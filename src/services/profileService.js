// src/services/profileService.js
import { supabase } from "@/lib/supabase";

/**
 * Profile service. Profiles store the user's role and identity, linked 1:1 to auth.users.
 * All data is sourced from the configured Supabase project.
 */

export const profileService = {
  /** Fetch the profile row for a given auth user id. */
  async getByUserId(userId) {
    if (!userId) return null;
    // NOTE: use an explicit column list (not select("*")). The profiles table
    // has a circular FK to supervisors (profiles.supervisor_id <>
    // supervisors.profile_id), and PostgREST returns 406 "could not serialize"
    // for select("*") on such tables. Explicit columns avoid that.
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, avatar_url, contact_number, bio, role, intern_id, supervisor_id, created_at, updated_at",
      )
      .eq("id", userId)
      .single();
    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(error.message);
    }
    return data;
  },

  /** Upsert the current user's profile (used after signup / profile edits). */
  async update(userId, updates) {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select(
        "id, full_name, email, avatar_url, contact_number, bio, role, intern_id, supervisor_id, created_at, updated_at",
      )
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** List all profiles (admin). */
  async list({ role, search, limit = 50, offset = 0 } = {}) {
    let query = supabase
      .from("profiles")
      .select(
        "id, full_name, email, avatar_url, contact_number, bio, role, intern_id, supervisor_id, created_at, updated_at",
        { count: "exact" },
      )
      .order("full_name", { ascending: true })
      .range(offset, offset + limit - 1);
    if (role) query = query.eq("role", role);
    if (search) query = query.ilike("full_name", `%${search}%`);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0 };
  },
};
