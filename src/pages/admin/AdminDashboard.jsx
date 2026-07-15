import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { dashboardService } from "@/services/dashboardService";
import { useAuth } from "@/contexts/AuthContext";
import { formatNumber } from "@/utils/format";

const ICONS = {
  interns:
    "M16 11a4 4 0 10-4-4 4 4 0 004 4zm-8 0a4 4 0 10-4-4 4 4 0 004 4zm0 2c-2.7 0-8 1.34-8 4v3h10v-3c0-.97.74-1.85 1.93-2.5A14 14 0 008 13zm8 0c-2.7 0-8 1.34-8 4v3h16v-3c0-2.66-5.3-4-8-4z",
  active:
    "M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h-4v-2h2V7h2v6z",
  completed: "M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.5-1.5z",
  eval: "M12 17.3l5.2 3.1-1.4-5.9 4.6-4-6.1-.5L12 4l-2.3 5.9-6.1.5 4.6 4-1.4 5.9z",
  attendance: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12z",
};

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    dashboardService.adminStats().then((s) => active && setStats(s));
    return () => {
      active = false;
    };
  }, []);

  if (!stats) return <Spinner label="Loading dashboard…" />;

  const cards = [
    { label: "Total Interns", value: formatNumber(stats.totalInterns), icon: ICONS.interns, tone: "brand" },
    { label: "Active Interns", value: formatNumber(stats.activeInterns), icon: ICONS.active, tone: "green" },
    { label: "Completed Internships", value: formatNumber(stats.completedInternships), icon: ICONS.completed, tone: "blue" },
    { label: "Pending Evaluations", value: formatNumber(stats.pendingEvaluations), icon: ICONS.eval, tone: "amber" },
    { label: "Attendance Today", value: formatNumber(stats.attendanceToday), icon: ICONS.attendance, tone: "red" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          Welcome back, {profile?.full_name?.split(" ")[0] ?? "Admin"}
        </h2>
        <p className="text-sm text-slate-500">
          Here's an overview of your internship program.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">
              Quick actions
            </h3>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Link
              to="/admin/interns"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              + Add / Manage Interns
            </Link>
            <Link
              to="/admin/attendance"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              Review Attendance
            </Link>
            <Link
              to="/admin/reports"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              Generate Reports
            </Link>
            <Link
              to="/admin/settings"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              System Settings
            </Link>
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">
              Program summary
            </h3>
          </div>
          <dl className="divide-y divide-slate-100 p-5 text-sm">
            <div className="flex justify-between py-2">
              <dt className="text-slate-500">Active vs Completed</dt>
              <dd className="font-medium text-slate-700">
                {stats.activeInterns} / {stats.completedInternships}
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-slate-500">Evaluations awaiting review</dt>
              <dd className="font-medium text-slate-700">
                {stats.pendingEvaluations}
              </dd>
            </div>
            <div className="flex justify-between py-2">
              <dt className="text-slate-500">Checked in today</dt>
              <dd className="font-medium text-slate-700">
                {stats.attendanceToday}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
