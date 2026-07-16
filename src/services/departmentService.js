import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

export const departmentService = {
  async list() {
    if (supabase) {
      const { data, error } = await supabase.from("departments").select("*").order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    return mockBackend.listDepartments();
  },
  async create(payload) {
    if (supabase) {
      const { data, error } = await supabase.from("departments").insert(payload).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.createDepartment(payload);
  },
  async update(id, payload) {
    if (supabase) {
      const { data, error } = await supabase.from("departments").update(payload).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.updateDepartment(id, payload);
  },
  async remove(id) {
    if (supabase) {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    return mockBackend.removeDepartment(id);
  },
};
