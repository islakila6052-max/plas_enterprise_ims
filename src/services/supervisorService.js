import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

export const supervisorService = {
  async list() {
    if (supabase) {
      const { data, error } = await supabase
        .from("supervisors")
        .select(
          "*, profile:profiles(full_name, email), department:departments(name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    return mockBackend.listSupervisors();
  },

  // NEW: Fetch a single supervisor by id (with department joined)
  async getById(id) {
    if (supabase) {
      const { data, error } = await supabase
        .from("supervisors")
        .select("*, department:departments(name)")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data ?? null;
    }
    return db.supervisors.find((s) => s.id === id) ?? null;
  },

  // NEW: Create supervisor
  async create(payload) {
    if (supabase) {
      const { data, error } = await supabase
        .from("supervisors")
        .insert(payload)
        .select(
          "*, profile:profiles(full_name, email), department:departments(name)",
        )
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.createSupervisor?.(payload) || null;
  },

  // NEW: Update supervisor
  async update(id, payload) {
    if (supabase) {
      const { data, error } = await supabase
        .from("supervisors")
        .update(payload)
        .eq("id", id)
        .select(
          "*, profile:profiles(full_name, email), department:departments(name)",
        )
        .single();
      if (error) throw new Error(error.message);

      // Also update profile if full_name or email changed
      if (payload.full_name || payload.email) {
        const updateData = {};
        if (payload.full_name) updateData.full_name = payload.full_name;
        if (payload.email) updateData.email = payload.email;

        if (data?.profile_id) {
          await supabase
            .from("profiles")
            .update(updateData)
            .eq("id", data.profile_id);
        }
      }

      return data;
    }
    return mockBackend.updateSupervisor?.(id, payload) || null;
  },

  // NEW: Remove supervisor
  async remove(id) {
    if (supabase) {
      // First get the profile_id to delete the auth user
      const { data: supData, error: fetchError } = await supabase
        .from("supervisors")
        .select("profile_id")
        .eq("id", id)
        .single();

      if (fetchError) throw new Error(fetchError.message);

      // Delete supervisor record
      const { error: deleteError } = await supabase
        .from("supervisors")
        .delete()
        .eq("id", id);

      if (deleteError) throw new Error(deleteError.message);

      // Note: Deleting the auth user would require admin API
      // For now, just delete the supervisor record
      return;
    }
    return mockBackend.removeSupervisor?.(id) || null;
  },
};
