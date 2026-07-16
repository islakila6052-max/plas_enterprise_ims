import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/contexts/AuthContext";
import { ATTENDANCE_STATUS, ATTENDANCE_STATUS_LABELS, PAGE_SIZE } from "@/lib/constants";
import { formatDate, formatTime, formatHours } from "@/utils/format";

const TONE = { present: "green", late: "amber", absent: "red", pending: "gray" };

export default function AdminAttendance() {
  const { isConfigured } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const res = await attendanceService.adminList({ date, page });
      let data = res.data;
      if (status) data = data.filter((r) => r.status === status);
      setRows(data);
      setTotal(res.count);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, date, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCSV() {
    if (!rows.length) return toast.error("No rows to export.");
    const header = ["Intern", "Date", "Time In", "Time Out", "Hours", "Status"];
    const lines = rows.map((r) => [
      r.intern?.full_name ?? "",
      r.date,
      r.time_in ?? "",
      r.time_out ?? "",
      r.total_hours,
      r.status,
    ]);
    const csv = [header, ...lines].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${date || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Attendance exported (CSV).");
  }

  const columns = [
    {
      key: "intern",
      header: "Intern",
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.intern?.full_name}</p>
          <p className="text-xs text-slate-400">{r.intern?.student_number}</p>
        </div>
      ),
    },
    { key: "date", header: "Date", render: (r) => formatDate(r.date) },
    { key: "time_in", header: "Time In", render: (r) => formatTime(r.time_in) },
    { key: "time_out", header: "Time Out", render: (r) => formatTime(r.time_out) },
    { key: "total_hours", header: "Hours", render: (r) => formatHours(r.total_hours) },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={TONE[r.status] ?? "gray"}>{ATTENDANCE_STATUS_LABELS[r.status] ?? r.status}</Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Organization-wide attendance records."
        action={<Button variant="secondary" onClick={exportCSV}>Export CSV</Button>}
      />
      <Card>
        <div className="grid gap-3 border-b border-brand-100 p-4 sm:grid-cols-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
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
        {rows.length > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}
