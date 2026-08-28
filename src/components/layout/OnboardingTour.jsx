// src/components/layout/OnboardingTour.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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
        "The interns currently under your supervision. Open any intern to review their journals, attendance, and documents in one place.",
      tip: "You only see interns assigned to you — your view stays focused.",
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

const CARD_WIDTH_DESKTOP = 380;
const CARD_WIDTH_TABLET = 340;
const CARD_MARGIN = 16;
const CARD_GAP = 20;
const EST_CARD_HEIGHT = 340;
const TRANSITION_MS = 200;

/**
 * Interactive first-time onboarding tour. Highlights each sidebar feature
 * in order with Next / Back / Skip / Finish controls. Runs automatically on
 * an admin's first dashboard visit; can be restarted from the profile menu.
 */
export default function OnboardingTour({ active, onFinish }) {
  const { role, profile } = useAuth();

  const items = useMemo(() => getNavItems(role), [role]);
  const steps = useMemo(() => buildSteps(items), [items]);

  // -1 = welcome screen, 0..n-1 = feature steps, steps.length = finish screen
  const [phase, setPhase] = useState(-1);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  }));

  // Entrance animation flag for the welcome/finish full-screen cards.
  const [entered, setEntered] = useState(false);
  // Cross-fade flag for step-to-step content swaps.
  const [cardVisible, setCardVisible] = useState(true);
  const transitionTimer = useRef(null);
  const missCount = useRef(0);

  const step = steps[stepIndex];
  const showWelcome = phase === -1;
  const showFinish = phase === steps.length;
  const touring = phase >= 0 && phase < steps.length;
  const isMobile = viewport.width < 640;
  const isTablet = viewport.width >= 640 && viewport.width < 1024;

  // Reset to the welcome screen whenever the tour is activated.
  useEffect(() => {
    if (!active) return;
    setPhase(-1);
    setStepIndex(0);
    setTargetRect(null);
    missCount.current = 0;
  }, [active]);

  // Trigger the entrance animation whenever we land on a full-screen phase.
  useEffect(() => {
    if (!active || !(showWelcome || showFinish)) return;
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [active, showWelcome, showFinish]);

  // Track viewport size for responsive positioning.
  useEffect(() => {
    function onResize() {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Track the highlighted element's position while touring.
  useEffect(() => {
    if (!touring || !step) return;
    let raf;

    function measure() {
      const el = document.querySelector(step.target);
      if (el) {
        missCount.current = 0;
        const r = el.getBoundingClientRect();
        setTargetRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        });
      } else {
        // Element not in the DOM/visible yet (e.g. collapsed mobile nav).
        // Give it a short grace period, then fall back to a centered card
        // rather than getting stuck with no visible tour at all.
        missCount.current += 1;
        if (missCount.current > 20) setTargetRect(null);
      }
      raf = requestAnimationFrame(measure);
    }
    measure();

    return () => cancelAnimationFrame(raf);
  }, [touring, step]);

  // Keyboard navigation: Esc to skip, arrow keys to move between steps.
  useEffect(() => {
    if (!active) return;
    function onKey(e) {
      if (e.key === "Escape") finishTour();
      else if (e.key === "ArrowRight") nextStep();
      else if (e.key === "ArrowLeft") prevStep();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, phase, stepIndex]);

  useEffect(() => {
    return () => clearTimeout(transitionTimer.current);
  }, []);

  if (!active) return null;

  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";

  function finishTour() {
    markTourCompleted();
    onFinish?.();
  }

  /** Cross-fades the step card out, applies the change, then fades it in. */
  function transitionTo({ nextPhase, nextIndex }) {
    setCardVisible(false);
    clearTimeout(transitionTimer.current);
    transitionTimer.current = setTimeout(() => {
      if (nextPhase !== undefined) setPhase(nextPhase);
      if (nextIndex !== undefined) setStepIndex(nextIndex);
      setCardVisible(true);
    }, TRANSITION_MS);
  }

  function nextStep() {
    if (showWelcome) return setPhase(0);
    if (!touring) return;
    if (stepIndex >= steps.length - 1) {
      transitionTo({ nextPhase: steps.length });
      return;
    }
    transitionTo({ nextIndex: stepIndex + 1 });
  }

  function prevStep() {
    if (showWelcome || !touring) return;
    if (stepIndex === 0) {
      transitionTo({ nextPhase: -1 });
      return;
    }
    transitionTo({ nextIndex: stepIndex - 1 });
  }

  /** Computes an in-viewport position for the step card next to the target. */
  function getCardStyle() {
    if (isMobile) {
      return {
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        width: "auto",
        maxWidth: "none",
      };
    }

    const width = isTablet ? CARD_WIDTH_TABLET : CARD_WIDTH_DESKTOP;

    if (!targetRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        width,
        transform: "translate(-50%, -50%)",
      };
    }

    let left = targetRect.left + targetRect.width + CARD_GAP;
    if (left + width + CARD_MARGIN > viewport.width) {
      // Not enough room on the right — flip to the left of the target.
      left = targetRect.left - width - CARD_GAP;
    }
    left = Math.min(
      Math.max(left, CARD_MARGIN),
      viewport.width - width - CARD_MARGIN,
    );

    let top = targetRect.top + targetRect.height / 2 - EST_CARD_HEIGHT / 2;
    top = Math.min(
      Math.max(top, CARD_MARGIN),
      viewport.height - EST_CARD_HEIGHT - CARD_MARGIN,
    );

    return { position: "fixed", top, left, width };
  }

  /* ---------------- Welcome screen ---------------- */
  if (showWelcome) {
    return (
      <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true">
        <div
          className={`absolute inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity duration-300 ${
            entered ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute left-1/2 top-1/2 w-[92vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl transition-all duration-300 ease-out ${
            entered ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 ring-1 ring-brand-100">
            <Icon name="dashboard" className="h-8 w-8 text-brand-600" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-500">
            Quick Tour
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-800">
            Welcome, {firstName} 👋
          </h2>
          <p className="mx-auto mt-3 max-w-[320px] text-sm leading-relaxed text-slate-500">
            Let's walk through the key areas of your Internship Management
            System — it only takes about a minute.
          </p>

          <div className="mt-7 flex flex-col gap-2.5">
            <Button onClick={() => setPhase(0)} className="w-full">
              Start Tour
            </Button>
            <button
              type="button"
              onClick={finishTour}
              className="rounded-lg py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600">
              Skip for now
            </button>
          </div>

          <p className="mt-5 text-[11px] text-slate-300">
            Tip: use ← → to navigate, Esc to exit anytime
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- Finish screen ---------------- */
  if (showFinish) {
    return (
      <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true">
        <div
          className={`absolute inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity duration-300 ${
            entered ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute left-1/2 top-1/2 w-[92vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl transition-all duration-300 ease-out ${
            entered ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}>
          <div
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-3xl ring-1 ring-green-100 transition-all delay-100 duration-300 ease-out ${
              entered ? "opacity-100 scale-100" : "opacity-0 scale-75"
            }`}>
            🎉
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">
            You're all set!
          </h2>
          <p className="mx-auto mt-3 max-w-[320px] text-sm leading-relaxed text-slate-500">
            You now know the key areas of the Internship Management System.
            Explore on your own, and restart this tour anytime from your profile
            menu.
          </p>
          <Button onClick={finishTour} className="mt-7 w-full">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!step) return null;

  const isLast = stepIndex === steps.length - 1;
  const pct = Math.round(((stepIndex + 1) / steps.length) * 100);
  const cardStyle = getCardStyle();

  return (
    <div className="fixed inset-0 z-[9998]" role="dialog" aria-modal="true">
      {/* Spotlight cut-out around the highlighted item. The huge box-shadow
          dims everything else in ONE layer — no separate backdrop, so there
          is no flicker or double-dimming while stepping. Position/size
          transition smoothly between steps; no pulsing or flashing. */}
      {targetRect && (
        <div
          className="absolute rounded-xl ring-2 ring-brand-400/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] transition-all duration-300 ease-out"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}
      {!targetRect && (
        <div className="absolute inset-0 bg-slate-900/60 transition-opacity duration-300" />
      )}

      {/* Step card */}
      <div
        className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 ease-out ${
          cardVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        }`}
        style={cardStyle}
        aria-live="polite">
        {/* Branded header strip */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 shadow-sm shadow-brand-600/30">
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
        </div>

        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-600">
            {step.description}
          </p>

          {step.tip && (
            <div className="mt-3 flex gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <span aria-hidden className="text-sm leading-none">
                💡
              </span>
              <p className="text-xs leading-relaxed text-amber-800">
                <span className="font-semibold">Pro tip:</span> {step.tip}
              </p>
            </div>
          )}

          {/* Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold tabular-nums text-slate-400">
              <span>
                {String(stepIndex + 1).padStart(2, "0")} /{" "}
                {String(steps.length).padStart(2, "0")}
              </span>
              <span>{pct}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={finishTour}
              className="rounded-lg px-1 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:text-slate-600">
              Skip Tour
            </button>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={prevStep}
                className="!px-3 !py-1.5 !text-xs transition-transform active:scale-[0.97]">
                ← Back
              </Button>
              <Button
                onClick={nextStep}
                className="!px-3 !py-1.5 !text-xs transition-transform active:scale-[0.97]">
                {isLast ? "Finish ✓" : "Next →"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
