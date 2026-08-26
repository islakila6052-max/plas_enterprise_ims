// src/components/layout/OnboardingTour.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getNavItems } from "@/components/layout/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Button from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

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
 * Build one tour step per sidebar item. Copy is written for first-time HR
 * administrators: what it does + why it matters, plus an actionable pro tip.
 */
function buildSteps(items) {
  const copy = {
    Dashboard: {
      description:
        "Your command center. See the whole internship program at a glance — total and active interns, attendance today, and evaluations waiting for your review.",
      tip: "Check this page every morning to spot anything that needs attention.",
    },
    Interns: {
      description:
        "The heart of the system. Add new interns, edit their records, assign supervisors, and track each internship from start to completion.",
      tip: "Use the search bar to find any intern in seconds.",
    },
    Supervisors: {
      description:
        "Create supervisor accounts here. Each supervisor belongs to a department and can only manage interns assigned to them.",
      tip: "Assign a supervisor before adding interns to that department.",
    },
    "Assigned Interns": {
      description:
        "A focused list of the interns currently under your supervision, with quick access to their journals, attendance, and documents.",
      tip: "",
    },
    Attendance: {
      description:
        "Monitor daily time-in and time-out records. Review timeout claims, flag late arrivals, and keep everyone accountable.",
      tip: "Records update in real time as interns clock in.",
    },
    "Daily Journals": {
      description:
        "Interns submit daily accomplishment reports here. Review each entry and approve it or send it back with feedback.",
      tip: "Pending journals are highlighted so nothing gets missed.",
    },
    Documents: {
      description:
        "Verify submitted requirements — resumes, MOAs, endorsement letters, school requirements, and completion reports.",
      tip: "Approve documents only after checking they are signed and complete.",
    },
    Evaluations: {
      description:
        "Performance evaluations submitted by supervisors. Review ratings and comments before finalizing each intern's assessment.",
      tip: "",
    },
    Announcements: {
      description:
        "Broadcast messages to everyone — or target specific roles. Perfect for orientation schedules, deadlines, and company updates.",
      tip: "Announcements appear instantly on interns' and supervisors' dashboards.",
    },
    Reports: {
      description:
        "Generate official reports for attendance, journals, and evaluations. Filter by date range or status, then export for printing.",
      tip: "Exports open in a print-ready format.",
    },
    Institutions: {
      description:
        "Manage partner schools and companies, including the academic programs they offer. Interns are linked to these institutions.",
      tip: "",
    },
    "Audit Logs": {
      description:
        "Your security trail. Every administrative action is recorded here — who did what, when, and exactly what changed (before and after values).",
      tip: "This log is read-only and cannot be edited by anyone.",
    },
    Settings: {
      description:
        "Company-wide configuration — required internship hours, program defaults, and other system-wide options.",
      tip: "Changes here affect all users immediately.",
    },
    Profile: {
      description:
        "Your personal account. Update your name, photo, contact details, and password anytime.",
      tip: "Use a strong, unique password to keep your admin account secure.",
    },
    // ---- Supervisor ----
    "Assigned Interns": {
      description:
        "The interns currently under your supervision. Open any intern to review their journals, attendance, and documents in one place.",
      tip: "You only see interns assigned to you — your view stays focused.",
    },
    // ---- Intern ----
    "Daily Journal": {
      description:
        "Record what you accomplished each day. Your supervisor reviews every entry, so write clearly and honestly.",
      tip: "Submit your journal daily — it counts toward your evaluation.",
    },
    Evaluation: {
      description:
        "See how you're doing. Your supervisor's ratings and feedback appear here once evaluations are submitted.",
      tip: "",
    },
  };

  return items.map((item) => ({
    label: item.label,
    icon: item.icon,
    target: `a[href="${item.to}"]`,
    ...(copy[item.label] ?? {
      description: `Open the ${item.label} section of the system.`,
      tip: "",
    }),
  }));
}

/**
 * Interactive first-time onboarding tour. Highlights each sidebar feature
 * in order with Next / Back / Skip / Finish controls. Runs automatically on
 * an admin's first dashboard visit; can be restarted from the profile menu.
 */
