// src/services/dashboardService.js
import { supabase } from "@/lib/supabase";

/**
 * Aggregated counts or dashboards. Each function degrades gracefully to zeros
 * when a table is empty. All data is sourced from Supabase.
 */

async function count(table, query) {
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (query) q = query(q);
  const { count, error } = await q;
  if (error) {
    // A single failing count (e.g. an unauthenticated request, or a filter
    // the gateway rejects) must never break the whole dashboard. Degrade to 0.
    console.error(`[IMS] count(${table}) failed:`, error.message);
    return 0;
  }
  return count ?? 0;
}

export const dashboardService = {
  async adminStats() {
    const [totalInterns, activeInterns, completed, pendingEvals, attendanceToday] = await Promise.all([
      count("interns"),
      count("interns", (q) => q.eq("status", "active")),
      count("interns", (q) => q.eq("status", "completed")),
      // NOTE: `neq` on an enum column can be rejected by the gateway in some
      // configurations. Compute "pending" (the only other live status) and
      // treat that as the pending-evaluation count instead of `neq.completed`.
      count("evaluations", (q) => q.eq("status", "pending")),
      count("attendance", (q) => q.eq("date", new Date().toISOString().slice(0, 10))),
    ]);
    return { totalInterns, activeInterns, completedInternships: completed, pendingEvaluations: pendingEvals, attendanceToday };
  },

  async supervisorStats(supervisorId) {
    // `attendance` has no supervisor_id column (only intern_id), so count
    // today's attendance via the supervisor's assigned interns.
    const { data: internRows, error: internErr } = await supabase
      .from("interns")
      .select("id")
      .eq("supervisor_id", supervisorId);
    if (internErr) return { assignedInterns: 0, attendanceToday: 0, pendingJournals: 0, pendingEvaluations: 0 };
    const internIds = (internRows ?? []).map((i) => i.id);
    const today = new Date().toISOString().slice(0, 10);
    const [assigned, attendanceToday, pendingJournals, pendingEvals] = await Promise.all([
      count("interns", (q) => q.eq("supervisor_id", supervisorId).eq("status", "active")),
      internIds.length
        ? count("attendance", (q) => q.in("intern_id", internIds).eq("date", today))
        : Promise.resolve(0),
      count("daily_journals", (q) => q.eq("supervisor_id", supervisorId).eq("status", "pending")),
      count("evaluations", (q) => q.eq("supervisor_id", supervisorId).eq("status", "pending")),
    ]);
    return { assignedInterns: assigned, attendanceToday, pendingJournals, pendingEvaluations: pendingEvals };
  },

  async internStats(internId) {
    const today = new Date().toISOString().slice(0, 10);
    const [hoursRows, required, attendanceToday, announcements] = await Promise.all([
      internId
        ? supabase
            .from("attendance")
            .select("total_hours")
            .eq("intern_id", internId)
            .then((r) => r.data ?? [])
        : [],
      supabase
        .from("interns")
        .select("required_hours")
        .eq("id", internId)
        .single()
        .then((r) => r.data?.required_hours ?? 0)
        .catch(() => 0),
      count("attendance", (q) => q.eq("intern_id", internId).eq("date", today)),
      count("announcements"),
    ]);
    const rendered = (hoursRows ?? []).reduce(
      (sum, r) => sum + (Number(r.total_hours) || 0),
      0,
    );
    const requiredHours = Number(required) || 0;
    return {
      hoursRendered: Math.round(rendered * 100) / 100,
      requiredHours,
      remainingHours: Math.max(0, requiredHours - rendered),
      todayAttendance: attendanceToday,
      latestAnnouncements: announcements,
    };
  },
};
