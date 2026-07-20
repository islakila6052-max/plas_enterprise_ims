// src/services/announcementService.js
import { supabase } from "@/lib/supabase";

export const announcementService = {
  async list({ category, page = 1, pageSize = 20 } = {}) {
    let query = supabase
      .from("announcements")
      .select("*", { count: "exact" })
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (category) query = query.eq("category", category);
    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    return { data: data ?? [], count: count ?? 0 };
  },

  async create(payload) {
    const { data, error } = await supabase.from("announcements").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  },

  async update(id, payload) {
    const { data, error } = await supabase.from("announcements").update(payload).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  },
};
