// src/components/journal/MonthProgress.jsx
import { useMemo } from "react";
import { todayISO } from "@/utils/format";

/** YYYY-MM-DD from numeric parts, using UTC to stay timezone-safe. */
function ymd(y, m, d) {
  return new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Month-at-a-glance consistency tracker.
 *
 * Shows the current month as a compact grid, marking the days the intern has
 * documented. Deliberately low-key: a filled dot per documented day and a ring
 * on today, with no scores or badges, so it reads as a professional record of
 * consistency rather than a game.
 */
export default function MonthProgress({ rows = [], onSelectDay }) {
  const today = todayISO();

  const { monthLabel, days, documentedCount, elapsedDays } = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    const monthIndex = m - 1;

    // Date -> status, so a day with two entries still renders one cell.
    const byDate = new Map();
    for (const r of rows) {
      const key = String(r.date ?? "").slice(0, 10);
      if (key) byDate.set(key, r);
    }

    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const leadingBlanks = new Date(Date.UTC(y, monthIndex, 1)).getUTCDay();

    const cells = [];
    for (let i = 0; i < leadingBlanks; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = ymd(y, monthIndex, d);
      cells.push({ key, day: d, journal: byDate.get(key) ?? null, isToday: key === today, isFuture: key > today });
    }

    return {
      monthLabel: new Date(Date.UTC(y, monthIndex, 1)).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      days: cells,
      documentedCount: cells.filter((c) => c?.journal).length,
      elapsedDays: cells.filter((c) => c && !c.isFuture).length,
    };
  }, [rows, today]);

  const percent = elapsedDays > 0 ? Math.round((documentedCount / elapsedDays) * 100) : 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">This Month</h3>
        <p className="text-xs text-slate-500 tabular-nums">
          {documentedCount} of {elapsedDays} days documented
        </p>
      </div>

      <div
        className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`${percent}% of days so far this month have a journal entry`}>
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-1 text-xs text-slate-500">{monthLabel}</p>

      <div className="mt-3 grid grid-cols-7 gap-1" aria-hidden>
        {WEEKDAYS.map((w, i) => (
          <span key={`${w}-${i}`} className="pb-1 text-center text-[10px] font-medium text-slate-400">
            {w}
          </span>
        ))}

        {days.map((cell, i) => {
          if (!cell) return <span key={`blank-${i}`} />;

          const { journal, isToday, isFuture } = cell;
          const dotTone = journal
            ? journal.status === "approved"
              ? "bg-brand-500"
              : journal.status === "rejected"
                ? "bg-red-400"
                : "bg-amber-400"
            : null;

          return (
            <button
              key={cell.key}
              type="button"
              disabled={!journal}
              onClick={() => journal && onSelectDay?.(journal)}
              title={
                journal
                  ? `${formatTitle(journal.date)} — open entry`
                  : isFuture
                    ? "Upcoming"
                    : "No journal"
              }
              aria-label={
                journal
                  ? `${formatTitle(journal.date)}: journal documented, ${journal.status}`
                  : `${formatTitle(cell.key)}: no journal`
              }
              className={[
                "relative flex aspect-square w-full items-center justify-center rounded-lg text-xs transition",
                isToday ? "font-bold ring-2 ring-brand-500 ring-offset-1" : "",
                journal ? "cursor-pointer hover:bg-brand-50" : "cursor-default",
                isFuture ? "text-slate-300" : "text-slate-600",
              ].join(" ")}>
              <span className={journal ? "text-brand-800" : ""}>{cell.day}</span>
              {dotTone && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${dotTone}`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Green = approved · Amber = awaiting review · Red = returned
      </p>
    </section>
  );
}

function formatTitle(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  if ([y, m, d].some(Number.isNaN)) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
