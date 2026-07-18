// src/pages/supervisor/SupervisorDashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { BarChart } from "@/components/ui/Chart";
import { dashboardService } from "@/services/dashboardService";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/utils/format";

const ICONS = {
  assigned: "assigned",
  attendance: "attendance",
  journal: "journal",
  eval: "eval",
};

export default function SupervisorDashboard() {
  const { profile, supervisorId } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    dashboardService.supervisorStats(supervisorId).then((s) => active && setStats(s));
    return () => {
      active = false;
    };
  }, [profile, supervisorId]);

  if (!stats) return <Spinner label="Loading dashboard…" />;

  const cards = [
    { label: "Assigned Interns", value: formatNumber(stats.assignedInterns), icon: ICONS.assigned, tone: "brand" },
    { label: "Attendance Today", value: formatNumber(stats.attendanceToday), icon: ICONS.attendance, tone: "green" },
    { label: "Pending Journals", value: formatNumber(stats.pendingJournals), icon: ICONS.journal, tone: "amber" },
    { label: "Pending Evaluations", value: formatNumber(stats.pendingEvaluations), icon: ICONS.eval, tone: "red" },
  ];

  const workloadData = [
    { label: "Pending Journals", value: stats.pendingJournals },
    { label: "Pending Evals", value: stats.pendingEvaluations },
    { label: "Attendance Today", value: stats.attendanceToday },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h2 className="text-xl font-bold text-slate-800">
          Welcome, {profile?.full_name?.split(" ")[0] ?? "Supervisor"}
        </h2>
        <p className="text-sm text-slate-500">
          Track and evaluate your assigned interns.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="animate-fade-up">
          <div className="border-b border-brand-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">Your workload</h3>
            <p className="mt-0.5 text-sm text-slate-500">Items needing your attention.</p>
          </div>
          <div className="p-5">
            <BarChart data={workloadData} />
          </div>
        </Card>

        <Card className="animate-fade-up">
          <div className="border-b border-brand-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">Your responsibilities</h3>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            <Link
              to="/supervisor/interns"
              className="rounded-lg border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              View Assigned Interns
            </Link>
            <Link
              to="/supervisor/journals"
              className="rounded-lg border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              Review Journals
            </Link>
            <Link
              to="/supervisor/evaluations"
              className="rounded-lg border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              Submit Evaluations
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
