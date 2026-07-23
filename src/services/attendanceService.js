// src/services/attendanceService.js
import { supabase } from "@/lib/supabase";
import { diffHours } from "@/utils/format";

/**
 * Attendance service. Time in/out, manual check-in, history and hour computation.
 * All data is sourced from Supabase.
 */

export const attendanceService = {
  /** Open (no time_out) attendance record for an intern today, if any. */
  async getOpen(internId) {
    if (!internId) return null;
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

  /** Today's attendance record (open or closed) for an intern, if any. */
  async getToday(internId) {
    if (!internId) return null;
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("intern_id", internId)
      .eq("date", today)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async timeIn(internId, method = "manual") {
    const today = new Date().toISOString().slice(0, 10);
    // Enforce one attendance record per intern per day.
    // If a record already exists (open or closed), reject the request.
    const { data: existing } = await supabase
      .from("attendance")
      .select("*")
      .eq("intern_id", internId)
      .eq("date", today)
      .maybeSingle();
    if (existing) {
      throw new Error("You have already submitted your attendance for today.");
    }
    const { data, error } = await supabase
      .from("attendance")
      .insert({ intern_id: internId, date: today, time_in: new Date().toISOString(), method, status: "present" })
      .select("*")
      .single();
    if (error) {
      // Catch duplicate-key violations from the database-level unique index
      // in case a race condition bypassed the existence check above.
      if (error.code === "23505") {
        throw new Error("You have already submitted your attendance for today.");
      }
      throw new Error(error.message);
    }
    return data;
  },

  async timeOut(recordId, timeInISO) {
    // Enforce at most one time-out per attendance record.
    const { data: existing } = await supabase
      .from("attendance")
      .select("time_out")
      .eq("id", recordId)
      .maybeSingle();
    if (!existing) {
      throw new Error("Attendance record not found.");
    }
    if (existing.time_out) {
      throw new Error("You have already timed out for today.");
    }
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
    let query = supabase
      .from("attendance")
      .select("*", { count: "exact" })
      .order("date", { ascending: false })
      .order("time_in", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (internId) query = query.eq("intern_id", internId);
    if (date) query = query.eq("date", date);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0 };
  },

  async adminList({ date, supervisorId, page = 1, pageSize = 15 } = {}) {
    let query = supabase
      .from("attendance")
      .select("*, intern:interns(full_name, student_number, supervisor_id)", { count: "exact" })
      .order("date", { ascending: false })
      .order("time_in", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (date) query = query.eq("date", date);
    // Filter to this supervisor's interns server-side (the embedded
    // intern.supervisor_id column is what the UI previously read client-side).
    if (supervisorId) query = query.eq("intern.supervisor_id", supervisorId);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0 };
  },
};
