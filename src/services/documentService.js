// src/services/documentService.js
import { supabase } from "@/lib/supabase";
import { notify, notifyAll } from "@/services/activityService"; // ✅ Added import

const BUCKET = "intern-documents";

export const documentService = {
  async list({ internId, status, page = 1, pageSize = 15 } = {}) {
    let query = supabase
      .from("documents")
      .select("*, intern:interns(full_name, student_number, profile_id)", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (internId) query = query.eq("intern_id", internId);
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

      // ✅ Fixed: Only one admin notification
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
    } catch (err  ) {
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
};