export default function OnboardingTour({ active, onFinish }) {
  const { role, profile } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);

  const items = useMemo(() => getNavItems(role), [role]);
  const steps = useMemo(() => buildSteps(items), [items]);

  // -1 = welcome screen, 0..n-1 = feature steps, steps.length = finish screen
  const [phase, setPhase] = useState(-1);
  const step = steps[stepIndex];
  const showWelcome = phase === -1;
  const showFinish = phase === steps.length;
  const touring = phase >= 0 && phase < steps.length;

  // Reset to the welcome screen whenever the tour is activated.
  useEffect(() => {
    if (!active) return;
    setPhase(-1);
    setStepIndex(0);
  }, [active]);

  // Track the highlighted element's position while touring.
  useEffect(() => {
    if (!touring || !step) return;
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
  }, [touring, step]);

  if (!active) return null;

  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";

  function finishTour() {
    markTourCompleted();
    onFinish?.();
  }
  function nextStep() {
    if (showWelcome) return setPhase(0);
    if (stepIndex >= steps.length - 1) return setPhase(steps.length);
    setStepIndex((i) => i + 1);
  }
  function prevStep() {
    if (showWelcome) return;
    if (stepIndex === 0) return setPhase(-1);
    setStepIndex((i) => i - 1);
  }

  /* ---------------- Welcome screen ---------------- */
  if (showWelcome) {
    return (
      <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
        <div className="absolute left-1/2 top-1/2 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
            <Icon name="dashboard" className="h-7 w-7 text-brand-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            Welcome, {firstName}! 👋
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            You have full control of the Internship Management System. Let us
            walk you through each section — it only takes a minute.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => setPhase(0)} className="w-full">
              Start the Tour
            </Button>
            <button
              type="button"
              onClick={finishTour}
              className="text-xs font-medium text-slate-400 hover:text-slate-600">
              Skip — I'll explore on my own
            </button>
          </div>
          <p className="mt-4 text-[11px] text-slate-300">
            Tip: use ← → keys to navigate, Esc to exit
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- Finish screen ---------------- */
  if (showFinish) {
    return (
      <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true">
        <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />
        <div className="absolute left-1/2 top-1/2 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl">
            🎉
          </div>
          <h2 className="text-xl font-bold text-slate-800">You're all set!</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            You now know your way around the system. If you ever need a
            refresher, restart this tour anytime from your profile menu.
          </p>
          <Button onClick={finishTour} className="mt-6 w-full">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!step || !targetRect) return null;

  const isLast = stepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true">
      {/* Spotlight cut-out around the highlighted item. The huge box-shadow
          dims everything else in ONE layer — no separate backdrop, so there
          is no flicker or double-dimming while stepping. Static ring: no
          pulsing/glow animation. */}
      <div
        className="absolute rounded-xl ring-4 ring-brand-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] transition-none"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
        }}
      />

      {/* Step tooltip — centered */}
      <div
        className="absolute w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}>
        {/* Branded header strip */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600">
            <Icon
              name={step.icon ?? "dashboard"}
              className="h-5 w-5 text-white"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
              Step {stepIndex + 1} of {steps.length}
            </p>
            <h3 className="truncate text-base font-bold text-slate-800">
              {step.label}
            </h3>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {Math.round(((stepIndex + 1) / steps.length) * 100)}%
          </span>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-600">
            {step.description}
          </p>

          {step.tip && (
            <div className="mt-3 flex gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <span aria-hidden className="text-sm">
                💡
              </span>
              <p className="text-xs leading-relaxed text-amber-800">
                <span className="font-semibold">Pro tip:</span> {step.tip}
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={finishTour}
              className="text-xs font-medium text-slate-400 hover:text-slate-600">
              Skip Tour
            </button>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={prevStep}
                disabled={stepIndex === 0}
                className="!px-3 !py-1.5 !text-xs">
                Back
              </Button>
              <Button onClick={nextStep} className="!px-3 !py-1.5 !text-xs">
                {isLast ? "Finish 🎉" : "Next →"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
