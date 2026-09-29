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
  async list({ internId, supervisorId, status, ratingMin, ratingMax, recommendation, search = "", page = 1, pageSize = 15 } = {}) {
    // When searching we need an INNER join on the intern so PostgREST can
    // filter parent rows by the embedded intern's name (server-side search
    // that works correctly with pagination and exact counts).
    const internEmbed = search
      ? "intern:interns!inner(full_name, last_name)"
      : "intern:interns(full_name, last_name)";
    let query = supabase
      .from("evaluations")
      .select(`*, ${internEmbed}`, { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (search) query = query.ilike("intern.full_name", `%${search.trim()}%`);
    if (internId) query = query.eq("intern_id", internId);
    if (supervisorId) query = query.eq("supervisor_id", supervisorId);
    if (status) query = query.eq("status", status);
    if (ratingMin) query = query.gte("overall_rating", Number(ratingMin));
    if (ratingMax) query = query.lte("overall_rating", Number(ratingMax));
    if (recommendation) query = query.eq("final_recommendation", recommendation);
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
   *
   * NOTE: `evaluations` has no `score` column — the six criteria columns plus
   * `overall_rating` are the only numeric scores. Querying a non-existent
   * "score" column made PostgREST return an error, which safeQuery swallowed,
   * so `averageScore` was silently always 0. Select the real columns instead
   * and compute the average in JS from whichever values are present.
   */
  async getStats(internId) {
    if (!internId) return { totalEvaluations: 0, pendingCount: 0, averageScore: 0 };

    const SCORE_COLUMNS = [
      "attendance",
      "communication",
      "teamwork",
      "initiative",
      "technical_skills",
      "professionalism",
    ].join(",");

    const [totalResult, pendingResult, rowsResult] = await Promise.all([
      safeQuery(() =>
        supabase.from("evaluations").select("*", { count: "exact", head: true }).eq("intern_id", internId)
      ),
      safeQuery(() =>
        supabase.from("evaluations").select("*", { count: "exact", head: true }).eq("intern_id", internId).eq("status", "pending")
      ),
      safeQuery(() =>
        supabase
          .from("evaluations")
          .select(`overall_rating,${SCORE_COLUMNS}`)
          .eq("intern_id", internId)
      ),
    ]);

    // Average every evaluation's own overall score when the supervisor entered
    // one; otherwise fall back to the mean of that row's six criteria so the
    // number is still meaningful instead of 0.
    const perRowScores = (rowsResult?.data ?? []).map((row) => {
      const overall = Number(row.overall_rating);
      if (overall > 0) return overall;
      const criteria = SCORE_COLUMNS.split(",")
        .map((c) => Number(row[c]))
        .filter((n) => n > 0);
      if (criteria.length === 0) return null;
      return criteria.reduce((a, b) => a + b, 0) / criteria.length;
    }).filter((n) => n != null);

    const averageScore =
      perRowScores.length > 0
        ? Math.round((perRowScores.reduce((a, b) => a + b, 0) / perRowScores.length) * 100) / 100
        : 0;

    return {
      totalEvaluations: totalResult?.count ?? 0,
      pendingCount: pendingResult?.count ?? 0,
      averageScore,
    };
  },
};