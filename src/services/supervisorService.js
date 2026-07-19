// supervisorService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";
import { userService } from "@/services/userService";

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
      if (!id) return null;
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

  /** Resolve a supervisor record by its linked profile (auth user) id. */
  async getByProfileId(profileId) {
    if (supabase) {
      if (!profileId) return null;
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
        .eq("profile_id", profileId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      return data ?? null;
    }
    return mockBackend.getSupervisorById?.(profileId) ?? null;
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

      // Manually update profile with supervisor_id (only if we have a profile link).
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
      // Fetch the linked profile (auth user) id before deleting the supervisor.
      const { data: supData, error: fetchError } = await supabase
        .from("supervisors")
        .select("profile_id")
        .eq("id", id)
        .single();
      if (fetchError) throw new Error(fetchError.message);

      // Delete the supervisor's OWN child records explicitly. The FKs from these
      // tables to supervisors are ON DELETE SET NULL (not cascade), so we must
      // remove them here to fully clear the supervisor's data.
      // Interns are NOT deleted — they are distinct people; their supervisor_id
      // is set to NULL by the FK, preserving their records.
      await supabase.from("evaluations").delete().eq("supervisor_id", id);
      await supabase.from("daily_journals").delete().eq("supervisor_id", id);
      if (supData?.profile_id) {
        await supabase.from("notifications").delete().eq("user_id", supData.profile_id);
      }

      // Delete the supervisor record.
      const { error: deleteError } = await supabase
        .from("supervisors")
        .delete()
        .eq("id", id);
      if (deleteError) throw new Error(deleteError.message);

      // Hard-delete the linked auth user so the account can no longer log in.
      if (supData?.profile_id) {
        try {
          await userService.deleteAuthUser(supData.profile_id);
        } catch (e) {
          console.error("Supervisor auth user delete failed:", e);
        }
      }

      return;
    }
    return mockBackend.removeSupervisor?.(id) || null;
  },
};
