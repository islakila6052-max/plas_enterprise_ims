// src/services/activityService.js
import { supabase } from "@/lib/supabase";

/**
 * Central place to record admin/supervisor actions (audit_logs) and to push
 * per-user notifications. Both are best-effort: a failure here should never
 * break the primary CRUD operation, so every call is wrapped in try/catch by
 * the caller or swallowed here.
 *
 * Data is written to the Supabase `audit_logs` and `notifications` tables.
 */

/** Record an audit entry. `user_id` is required (the acting profile id). */
export async function recordAudit(entry) {
  try {
    const { error } = await supabase
      .from("audit_logs")
      .insert({
        user_id: entry.user_id,
        action: entry.action, // create | update | delete | review | login
        resource_type: entry.resource_type,
        resource_id: entry.resource_id ?? null,
        changes: entry.changes ?? {},
        ip_address: entry.ip_address ?? null,
        user_agent: entry.user_agent ?? null,
      });
    if (error) throw error;
    return;
  } catch {
    /* non-fatal: never block the main action */
  }
}

/** Notify a specific user. */
export async function notify(payload) {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
      metadata: payload.metadata ?? {},
    });
    if (error) throw error;
    return;
  } catch {
    /* non-fatal */
  }
}
