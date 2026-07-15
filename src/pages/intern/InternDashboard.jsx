import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import { dashboardService } from "@/services/dashboardService";
import { useAuth } from "@/contexts/AuthContext";
import { formatHours, formatNumber } from "@/utils/format";

const ICONS = {
  hours: "M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h-4v-2h2V7h2v6z",
  required: "M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.5-1.5z",
  remaining: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 100 12 6 6 0 000-12z",
  today: "M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z",
  announce: "M3 11l18-8-8 18-2-7-8-3z",
};

export default function InternDashboard() {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let active = true;
    const internId = profile?.intern_id ?? user?.id;
    dashboardService.internStats(internId).then((s) => active && setStats(s));
    return () => {
      active = false;
    };
  }, [profile, user]);

  if (!stats) return <Spinner label="Loading dashboard…" />;

  const cards = [
    { label: "Hours Rendered", value: formatHours(stats.hoursRendered), icon: ICONS.hours, tone: "brand" },
    { label: "Required Hours", value: formatHours(stats.requiredHours), icon: ICONS.required, tone: "blue" },
    { label: "Remaining Hours", value: formatHours(stats.remainingHours), icon: ICONS.remaining, tone: "green" },
    { label: "Today's Attendance", value: formatNumber(stats.todayAttendance), icon: ICONS.today, tone: "amber" },
    { label: "Latest Announcements", value: formatNumber(stats.latestAnnouncements), icon: ICONS.announce, tone: "red" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">
          Hi, {profile?.full_name?.split(" ")[0] ?? "Intern"} 👋
        </h2>
        <p className="text-sm text-slate-500">
          Keep track of your internship progress.
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
              Progress to completion
            </h3>
          </div>
          <div className="p-5">
            <div className="mb-2 flex justify-between text-sm text-slate-500">
              <span>{formatHours(stats.hoursRendered)}</span>
              <span>{formatHours(stats.requiredHours)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    stats.requiredHours
                      ? (stats.hoursRendered / stats.requiredHours) * 100
                      : 0,
                  )}%`,
                }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {formatHours(stats.remainingHours)} remaining to finish your
              internship.
            </p>
          </div>
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-base font-semibold text-slate-800">
              Quick links
            </h3>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Link
              to="/intern/attendance"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              Time In / Out
            </Link>
            <Link
              to="/intern/journal"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              Submit Journal
            </Link>
            <Link
              to="/intern/documents"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              Upload Documents
            </Link>
            <Link
              to="/intern/announcements"
              className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50">
              View Announcements
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
