// src/services/documentService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

const BUCKET = "intern-documents";

export const documentService = {
  async list({ internId, status, page = 1, pageSize = 15 } = {}) {
    if (supabase) {
      let query = supabase
        .from("documents")
        .select("*, intern:interns(full_name, student_number)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (internId) query = query.eq("intern_id", internId);
      if (status) query = query.eq("status", status);
      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return { data: data ?? [], count: count ?? 0 };
    }
    return mockBackend.listDocuments({ internId, status, page, pageSize });
  },

  /** Upload a file to Supabase Storage and create the document row. */
  async upload({ internId, type, file, label }) {
    if (supabase) {
      const path = `${internId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
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
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.uploadDocument({
      internId,
      type,
      label,
      file_name: file?.name ?? `${type}.pdf`,
    });
  },

  async review(id, status) {
    if (supabase) {
      const { data, error } = await supabase.from("documents").update({ status }).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.reviewDocument(id, status);
  },

  /** Signed URL for secure download. */
  async downloadUrl(filePath) {
    if (supabase) {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    }
    // Demo mode: simulate a download by generating a small placeholder file.
    return null;
  },

  async remove(id, filePath) {
    if (supabase) {
      if (filePath) await supabase.storage.from(BUCKET).remove([filePath]);
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    return mockBackend.removeDocument(id);
  },
};
