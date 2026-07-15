import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import Button from "@/components/ui/Button";
import { documentService } from "@/services/documentService";
import { useAuth } from "@/contexts/AuthContext";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPES, PAGE_SIZE } from "@/lib/constants";
import { formatDate } from "@/utils/format";

const TONE = { pending: "amber", approved: "green", rejected: "red" };
const TYPE_LABEL = Object.fromEntries(DOCUMENT_TYPES.map((t) => [t.value, t.label]));

export default function AdminDocuments() {
  const { isConfigured } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
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
  }, [isConfigured, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(row, status) {
    try {
      await documentService.review(row.id, status);
      toast.success(`Document ${status}.`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function download(row) {
    try {
      const url = await documentService.downloadUrl(row.file_path);
      window.open(url, "_blank");
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
      render: (r) => TYPE_LABEL[r.type] ?? r.type,
    },
    { key: "created", header: "Uploaded", render: (r) => formatDate(r.created_at) },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge tone={TONE[r.status] ?? "gray"}>
          {DOCUMENT_STATUS_LABELS[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => download(r)}>
            Download
          </Button>
          {r.status === "pending" && (
            <>
              <Button size="sm" onClick={() => review(r, "approved")}>
                Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => review(r, "rejected")}>
                Reject
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Review and approve intern documents."
      />
      <Card>
        {loading ? (
          <Spinner label="Loading documents…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <div className="p-4 text-center text-sm text-slate-500">
                No documents uploaded.
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
