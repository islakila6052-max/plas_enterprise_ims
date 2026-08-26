import { supabase } from "@/lib/supabase";

/**
 * Central place to record admin/supervisor/intern actions (audit_logs) and
 * push per-user notifications. Both are best-effort: a failure here should
 * never break the primary CRUD operation.
 */

/**
 * Build a field-level diff between the previous and next state of a record.
 * Only fields that actually changed are included. Every entry is stored as
 * an explicit { from, to } pair so both the previous value and the updated
 * value remain available in the audit log even after the original record is
 * modified or deleted.
 *
 *   auditDiff({ name: "A" }, { name: "B", role: "x" })
 *   // => { name: { from: "A", to: "B" }, role: { from: null, to: "x" } }
 */
export function auditDiff(previous = {}, next = {}) {
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  const changes = {};
  for (const key of keys) {
    const from = previous[key] ?? null;
    const to = next[key] ?? null;
    if (String(from) !== String(to)) changes[key] = { from, to };
  }
  return changes;
}

/**
 * Snapshot of values for CREATE actions — no previous value exists, so every
 * entry records `from: null` plus the created value.
 */
export function auditCreated(values = {}) {
  const changes = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) changes[key] = { from: null, to: value ?? null };
  }
  return changes;
}

/**
 * Snapshot of values for DELETE actions — captures what existed immediately
 * before deletion as `from`, with no updated value (`to: null`).
 */
export function auditDeleted(values = {}) {
  const changes = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) changes[key] = { from: value ?? null, to: null };
  }
  return changes;
}

/**
 * Normalize any legacy changes shape into { from, to } pairs so old flat
 * entries ({ field: value }) still render correctly.
 */
function normalizeChanges(changes) {
  if (!changes || typeof changes !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(changes)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !(value instanceof Date) &&
      ("from" in value || "to" in value)
    ) {
      out[key] = { from: value.from ?? null, to: value.to ?? null };
    } else {
      out[key] = { from: null, to: value ?? null };
    }
  }
  return out;
}

export async function recordAudit(entry) {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      user_id: entry.user_id,
      action: entry.action, // create | update | delete | review | login
      resource_type: entry.resource_type,
      resource_id: entry.resource_id ?? null,
      changes: normalizeChanges(entry.changes),
      ip_address: entry.ip_address ?? null,
      user_agent: entry.user_agent ?? null,
    });
    if (error) throw error;
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
    if (error)
      console.error("[NOTIFICATION] Failed to create notification:", error);
  } catch (err) {
    console.error("[NOTIFICATION] Unexpected error:", err);
  }
}

/** Fetch all profile ids for a role. Internal helper, not exported. */
async function getProfileIdsByRole(role) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", role);
  return data ?? [];
}

async function getInternProfile(internId) {
  if (!internId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", internId)
    .single();
  return data;
}

/**
 * Core fan-out: builds and inserts notifications for admins, supervisors,
 * and (optionally) one intern, in a single batch insert.
 *
 * `resolve(role)` lets callers customize type/title/message/link per role
 * (admin | supervisor | intern), falling back to the shared defaults.
 */
async function fanOutNotifications({ internId, metadata, resolve }) {
  try {
    const [adminProfiles, supervisorProfiles, internProfile] =
      await Promise.all([
        getProfileIdsByRole("admin"),
        getProfileIdsByRole("supervisor"),
        getInternProfile(internId),
      ]);

    const notifications = [];

    for (const admin of adminProfiles) {
      const r = resolve("admin");
      if (r)
        notifications.push({
          user_id: admin.id,
          metadata: metadata ?? {},
          ...r,
        });
    }
    for (const supervisor of supervisorProfiles) {
      const r = resolve("supervisor");
      if (r)
        notifications.push({
          user_id: supervisor.id,
          metadata: metadata ?? {},
          ...r,
        });
    }
    if (internProfile?.id) {
      const r = resolve("intern");
      if (r)
        notifications.push({
          user_id: internProfile.id,
          metadata: metadata ?? {},
          ...r,
        });
    }

    if (notifications.length > 0) {
      const { error } = await supabase
        .from("notifications")
        .insert(notifications);
      if (error)
        console.error(
          "[NOTIFICATION FANOUT] Failed to create notifications:",
          error,
        );
    }
  } catch (err) {
    console.error("[NOTIFICATION FANOUT] Unexpected error:", err);
  }
}

/** Notify all admins + supervisors + (optional) one intern with the same content. */
export async function notifyAll(payload) {
  return fanOutNotifications({
    internId: payload.internId,
    metadata: payload.metadata,
    resolve: () => ({
      type: payload.type,
      title: payload.title,
      message: payload.message,
      link: payload.link ?? null,
    }),
  });
}

/** Alias kept for backwards compatibility with existing callers. */
export async function notifyAllWithType(payload) {
  return notifyAll(payload);
}

/**
 * Notify all three subjects, but allow per-role overrides
 * (adminType/adminTitle/adminMessage/adminLink, supervisorX, internX).
 * Falls back to the shared `type`/`title`/`message`/`link` when a role-specific
 * field isn't provided.
 */
export async function notifyAllForAction(payload) {
  return fanOutNotifications({
    internId: payload.internId,
    metadata: payload.metadata,
    resolve: (role) => ({
      type: payload[`${role}Type`] || payload.type,
      title: payload[`${role}Title`] || payload.title,
      message: payload[`${role}Message`] || payload.message,
      link: payload[`${role}Link`] || payload.link || null,
    }),
  });
}

/** Same as notifyAllForAction, but with safe string defaults if nothing is set. */
export async function notifyAllForActionWithTypes(payload) {
  return fanOutNotifications({
    internId: payload.internId,
    metadata: payload.metadata,
    resolve: (role) => ({
      type: payload[`${role}Type`] || payload.type || "announcement",
      title: payload[`${role}Title`] || payload.title || "Notification",
      message:
        payload[`${role}Message`] ||
        payload.message ||
        "You have a new notification.",
      link: payload[`${role}Link`] || payload.link || null,
    }),
  });
}
