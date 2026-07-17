// src/services/auditLogService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

/**
 * Audit log service. Append-only activity trail keyed by user, resource type
 * and resource id. In demo mode it falls back to the in-memory mock backend.
 *
 * Table columns (see DATABASE_SCHEMA.md):
 *   id, user_id, action, resource_type, resource_id, changes, ip_address,
 *   user_agent, created_at
 */

export const auditLogService = {
  /** List audit logs, optionally filtered by resource. Newest first. */
  async list({ resourceType = "", resourceId = "", limit = 100 } = {}) {
    if (supabase) {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (resourceType) query = query.eq("resource_type", resourceType);
      if (resourceId) query = query.eq("resource_id", resourceId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    return mockBackend.listAuditLogs({ resourceType, resourceId, limit });
  },

  /** Create an audit log entry (system/admin flows). */
  async create(payload) {
    if (supabase) {
      const { data, error } = await supabase
        .from("audit_logs")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.createAuditLog(payload);
  },
};
