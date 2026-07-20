// src/pages/admin/AdminJournals.jsx
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { journalService } from "@/services/journalService";

import { JOURNAL_STATUS, JOURNAL_STATUS_LABELS, PAGE_SIZE } from "@/lib/constants";
import { formatDate } from "@/utils/format";
import { recordAudit, notify } from "@/services/activityService";
import { useAuth } from "@/contexts/AuthContext";

const TONE = { pending: "amber", approved: "green", rejected: "red" };

export default function AdminJournals() {
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [reviewing, setReviewing] = useState(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await journalService.list({ page });
      let data = res.data;
      if (status) data = data.filter((r) => r.status === status);
      if (search) {
        const q = search.toLowerCase();
        data = data.filter((r) => (r.intern?.full_name ?? "").toLowerCase().includes(q));
      }
      setRows(data);
      setTotal(res.count);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  function openReview(row) {
    setReviewing(row);
    setComment(row.supervisor_comment ?? "");
  }

  async function decide(decision) {
    if (!reviewing) return;
    setSaving(true);
    try {
      await journalService.review(reviewing.id, decision, null, comment);
      await recordAudit({ user_id: user?.id, action: "review", resource_type: "daily_journal", resource_id: reviewing.id, changes: { status: decision } });
      // Notify the intern who owns this journal that it was reviewed.
      if (reviewing.intern?.profile_id) {
        await notify({
          user_id: reviewing.intern.profile_id,
          type: "journal_review",
          title: `Journal ${decision}`,
          message: `Your journal for ${formatDate(reviewing.date)} was ${decision}.`,
          link: "/intern/journal",
        });
      }
      toast.success(`Journal ${decision}.`);
      setReviewing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
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
    { key: "activities", header: "Activities", render: (r) => <p className="max-w-xs truncate text-slate-600">{r.activities}</p> },
    { key: "hours_worked", header: "Hours", render: (r) => r.hours_worked ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={TONE[r.status] ?? "gray"}>{JOURNAL_STATUS_LABELS[r.status] ?? r.status}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <button className="text-sm font-medium text-brand-700 hover:text-brand-800" onClick={() => openReview(r)}>
          Review
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Daily Journals" description="Review internship daily journals." />
      <Card>
        <div className="grid gap-3 border-b border-brand-100 p-4 sm:grid-cols-2">
          <Input
            placeholder="Search intern name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="max-w-xs">
            <option value="">All Statuses</option>
            {Object.values(JOURNAL_STATUS).map((s) => (
              <option key={s} value={s}>{JOURNAL_STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        {loading ? (
          <Spinner label="Loading journals…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={<div className="p-4 text-center text-sm text-slate-500">No journals submitted.</div>}
          />
        )}
        {rows.length > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
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
            <Textarea label="Supervisor comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
