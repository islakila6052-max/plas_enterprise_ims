// src/pages/admin/AdminDocuments.jsx
import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { documentService } from "@/services/documentService";

import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPES, PAGE_SIZE } from "@/lib/constants";
import { formatDate } from "@/utils/format";
import { recordAudit } from "@/services/activityService";
import { useAuth } from "@/contexts/AuthContext";
import { Icon } from "@/components/ui/icons";

const TONE = { pending: "amber", approved: "green", rejected: "red" };
const TYPE_LABEL = Object.fromEntries(DOCUMENT_TYPES.map((t) => [t.value, t.label]));

// Maps each document type to a shared icon name.
function fileIcon(type) {
  const map = {
    resume: "fileText",
    moa: "fileText",
    endorsement: "fileText",
    school_requirements: "graduationCap",
    completion_report: "clipboardCheck",
  };
  return map[type] ?? "file";
}

export default function AdminDocuments() {
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await documentService.list({ page });
      setRows(res.data);
      setTotal(res.count);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(row, status) {
    try {
      // documentService.review() already sends a notification to the intern.
      await documentService.review(row.id, status);
      await recordAudit({ user_id: user?.id, action: "review", resource_type: "document", resource_id: row.id, changes: { status } });
      toast.success(`Document ${status}.`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function download(row) {
    try {
      // The bucket is public, so file_url is directly usable. Fall back to a
      // signed URL for private buckets / expired links.
      const url = row.file_url || (await documentService.downloadUrl(row.file_path));
      if (!url) {
        toast.error("Download link unavailable.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err.message);
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
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <button onClick={() => setPreview(r)} className="flex items-center gap-2 text-left hover:text-brand-700">
          <Icon name={fileIcon(r.type)} className="h-5 w-5 text-brand-600" />
          <span>{TYPE_LABEL[r.type] ?? r.type}</span>
        </button>
      ),
    },
    { key: "created", header: "Uploaded", render: (r) => formatDate(r.created_at) },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={TONE[r.status] ?? "gray"}>{DOCUMENT_STATUS_LABELS[r.status] ?? r.status}</Badge>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPreview(r)}>Preview</Button>
          <Button size="sm" variant="ghost" onClick={() => download(r)}>Download</Button>
          {r.status === "pending" && (
            <>
              <Button size="sm" onClick={() => review(r, "approved")}>Approve</Button>
              <Button size="sm" variant="danger" onClick={() => review(r, "rejected")}>Reject</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Documents" description="Review and approve intern documents." />
      <Card>
        {loading ? (
          <Spinner label="Loading documents…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={<div className="p-4 text-center text-sm text-slate-500">No documents uploaded.</div>}
          />
        )}
        {rows.length > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        )}
      </Card>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Document Preview" size="md">
        {preview && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Icon name={fileIcon(preview.type)} className="h-10 w-10 text-brand-600" />
              <div>
                <p className="font-medium text-slate-800">{preview.file_name ?? TYPE_LABEL[preview.type]}</p>
                <p className="text-slate-500">{preview.intern?.full_name}</p>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-brand-200 bg-brand-50/50 p-6 text-center text-slate-500">
              Document preview is not available in the browser.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => download(preview)}>Download</Button>
              {preview.status === "pending" && (
                <>
                  <Button onClick={() => { review(preview, "approved"); setPreview(null); }}>Approve</Button>
                  <Button variant="danger" onClick={() => { review(preview, "rejected"); setPreview(null); }}>Reject</Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
