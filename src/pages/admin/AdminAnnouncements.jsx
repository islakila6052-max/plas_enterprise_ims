import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import { announcementService } from "@/services/announcementService";
import { useAuth } from "@/contexts/AuthContext";
import { ANNOUNCEMENT_CATEGORIES } from "@/lib/constants";
import { formatDateTime, timeAgo } from "@/utils/format";

export default function AdminAnnouncements() {
  const { isConfigured, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { title: "", body: "", category: "company_news" },
  });

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const res = await announcementService.list({});
      setRows(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(values) {
    setSaving(true);
    try {
      await announcementService.create({
        ...values,
        published_by: user?.id,
      });
      toast.success("Announcement published.");
      setModalOpen(false);
      reset();
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!confirm("Delete this announcement?")) return;
    try {
      await announcementService.remove(row.id);
      toast.success("Deleted.");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const catLabel = Object.fromEntries(
    ANNOUNCEMENT_CATEGORIES.map((c) => [c.value, c.label]),
  );

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Publish company news, deadlines and reminders."
        action={
          <Button onClick={() => setModalOpen(true)}>+ New Announcement</Button>
        }
      />

      {loading ? (
        <Spinner label="Loading announcements…" />
      ) : (
        <div className="space-y-4">
          {rows.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-4 p-5">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone="brand">{catLabel[a.category] ?? a.category}</Badge>
                    <span className="text-xs text-slate-400">
                      {timeAgo(a.created_at)} · {formatDateTime(a.created_at)}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">
                    {a.title}
                  </h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                    {a.body}
                  </p>
                </div>
                <button
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                  onClick={() => remove(a)}>
                  Delete
                </button>
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <Card>
              <p className="p-5 text-center text-sm text-slate-500">
                No announcements yet.
              </p>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Announcement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} loading={saving}>
              Publish
            </Button>
          </>
        }>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input
            label="Title"
            error={errors.title?.message}
            {...register("title", { required: "Title is required" })}
          />
          <Select label="Category" {...register("category")}>
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
          <Textarea
            label="Message"
            rows={5}
            error={errors.body?.message}
            {...register("body", { required: "Message is required" })}
          />
        </form>
      </Modal>
    </div>
  );
}
