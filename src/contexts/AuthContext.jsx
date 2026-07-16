import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "@/services/authService";
import { profileService } from "@/services/profileService";
import { isSupabaseConfigured } from "@/lib/supabase";
import { ROLES } from "@/lib/constants";

const AuthContext = createContext(null);

/**
 * Provides authentication state, the current user's profile, and role helpers.
 *
 * Works in two modes:
 * - Supabase mode: real auth + profile lookup.
 * - Demo mode (no Supabase env): a localStorage session + in-memory mock backend
 *   so the prototype is fully functional without a backend.
 *
 * - `user`        : auth user (or null)
 * - `profile`     : linked profile row (or null)
 * - `role`        : profile.role (or null)
 * - `loading`     : initial bootstrap in progress
 * - `isConfigured`: whether Supabase env vars are present
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(authUser) {
    if (!authUser) {
      setProfile(null);
      return null;
    }
    try {
      const p = await profileService.getByUserId(authUser.id);
      setProfile(p);
      return p;
    } catch {
      setProfile(null);
      return null;
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const current = await authService.getCurrentUser();
      if (!active) return;
      setUser(current ?? null);
      await loadProfile(current);
      if (!active) return;
      setLoading(false);
    }

    bootstrap();

    const unsubscribe = authService.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      loadProfile(nextUser);
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    const role = profile?.role ?? null;
    return {
      user,
      profile,
      role,
      loading,
      isConfigured: isSupabaseConfigured,
      isAuthenticated: Boolean(user),
      isAdmin: role === ROLES.ADMIN || role === ROLES.HR_STAFF,
      isSupervisor: role === ROLES.SUPERVISOR,
      isIntern: role === ROLES.INTERN,
      // Returns the freshly loaded profile so callers can read role immediately.
      refreshProfile: () => loadProfile(user),
      signIn: authService.signIn,
      signOut: async () => {
        await authService.signOut();
        setUser(null);
        setProfile(null);
      },
    };
  }, [user, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
