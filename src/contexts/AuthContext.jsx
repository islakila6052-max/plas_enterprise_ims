// src/contexts/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "@/services/authService";
import { profileService } from "@/services/profileService";
import { ROLES } from "@/lib/constants";

const AuthContext = createContext(null);

/**
 * Provides authentication state, the current user's profile, and role helpers.
 *
 * - `user`        : auth user (or null)
 * - `profile`     : linked profile row (or null)
 * - `role`        : profile.role (or null)
 * - `loading`     : initial bootstrap in progress
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(authUser) {
    if (!authUser) {
      setProfile(null);
      setProfileError(null);
      return null;
    }
    try {
      const p = await profileService.getByUserId(authUser.id);
      setProfile(p);
      setProfileError(p ? null : "No profile/role is assigned to this account.");
      return p;
    } catch (err) {
      // Network errors (offline, Supabase down) are non-fatal —
      // the user can still interact with the app and data will
      // refresh once connectivity is restored.
      // eslint-disable-next-line no-console
      console.warn("[IMS] Profile load failed (network?):", err.message);
      setProfile(null);
      setProfileError(err?.message ?? "Failed to load profile.");
      return null;
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      let current = null;
      try {
        current = await authService.getCurrentUser();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[IMS] Session restore failed:", err?.message);
        current = null;
      }
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
      // Guard: loadProfile is async and not awaited here. If it rejects it must
      // not become an unhandled rejection that crashes the whole app.
      loadProfile(nextUser).catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[IMS] Failed to load profile on auth change:", err);
        setProfile(null);
      });
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => {
    const role = profile?.role ?? null;
    // Resolved linked record ids. In the DB these live on profiles.intern_id /
    // profiles.supervisor_id (kept in sync by the sync_profile_links trigger).
    const internId = profile?.intern_id ?? null;
    const supervisorId = profile?.supervisor_id ?? null;
    return {
      user,
      profile,
      role,
      profileError,
      internId,
      supervisorId,
      loading,
      isAuthenticated: Boolean(user),
      isAdmin: role === ROLES.ADMIN || role === ROLES.HR_STAFF,
      isSupervisor: role === ROLES.SUPERVISOR,
      isIntern: role === ROLES.INTERN,
      // Re-reads the current auth user and refreshes the linked profile so
      // callers can read role immediately.
      refreshProfile: async () => {
        let current = null;
        try {
          current = await authService.getCurrentUser();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[IMS] Session refresh failed:", err?.message);
        }
        setUser(current ?? null);
        return loadProfile(current);
      },
      signIn: authService.signIn,
      signOut: async () => {
        try {
          await authService.signOut();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn("[IMS] Sign out failed:", err?.message);
        }
        setUser(null);
        setProfile(null);
        setProfileError(null);
      },
    };
  }, [user, profile, loading, profileError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
