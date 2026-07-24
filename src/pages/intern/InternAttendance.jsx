// src/pages/intern/InternAttendance.jsx
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { attendanceService } from "@/services/attendanceService";
import { useAuth } from "@/contexts/AuthContext";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatTime, formatHours, todayISO } from "@/utils/format";
import { recordAudit, notify } from "@/services/activityService";
import { supabase } from "@/lib/supabase";

const TONE = { present: "green", late: "amber", absent: "red", pending: "gray" };

export default function InternAttendance() {
  const { profile, internId } = useAuth();
  const [open, setOpen] = useState(null);
  const [todayRec, setTodayRec] = useState(null); // today's record (open or closed)
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRecord, res] = await Promise.all([
        attendanceService.getToday(internId),
        attendanceService.list({ internId, page: 1, pageSize: 30 }),
      ]);
      setTodayRec(todayRecord);
      // Derive open session state: a record exists and hasn't been timed out yet.
      setOpen(todayRecord && !todayRecord.time_out ? todayRecord : null);
      setRows(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [internId]);

  useEffect(() => {
    load();
  }, [load]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTimeOutOpen, setConfirmTimeOutOpen] = useState(false);

  async function confirmTimeIn() {
    setConfirmOpen(false);
    setBusy(true);
    try {
      const rec = await attendanceService.timeIn(internId, "manual");
      await recordAudit({ user_id: profile?.id, action: "create", resource_type: "attendance", resource_id: rec?.id, changes: { type: "time_in", date: todayISO() } });

      // Notify the assigned supervisor about time-in.
      try {
        const { data: intern } = await supabase
          .from("interns")
          .select("full_name, supervisor_id")
          .eq("id", internId)
          .single();
        if (intern?.supervisor_id) {
          const { data: supProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", intern.supervisor_id)
            .single();
          if (supProfile?.id) {
            await notify({
              user_id: supProfile.id,
              type: "attendance_update",
              title: "Time in recorded",
              message: `${intern.full_name || "Your intern"} just timed in for ${todayISO()}.`,
              link: "/supervisor/attendance",
              metadata: { intern_id: internId },
            });
          }
        }
      } catch {
        /* non-fatal */
      }

      toast.success("Timed in.");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function timeOut() {
    setConfirmTimeOutOpen(false);
    setBusy(true);
    try {
      await attendanceService.timeOut(open.id, open.time_in);
      await recordAudit({ user_id: profile?.id, action: "update", resource_type: "attendance", resource_id: open.id, changes: { type: "time_out" } });

      // Notify the supervisor about time-out.
      try {
        const { data: intern } = await supabase
          .from("interns")
          .select("full_name, supervisor_id")
          .eq("id", internId)
          .single();
        if (intern?.supervisor_id) {
          const { data: supProfile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", intern.supervisor_id)
            .single();
          if (supProfile?.id) {
            await notify({
              user_id: supProfile.id,
              type: "attendance_update",
              title: "Time out recorded",
              message: `${intern.full_name || "Your intern"} just timed out for ${todayISO()}.`,
              link: "/supervisor/attendance",
              metadata: { intern_id: internId },
            });
          }
        }
      } catch {
        /* non-fatal */
      }

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
    { key: "time_in", header: "Time In (Login)", render: (r) => formatTime(r.time_in) },
    {
      key: "time_out",
      header: "Time Out (Logout)",
      render: (r) => (r.time_out ? formatTime(r.time_out) : <span className="text-amber-600">Still in</span>),
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
            ) : todayRec?.time_out ? (
              <p className="mt-1 text-sm font-medium text-slate-600">
                You have completed your attendance for today.
              </p>
            ) : (
              <p className="mt-1 text-sm font-medium text-slate-600">
                You haven't timed in today.
              </p>
            )}
          </div>
          {open ? (
            <Button onClick={() => setConfirmTimeOutOpen(true)} loading={busy}>
              Time Out
            </Button>
          ) : todayRec?.time_out ? (
            <Button disabled variant="secondary">
              Attendance Completed
            </Button>
          ) : (
            <Button onClick={() => setConfirmOpen(true)} loading={busy}>
              Time In
            </Button>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmTimeIn}
        title="Time in for today?"
        message={`You can only record one attendance per day. Confirm to time in for ${todayISO()}.`}
        confirmLabel="Yes, Time In"
        tone="primary"
        loading={busy}
      />

      <ConfirmDialog
        open={confirmTimeOutOpen}
        onClose={() => setConfirmTimeOutOpen(false)}
        onConfirm={timeOut}
        title="Time out for today?"
        message={`You timed in at ${open ? formatTime(open.time_in) : "—"}. Once you time out, you cannot time in again today.`}
        confirmLabel="Yes, Time Out"
        tone="danger"
        loading={busy}
      />

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
