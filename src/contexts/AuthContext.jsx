// src/contexts/AuthContext.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { authService } from "@/services/authService";
import { profileService } from "@/services/profileService";
import { ROLES } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";

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
  // H8 - session lifetime.
  // persistSession + autoRefreshToken means a token left on a shared or
  // compromised machine stays valid indefinitely: there was no absolute expiry
  // and no idle timeout, and signing out was the only way to end it. We now
  // enforce BOTH an idle timeout and a hard absolute cap, also bounded by the
  // JWT's own exp so a forged local clock cannot extend a session.
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle
  const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours max
  const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"];
  const IDLE_WARN_MS = 2 * 60 * 1000; // warn 2 min before idle expiry

  // Tracks the user id whose profile is already loaded (or in flight) so the
  // bootstrap pass and the INITIAL_SESSION event do not each fire the same
  // profiles query. Supabase replays INITIAL_SESSION on subscribe, which used
  // to double-fetch on every page load.
  const loadedProfileFor = useRef(null);
  // Holds the last successfully loaded profile so a duplicate call can return
  // it without a stale closure over `profile` state.
  const loadedProfile = useRef(null);
  // H8: epoch ms when the current session was first seen, plus the last time
  // the user was seen active. Both reset on sign-in/sign-out.
  const sessionStartedAt = useRef(0);
  const lastActiveAt = useRef(0);

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      loadedProfileFor.current = null;
      loadedProfile.current = null;
      setProfile(null);
      setProfileError(null);
      return null;
    }
    // Already loaded for this exact user — reuse it instead of re-querying.
    if (loadedProfileFor.current === authUser.id) {
      return loadedProfile.current;
    }
    // Mark before awaiting so two concurrent callers cannot both start a fetch.
    loadedProfileFor.current = authUser.id;
    try {
      const p = await profileService.getByUserId(authUser.id);
      loadedProfile.current = p;
      setProfile(p);
      setProfileError(p ? null : "No profile/role is assigned to this account.");
      return p;
    } catch (err) {
      // Network errors (offline, Supabase down) are non-fatal —
      // the user can still interact with the app and data will
      // refresh once connectivity is restored.
      // eslint-disable-next-line no-console
      logger.warn("[IMS] Profile load failed (network?):", err.message);
      // Allow a retry on the next auth event, since this user never loaded.
      if (loadedProfileFor.current === authUser.id) {
        loadedProfileFor.current = null;
      }
      setProfile(null);
      setProfileError(err?.message ?? "Failed to load profile.");
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      let current = null;
      try {
        current = await authService.getCurrentUser();
      } catch (err) {
        // eslint-disable-next-line no-console
        logger.warn("[IMS] Session restore failed:", err?.message);
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
        logger.error("[IMS] Failed to load profile on auth change:", err);
        setProfile(null);
      });
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadProfile]);

  // ---------------------------------------------------------------------------
  // H8 - idle + absolute session timeout
  // ---------------------------------------------------------------------------
  // Runs only while a user is signed in. Pointer/keyboard/touch/scroll events
  // push the idle deadline forward, but the absolute deadline is fixed at
  // sign-in and is never extended, so a session cannot be kept alive forever
  // by scripted activity. Both timers are also capped by the JWT's own `exp`.
  useEffect(() => {
    if (!user) {
      sessionStartedAt.current = 0;
      lastActiveAt.current = 0;
      return undefined;
    }

    const now = Date.now();
    if (!sessionStartedAt.current) sessionStartedAt.current = now;
    lastActiveAt.current = now;

    let warned = false;

    const endSession = async () => {
      // Sign out server-side too, so the refresh token is revoked rather than
      // merely dropped from this tab.
      try {
        await supabase.auth.signOut();
      } catch {
        /* best effort - local state is cleared regardless */
      }
      sessionStartedAt.current = 0;
      lastActiveAt.current = 0;
      setUser(null);
      setProfile(null);
      setProfileError("Your session expired. Please sign in again.");
    };

    const tick = () => {
      if (!user) return;
      const t = Date.now();

      // Never outlive the access token itself, even if refreshed locally.
      const expMs = user.exp ? user.exp * 1000 : Infinity;
      if (t >= expMs) return void endSession();

      if (t - sessionStartedAt.current >= ABSOLUTE_TIMEOUT_MS) {
        return void endSession();
      }

      const idleFor = t - lastActiveAt.current;
      if (idleFor >= IDLE_TIMEOUT_MS) {
        return void endSession();
      }

      if (!warned && idleFor >= IDLE_TIMEOUT_MS - IDLE_WARN_MS) {
        warned = true;
        toast(
          "You'll be signed out shortly due to inactivity. Move the mouse to stay signed in.",
          { id: "ims-idle-warning", duration: 12000 },
        );
      }
    };

    const onActivity = () => {
      lastActiveAt.current = Date.now();
      warned = false;
      toast.dismiss?.("ims-idle-warning");
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    const interval = window.setInterval(tick, 30 * 1000);

    return () => {
      window.clearInterval(interval);
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
      toast.dismiss?.("ims-idle-warning");
    };
  }, [user]);

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
      // callers can read role immediately. Clears the dedupe guard first so the
      // refresh genuinely hits the database instead of returning the cached row.
      refreshProfile: async () => {
        let current = null;
        try {
          current = await authService.getCurrentUser();
        } catch (err) {
          // eslint-disable-next-line no-console
          logger.warn("[IMS] Session refresh failed:", err?.message);
        }
        setUser(current ?? null);
        loadedProfileFor.current = null;
        return loadProfile(current);
      },
      signIn: authService.signIn,
      signOut: async () => {
        try {
          await authService.signOut();
        } catch (err) {
          // eslint-disable-next-line no-console
          logger.warn("[IMS] Sign out failed:", err?.message);
        }
        setUser(null);
        loadedProfileFor.current = null;
        loadedProfile.current = null;
        setProfile(null);
        setProfileError(null);
      },
    };
  }, [user, profile, loading, profileError, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
