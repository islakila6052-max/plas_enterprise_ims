// src/services/attendanceService.js
import { supabase } from "@/lib/supabase";
import { diffHours, todayDateInAttendanceTZ } from "@/utils/format";

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

/**
 * Attendance service. Time in/out, manual check-in, history and hour computation.
 * All data is sourced from Supabase.
 */

export const attendanceService = {
  /** Open (no time_out) attendance record for an intern today, if any. */
  async getOpen(internId) {
    if (!internId) return null;
    const today = todayDateInAttendanceTZ();
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
    const today = todayDateInAttendanceTZ();
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
    const today = todayDateInAttendanceTZ();
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
      .insert({
        intern_id: internId,
        date: today,
        time_in: new Date().toISOString(),
        method,
        status: "present",
      })
      .select("*")
      .single();
    if (error) {
      // Catch duplicate-key violations from the database-level unique index
      // in case a race condition bypassed the existence check above.
      if (error.code === "23505") {
        throw new Error(
          "You have already submitted your attendance for today.",
        );
      }
      throw new Error(error.message);
    }
    return data;
  },

  // src/services/attendanceService.js (partial update - replace the timeOut method)

  // src/services/attendanceService.js

  async timeOut(recordId, timeOutISO, remarks = null) {
    // Enforce at most one time-out per attendance record.
    const { data: existing } = await supabase
      .from("attendance")
      .select("time_out, time_in")
      .eq("id", recordId)
      .maybeSingle();
    if (!existing) {
      throw new Error("Attendance record not found.");
    }
    if (existing.time_out) {
      throw new Error("You have already timed out for today.");
    }

    // Calculate total hours from time_in to the provided timeOut
    const total = diffHours(existing.time_in, timeOutISO);
    const { data, error } = await supabase
      .from("attendance")
      .update({
        time_out: timeOutISO,
        total_hours: total,
        remarks: remarks || null,
        method: "manual",
      })
      .eq("id", recordId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Submit a missed clock-out claim for an attendance record that has a
   * time_in but no time_out. The claim is subject to supervisor approval.
   * @param {string} recordId - Attendance record id
   * @param {string} claimedTimeOutISO - ISO timestamp the intern claims they left
   * @param {string} remarks - Reason for the missed clock-out
   */
  async submitClaim(recordId, claimedTimeOutISO, remarks) {
    const { data: existing } = await supabase
      .from("attendance")
      .select("time_out, time_in, claim_status")
      .eq("id", recordId)
      .maybeSingle();
    if (!existing) {
      throw new Error("Attendance record not found.");
    }
    if (existing.time_out) {
      throw new Error("This attendance record already has a time out.");
    }
    if (existing.claim_status === "pending") {
      throw new Error("You already have a pending claim for this record.");
    }
    if (existing.claim_status === "approved") {
      throw new Error("This claim has already been approved.");
    }

    const { data, error } = await supabase
      .from("attendance")
      .update({
        claimed_time_out: claimedTimeOutISO,
        claim_status: "pending",
        claim_remarks: remarks || null,
      })
      .eq("id", recordId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Review a missed clock-out claim. On approval, the claimed time becomes
   * the official time_out and total_hours are recomputed.
   * @param {string} recordId - Attendance record id
   * @param {"approved"|"rejected"} decision - Approve or reject the claim
   * @param {string} reviewerProfileId - Profile id of the reviewing supervisor
   * @param {string} [comment] - Optional supervisor comment
   */
  async reviewClaim(recordId, decision, reviewerProfileId, comment = null) {
    const { data: existing } = await supabase
      .from("attendance")
      .select("time_out, time_in, claimed_time_out, claim_status")
      .eq("id", recordId)
      .maybeSingle();
    if (!existing) {
      throw new Error("Attendance record not found.");
    }
    if (!existing.claimed_time_out) {
      throw new Error("No claim exists for this attendance record.");
    }
    if (existing.claim_status !== "pending") {
      throw new Error("This claim has already been reviewed.");
    }

    const patch = {
      claim_status: decision,
      claim_reviewed_by: reviewerProfileId,
      claim_reviewed_at: new Date().toISOString(),
      claim_review_comment: comment || null,
    };

    // Populate the attendance remarks with the supervisor's review comment so
    // the intern can see what the supervisor communicated about the claim.
    if (comment) {
      patch.remarks = comment;
    }

    // On approval, apply the claimed time as the official time_out and
    // recompute total hours.
    if (decision === "approved") {
      patch.time_out = existing.claimed_time_out;
      patch.total_hours = diffHours(
        existing.time_in,
        existing.claimed_time_out,
      );
      patch.method = "claimed";
    }

    // On rejection, the intern has no valid time-out for the day, so mark
    // the attendance status as absent instead of leaving it as present.
    if (decision === "rejected") {
      patch.status = "absent";
    }

    const { data, error } = await supabase
      .from("attendance")
      .update(patch)
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

  async adminList({
    dateFrom,
    dateTo,
    supervisorId,
    page = 1,
    pageSize = 15,
  } = {}) {
    let query = supabase
      .from("attendance")
      .select("*, intern:interns(full_name, student_number, supervisor_id)", {
        count: "exact",
      })
      .order("date", { ascending: false })
      .order("time_in", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (dateFrom) query = query.gte("date", dateFrom);
    if (dateTo) query = query.lte("date", dateTo);
    // Filter to this supervisor's interns server-side (the embedded
    // intern.supervisor_id column is what the UI previously read client-side).
    if (supervisorId) query = query.eq("intern.supervisor_id", supervisorId);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0 };
  },

  /**
   * Fetch attendance stats with graceful degradation.
   * Returns safe defaults on network failure.
   */
  async getStats(internId) {
    if (!internId) return { presentToday: 0, totalHours: 0 };

    const today = todayDateInAttendanceTZ();
    const [attendanceResult, hoursResult] = await Promise.all([
      safeQuery(() =>
        supabase
          .from("attendance")
          .select("*", { count: "exact", head: true })
          .eq("intern_id", internId)
          .eq("date", today),
      ),
      safeQuery(() =>
        supabase
          .from("attendance")
          .select("total_hours")
          .eq("intern_id", internId),
      ),
    ]);

    const totalHours = (hoursResult?.data ?? []).reduce(
      (sum, r) => sum + (Number(r.total_hours) || 0),
      0,
    );

    return {
      presentToday: attendanceResult?.count ?? 0,
      totalHours: Math.round(totalHours * 100) / 100,
    };
  },
};
