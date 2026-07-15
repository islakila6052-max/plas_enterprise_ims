import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { profileService } from "@/services/profileService";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import ChangePassword from "@/pages/auth/ChangePassword";
import { ROLE_LABELS } from "@/lib/constants";

export default function ProfileSettings() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name ?? "",
        contact_number: profile.contact_number ?? "",
        bio: profile.bio ?? "",
      });
    }
    setLoading(false);
  }, [profile, reset]);

  async function onSubmit(values) {
    setServerError("");
    setSaved(false);
    setSaving(true);
    try {
      await profileService.update(user.id, {
        full_name: values.full_name,
        contact_number: values.contact_number,
        bio: values.bio,
      });
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner label="Loading profile…" />;

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-4 border-b border-slate-100 px-5 py-4">
          <Avatar src={profile?.avatar_url} name={profile?.full_name} size="lg" />
          <div>
            <h3 className="text-base font-semibold text-slate-800">
              {profile?.full_name ?? "Your Profile"}
            </h3>
            <p className="text-sm text-slate-500">
              {ROLE_LABELS[profile?.role] ?? "User"} · {user?.email}
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-5">
          {saved && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Profile updated.
            </div>
          )}
          {serverError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Full name"
              error={errors.full_name?.message}
              {...register("full_name", { required: "Name is required" })}
            />
            <Input
              label="Contact number"
              placeholder="+63 9xx xxx xxxx"
              {...register("contact_number")}
            />
          </div>
          <Textarea
            label="Bio"
            rows={3}
            placeholder="Short introduction…"
            {...register("bio")}
          />
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
        </form>
      </Card>

      <ChangePassword />
    </div>
  );
}
