// src/services/institutionService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

/**
 * Institution service. Institutions are master setup data (schools / universities)
 * that own academic programs. Admin-only writes; authenticated users can read.
 * Falls back to the in-memory mock backend when Supabase is not configured.
 */
const COLUMNS = [
  "institution_id",
  "institution_name",
  "abbreviation",
  "campus",
  "address",
  "contact_person",
  "contact_number",
  "email",
  "logo_url",
  "created_at",
  "updated_at",
];

export const institutionService = {
  async list({ search = "" } = {}) {
    if (!supabase) {
      let rows = mockBackend.listInstitutions?.() || [];
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            (r.institution_name || "").toLowerCase().includes(q) ||
            (r.abbreviation || "").toLowerCase().includes(q) ||
            (r.campus || "").toLowerCase().includes(q),
        );
      }
      return rows;
    }
    try {
      let query = supabase
        .from("institutions")
        .select(COLUMNS.join(","))
        .order("institution_name", { ascending: true });
      if (search) {
        query = query.or(
          `institution_name.ilike.%${search}%,abbreviation.ilike.%${search}%,campus.ilike.%${search}%`,
        );
      }
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
      .select(COLUMNS.join(","))
      .eq("institution_id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  _payload(p) {
    return {
      institution_name: p.institution_name,
      abbreviation: p.abbreviation || null,
      campus: p.campus || null,
      address: p.address || null,
      contact_person: p.contact_person || null,
      contact_number: p.contact_number || null,
      email: p.email || null,
      logo_url: p.logo_url || null,
    };
  },

  async create(payload) {
    if (!supabase) return mockBackend.createInstitution?.(payload) || null;
    const { data, error } = await supabase
      .from("institutions")
      .insert(this._payload(payload))
      .select(COLUMNS.join(","))
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload) {
    if (!supabase) return mockBackend.updateInstitution?.(id, payload) || null;
    const { data, error } = await supabase
      .from("institutions")
      .update(this._payload(payload))
      .eq("institution_id", id)
      .select(COLUMNS.join(","))
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    if (!supabase) return mockBackend.removeInstitution?.(id);
    const { error } = await supabase.from("institutions").delete().eq("institution_id", id);
    if (error) throw new Error(error.message);
  },
};
