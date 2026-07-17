// src/services/settingsService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

/** Singleton settings row (id = 1) for company-wide configuration. */
export const settingsService = {
  async get() {
    if (supabase) {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error && error.code !== "PGRST116") throw new Error(error.message);
      return data;
    }
    return mockBackend.getSettings();
  },

  async upsert(payload) {
    if (supabase) {
      const { data, error } = await supabase.from("settings").upsert({ id: 1, ...payload }).select("*").single();
      if (error) throw new Error(error.message);
      return data;
    }
    return mockBackend.upsertSettings(payload);
  },
};
