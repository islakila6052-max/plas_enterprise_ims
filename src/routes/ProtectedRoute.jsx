// src/routes/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Spinner from "@/components/ui/Spinner";

/**
 * Gate that requires an authenticated user with a resolved profile/role.
 * Redirects to /login (preserving the attempted location) when unauthenticated.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, role, loading, profileError } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading your workspace…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!role) {
    const offline =
      !profileError ||
      profileError.toLowerCase().includes("internet") ||
      profileError.toLowerCase().includes("network") ||
      profileError.toLowerCase().includes("offline");
    // Authenticated but no profile/role yet (e.g. just signed up, or a
    // transient network failure while loading the profile).
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="surface max-w-md p-6">
          <h2 className="text-lg font-semibold text-slate-800">
            {offline ? "Couldn't load your profile" : "Account not set up"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {offline
              ? "We couldn't load your profile — this is usually a connection issue. Check your network and reload the page."
              : "Your account exists but no profile/role is assigned. Please contact an administrator to activate your account."}
          </p>
          {offline && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700">
              Reload
            </button>
          )}
        </div>
      </div>
    );
  }

  return children;
}
