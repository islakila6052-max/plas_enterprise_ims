import { supabase } from "@/lib/supabase";

/**
 * Profile service. Profiles store the user's role and identity, linked 1:1 to auth.users.
 */

export const profileService = {
  /** Fetch the profile row for a given auth user id. */
  async getByUserId(userId) {
    if (!supabase || !userId) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) {
      // A missing profile is not fatal during bootstrap.
      if (error.code === "PGRST116") return null;
      throw new Error(error.message);
    }
    return data;
  },

  /** Upsert the current user's profile (used after signup / profile edits). */
  async update(userId, updates) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** List all profiles (admin). */
  async list({ role, search, limit = 50, offset = 0 } = {}) {
    if (!supabase) return [];
    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("full_name", { ascending: true })
      .range(offset, offset + limit - 1);
    if (role) query = query.eq("role", role);
    if (search) query = query.ilike("full_name", `%${search}%`);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0 };
  },
};
