// src/pages/intern/InternJournal.jsx
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { journalService } from "@/services/journalService";
import { useAuth } from "@/contexts/AuthContext";
import { JOURNAL_STATUS_LABELS } from "@/lib/constants";
import { formatDate, todayISO } from "@/utils/format";
import { recordAudit, notify } from "@/services/activityService";
import { supabase } from "@/lib/supabase";

const TONE = { pending: "amber", approved: "green", rejected: "red" };

export default function InternJournal() {
  const { profile, internId } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: { date: todayISO(), activities: "", hours_worked: "", challenges: "", learnings: "" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await journalService.list({ internId, page: 1, pageSize: 30 });
      let data = res.data;
      if (search) {
        const q = search.toLowerCase();
        data = data.filter((r) => (r.activities ?? "").toLowerCase().includes(q));
      }
      setRows(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [internId, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(values) {
    setSaving(true);
    try {
      const created = await journalService.create({
        intern_id: internId,
        date: values.date,
        activities: values.activities,
        hours_worked: Number(values.hours_worked) || 0,
        challenges: values.challenges,
        learnings: values.learnings,
        status: "pending",
      });
      await recordAudit({ user_id: profile?.id, action: "create", resource_type: "daily_journal", resource_id: created?.id, changes: { date: values.date } });

      // Notify the assigned supervisor about the new journal entry.
      try {
        const { data: intern } = await supabase
          .from("interns")
          .select("full_name, supervisor_id")
          .eq("id", internId)
          .single();
        if (intern?.supervisor_id) {
          const { data: supProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", intern.supervisor_id)
            .single();
          if (supProfile?.id) {
            await notify({
              user_id: supProfile.id,
              type: "journal_submitted",
              title: "New journal entry",
              message: `${profile?.full_name || "An intern"} submitted a journal entry for ${values.date}.`,
              link: "/supervisor/journals",
              metadata: { intern_id: internId, journal_id: created?.id },
            });
          }
        }
      } catch {
        /* non-fatal */
      }

      toast.success("Journal submitted.");
      reset({ date: todayISO(), activities: "", hours_worked: "", challenges: "", learnings: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "date", header: "Date", render: (r) => formatDate(r.date) },
    { key: "activities", header: "Activities", render: (r) => <p className="max-w-xs truncate text-slate-600">{r.activities}</p> },
    { key: "hours", header: "Hours", render: (r) => r.hours_worked ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={TONE[r.status] ?? "gray"}>{JOURNAL_STATUS_LABELS[r.status] ?? r.status}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Daily Journal" description="Submit your daily activities and learnings." />

      <Card>
        <div className="border-b border-brand-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">New Entry</h3>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" type="date" {...register("date", { required: "Date is required" })} />
            <Input label="Hours worked" type="number" step="0.5" {...register("hours_worked", { required: "Required" })} />
          </div>
          <Textarea label="Activities" rows={3} error={errors.activities?.message} {...register("activities", { required: "Activities are required" })} />
          <Textarea label="Challenges" rows={2} {...register("challenges")} />
          <Textarea label="Learnings" rows={2} {...register("learnings")} />
          <Button type="submit" loading={saving}>Submit Journal</Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">My Journals</h3>
          <Input
            placeholder="Search activities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {loading ? (
          <Spinner label="Loading journals…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={<div className="p-4 text-center text-sm text-slate-500">No journals submitted yet.</div>}
          />
        )}
      </Card>
    </div>
  );
}
