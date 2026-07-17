// src/components/ui/StatCard.jsx
import { cn } from "@/utils/cn";

/**
 * Dashboard statistic card.
 * - `label`, `value`, `hint`, `icon` (SVG path string), `tone`
 */
export default function StatCard({ label, value, hint, icon, tone = "brand" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
  };
  return (
    <div className="surface flex items-center gap-4 p-5">
      {icon && (
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            tones[tone],
          )}>
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
            <path d={icon} />
          </svg>
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {hint && <p className="truncate text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}
