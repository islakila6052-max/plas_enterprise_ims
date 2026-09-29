// src/components/journal/MonthProgress.jsx
import { useMemo } from "react";
import { todayISO } from "@/utils/format";

/**
 * Month-at-a-glance consistency tracker.
 *
 * Deliberately minimal: a single row of small dots, one per day elapsed this
 * month, so an intern can see their consistency without the page being
 * dominated by a calendar grid. Filled dots are days that were documented,
 * hollow dots are gaps. No scores, badges or headings.
 *
 * Days are also keyboard-reachable buttons with a descriptive label, so the
 * strip is usable with a screen reader even though it is visually just dots.
 */
export default function MonthProgress({ rows = [], onSelectDay }) {
  const today = todayISO();

  const { monthLabel, dots, documentedCount, elapsedDays } = useMemo(() => {
    const [y, m] = today.split("-").map(Number);
    const monthIndex = m - 1;

    // Date -> journal, so a day with two entries still renders one dot.
    const byDate = new Map();
    for (const r of rows) {
      const key = String(r?.date ?? "").slice(0, 10);
      if (key) byDate.set(key, r);
    }

    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = [];
    for (let d = 1; d <= daysInMonth; d += 1) {
      const key = new Date(Date.UTC(y, monthIndex, d))
        .toISOString()
        .slice(0, 10);
      if (key > today) break; // stop at today; the month is still in progress
      cells.push({ key, day: d, journal: byDate.get(key) ?? null });
    }

    return {
      monthLabel: new Date(Date.UTC(y, monthIndex, 1)).toLocaleDateString(
        "en-US",
        { month: "long", year: "numeric", timeZone: "UTC" },
      ),
      dots: cells,
      documentedCount: cells.filter((c) => c.journal).length,
      elapsedDays: cells.length,
    };
  }, [rows, today]);

  const percent = elapsedDays > 0 ? Math.round((documentedCount / elapsedDays) * 100) : 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="text-xs font-medium text-slate-500">
          {monthLabel}
          <span className="ml-2 tabular-nums text-slate-400">
            {documentedCount}/{elapsedDays} days · {percent}%
          </span>
        </h3>

        <div className="flex flex-wrap items-center gap-1" role="img" aria-label={`${documentedCount} of ${elapsedDays} days documented this month`}>
          {dots.map((cell) =>
            cell.journal ? (
              <button
                key={cell.key}
                type="button"
                onClick={() => onSelectDay?.(cell.journal)}
                title={`Day ${cell.day} — ${cell.journal.status}`}
                aria-label={`Day ${cell.day}: documented, ${cell.journal.status}`}
                className="h-2 w-2 rounded-full bg-brand-500 transition hover:scale-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              />
            ) : (
              <span
                key={cell.key}
                title={`Day ${cell.day} — not documented`}
                className="h-2 w-2 rounded-full bg-slate-200"
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
}
