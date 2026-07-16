import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Avatar from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { internService } from "@/services/internService";
import { useAuth } from "@/contexts/AuthContext";
import { INTERN_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/utils/format";

const TONE = { active: "green", completed: "blue", archived: "gray" };

export default function SupervisorInterns() {
  const { profile, supervisorId } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await internService.list({ page: 1, pageSize: 100, supervisorId: supervisorId });
      let data = res.data;
      if (search) {
        const q = search.toLowerCase();
        data = data.filter((r) => r.full_name.toLowerCase().includes(q));
      }
      setRows(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [supervisorId, search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Assigned Interns" description="Interns under your supervision." />
      <Card>
        <div className="border-b border-brand-100 p-4">
          <Input
            placeholder="Search intern name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        {loading ? (
          <Spinner label="Loading interns…" />
        ) : (
          <Table
            columns={[
              {
                key: "full_name",
                header: "Name",
                render: (r) => (
                  <button onClick={() => setDetail(r)} className="text-left font-medium text-slate-800 hover:text-brand-700">
                    {r.full_name}
                  </button>
                ),
              },
              { key: "school", header: "School", render: (r) => r.school ?? "—" },
              { key: "department", header: "Department", render: (r) => r.department?.name ?? "—" },
              { key: "start", header: "Start", render: (r) => formatDate(r.start_date) },
              { key: "end", header: "End", render: (r) => formatDate(r.end_date) },
              {
                key: "status",
                header: "Status",
                render: (r) => <Badge tone={TONE[r.status] ?? "gray"}>{INTERN_STATUS_LABELS[r.status] ?? r.status}</Badge>,
              },
            ]}
            rows={rows}
            rowKey={(r) => r.id}
            empty={<div className="p-4 text-center text-sm text-slate-500">No interns assigned yet.</div>}
          />
        )}
      </Card>

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title="Intern Details" size="md">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar name={detail.full_name} size="lg" />
              <div>
                <p className="text-lg font-semibold text-slate-800">{detail.full_name}</p>
                <p className="text-sm text-slate-500">{detail.course} · {detail.school}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Student No." value={detail.student_number} />
              <Detail label="Email" value={detail.email} />
              <Detail label="Contact" value={detail.contact_number} />
              <Detail label="Department" value={detail.department?.name} />
              <Detail label="Start" value={formatDate(detail.start_date)} />
              <Detail label="End" value={formatDate(detail.end_date)} />
              <Detail label="Required Hrs" value={detail.required_hours} />
              <Detail label="Status" value={INTERN_STATUS_LABELS[detail.status]} />
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-lg bg-brand-50/50 px-3 py-2">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-700">{value ?? "—"}</dd>
    </div>
  );
}
