// src/pages/admin/AdminAnnouncements.jsx
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
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { announcementService } from "@/services/announcementService";
import { useAuth } from "@/contexts/AuthContext";
import { ANNOUNCEMENT_CATEGORIES } from "@/lib/constants";
import { formatDateTime, timeAgo } from "@/utils/format";
import { notifyAllWithType } from "@/services/activityService";

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: { title: "", body: "", category: "company_news" } });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await announcementService.list({});
      setRows(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    reset({ title: "", body: "", category: "company_news" });
    setModalOpen(true);
  }

  function openEdit(a) {
    setEditing(a);
    reset({ title: a.title, body: a.body, category: a.category });
    setModalOpen(true);
  }

  async function onSubmit(values) {
    setSaving(true);
    try {
      if (editing) {
        await announcementService.update(editing.id, values);
        toast.success("Announcement updated.");
      } else {
        await announcementService.create({ ...values, published_by: user?.id });

        // Notify all users about the new announcement.
        notifyAllWithType({
          type: "announcement",
          title: `New announcement: ${values.title}`,
          message: values.body?.substring(0, 120) + (values.body?.length > 120 ? "…" : ""),
          link: "/intern/announcements",
          metadata: { category: values.category },
        }).catch(() => {});

        toast.success("Announcement published.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(a) {
    try {
      await announcementService.update(a.id, { pinned: !a.pinned });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function remove() {
    try {
      await announcementService.remove(confirm.id);
      toast.success("Deleted.");
      setConfirm(null);
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirm(null);
    }
  }

  const catLabel = Object.fromEntries(ANNOUNCEMENT_CATEGORIES.map((c) => [c.value, c.label]));

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Publish company news, deadlines and reminders."
        action={<Button onClick={openCreate}>+ New Announcement</Button>}
      />

      {loading ? (
        <Spinner label="Loading announcements…" />
      ) : (
        <div className="space-y-4">
          {rows.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {a.pinned && <Badge tone="green">Pinned</Badge>}
                    <Badge tone="brand">{catLabel[a.category] ?? a.category}</Badge>
                    <span className="text-xs text-slate-400">
                      {timeAgo(a.created_at)} · {formatDateTime(a.created_at)}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">{a.title}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button className="text-xs font-medium text-brand-700 hover:text-brand-800" onClick={() => togglePin(a)}>
                    {a.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button className="text-xs font-medium text-slate-500 hover:text-slate-700" onClick={() => openEdit(a)}>
                    Edit
                  </button>
                  <button className="text-xs font-medium text-red-500 hover:text-red-600" onClick={() => setConfirm(a)}>
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <Card>
              <p className="p-5 text-center text-sm text-slate-500">No announcements yet.</p>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Announcement" : "New Announcement"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit(onSubmit)} loading={saving}>
              {editing ? "Save" : "Publish"}
            </Button>
          </>
        }>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Title" error={errors.title?.message} {...register("title", { required: "Title is required" })} />
          <Select label="Category" {...register("category")}>
            {ANNOUNCEMENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Textarea label="Message" rows={5} error={errors.body?.message} {...register("body", { required: "Message is required" })} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
        title="Delete announcement?"
        message={`Delete "${confirm?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
      />
    </div>
  );
}
