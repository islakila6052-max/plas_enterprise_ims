// src/services/evaluationService.js
import { supabase } from "@/lib/supabase";

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

  /**
   * Fetch evaluation stats with graceful degradation.
   * Returns safe defaults on network failure.
   */
  async getStats(internId) {
    if (!internId) return { totalEvaluations: 0, pendingCount: 0, averageScore: 0 };

    const [totalResult, pendingResult, scoresResult] = await Promise.all([
      safeQuery(() =>
        supabase.from("evaluations").select("*", { count: "exact", head: true }).eq("intern_id", internId)
      ),
      safeQuery(() =>
        supabase.from("evaluations").select("*", { count: "exact", head: true }).eq("intern_id", internId).eq("status", "pending")
      ),
      safeQuery(() =>
        supabase.from("evaluations").select("score").eq("intern_id", internId)
      ),
    ]);

    const scores = (scoresResult?.data ?? []).map((r) => Number(r.score)).filter((n) => !isNaN(n));
    const averageScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;

    return {
      totalEvaluations: totalResult?.count ?? 0,
      pendingCount: pendingResult?.count ?? 0,
      averageScore,
    };
  },
};
