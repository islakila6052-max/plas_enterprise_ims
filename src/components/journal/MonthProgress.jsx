// src/components/journal/MonthProgress.jsx
import { useMemo } from "react";
import { todayISO } from "@/utils/format";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_INITIALS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Compact month calendar showing which days were documented.
 *
 * An ordinary calendar, shrunk to fit a narrow sidebar column: small square
 * cells, day numbers, single-letter weekday headers. Kept deliberately plain —
 * one accent colour for documented days, one ring for today, everything else
 * plain text — so it reads as a professional record rather than a tracker.
 *
 * Days are keyboard-reachable buttons with descriptive labels, so the compact
 * presentation stays usable with a screen reader.
 */
export default function MonthProgress({ rows = [], onSelectDay }) {
  const today = todayISO();

  const { monthLabel, cells, documentedCount, elapsedDays } = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    const monthIndex = m - 1;

    // Date -> journal, so a day with two entries still renders one cell.
    const byDate = new Map();
    for (const r of rows) {
      const key = String(r?.date ?? "").slice(0, 10);
      if (key) byDate.set(key, r);
    }

    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    // getUTCDay is 0=Sunday, which matches the weekday header order above.
    const leadingBlanks = new Date(Date.UTC(y, monthIndex, 1)).getUTCDay();

    const grid = [];
    for (let i = 0; i < leadingBlanks; i += 1) grid.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = new Date(Date.UTC(y, monthIndex, d))
        .toISOString()
        .slice(0, 10);
      grid.push({
        key,
        day: d,
        journal: byDate.get(key) ?? null,
        isToday: key === today,
        isFuture: key > today,
      });
    }

    return {
      // Short label keeps the header to one line in a narrow column.
      monthLabel: `${MONTH_INITIALS[monthIndex]} ${y}`,
      cells: grid,
      documentedCount: grid.filter((c) => c?.journal).length,
      elapsedDays: grid.filter((c) => c && !c.isFuture).length,
    };
  }, [rows, today]);

  const percent =
    elapsedDays > 0 ? Math.round((documentedCount / elapsedDays) * 100) : 0;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-3"
      aria-label={`Monthly journal progress for ${monthLabel}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-700">{monthLabel}</h3>
        <p className="text-[11px] tabular-nums text-slate-400">
          {documentedCount}/{elapsedDays} · {percent}%
        </p>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_INITIALS.map((w, i) => (
          <span
            key={`${w}-${i}`}
            aria-hidden
            className="pb-1 text-center text-[9px] font-medium leading-none text-slate-300">
            {w}
          </span>
        ))}

        {cells.map((cell, i) => {
          if (!cell) return <span key={`blank-${i}`} aria-hidden />;

          const { journal, isToday, isFuture } = cell;
          const cls = [
            "flex aspect-square w-full items-center justify-center rounded text-[10px] leading-none tabular-nums transition",
            journal ? "bg-brand-50 font-semibold text-brand-700" : "",
            journal ? "cursor-pointer hover:bg-brand-100" : "cursor-default",
            !journal && isFuture ? "text-slate-200" : "text-slate-500",
            isToday ? "ring-1 ring-brand-500 ring-inset" : "",
          ].join(" ");

          if (!journal) {
            return (
              <span
                key={cell.key}
                aria-hidden
                title={`Day ${cell.day} — not documented`}
                className={cls}>
                {cell.day}
              </span>
            );
          }

          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDay?.(journal)}
              title={`Day ${cell.day} — ${journal.status}`}
              aria-label={`Day ${cell.day}: documented, ${journal.status}`}
              className={`${cls} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500`}>
              {cell.day}
            </button>
          );
        })}
      </div>
    </section>
  );
}

