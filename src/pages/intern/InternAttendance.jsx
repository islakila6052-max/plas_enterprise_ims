import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/contexts/AuthContext";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatTime, formatHours, todayISO } from "@/utils/format";

const TONE = { present: "green", late: "amber", absent: "red", pending: "gray" };

export default function InternAttendance() {
  const { isConfigured, profile, internId } = useAuth();
  const [open, setOpen] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const [openRec, res] = await Promise.all([
        attendanceService.getOpen(internId),
        attendanceService.list({ internId, page: 1, pageSize: 30 }),
      ]);
      setOpen(openRec);
      setRows(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, internId]);

  useEffect(() => {
    load();
  }, [load]);

  async function timeIn() {
    setBusy(true);
    try {
      await attendanceService.timeIn(internId, "manual");
      toast.success("Timed in.");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function timeOut() {
    setBusy(true);
    try {
      await attendanceService.timeOut(open.id, open.time_in);
      toast.success("Timed out.");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const columns = [
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
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        description="Time in and out and view your attendance history."
      />

      <Card>
        <div className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-slate-500">Today · {todayISO()}</p>
            {open ? (
              <p className="mt-1 text-sm font-medium text-emerald-600">
                You are timed in since {formatTime(open.time_in)}
              </p>
            ) : (
              <p className="mt-1 text-sm font-medium text-slate-600">
                You haven't timed in today.
              </p>
            )}
          </div>
          {open ? (
            <Button onClick={timeOut} loading={busy}>
              Time Out
            </Button>
          ) : (
            <Button onClick={timeIn} loading={busy}>
              Time In
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">History</h3>
        </div>
        {loading ? (
          <Spinner label="Loading history…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <div className="p-4 text-center text-sm text-slate-500">
                No attendance records yet.
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}
