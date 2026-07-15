import { supabase } from "@/lib/supabase";

/**
 * Aggregated counts for dashboards. Each function degrades gracefully to zeros
 * when Supabase is not configured or the table is empty.
 */

async function count(table, query) {
  if (!supabase) return 0;
  let q = supabase.from(table).select("*", { count: "exact", head: true });
  if (query) q = query(q);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

export const dashboardService = {
  async adminStats() {
    const [totalInterns, activeInterns, completed, pendingEvals, attendanceToday] =
      await Promise.all([
        count("interns"),
        count("interns", (q) => q.eq("status", "active")),
        count("interns", (q) => q.eq("status", "completed")),
        count("evaluations", (q) => q.eq("status", "pending")),
        count(
          "attendance",
          (q) => q.eq("date", new Date().toISOString().slice(0, 10)),
        ),
      ]);
    return {
      totalInterns,
      activeInterns,
      completedInternships: completed,
      pendingEvaluations: pendingEvals,
      attendanceToday,
    };
  },

  async supervisorStats(supervisorId) {
    const base = (q) =>
      supervisorId ? q.eq("supervisor_id", supervisorId) : q;
    const [assigned, attendanceToday, pendingJournals, pendingEvals] =
      await Promise.all([
        count("interns", (q) => base(q).eq("status", "active")),
        count(
          "attendance",
          (q) =>
            base(q).eq("date", new Date().toISOString().slice(0, 10)),
        ),
        count("daily_journals", (q) => base(q).eq("status", "pending")),
        count("evaluations", (q) => base(q).eq("status", "pending")),
      ]);
    return { assignedInterns: assigned, attendanceToday, pendingJournals, pendingEvaluations: pendingEvals };
  },

  async internStats(internId) {
    const today = new Date().toISOString().slice(0, 10);
    const [hoursRows, required, attendanceToday, announcements] = await Promise.all([
      internId
        ? supabase
          ?.from("attendance")
            .select("total_hours")
            .eq("intern_id", internId)
        : { data: [] },
      supabase
        ?.from("interns")
          .select("required_hours")
          .eq("id", internId)
          .single()
          .then((r) => r.data?.required_hours ?? 0)
          .catch(() => 0),
      count("attendance", (q) => q.eq("intern_id", internId).eq("date", today)),
      count("announcements"),
    ]);
    const rendered = hoursRows?.data?.reduce(
      (sum, r) => sum + (Number(r.total_hours) || 0),
      0,
    ) ?? 0;
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
