import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Textarea, Input } from "@/components/ui/Input";
import { journalService } from "@/services/journalService";
import { useAuth } from "@/contexts/AuthContext";
import { JOURNAL_STATUS, JOURNAL_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/utils/format";

const TONE = { pending: "amber", approved: "green", rejected: "red" };

export default function SupervisorJournals() {
  const { isConfigured, profile, supervisorId } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const sid = supervisorId;
      const res = await journalService.list({ supervisorId: sid, page: 1, pageSize: 100 });
      let data = res.data;
      if (status) data = data.filter((r) => r.status === status);
      if (search) {
        const q = search.toLowerCase();
        data = data.filter((r) => (r.intern?.full_name ?? "").toLowerCase().includes(q));
      }
      setRows(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isConfigured, profile, user, status, search]);

  useEffect(() => {
    load();
  }, [load]);

  function openReview(r) {
    setReviewing(r);
    setComment(r.supervisor_comment ?? "");
  }

  async function decide(status) {
    if (!reviewing) return;
    setSaving(true);
    try {
      const sid = supervisorId;
      await journalService.review(reviewing.id, status, sid, comment);
      toast.success(`Journal ${status}.`);
      setReviewing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: "intern", header: "Intern", render: (r) => r.intern?.full_name ?? "—" },
    { key: "date", header: "Date", render: (r) => formatDate(r.date) },
    { key: "activities", header: "Activities", render: (r) => <p className="max-w-xs truncate text-slate-600">{r.activities}</p> },
    { key: "status", header: "Status", render: (r) => <Badge tone={TONE[r.status] ?? "gray"}>{JOURNAL_STATUS_LABELS[r.status] ?? r.status}</Badge> },
    {
      key: "actions",
      header: "",
      render: (r) => (
        <button className="text-sm font-medium text-brand-700 hover:text-brand-800" onClick={() => openReview(r)}>
          Review
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Daily Journals" description="Review and comment on your interns' journals." />
      <Card>
        <div className="grid gap-3 border-b border-brand-100 p-4 sm:grid-cols-2">
          <Input
            placeholder="Search intern name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="max-w-xs rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm text-slate-700">
            <option value="">All Statuses</option>
            {Object.values(JOURNAL_STATUS).map((s) => (
              <option key={s} value={s}>{JOURNAL_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        {loading ? (
          <Spinner label="Loading journals…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={<div className="p-4 text-center text-sm text-slate-500">No journals to review.</div>}
          />
        )}
      </Card>

      <Modal
        open={Boolean(reviewing)}
        onClose={() => setReviewing(null)}
        title="Review Journal"
        footer={
          <>
            <Button variant="danger" onClick={() => decide("rejected")} loading={saving}>Reject</Button>
            <Button onClick={() => decide("approved")} loading={saving}>Approve</Button>
          </>
        }>
        {reviewing && (
          <div className="space-y-3 text-sm">
            <p><span className="text-slate-500">Intern: </span>{reviewing.intern?.full_name}</p>
            <p><span className="text-slate-500">Date: </span>{formatDate(reviewing.date)}</p>
            <div>
              <p className="mb-1 font-medium text-slate-700">Activities</p>
              <p className="whitespace-pre-wrap text-slate-600">{reviewing.activities}</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-700">Challenges</p>
              <p className="whitespace-pre-wrap text-slate-600">{reviewing.challenges || "—"}</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-700">Learnings</p>
              <p className="whitespace-pre-wrap text-slate-600">{reviewing.learnings || "—"}</p>
            </div>
            <Textarea label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
