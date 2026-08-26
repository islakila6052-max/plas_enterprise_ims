// src/pages/auth/FirstTimeSetup.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { ShieldCheck, Eye, EyeOff } from "lucide-react";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";

/**
 * First-Time Admin Account Setup.
 *
 * Shown only while the system has no admin account. The availability check is
 * performed server-side (GET /api/admin/setup-admin) and re-verified on
 * submission — once an admin exists the endpoint rejects creation with 403,
 * so this page can never be used to add extra initial admins.
 */
export default function FirstTimeSetup() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: { full_name: "", email: "", password: "", confirm: "" },
  });

  // Check server-side whether setup is still available.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/setup-admin");
        const data = await res.json();
        if (!active) return;
        setSetupRequired(Boolean(data.setupRequired));
      } catch {
        if (active) setSetupRequired(false); // fail closed on network errors
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(values) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/setup-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: values.full_name.trim(),
          email: values.email.trim(),
          password: values.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || "Failed to create the admin account.");
      toast.success("Admin account created. You can now sign in.");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner label="Checking system status…" />
      </div>
    );
  }

  // Setup already completed (or unavailable): hide the form entirely.
  if (!setupRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-3 h-10 w-10 text-green-600" />
          <h1 className="text-lg font-semibold text-slate-800">
            Setup already completed
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            An administrator account already exists for this system. Please sign
            in with your credentials.
          </p>
          <Link
            to="/login"
            className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const password = watch("password");

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <ShieldCheck className="mx-auto mb-3 h-12 w-12 text-brand-600" />
          <h1 className="text-2xl font-bold text-slate-800">
            First-Time Setup
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Create the first administrator account for your organization. This
            page will be disabled automatically afterwards.
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          noValidate>
          <div>
            <Input
              label="Full name"
              placeholder="Juan Dela Cruz"
              error={errors.full_name?.message}
              {...register("full_name", {
                required: "Full name is required.",
                minLength: { value: 2, message: "Name is too short." },
              })}
            />
          </div>

          <div>
            <Input
              label="Email"
              type="email"
              placeholder="admin@company.com"
              error={errors.email?.message}
              {...register("email", {
                required: "Email is required.",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email address.",
                },
              })}
            />
          </div>

          <div>
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                error={errors.password?.message}
                {...register("password", {
                  required: "Password is required.",
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters.",
                  },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-8 text-slate-400 hover:text-slate-600"
                aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <Input
              label="Confirm password"
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              error={errors.confirm?.message}
              {...register("confirm", {
                required: "Please confirm your password.",
                validate: (v) => v === password || "Passwords do not match.",
              })}
            />
          </div>

          <Button type="submit" loading={submitting} className="w-full">
            Create Admin Account
          </Button>

          <p className="text-center text-xs text-slate-400">
            This one-time form stops accepting submissions as soon as the first
            admin exists.
          </p>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
