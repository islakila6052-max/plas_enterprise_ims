import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";
import { PAGE_SIZE } from "@/lib/constants";

export const internService = {
  async list({
    search = "",
    departmentId = "",
    status = "",
    supervisorId = "", // NEW: Add supervisorId parameter
    createdBy = "", // NEW: interns created by this user (OR with supervisorId)
    page = 1,
    pageSize = PAGE_SIZE,
  } = {}) {
    if (supabase) {
      let query = supabase
        .from("interns")
        .select(
          "*, department:departments(name), supervisor:supervisors(full_name, email)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (search) {
        query = query.or(
          `full_name.ilike.%${search}%,student_number.ilike.%${search}%,school.ilike.%${search}%`,
        );
      }
      if (departmentId) query = query.eq("department_id", departmentId);
      if (status) query = query.eq("status", status);
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
    }
    return mockBackend.listInterns({
      search,
      departmentId,
      status,
      supervisorId,
      createdBy,
      page,
      pageSize,
    });
  },

  async get(id) {
    if (supabase) {
      const { data, error } = await supabase
        .from("interns")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.getIntern(id);
  },

  async create(payload) {
    if (supabase) {
      const { data, error } = await supabase
        .from("interns")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.createIntern(payload);
  },

  async update(id, payload) {
    if (supabase) {
      const { data, error } = await supabase
        .from("interns")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.updateIntern(id, payload);
  },

  async remove(id) {
    if (supabase) {
      const { error } = await supabase.from("interns").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    return mockBackend.removeIntern(id);
  },

  /** Soft-archive by flipping status. */
  async archive(id) {
    return this.update(id, { status: "archived" });
  },

  async restore(id) {
    return this.update(id, { status: "active" });
  },
};
