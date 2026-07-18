// src/services/userService.js
/**
 * User creation service.
 *
 * Creating an auth user requires the Supabase service-role key, which must never
 * be exposed to the browser. Therefore:
 * - In Supabase mode we delegate to the serverless API route (/api/admin/create-user)
 *   which uses the service-role key server-side.
 * - In demo mode (no Supabase env) we create the profile row directly in the
 *   in-memory mock backend so the prototype is fully functional without a backend.
 *
 * Both branches return `{ id, email }` so callers can link the new auth user to a
 * supervisors / interns record via `profile_id`.
 */
import { isSupabaseConfigured } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";

export const userService = {
  /**
   * Create an auth user (and its linked profile row).
   * @param {{ email: string, password: string, full_name: string, role: string }} params
   * @returns {Promise<{ id: string, email: string }>}
   */
  async createAuthUser({ email, password, full_name, role }) {
    if (isSupabaseConfigured) {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          user_metadata: { full_name, role },
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to create user");
      }
      const { user } = await response.json();
      return { id: user.id, email: user.email };
    }

    return mockBackend.createUser({ email, password, full_name, role });
  },
};
