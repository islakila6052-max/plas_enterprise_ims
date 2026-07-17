// supervisorService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

export const supervisorService = {
  async list() {
    if (supabase) {
      const { data, error } = await supabase
        .from("supervisors")
        .select(
          `
          *,
          profile:profile_id (
            full_name,
            email
          ),
          department:departments (
            name
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }
      return data ?? [];
    }
    return mockBackend.listSupervisors();
  },

  async getById(id) {
    if (supabase) {
      const { data, error } = await supabase
        .from("supervisors")
        .select(
          `
          *,
          profile:profile_id (
            full_name,
            email
          ),
          department:departments (
            name
          )
        `,
        )
        .eq("id", id)
        .single();

      if (error) {
        throw new Error(error.message);
      }
      return data ?? null;
    }
    return mockBackend.getSupervisorById?.(id) ?? null;
  },

  async create(payload) {
    if (supabase) {
      const { data, error } = await supabase
        .from("supervisors")
        .insert({
          profile_id: payload.profile_id,
          department_id: payload.department_id,
          full_name: payload.full_name,
          email: payload.email,
          created_by: payload.created_by,
        })
        .select(
          `
          *,
          profile:profile_id (
            full_name,
            email
          ),
          department:departments (
            name
          )
        `,
        )
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Manually update profile with supervisor_id
      if (data?.profile_id) {
        await supabase
          .from("profiles")
          .update({ supervisor_id: data.id })
          .eq("id", data.profile_id);
      }

      return data;
    }
    return mockBackend.createSupervisor?.(payload) || null;
  },

  async update(id, payload) {
    if (supabase) {
      const updateData = {
        department_id: payload.department_id,
        full_name: payload.full_name,
        email: payload.email,
      };

      const { data, error } = await supabase
        .from("supervisors")
        .update(updateData)
        .eq("id", id)
        .select(
          `
          *,
          profile:profile_id (
            full_name,
            email
          ),
          department:departments (
            name
          )
        `,
        )
        .single();

      if (error) {
        throw new Error(error.message);
      }

      // Also update profile if full_name or email changed
      if (payload.full_name || payload.email) {
        const profileUpdate = {};
        if (payload.full_name) profileUpdate.full_name = payload.full_name;
        if (payload.email) profileUpdate.email = payload.email;

        if (data?.profile_id && Object.keys(profileUpdate).length > 0) {
          await supabase
            .from("profiles")
            .update(profileUpdate)
            .eq("id", data.profile_id);
        }
      }

      return data;
    }
    return mockBackend.updateSupervisor?.(id, payload) || null;
  },

  async remove(id) {
    if (supabase) {
      // First get the profile_id
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

      // Update the profile to remove supervisor_id
      if (supData?.profile_id) {
        await supabase
          .from("profiles")
          .update({ supervisor_id: null })
          .eq("id", supData.profile_id);
      }

      return;
    }
    return mockBackend.removeSupervisor?.(id) || null;
  },
};
