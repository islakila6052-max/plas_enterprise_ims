// src/services/programService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

/**
 * Program service. Programs belong to an institution (1:N). Admin-only writes;
 * authenticated users can read. MOA (Memorandum of Agreement) is stored as a
 * Supabase Storage object path under the `institution-moa` bucket.
 */
export const programService = {
  async list({ institutionId = "", search = "" } = {}) {
    if (!supabase) {
      let rows = mockBackend.listPrograms?.() || [];
      if (institutionId) rows = rows.filter((r) => r.institution_id === institutionId);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter((r) => r.program_name.toLowerCase().includes(q));
      }
      return rows;
    }
    try {
      let query = supabase
        .from("programs")
        .select("*, institution:institutions(institution_name, abbreviation)")
        .order("program_name", { ascending: true });
      if (institutionId) query = query.eq("institution_id", institutionId);
      if (search) query = query.ilike("program_name", `%${search}%`);
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
      .select("*, institution:institutions(institution_name, abbreviation)")
      .eq("program_id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async create(payload) {
    if (!supabase) return mockBackend.createProgram?.(payload) || null;
    const { data, error } = await supabase
      .from("programs")
      .insert({
        institution_id: payload.institution_id,
        program_name: payload.program_name,
        abbreviation: payload.abbreviation || null,
        hours_to_render: Number(payload.hours_to_render) || 0,
        memo_of_agreement: payload.memo_of_agreement || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload) {
    if (!supabase) return mockBackend.updateProgram?.(id, payload) || null;
    const { data, error } = await supabase
      .from("programs")
      .update({
        institution_id: payload.institution_id,
        program_name: payload.program_name,
        abbreviation: payload.abbreviation || null,
        hours_to_render: Number(payload.hours_to_render) || 0,
        memo_of_agreement: payload.memo_of_agreement || null,
      })
      .eq("program_id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    if (!supabase) return mockBackend.removeProgram?.(id);
    const { error } = await supabase.from("programs").delete().eq("program_id", id);
    if (error) throw new Error(error.message);
    return;
  },
};

/**
 * Upload an MOA PDF to the `institution-moa` storage bucket and return its path.
 * Only used in Supabase mode; the mock backend stores the filename instead.
 */
export async function uploadMoa(file, institutionId) {
  if (!supabase) return `mock://${file.name}`;
  const path = `${institutionId || "shared"}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage
    .from("institution-moa")
    .upload(path, file, { upsert: true, contentType: file.type || "application/pdf" });
  if (error) throw new Error(error.message);
  return path;
}

/** Resolve a stored MOA path to a signed/public URL for preview/download. */
export async function moaUrl(path) {
  if (!supabase || !path) return null;
  if (path.startsWith("http")) return path;
  const { data, error } = await supabase.storage
    .from("institution-moa")
    .createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}
