// src/services/evaluationService.js
import { supabase } from "@/lib/supabase";

export const evaluationService = {
  async list({ internId, supervisorId, status, page = 1, pageSize = 15 } = {}) {
    let query = supabase
      .from("evaluations")
      .select("*, intern:interns(full_name, student_number)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (internId) query = query.eq("intern_id", internId);
    if (supervisorId) query = query.eq("supervisor_id", supervisorId);
    if (status) query = query.eq("status", status);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0 };
  },

  async get(id) {
    const { data, error } = await supabase.from("evaluations").select("*").eq("id", id).single();
    if (error) throw new Error(error.message);
    return data;
  },

  async create(payload) {
    const { data, error } = await supabase.from("evaluations").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase.from("evaluations").update(payload).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  },
};
