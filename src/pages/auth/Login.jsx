import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import { authService } from "@/services/authService";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import SetupBanner from "@/components/ui/SetupBanner";
import { ROLES } from "@/lib/constants";

const ROLE_HOME = {
  [ROLES.ADMIN]: "/admin",
  [ROLES.HR_STAFF]: "/admin",
  [ROLES.SUPERVISOR]: "/supervisor",
  [ROLES.INTERN]: "/intern",
};

export default function Login() {
  const { isConfigured, refreshProfile, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { email: "", password: "" } });

  const from = location.state?.from?.pathname;

  async function onSubmit(values) {
    setServerError("");
    setSubmitting(true);
    try {
      await authService.signIn(values.email, values.password);
      // Wait for the auth listener to resolve the profile.
      await new Promise((r) => setTimeout(r, 400));
      await refreshProfile();
      const target = from || ROLE_HOME[role] || "/";
      navigate(target, { replace: true });
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {!isConfigured && <SetupBanner />}
      <div className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-black text-white">
              IMS
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              Internship Management System
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="surface space-y-4 p-6">
            {serverError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {serverError}
              </div>
            )}
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={errors.email?.message}
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email",
                },
              })}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register("password", { required: "Password is required" })}
            />
            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-brand-600 hover:text-brand-700">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full" loading={submitting}>
              Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
