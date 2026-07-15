import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { internService } from "@/services/internService";
import { useAuth } from "@/contexts/AuthContext";
import { INTERN_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/utils/format";

const TONE = { active: "green", completed: "blue", archived: "gray" };

export default function SupervisorInterns() {
  const { isConfigured, profile, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      // Supervisors see only their assigned interns.
      const res = await internService.list({
        page: 1,
        supervisorId: profile?.supervisor_id ?? user?.id,
      });
      // Filter client-side by supervisor since list() supports it via query.
      setRows(res.data);
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
      key: "full_name",
      header: "Name",
      render: (r) => (
        <div>
          <p className="font-medium text-slate-800">{r.full_name}</p>
          <p className="text-xs text-slate-400">{r.student_number}</p>
        </div>
      ),
    },
    { key: "school", header: "School", render: (r) => r.school ?? "—" },
    {
      key: "department",
      header: "Department",
      render: (r) => r.department?.name ?? "—",
    },
    {
      key: "start",
      header: "Start",
      render: (r) => formatDate(r.start_date),
    },
    {
      key: "end",
      header: "End",
      render: (r) => formatDate(r.end_date),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={TONE[r.status] ?? "gray"}>
          {INTERN_STATUS_LABELS[r.status] ?? r.status}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Assigned Interns"
        description="Interns under your supervision."
      />
      <Card>
        {loading ? (
          <Spinner label="Loading interns…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <div className="p-4 text-center text-sm text-slate-500">
                No interns assigned yet.
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}
