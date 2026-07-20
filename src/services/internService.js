import { supabase } from "@/lib/supabase";
import { PAGE_SIZE } from "@/lib/constants";
import { userService } from "@/services/userService";

export const internService = {
  async list({
    search = "",
    departmentId = "",
    status = "",
    supervisorId = "", // NEW: Add supervisorId parameter
    createdBy = "", // NEW: interns created by this user (OR with supervisorId)
    institutionId = "", // NEW: filter by linked institution
    programId = "", // NEW: filter by linked program
    page = 1,
    pageSize = PAGE_SIZE,
  } = {}) {
    let query = supabase
        .from("interns")
        .select(
          "*, department:departments(name), supervisor:supervisors(full_name, email), institution:institutions(institution_name), program:programs(program_name, abbreviation)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,student_number.ilike.%${search}%`,
        );
      }
      if (departmentId) query = query.eq("department_id", departmentId);
      if (status) query = query.eq("status", status);
      if (institutionId) query = query.eq("institution_id", institutionId);
      if (programId) query = query.eq("program_id", programId);
      // Supervisors see interns assigned to them OR created by them.
      if (supervisorId && createdBy) {
        query = query.or(`supervisor_id.eq.${supervisorId},created_by.eq.${createdBy}`);
      } else if (supervisorId) {
        query = query.eq("supervisor_id", supervisorId);
      } else if (createdBy) {
        query = query.eq("created_by", createdBy);
      }

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return { data: data ?? [], count: count ?? 0, page, pageSize };
  },

  async get(id) {
    const { data, error } = await supabase
      .from("interns")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async create(payload) {
    const { data, error } = await supabase
      .from("interns")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from("interns")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    // Fetch the linked profile (auth user) id before deleting the intern.
    const { data: internRow, error: fetchErr } = await supabase
      .from("interns")
      .select("profile_id")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);

    // Delete the intern row. FK ON DELETE CASCADE removes attendance,
    // daily_journals, documents and evaluations for this intern automatically.
    const { error } = await supabase.from("interns").delete().eq("id", id);
    if (error) throw new Error(error.message);

    // Hard-delete the linked auth user so the account can no longer log in.
    // profiles.id cascades to the profile row; intern children are already gone.
    if (internRow?.profile_id) {
      try {
        await userService.deleteAuthUser(internRow.profile_id);
      } catch (e) {
        // Non-fatal: the intern data is already removed. Surface but don't fail
        // the whole operation if the auth delete is blocked for any reason.
        console.error("Intern auth user delete failed:", e);
      }
    }
    return;
  },

  /** Soft-archive by flipping status. */
  async archive(id) {
    return this.update(id, { status: "archived" });
  },

  async restore(id) {
    return this.update(id, { status: "active" });
  },
};
