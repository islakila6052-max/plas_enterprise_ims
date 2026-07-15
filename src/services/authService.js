import { supabase } from "@/lib/supabase";

/**
 * Authentication service wrapping Supabase Auth.
 * Every function throws a normalized Error with a friendly message.
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
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  },

  /** Sign in with email + password. */
  async signIn(email, password) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw normalizeError(error);
    return data;
  },

  /** Sign out the current user. */
  async signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw normalizeError(error);
  },

  /** Send a password reset email. */
  async forgotPassword(email) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw normalizeError(error);
  },

  /** Update the password of the currently signed-in user. */
  async updatePassword(password) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw normalizeError(error);
  },

  /** Subscribe to auth state changes. Returns an unsubscribe fn. */
  onAuthStateChange(callback) {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return data.subscription.unsubscribe.bind(data.subscription);
  },
};
