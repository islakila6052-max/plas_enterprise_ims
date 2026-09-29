// src/components/journal/JournalFeedbackButton.jsx
import { MessageSquareQuote, MessageSquare } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * Clickable affordance that opens the supervisor feedback modal for a journal.
 *
 * Two visual states so an intern can tell at a glance which entries have been
 * reviewed with comments and which are still waiting:
 *   - filled icon + label  -> supervisor left a comment
 *   - muted icon + label   -> no comment yet
 *
 * Sized for touch (min 44px target) on mobile while staying compact on desktop.
 */
export default function JournalFeedbackButton({ journal, onClick }) {
  const hasComment = Boolean(journal?.supervisor_comment?.trim());

  return (
    <button
      type="button"
      onClick={onClick}
      title={hasComment ? "View supervisor feedback" : "No feedback yet"}
      aria-label={
        hasComment
          ? "View supervisor feedback for this journal entry"
          : "No supervisor feedback yet for this journal entry"
      }
      className={cn(
        "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        hasComment
          ? "border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-400 hover:bg-brand-100"
          : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-500",
      )}>
      {hasComment ? (
        <MessageSquareQuote aria-hidden className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <MessageSquare aria-hidden className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="whitespace-nowrap">
        {hasComment ? "Feedback" : "No feedback"}
      </span>
    </button>
  );
}
