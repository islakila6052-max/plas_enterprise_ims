// src/pages/intern/InternJournal.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import {
  Plus,
  NotebookPen,
  Clock,
  Flame,
  CheckCircle2,
  MessageSquareQuote,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Input, Textarea, CharCounter } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { journalService } from "@/services/journalService";
import { useAuth } from "@/contexts/AuthContext";
import { JOURNAL_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatHours, todayISO } from "@/utils/format";
import { recordAudit, notify } from "@/services/activityService";
import { supabase } from "@/lib/supabase";
import JournalFeedbackModal from "@/components/journal/JournalFeedbackModal";

const TONE = { pending: "amber", approved: "green", rejected: "red" };

/** Icons per status, so state reads correctly without relying on colour alone. */
const STATUS_ICON = { approved: CheckCircle2, pending: Clock, rejected: null };

/**
 * Consecutive-day streak ending today, or yesterday so an intern who has not
 * written yet today does not watch it reset to zero mid-morning.
 * Counts distinct calendar days, so two entries on one date count once.
 */
function computeStreak(dates, today = todayISO()) {
  const days = new Set(dates.filter(Boolean).map((d) => String(d).slice(0, 10)));
  if (days.size === 0) return 0;

  // UTC-based date math. Building a local-midnight Date and reading
  // toISOString() silently loses a day in any timezone east of UTC (in UTC+8,
  // '2026-09-29' came back as '2026-09-27'), which would corrupt every streak.
  const shift = (iso, delta) => {
    const [y, m, d] = String(iso).split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    t.setUTCDate(t.getUTCDate() + delta);
    return t.toISOString().slice(0, 10);
  };

  // Anchor on the most recent day that keeps the streak alive.
  let cursor = days.has(today) ? today : shift(today, -1);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shift(cursor, -1);
  }
  return streak;
}

/** One compact stat in the summary strip. */
function StatChip({ icon: Icon, value, label, tone = "brand" }) {
  const toneClass = {
    brand: "text-brand-600 bg-brand-50",
    amber: "text-amber-600 bg-amber-50",
    slate: "text-slate-500 bg-slate-100",
  }[tone];

  return (
    <div className="flex items-center gap-2.5 px-1 py-1">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClass}`}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold leading-tight text-slate-800 tabular-nums">{value}</p>
        <p className="truncate text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

/** One journal entry rendered as a card rather than a table row. */
function JournalCard({ journal, onViewFeedback }) {
  const hasComment = Boolean(journal.supervisor_comment?.trim());
  const StatusIcon = STATUS_ICON[journal.status];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-200">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">{formatDate(journal.date)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {journal.hours_worked != null
              ? formatHours(Number(journal.hours_worked))
              : "No hours logged"}
          </p>
        </div>
        <Badge tone={TONE[journal.status] ?? "gray"}>
          {StatusIcon && <StatusIcon className="mr-1 h-3 w-3" aria-hidden />}
          {JOURNAL_STATUS_LABELS[journal.status] ?? journal.status}
        </Badge>
      </div>

      <section className="mt-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Today&apos;s Activities
        </h4>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
          {journal.activities || "—"}
        </p>
      </section>

      {(journal.challenges || journal.learnings) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {journal.challenges && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Challenges
              </h4>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">
                {journal.challenges}
              </p>
            </section>
          )}
          {journal.learnings && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Learnings
              </h4>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">
                {journal.learnings}
              </p>
            </section>
          )}
        </div>
      )}

      {/* Feedback is part of the entry, not a separate table column. */}
      <section
        className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${
          hasComment
            ? "border-brand-100 bg-brand-50/60"
            : "border-dashed border-slate-200 bg-slate-50"
        }`}>
        <div className="flex min-w-0 items-center gap-2">
          <MessageSquareQuote
            aria-hidden
            className={`h-4 w-4 shrink-0 ${hasComment ? "text-brand-600" : "text-slate-400"}`}
          />
          <p className={`text-sm ${hasComment ? "font-medium text-brand-800" : "text-slate-400"}`}>
            {hasComment ? "Supervisor left feedback" : "No feedback yet"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onViewFeedback(journal)}
          className="flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-100/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
          {hasComment ? "View" : "Check"}
          <span aria-hidden>&rarr;</span>
        </button>
      </section>
    </article>
  );
}

