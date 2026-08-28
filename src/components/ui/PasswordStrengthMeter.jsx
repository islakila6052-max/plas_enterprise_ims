// src/components/ui/PasswordStrengthMeter.jsx
import { cn } from "@/utils/cn";

/**
 * Minimal password strength indicator: a single thin line that fills and
 * changes color as more password requirements are met. Replaces the old
 * bulleted requirements list.
 *
 * Requirements (same as the Add Intern / Add Supervisor validation rules):
 *   1. At least 8 characters
 *   2. One uppercase letter (A-Z)
 *   3. One lowercase letter (a-z)
 *   4. One number (0-9)
 *   5. One symbol (!@#$…)
 */
const CHECKS = [
  (pw) => pw.length >= 8,
  (pw) => /[A-Z]/.test(pw),
  (pw) => /[a-z]/.test(pw),
  (pw) => /\d/.test(pw),
  (pw) => /[^A-Za-z0-9]/.test(pw),
];

/** Track/fill colors per number of met requirements. */
const STRENGTH_STYLES = [
  "", // 0 met — empty track only
  "bg-red-500", // 1 — very weak
  "bg-orange-500", // 2 — weak
  "bg-amber-500", // 3 — fair
  "bg-lime-500", // 4 — good
  "bg-green-600", // 5 — strong (all requirements met)
];

export default function PasswordStrengthMeter({ password = "", className = "" }) {
  const met = CHECKS.reduce((n, check) => n + (check(password) ? 1 : 0), 0);
  const pct = (met / CHECKS.length) * 100;

  return (
    <div
      className={cn(
        "mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200",
        className,
      )}
      role="progressbar"
      aria-label="Password strength"
      aria-valuemin={0}
      aria-valuemax={CHECKS.length}
      aria-valuenow={met}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          STRENGTH_STYLES[met],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
