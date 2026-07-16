import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

export const announcementService = {
  async list({ category, page = 1, pageSize = 20 } = {}) {
    if (supabase) {
      let query = supabase
        .from("announcements")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (category) query = query.eq("category", category);
      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return { data: data ?? [], count: count ?? 0 };
    }
    return mockBackend.listAnnouncements({ category, page, pageSize });
  },

  async create(payload) {
    if (supabase) {
      const { data, error } = await supabase.from("announcements").insert(payload).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.createAnnouncement(payload);
  },

  async update(id, payload) {
    if (supabase) {
      const { data, error } = await supabase.from("announcements").update(payload).eq("id", id).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.updateAnnouncement(id, payload);
  },

  async remove(id) {
    if (supabase) {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    return mockBackend.removeAnnouncement(id);
  },
};
