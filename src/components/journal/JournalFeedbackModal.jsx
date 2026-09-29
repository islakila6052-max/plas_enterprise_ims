// src/components/journal/JournalFeedbackModal.jsx
import { MessageSquareQuote, MessageSquare } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { JOURNAL_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/utils/format";

const TONE = { pending: "amber", approved: "green", rejected: "red" };

/** Best available display name for the reviewing supervisor. */
function supervisorName(journal) {
  const s = journal?.supervisor;
  if (!s) return "Your supervisor";
  return s.full_name || [s.first_name, s.last_name].filter(Boolean).join(" ") || "Your supervisor";
}

/**
 * Read-only modal showing a supervisor's feedback on a journal entry, alongside
 * what the intern originally wrote.
 *
 * Interns could not see `supervisor_comment` at all before this existed — the
 * journal table listed date/activities/hours/status, so feedback a supervisor
 * left was written to the database but invisible to the person it was meant for.
 *
 * Read-only by design: the intern must not be able to edit a supervisor's words.
 */
export default function JournalFeedbackModal({ journal, open, onClose }) {
  if (!journal) return null;

  const comment = journal.supervisor_comment?.trim() || "";
  const hasComment = comment.length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Supervisor Feedback" size="md">
      <div className="space-y-4">
        {/* Which entry this feedback refers to */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Journal entry</p>
            <p className="font-medium text-slate-700">{formatDate(journal.date)}</p>
          </div>
          <Badge tone={TONE[journal.status] ?? "gray"}>
            {JOURNAL_STATUS_LABELS[journal.status] ?? journal.status}
          </Badge>
        </div>

        {/* The intern's own submission, for context */}
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Your entry
          </h4>
          <p className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
            {journal.activities || "—"}
          </p>
          {journal.hours_worked != null && (
            <p className="mt-1 text-xs text-slate-400">
              Hours logged: {journal.hours_worked}
            </p>
          )}
        </section>

        {/* The feedback itself */}
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Comment from {supervisorName(journal)}
          </h4>
          {hasComment ? (
            <div
              className={`flex gap-2 rounded-lg border p-3 ${
                journal.status === "rejected"
                  ? "border-red-100 bg-red-50"
                  : "border-brand-100 bg-brand-50/60"
              }`}>
              <MessageSquareQuote
                aria-hidden
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  journal.status === "rejected"
                    ? "text-red-500"
                    : "text-brand-600"
                }`}
              />
              <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                {comment}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-400">
              <MessageSquare aria-hidden className="h-4 w-4 shrink-0" />
              No feedback yet. Your supervisor hasn't reviewed this entry.
            </div>
          )}
        </section>

        {journal.status === "rejected" && hasComment && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This entry was returned for revision. Read the comment above, then
            submit a new journal entry with the changes.
          </p>
        )}
      </div>
    </Modal>
  );
}
