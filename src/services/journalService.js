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
      // Resolve supervisor_id from the intern's record when not provided,
      // so the supervisor's journal list (filtered by supervisor_id) sees it.
      const finalPayload = { ...payload };
      if (!finalPayload.supervisor_id && finalPayload.intern_id) {
        const { data: intern } = await supabase
          .from("interns")
          .select("supervisor_id")
          .eq("id", finalPayload.intern_id)
          .single();
        if (intern?.supervisor_id) finalPayload.supervisor_id = intern.supervisor_id;
      }
      const { data, error } = await supabase.from("daily_journals").insert(finalPayload).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.createJournal(payload);
  },

  async review(id, status, supervisorId, comment) {
    if (supabase) {
      // Only set supervisor_id when one is provided. Passing null here would
      // wipe the link the supervisor's journal list + RLS depend on.
      const patch = { status, supervisor_comment: comment };
      if (supervisorId) patch.supervisor_id = supervisorId;
      const { data, error } = await supabase
        .from("daily_journals")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.reviewJournal(id, status, supervisorId, comment);
  },
};
