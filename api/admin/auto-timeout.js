// api/admin/auto-timeout.js
// Serverless function (Vercel) that automatically times out interns
// who have clocked in but forgotten to clock out at the end of the
// workday (5:00 PM). This ensures attendance records are always
// complete and total_hours is calculated correctly.
//
// This function is intended to be triggered by a Vercel Cron Job
// (or any external scheduler) at 5:00 PM daily.
//
// Environment (server-only, NOT the VITE_* frontend vars):
//   SUPABASE_URL                 e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY    service-role key (secret, bypasses RLS)
//   SUPABASE_ANON_KEY            anon/public key (verifies the caller)
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;
const supabaseAnon = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * Resolve the caller's role from their session token.
 * Returns the profile row (with role) or null if unauthenticated/invalid.
 */
async function getCallerProfile(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!supabaseAnon) return null;
  const { data, error } = await supabaseAnon.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", data.user.id)
    .single();
  return profile || null;
}

export default async function handler(req, res) {
  // Fail fast with a clear message if the function is mis-configured.
  if (!supabaseAdmin || !supabaseAnon) {
    return res.status(500).json({
      error:
        "Server misconfiguration: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are not set for this serverless function.",
    });
  }

  // Only allow POST (or GET for manual testing).
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Only admins / HR staff may trigger this manually.
  // When triggered by a cron job, there is no caller — we allow it through.
  const caller = await getCallerProfile(req.headers.authorization);
  const isAdmin = caller && ["admin", "hr_staff"].includes(caller.role);
  const isCron = !req.headers.authorization; // Cron jobs have no auth header

  if (!isAdmin && !isCron) {
    return res.status(403).json({ error: "Forbidden: insufficient privileges" });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const fivePM = new Date(`${today}T17:00:00Z`);

    // Find all attendance records for today that have a time_in but no time_out.
    // These are interns who clocked in but forgot to clock out.
    const { data: openRecords, error: fetchError } = await supabaseAdmin
      .from("attendance")
      .select("id, intern_id, time_in, total_hours")
      .eq("date", today)
      .not("time_in", "is", null)
      .is("time_out", null);

    if (fetchError) {
      console.error("[AUTO-TIMEOUT] Failed to fetch open records:", fetchError.message);
      return res.status(500).json({ error: "Failed to fetch open attendance records" });
    }

    if (!openRecords || openRecords.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No open attendance records found.",
        timeoutCount: 0,
      });
    }

    // Update each open record: set time_out to 5:00 PM and recalculate total_hours.
    let timeoutCount = 0;
    const errors = [];

    for (const record of openRecords) {
      try {
        // Calculate total hours from time_in to 5:00 PM.
        const totalHours = calculateHours(record.time_in, fivePM.toISOString());

        const { error: updateError } = await supabaseAdmin
          .from("attendance")
          .update({
            time_out: fivePM.toISOString(),
            total_hours: totalHours,
            method: "auto-timeout",
          })
          .eq("id", record.id);

        if (updateError) {
          console.error(
            `[AUTO-TIMEOUT] Failed to timeout record ${record.id}:`,
            updateError.message,
          );
          errors.push({ id: record.id, error: updateError.message });
        } else {
          timeoutCount++;
          console.log(
            `[AUTO-TIMEOUT] Auto-timed out record ${record.id} for intern ${record.intern_id} at 5:00 PM. Total hours: ${totalHours}`,
          );
        }
      } catch (err) {
        console.error(`[AUTO-TIMEOUT] Unexpected error for record ${record.id}:`, err.message);
        errors.push({ id: record.id, error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Auto-timeout complete. ${timeoutCount} record(s) updated.`,
      timeoutCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[AUTO-TIMEOUT] Unexpected error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}

/**
 * Calculate the difference in hours between two ISO timestamps.
 * Returns 0 if either timestamp is invalid or if end <= start.
 */
function calculateHours(startISO, endISO) {
  if (!startISO || !endISO) return 0;
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round(((end - start) / 3_600_000) * 100) / 100;
}
