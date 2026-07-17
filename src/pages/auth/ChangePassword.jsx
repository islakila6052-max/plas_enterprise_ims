// src/pages/auth/ChangePassword.jsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { authService } from "@/services/authService";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";

export default function ChangePassword() {
  const { user } = useAuth();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: { password: "", confirm: "" } });

  async function onSubmit({ password }) {
    setServerError("");
    setDone(false);
    setSubmitting(true);
    try {
      await authService.updatePassword(password);
      setDone(true);
      reset();
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-800">Change password</h3>
        <p className="mt-0.5 text-sm text-slate-500">
          {user?.email
            ? `Signed in as ${user.email}`
            : "Update your account password"}
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-5">
        {done && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Password changed successfully.
          </div>
        )}
        {serverError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </div>
        )}
        <div className="grid max-w-md gap-4">
          <Input
            label="New password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "At least 8 characters" },
            })}
          />
          <Input
            label="Confirm password"
            type="password"
            placeholder="••••••••"
            error={errors.confirm?.message}
            {...register("confirm", {
              required: "Please confirm your password",
              validate: (v) =>
                v === watch("password") || "Passwords do not match",
            })}
          />
        </div>
        <Button type="submit" loading={submitting}>
          Update password
        </Button>
      </form>
    </Card>
  );
}
