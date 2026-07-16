import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { Input, Select } from "@/components/ui/Input";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/contexts/AuthContext";
import { ATTENDANCE_STATUS, ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatTime, formatHours } from "@/utils/format";

const TONE = { present: "green", late: "amber", absent: "red", pending: "gray" };

export default function SupervisorAttendance() {
  const { profile, supervisorId } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceService.adminList({ page: 1, pageSize: 100 });
      const sid = supervisorId;
      let filtered = res.data.filter((r) => r.intern?.supervisor_id === sid);
      if (status) filtered = filtered.filter((r) => r.status === status);
      if (search) {
        const q = search.toLowerCase();
        filtered = filtered.filter((r) => (r.intern?.full_name ?? "").toLowerCase().includes(q));
      }
      setRows(filtered);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [supervisorId, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    { key: "intern", header: "Intern", render: (r) => r.intern?.full_name ?? "—" },
    { key: "date", header: "Date", render: (r) => formatDate(r.date) },
    { key: "time_in", header: "Time In", render: (r) => formatTime(r.time_in) },
    { key: "time_out", header: "Time Out", render: (r) => formatTime(r.time_out) },
    { key: "hours", header: "Hours", render: (r) => formatHours(r.total_hours) },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={TONE[r.status] ?? "gray"}>{ATTENDANCE_STATUS_LABELS[r.status] ?? r.status}</Badge>,
    },
  ];

  return (
    <div>
      <PageHeader title="Attendance" description="Attendance of your assigned interns." />
      <Card>
        <div className="grid gap-3 border-b border-brand-100 p-4 sm:grid-cols-2">
          <Input
            placeholder="Search intern name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="max-w-xs">
            <option value="">All Statuses</option>
            {Object.values(ATTENDANCE_STATUS).map((s) => (
              <option key={s} value={s}>{ATTENDANCE_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        {loading ? (
          <Spinner label="Loading attendance…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={<div className="p-4 text-center text-sm text-slate-500">No attendance records.</div>}
          />
        )}
      </Card>
    </div>
  );
}
