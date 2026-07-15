import { supabase } from "@/lib/supabase";
import { diffHours } from "@/utils/format";

/**
 * Attendance service. Time in/out, manual check-in, history and hour computation.
 */

export const attendanceService = {
  /** Open (no time_out) attendance record for an intern today, if any. */
  async getOpen(internId) {
    if (!supabase || !internId) return null;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("intern_id", internId)
      .eq("date", today)
      .is("time_out", null)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async timeIn(internId, method = "manual") {
    if (!supabase) throw new Error("Supabase is not configured.");
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("attendance")
      .insert({
        intern_id: internId,
        date: today,
        time_in: new Date().toISOString(),
        method,
        status: "present",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async timeOut(recordId, timeInISO) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const timeOut = new Date().toISOString();
    const total = diffHours(timeInISO, timeOut);
    const { data, error } = await supabase
      .from("attendance")
      .update({ time_out: timeOut, total_hours: total })
      .eq("id", recordId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async list({ internId, date, page = 1, pageSize = 15 } = {}) {
    if (!supabase) return { data: [], count: 0 };
    let query = supabase
      .from("attendance")
      .select("*", { count: "exact" })
      .order("date", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (internId) query = query.eq("intern_id", internId);
    if (date) query = query.eq("date", date);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0 };
  },

  async adminList({ date, page = 1, pageSize = 15 } = {}) {
    if (!supabase) return { data: [], count: 0 };
    let query = supabase
      .from("attendance")
      .select("*, intern:interns(full_name, student_number)", { count: "exact" })
      .order("date", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (date) query = query.eq("date", date);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0 };
  },
};
