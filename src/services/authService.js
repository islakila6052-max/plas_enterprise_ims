// src/services/authService.js
import { supabase } from "@/lib/supabase";
import { classifyError } from "@/lib/api";

/**
 * Authentication service. Wraps Supabase Auth. All data is sourced from the
 * configured Supabase project — there is no demo/mock fallback.
 */

function normalizeError(error) {
  if (!error) return new Error("Something went wrong. Please try again.");
  const classified = classifyError(error);
  return new Error(classified.message);
}

export const authService = {
  /** Current session user (or null). */
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  },

  /** Sign in with email + password. */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw normalizeError(error);
    return data;
  },

  /** Sign out the current user. */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw normalizeError(error);
    return;
  },
  /** Send a password reset email. */
  async forgotPassword(email) {
    // Auto-detect Vercel URL in production
    const vercelUrl = import.meta.env.VERCEL_URL;
    const appUrl = import.meta.env.VITE_APP_URL;

    let baseUrl;
    if (vercelUrl) {
      baseUrl = `https://${vercelUrl}`;
    } else if (appUrl) {
      baseUrl = appUrl;
    } else {
      baseUrl = window.location.origin;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/reset-password`,
    });
    if (error) throw normalizeError(error);
    return;
  },

  /** Update the password of the currently signed-in user. */
  async updatePassword(password) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw normalizeError(error);
    return;
  },

  /** Subscribe to auth state changes. Returns an unsubscribe fn. */
  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return data.subscription.unsubscribe.bind(data.subscription);
  },
};
