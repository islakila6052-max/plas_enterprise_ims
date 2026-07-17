// src/services/departmentService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

export const departmentService = {
  async list() {
    if (!supabase) {
      return mockBackend.listDepartments?.() || [];
    }

    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return data ?? [];
    } catch (err) {
      throw err;
    }
  },

  async getById(id) {
    if (!supabase) {
      return mockBackend.getDepartmentById?.(id) || null;
    }

    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (err) {
      throw err;
    }
  },

  async create(payload) {
    if (!supabase) {
      return mockBackend.createDepartment?.(payload) || null;
    }

    try {
      const { data, error } = await supabase
        .from("departments")
        .insert(payload)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (err) {
      throw err;
    }
  },

  async update(id, payload) {
    if (!supabase) {
      return mockBackend.updateDepartment?.(id, payload) || null;
    }

    try {
      const { data, error } = await supabase
        .from("departments")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (err) {
      throw err;
    }
  },

  async remove(id) {
    if (!supabase) {
      return mockBackend.removeDepartment?.(id) || null;
    }

    try {
      const { error } = await supabase
        .from("departments")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);
      return;
    } catch (err) {
      throw err;
    }
  },
};
