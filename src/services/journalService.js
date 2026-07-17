// src/services/journalService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

export const journalService = {
  async list({ internId, status, supervisorId, page = 1, pageSize = 15 } = {}) {
    if (supabase) {
      let query = supabase
        .from("daily_journals")
        .select("*, intern:interns(full_name, student_number)", { count: "exact" })
        .order("date", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (internId) query = query.eq("intern_id", internId);
      if (status) query = query.eq("status", status);
      if (supervisorId) query = query.eq("supervisor_id", supervisorId);
      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return { data: data ?? [], count: count ?? 0 };
    }
    return mockBackend.listJournals({ internId, status, supervisorId, page, pageSize });
  },

  async create(payload) {
    if (supabase) {
      const { data, error } = await supabase.from("daily_journals").insert(payload).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.createJournal(payload);
  },

  async review(id, status, supervisorId, comment) {
    if (supabase) {
      const { data, error } = await supabase
        .from("daily_journals")
        .update({ status, supervisor_id: supervisorId, supervisor_comment: comment })
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.reviewJournal(id, status, supervisorId, comment);
  },
};
