// src/services/authService.js
import { supabase } from "@/lib/supabase";
import mockBackend from "@/lib/mockBackend";
import { DEMO_ACCOUNTS } from "@/lib/sampleData";

/**
 * Authentication service.
 *
 * - With Supabase configured: wraps Supabase Auth.
 * - Without Supabase (demo mode): validates against the sample accounts and
 *   persists a lightweight session in localStorage so the prototype behaves
 *   like a real app (refresh-safe, role-aware login).
 */

const DEMO_SESSION_KEY = "ims-demo-session";

function normalizeError(error) {
  if (!error) return new Error("Something went wrong. Please try again.");
  const message =
    error.message ||
    error.error_description ||
    "Authentication failed. Please try again.";
  return new Error(message);
}

function readDemoSession() {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const authService = {
  /** Current session user (or null). */
  async getCurrentUser() {
    if (supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data.user;
    }
    const session = readDemoSession();
    return session ? { id: session.id, email: session.email } : null;
  },

  /** Sign in with email + password. */
  async signIn(email, password) {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw normalizeError(error);
      return data;
    }
    // Demo mode: match against sample accounts (password always password123).
    const account =
      DEMO_ACCOUNTS.find(
        (a) => a.email.toLowerCase() === String(email).toLowerCase(),
      ) ?? mockBackend.getDemoAccount(email);
    if (!account) {
      throw new Error("No demo account found for that email. Try hr@company.com, supervisor@company.com or intern@company.com.");
    }
    if (account.password !== password) {
      throw new Error("Incorrect password. Use password123 for the demo accounts.");
    }
    const profile = await mockBackend.getProfileByEmail(account.email);
    if (!profile) throw new Error("Demo profile not found.");
    localStorage.setItem(
      DEMO_SESSION_KEY,
      JSON.stringify({ id: profile.id, email: profile.email, role: profile.role }),
    );
    return { user: { id: profile.id, email: profile.email } };
  },

  /** Sign out the current user. */
  async signOut() {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw normalizeError(error);
      return;
    }
    localStorage.removeItem(DEMO_SESSION_KEY);
  },

  /** Send a password reset email. */
  async forgotPassword(email) {
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw normalizeError(error);
      return;
    }
    // Demo mode: simulate success.
    return;
  },

  /** Update the password of the currently signed-in user. */
  async updatePassword(password) {
    if (supabase) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw normalizeError(error);
      return;
    }
    // Demo mode: simulate success.
    return;
  },

  /** Subscribe to auth state changes. Returns an unsubscribe fn. */
  onAuthStateChange(callback) {
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event, session);
      });
      return data.subscription.unsubscribe.bind(data.subscription);
    }
    // Demo mode: no live session events; return a no-op unsubscribe.
    return () => {};
  },
};
