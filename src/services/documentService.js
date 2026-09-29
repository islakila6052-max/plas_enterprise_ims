// src/services/documentService.js
import { supabase } from "@/lib/supabase";
import { notify } from "@/services/activityService";

const BUCKET = "intern-documents";

/**
 * Best-effort MIME type from a filename, for when the browser reports an empty
 * `file.type` (common for Office documents on some OSes).
 */
function guessMimeType(name) {
  if (!name) return null;
  const ext = String(name).split(".").pop()?.toLowerCase();
  const map = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext] ?? null;
}

/**
 * Classify a document for inline preview.
 * Prefers the stored `mime_type`; falls back to the file extension so older
 * rows uploaded before `mime_type` was persisted still preview correctly.
 */
export function getPreviewKind(doc) {
  if (!doc) return "none";
  const mime = (doc.mime_type || "").toLowerCase();
  const ext = (doc.file_name || doc.label || "").split(".").pop()?.toLowerCase();

  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext))
    return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  return "none";
}


/**
 * Safely execute a Supabase query, returning null on network failure.
 * Used for non-critical queries that should not crash the UI.
 */
async function safeQuery(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error("[IMS] Safe query failed:", err.message);
    return null;
  }
}

export const documentService = {
  async list({ internId, status, supervisorId, page = 1, pageSize = 15 } = {}) {
    // Supervisors scope to their own interns. This needs an INNER join on
    // `interns` so PostgREST can filter parent rows by the embedded
    // `intern.supervisor_id` — a LEFT join cannot be filtered and would
    // silently return every document in the system.
    const internEmbed = supervisorId
      ? "intern:interns!inner(first_name, last_name, full_name, profile_id)"
      : "intern:interns(first_name, last_name, full_name, profile_id)";
    let query = supabase
      .from("documents")
      .select(`*, ${internEmbed}`, {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (internId) query = query.eq("intern_id", internId);
    if (supervisorId) query = query.eq("intern.supervisor_id", supervisorId);
    if (status) query = query.eq("status", status);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0 };
  },

  async upload({ internId, type, file, label }) {
    const path = `${internId}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const { data, error } = await supabase
      .from("documents")
      .insert({
        intern_id: internId,
        type,
        label: label || type,
        file_path: path,
        file_url: urlData.publicUrl,
        file_name: file?.name ?? `${type}.pdf`,
        // Persist the MIME type and byte size. Without these the UI had no way
        // to know whether a document could be rendered inline, so every preview
        // fell back to a "cannot preview" placeholder. `file.type` can be empty
        // for some browsers/OSes, so fall back to a name-based guess.
        mime_type: file?.type || guessMimeType(file?.name),
        file_size: file?.size ?? null,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Notify supervisor + admin about new document
    try {
      const { data: intern } = await supabase
        .from("interns")
        .select("full_name, supervisor_id")
        .eq("id", internId)
        .single();

      if (intern?.supervisor_id) {
        const { data: supProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", intern.supervisor_id)
          .single();
        if (supProfile?.id) {
          await notify({
            user_id: supProfile.id,
            type: "document_review",
            title: "New document submitted",
            message: `${intern.full_name || "An intern"} submitted a document for review.`,
            link: "/supervisor/documents",
            metadata: { intern_id: internId, document_id: data.id },
          });
        }
      }

      // Only one admin notification
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      for (const admin of adminProfiles || []) {
        await notify({
          user_id: admin.id,
          type: "document_review",
          title: "New document submitted",
          message: `${intern?.full_name || "An intern"} submitted a document for review.`,
          link: "/admin/documents",
          metadata: { intern_id: internId, document_id: data.id },
        });
      }
    } catch (err) {
      console.error("[DOCUMENT NOTIFICATION] Failed:", err);
    }

    return data;
  },

  async review(id, status) {
    const { data, error } = await supabase
      .from("documents")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Notify intern about review
    try {
      const { data: document } = await supabase
        .from("documents")
        .select("*, intern:interns(full_name, profile_id)")
        .eq("id", id)
        .single();

      if (document?.intern?.profile_id) {
        await notify({
          user_id: document.intern.profile_id,
          type: "document_review",
          title: `Document ${status}`,
          message: `Your document "${document.file_name ?? document.label}" was ${status}.`,
          link: "/intern/documents",
          metadata: { document_id: id, status },
        });
      }
    } catch (err) {
      console.error("[DOCUMENT REVIEW NOTIFICATION] Failed:", err);
    }

    return data;
  },

  async downloadUrl(filePath) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  },

  async remove(id, filePath) {
    if (filePath) await supabase.storage.from(BUCKET).remove([filePath]);
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  },

  /**
   * Fetch document count with graceful degradation.
   * Returns safe defaults on network failure.
   */
  async getStats(internId) {
    if (!internId) return { totalDocuments: 0 };

    const result = await safeQuery(() =>
      supabase.from("documents").select("*", { count: "exact", head: true }).eq("intern_id", internId)
    );

    return { totalDocuments: result?.count ?? 0 };
  },
};
