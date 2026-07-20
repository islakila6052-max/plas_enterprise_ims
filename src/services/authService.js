// src/services/authService.js
import { supabase } from "@/lib/supabase";

/**
 * Authentication service. Wraps Supabase Auth. All data is sourced from the
 * configured Supabase project — there is no demo/mock fallback.
 */

function normalizeError(error) {
  if (!error) return new Error("Something went wrong. Please try again.");
  const message =
    error.message ||
    error.error_description ||
    "Authentication failed. Please try again.";
  return new Error(message);
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
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
