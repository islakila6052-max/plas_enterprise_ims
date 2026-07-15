import { supabase } from "@/lib/supabase";

export const departmentService = {
  async list() {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  async create(payload) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase
      .from("departments")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  async update(id, payload) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase
      .from("departments")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
  async remove(id) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
