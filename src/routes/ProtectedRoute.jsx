// src/routes/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Spinner from "@/components/ui/Spinner";

/**
 * Gate that requires an authenticated user with a resolved profile/role.
 * Redirects to /login (preserving the attempted location) when unauthenticated.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, role, loading } = useAuth();
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
    // Authenticated but no profile/role yet (e.g. just signed up).
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <div className="surface max-w-md p-6">
          <h2 className="text-lg font-semibold text-slate-800">
            Account not set up
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Your account exists but no profile/role is assigned. Please contact
            an administrator to activate your account.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
