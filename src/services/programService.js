// src/services/programService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

/**
 * Program service. Programs belong to an institution (1:N). Admin-only writes;
 * authenticated users can read.
 */
const COLUMNS = [
  "program_id",
  "institution_id",
  "program_name",
  "abbreviation",
  "program_code",
  "required_hours",
  "created_at",
  "updated_at",
];

export const programService = {
  async list({ institutionId = "", search = "" } = {}) {
    if (!supabase) {
      let rows = mockBackend.listPrograms?.() || [];
      if (institutionId) rows = rows.filter((r) => r.institution_id === institutionId);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            (r.program_name || "").toLowerCase().includes(q) ||
            (r.program_code || "").toLowerCase().includes(q) ||
            (r.abbreviation || "").toLowerCase().includes(q),
        );
      }
      return rows;
    }
    try {
      let query = supabase
        .from("programs")
        .select(COLUMNS.join(","))
        .order("program_name", { ascending: true });
      if (institutionId) query = query.eq("institution_id", institutionId);
      if (search) {
        query = query.or(
          `program_name.ilike.%${search}%,program_code.ilike.%${search}%,abbreviation.ilike.%${search}%`,
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
    if (!supabase) return mockBackend.getProgramById?.(id) || null;
    const { data, error } = await supabase
      .from("programs")
      .select(COLUMNS.join(","))
      .eq("program_id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  _payload(p) {
    return {
      institution_id: p.institution_id,
      program_name: p.program_name,
      abbreviation: p.abbreviation || null,
      program_code: p.program_code || null,
      required_hours: Number(p.required_hours) || 0,
    };
  },

  async create(payload) {
    if (!supabase) return mockBackend.createProgram?.(payload) || null;
    const { data, error } = await supabase
      .from("programs")
      .insert(this._payload(payload))
      .select(COLUMNS.join(","))
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload) {
    if (!supabase) return mockBackend.updateProgram?.(id, payload) || null;
    const { data, error } = await supabase
      .from("programs")
      .update(this._payload(payload))
      .eq("program_id", id)
      .select(COLUMNS.join(","))
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    if (!supabase) return mockBackend.removeProgram?.(id);
    const { error } = await supabase.from("programs").delete().eq("program_id", id);
    if (error) throw new Error(error.message);
  },

  /**
   * Reconcile the full set of programs for an institution: insert new ones,
   * update existing ones (matched by program_id), and delete removed ones.
   * Used by the institution modal so an admin can manage programs inline.
   *
   * @param {string} institutionId
   * @param {Array}  programs  [{ program_id?, program_name, abbreviation?, program_code?, required_hours }]
   */
  async reconcile(institutionId, programs = []) {
    if (!supabase) return mockBackend.reconcilePrograms?.(institutionId, programs);
    const existing = await this.list({ institutionId });
    const incomingIds = new Set(programs.filter((p) => p.program_id).map((p) => p.program_id));

    // Delete programs that are no longer present.
    for (const p of existing) {
      if (!incomingIds.has(p.program_id)) await this.remove(p.program_id);
    }

    // Upsert incoming programs.
    for (const p of programs) {
      const payload = { ...this._payload(p), institution_id: institutionId };
      if (p.program_id) await this.update(p.program_id, payload);
      else await this.create(payload);
    }
  },
};
