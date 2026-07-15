import { supabase } from "@/lib/supabase";
import { PAGE_SIZE } from "@/lib/constants";

/**
 * Intern management service. Handles full CRUD plus search/filter/pagination.
 */

export const internService = {
  /** List interns with optional filters + pagination. */
  async list({ search = "", departmentId = "", status = "", page = 1 } = {}) {
    if (!supabase) return { data: [], count: 0, page: 1, pageSize: PAGE_SIZE };
    let query = supabase
      .from("interns")
      .select(
        "*, department:departments(name), supervisor:supervisors(profiles(full_name))",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,student_number.ilike.%${search}%,school.ilike.%${search}%`,
      );
    }
    if (departmentId) query = query.eq("department_id", departmentId);
    if (status) query = query.eq("status", status);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0, page, pageSize: PAGE_SIZE };
  },

  async get(id) {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from("interns")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async create(payload) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase
      .from("interns")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload) {
    if (!supabase) throw new Error("Supabase is not configured.");
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
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.from("interns").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  /** Soft-archive by flipping status. */
  async archive(id) {
    return this.update(id, { status: "archived" });
  },

  async restore(id) {
    return this.update(id, { status: "active" });
  },
};
