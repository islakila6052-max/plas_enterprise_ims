// src/components/layout/OnboardingTour.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getNavItems } from "@/components/layout/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";

const STORAGE_KEY = "ims_onboarding_tour_completed";

/** True if this browser has already completed the onboarding tour. */
export function hasCompletedTour() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return true; // fail closed: never nag if storage is unavailable
  }
}

export function markTourCompleted() {
  try {
    localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    /* non-fatal */
  }
}

export function resetTour() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}

/**
 * Build one tour step per sidebar item. Each step targets the sidebar link
 * via its route path so steps stay in sync with the role's navigation.
 */
function buildSteps(items) {
  const descriptions = {
    Dashboard:
      "Your overview of the whole internship program — key stats and recent activity at a glance.",
    Interns:
      "Add, edit, and manage intern records — accounts, assignments, and internship details.",
    Supervisors:
      "Create supervisor accounts and assign them to departments to oversee interns.",
    "Assigned Interns":
      "The interns currently assigned to you, with quick access to their records.",
    Attendance:
      "Track daily time-in/time-out records, review claims, and monitor attendance issues.",
    "Daily Journals":
      "Review journals submitted by interns and approve or request revisions.",
    Documents:
      "Verify submitted requirements — resumes, MOAs, endorsements, and reports.",
    Evaluations:
      "View and manage performance evaluations submitted for each intern.",
    Announcements:
      "Publish announcements that reach supervisors and interns instantly.",
    Reports: "Generate and export attendance, journal, and evaluation reports.",
    Institutions: "Manage partner institutions and their academic programs.",
    "Audit Logs":
      "A read-only trail of every administrative action, with before/after values.",
    Settings:
      "Company-wide configuration such as required hours and program defaults.",
    Profile: "Update your own account details, photo, and password.",
  };

  return items.map((item) => ({
    label: item.label,
    target: `a[href="${item.to}"]`,
    description:
      descriptions[item.label] ??
      `Open the ${item.label} section of the system.`,
  }));
}

/**
 * Interactive first-time onboarding tour. Highlights each sidebar feature
 * in order with Next / Back / Skip / Finish controls. Runs automatically on
 * an admin's first dashboard visit; can be restarted from the profile menu.
 */
export default function OnboardingTour({ active, onFinish }) {
  const { role } = useAuth();
  const location = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const items = useMemo(() => getNavItems(role), [role]);
  const steps = useMemo(() => buildSteps(items), [items]);
  const step = steps[stepIndex];

  // Auto-start on the admin dashboard when the tour hasn't been completed.
  useEffect(() => {
    if (!active) return;
    setStepIndex(0);
  }, [active]);

  // Track the highlighted element's position.
  useEffect(() => {
    if (!active || !step) return;
    let raf;

    function measure() {
      const el = document.querySelector(step.target);
      if (el) {
        const r = el.getBoundingClientRect();
        setTargetRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        });
      }
      raf = requestAnimationFrame(measure);
    }
    measure();

    return () => cancelAnimationFrame(raf);
  }, [active, step]);

  if (!active || !step || !targetRect) return null;

  const finish = () => {
    markTourCompleted();
    onFinish?.();
  };

  const next = () =>
    stepIndex === steps.length - 1 ? finish() : setStepIndex((i) => i + 1);
  const back = () => setStepIndex((i) => Math.max(0, i - 1));

  // Tooltip placement: prefer to the RIGHT of the sidebar item. Only fall
  // back to below/above when the viewport is too narrow — never overlap the
  // highlighted item itself.
  const TOOLTIP_W = 320;
  const spaceRight = window.innerWidth - targetRect.right;
  let tooltipStyle;
  if (spaceRight >= TOOLTIP_W + 24) {
    tooltipStyle = {
      top: Math.min(Math.max(targetRect.top - 8, 16), window.innerHeight - 240),
      left: targetRect.right + 16,
    };
  } else {
    // Not enough room on the right: place under (or above) the item.
    const below = targetRect.bottom + 12;
    const fitsBelow = below + 220 < window.innerHeight;
    tooltipStyle = {
      top: fitsBelow ? below : Math.max(targetRect.top - 232, 16),
      left: Math.min(
        Math.max(targetRect.left, 16),
        window.innerWidth - TOOLTIP_W - 16,
      ),
    };
  }

  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true">
      {/* Dimmed backdrop with a cut-out around the highlighted item. */}
      <div className="absolute inset-0 bg-slate-900/60 transition-all" />
      <div
        className="absolute rounded-xl ring-4 ring-brand-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.6)]"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
        }}
      />

      {/* Step tooltip */}
      <div
        className="absolute rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
        style={{ ...tooltipStyle, width: TOOLTIP_W }}>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          Step {stepIndex + 1} of {steps.length}
        </p>
        <h3 className="mt-1 text-base font-bold text-slate-800">
          {step.label}
        </h3>
        <p className="mt-1 text-sm text-slate-500">{step.description}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Skip Tour
          </button>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={back}
              disabled={stepIndex === 0}
              className="!px-3 !py-1.5 !text-xs">
              Back
            </Button>
            <Button onClick={next} className="!px-3 !py-1.5 !text-xs">
              {isLast ? "Finish" : "Next"}
            </Button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="mt-3 flex justify-center gap-1">
          {steps.map((_, i) => (
            <span
              key={i}
              className={
                i === stepIndex
                  ? "h-1.5 w-4 rounded-full bg-brand-600"
                  : "h-1.5 w-1.5 rounded-full bg-slate-300"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
