import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/contexts/AuthContext";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatTime, formatHours } from "@/utils/format";

const TONE = { present: "green", late: "amber", absent: "red", pending: "gray" };

export default function SupervisorAttendance() {
  const { isConfigured, profile, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const res = await attendanceService.adminList({ page: 1, pageSize: 100 });
      // Keep only records for this supervisor's interns.
      const sid = profile?.supervisor_id ?? user?.id;
      const filtered = res.data.filter((r) => r.intern?.supervisor_id === sid);
      setRows(filtered);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, profile, user]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: "intern",
      header: "Intern",
      render: (r) => r.intern?.full_name ?? "—",
    },
    { key: "date", header: "Date", render: (r) => formatDate(r.date) },
    { key: "time_in", header: "Time In", render: (r) => formatTime(r.time_in) },
    {
      key: "time_out",
      header: "Time Out",
      render: (r) => formatTime(r.time_out) ?? "—",
    },
    { key: "hours", header: "Hours", render: (r) => formatHours(r.total_hours) },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={TONE[r.status] ?? "gray"}>
          {ATTENDANCE_STATUS_LABELS[r.status] ?? r.status}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Attendance of your assigned interns."
      />
      <Card>
        {loading ? (
          <Spinner label="Loading attendance…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <div className="p-4 text-center text-sm text-slate-500">
                No attendance records.
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}
