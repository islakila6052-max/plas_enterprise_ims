// src/services/institutionService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

/**
 * Institution service. Institutions are master setup data (schools / universities)
 * that own academic programs. Admin-only writes; authenticated users can read.
 * Falls back to the in-memory mock backend when Supabase is not configured.
 */
export const institutionService = {
  async list({ search = "" } = {}) {
    if (!supabase) {
      let rows = mockBackend.listInstitutions?.() || [];
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter((r) => r.institution_name.toLowerCase().includes(q));
      }
      return rows;
    }
    try {
      let query = supabase
        .from("institutions")
        .select("*")
        .order("institution_name", { ascending: true });
      if (search) query = query.ilike("institution_name", `%${search}%`);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data ?? [];
    } catch (err) {
      throw err;
    }
  },

  async getById(id) {
    if (!supabase) return mockBackend.getInstitutionById?.(id) || null;
    const { data, error } = await supabase
      .from("institutions")
      .select("*")
      .eq("institution_id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async create(payload) {
    if (!supabase) return mockBackend.createInstitution?.(payload) || null;
    const { data, error } = await supabase
      .from("institutions")
      .insert({
        institution_name: payload.institution_name,
        abbreviation: payload.abbreviation || null,
        campus: payload.campus || null,
        address: payload.address || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload) {
    if (!supabase) return mockBackend.updateInstitution?.(id, payload) || null;
    const { data, error } = await supabase
      .from("institutions")
      .update({
        institution_name: payload.institution_name,
        abbreviation: payload.abbreviation || null,
        campus: payload.campus || null,
        address: payload.address || null,
      })
      .eq("institution_id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    if (!supabase) return mockBackend.removeInstitution?.(id);
    const { error } = await supabase
      .from("institutions")
      .delete()
      .eq("institution_id", id);
    if (error) throw new Error(error.message);
    return;
  },
};