export default function InternJournal() {
  const { profile, internId } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  // The form is collapsed by default so the page reads as a journal to review
  // rather than a blank form to fill in.
  const [formOpen, setFormOpen] = useState(false);
  // Which journal entry's supervisor feedback is currently open in the modal.
  const [feedbackJournal, setFeedbackJournal] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: { date: todayISO(), activities: "", hours_worked: "", challenges: "", learnings: "" },
  });

  const load = useCallback(async () => {
    if (!internId) {
      setRows([]);
      setLoading(false);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await journalService.list({ internId, page: 1, pageSize: 30 });
      let data = res.data ?? [];
      if (search) {
        const q = search.toLowerCase();
        data = data.filter((r) => (r.activities ?? "").toLowerCase().includes(q));
      }
      setRows(data);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [internId, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(values) {
    if (saving) return;
    if (!internId) {
      toast.error("Your intern profile isn't linked yet. Please contact an administrator.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("No internet connection. Please check your network and try again.");
      return;
    }
    if (values.date && values.date > todayISO()) {
      toast.error("Journal date cannot be in the future.");
      return;
    }
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
      // Collapse the form so the new entry is immediately visible in the list.
      setFormOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Summary figures for the motivational strip. `rows` is already limited to
  // the most recent 30 entries, so these describe what the intern sees rather
  // than their lifetime totals.
  const stats = useMemo(() => {
    const totalHours = rows.reduce(
      (sum, r) => sum + (Number(r.hours_worked) || 0),
      0,
    );
    return {
      entries: rows.length,
      hours: Math.round(totalHours * 100) / 100,
      streak: computeStreak(rows.map((r) => r.date)),
    };
  }, [rows]);

  const today = todayISO();
  const hasEntryToday = useMemo(
    () => rows.some((r) => String(r.date ?? "").slice(0, 10) === today),
    [rows, today],
  );

  function openForm() {
    reset({
      date: today,
      activities: "",
      hours_worked: "",
      challenges: "",
      learnings: "",
    });
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Daily Journal"
        description="Document your OJT journey, one day at a time."
      />

      {/* Summary strip: gives a reason to return to the page. */}
      <Card>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <StatChip
            icon={NotebookPen}
            value={stats.entries}
            label={stats.entries === 1 ? "Journal Entry" : "Journal Entries"}
          />
          <StatChip
            icon={Clock}
            value={formatHours(stats.hours)}
            label="Hours Logged"
            tone="slate"
          />
          <StatChip
            icon={Flame}
            value={stats.streak}
            label="Day Streak"
            tone="amber"
          />
        </div>
        {stats.streak > 0 && (
          <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
            Keep documenting your OJT journey — you&apos;re on a{" "}
            <span className="font-semibold text-amber-600">
              {stats.streak}-day streak
            </span>
            .
          </p>
        )}
      </Card>

      {/* The form is an action, not a permanent blank panel. */}
      {formOpen ? (
        <Card>
          <div className="flex items-center justify-between border-b border-brand-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">
              {hasEntryToday ? "Add Another Entry" : "Write Today's Journal"}
            </h3>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="min-h-[36px] rounded-lg px-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
              Close
            </button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Date"
                maxLength={10}
                type="date"
                max={today}
                error={errors.date?.message}
                {...register("date", {
                  required: "Date is required",
                  validate: (v) =>
                    !v || v <= today || "Date cannot be in the future",
                })}
              />
              <Input
                label="Hours Worked"
                maxLength={6}
                type="number"
                step="0.5"
                min={0}
                max={24}
                error={errors.hours_worked?.message}
                {...register("hours_worked", {
                  required: "Hours worked is required",
                  min: { value: 0, message: "Hours worked must be 0 or greater" },
                  max: { value: 24, message: "Hours worked cannot exceed 24" },
                })}
              />
            </div>

            <div>
              <Textarea
                label="What did you work on today?"
                placeholder="Tell us about the tasks and activities you completed…"
                rows={4}
                maxLength={250}
                error={errors.activities?.message}
                {...register("activities", {
                  required: "Activities are required",
                  validate: (v) =>
                    (v ?? "").trim().length > 0 || "Activities are required",
                })}
              />
              <CharCounter value={watch("activities")} limit={250} />
            </div>

            <div>
              <Textarea
                label="What challenges did you encounter?"
                placeholder="Describe any problems or difficulties you faced…"
                rows={3}
                maxLength={250}
                {...register("challenges")}
              />
              <CharCounter value={watch("challenges")} limit={250} />
            </div>

            <div>
              <Textarea
                label="What did you learn today?"
                placeholder="Share a skill, concept, or experience you gained…"
                rows={3}
                maxLength={250}
                {...register("learnings")}
              />
              <CharCounter value={watch("learnings")} limit={250} />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" loading={saving}>
                Submit Journal
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="flex justify-center">
          <Button onClick={openForm} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" aria-hidden />
            Write Today&apos;s Journal
          </Button>
        </div>
      )}

      {/* History as cards: reads like a journal, and stacks cleanly on mobile
          where the previous five-column table had to scroll sideways. */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-brand-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-slate-800">Recent Journals</h3>
          <Input
            placeholder="Search activities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
            aria-label="Search journal activities"
          />
        </div>
        <div className="p-4">
          {loading ? (
            <Spinner label="Loading journals…" />
          ) : loadError ? (
            <ErrorAlert
              message={loadError.message}
              onRetry={load}
              loading={loading}
            />
          ) : rows.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">
                {search
                  ? "No journals match your search."
                  : "No journals submitted yet. Start documenting your OJT journey today."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <JournalCard
                  key={r.id}
                  journal={r}
                  onViewFeedback={setFeedbackJournal}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      <JournalFeedbackModal
        journal={feedbackJournal}
        open={Boolean(feedbackJournal)}
        onClose={() => setFeedbackJournal(null)}
      />
    </div>
  );
}
