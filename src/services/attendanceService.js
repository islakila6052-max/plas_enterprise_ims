// src/services/attendanceService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";
import { diffHours } from "@/utils/format";

/**
 * Attendance service. Time in/out, manual check-in, history and hour computation.
 * Falls back to the in-memory mock backend when Supabase is not configured.
 */

export const attendanceService = {
  /** Open (no time_out) attendance record for an intern today, if any. */
  async getOpen(internId) {
    if (supabase) {
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
    }
    return mockBackend.getOpenAttendance(internId);
  },

  async timeIn(internId, method = "manual") {
    if (supabase) {
      const today = new Date().toISOString().slice(0, 10);
      // Enforce one attendance record per day: reuse today's record if it exists
      // (open or already closed) instead of creating a duplicate.
      const { data: existing } = await supabase
        .from("attendance")
        .select("*")
        .eq("intern_id", internId)
        .eq("date", today)
        .maybeSingle();
      if (existing) {
        // Reuse today's record. If it was already closed (timed out),
        // reopen it so the intern can log a new session — matches the
        // demo backend's behaviour and avoids a stuck "can't time in" state.
        if (existing.time_out) {
          const { data, error } = await supabase
            .from("attendance")
            .update({ time_in: new Date().toISOString(), time_out: null, total_hours: 0, status: "present", method })
            .eq("id", existing.id)
            .select("*")
            .single();
          if (error) throw new Error(error.message);
          return data;
        }
        return existing;
      }
      const { data, error } = await supabase
        .from("attendance")
        .insert({ intern_id: internId, date: today, time_in: new Date().toISOString(), method, status: "present" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.timeIn(internId, method);
  },

  async timeOut(recordId, timeInISO) {
    if (supabase) {
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
    }
    return mockBackend.timeOut(recordId, timeInISO);
  },

  async list({ internId, date, page = 1, pageSize = 15 } = {}) {
    if (supabase) {
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
    }
    return mockBackend.listAttendance({ internId, date, page, pageSize });
  },

  async adminList({ date, supervisorId, page = 1, pageSize = 15 } = {}) {
    if (supabase) {
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
    }
    return mockBackend.adminListAttendance({ date, supervisorId, page, pageSize });
  },
};
