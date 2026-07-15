import { supabase } from "@/lib/supabase";

export const supervisorService = {
  async list() {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("supervisors")
      .select("*, profile:profiles(full_name, email)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
};
