// src/services/dashboardService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

/**
 * Aggregated counts for dashboards. Each function degrades gracefully to zeros
 * when Supabase is not configured or the table is empty. In demo mode it reads
 * from the in-memory mock backend.
 */

async function count(table, query) {
  if (supabase) {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (query) q = query(q);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  }
  return 0;
}

export const dashboardService = {
  async adminStats() {
    if (supabase) {
      const [totalInterns, activeInterns, completed, pendingEvals, attendanceToday] = await Promise.all([
        count("interns"),
        count("interns", (q) => q.eq("status", "active")),
        count("interns", (q) => q.eq("status", "completed")),
        count("evaluations", (q) => q.neq("status", "completed")),
        count("attendance", (q) => q.eq("date", new Date().toISOString().slice(0, 10))),
      ]);
      return { totalInterns, activeInterns, completedInternships: completed, pendingEvaluations: pendingEvals, attendanceToday };
    }
    return mockBackend.adminStats();
  },

  async supervisorStats(supervisorId) {
    if (supabase) {
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
    }
    return mockBackend.supervisorStats(supervisorId);
  },

  async internStats(internId) {
    if (supabase) {
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
    }
    return mockBackend.internStats(internId);
  },
};
