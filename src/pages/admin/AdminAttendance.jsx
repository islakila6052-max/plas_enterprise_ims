import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import { Input } from "@/components/ui/Input";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/contexts/AuthContext";
import { ATTENDANCE_STATUS_LABELS, PAGE_SIZE } from "@/lib/constants";
import { formatDate, formatTime, formatHours } from "@/utils/format";

const TONE = { present: "green", late: "amber", absent: "red", pending: "gray" };

export default function AdminAttendance() {
  const { isConfigured } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const res = await attendanceService.adminList({ date, page });
      setRows(res.data);
      setTotal(res.count);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, date, page]);

  useEffect(() => {
    load();
  }, [load]);

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
    {
      key: "time_out",
      header: "Time Out",
      render: (r) => formatTime(r.time_out) ?? "—",
    },
    {
      key: "total_hours",
      header: "Hours",
      render: (r) => formatHours(r.total_hours),
    },
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
        description="Organization-wide attendance records."
      />
      <Card>
        <div className="border-b border-slate-100 p-4">
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
            className="max-w-xs"
          />
        </div>
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
        {rows.length > 0 && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        )}
      </Card>
    </div>
  );
}
