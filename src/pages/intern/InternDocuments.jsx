import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { documentService } from "@/services/documentService";
import { useAuth } from "@/contexts/AuthContext";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPES } from "@/lib/constants";
import { formatDate } from "@/utils/format";

const TONE = { pending: "amber", approved: "green", rejected: "red" };
const TYPE_LABEL = Object.fromEntries(DOCUMENT_TYPES.map((t) => [t.value, t.label]));

export default function InternDocuments() {
  const { isConfigured, profile, user } = useAuth();
  const internId = profile?.intern_id ?? user?.id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState(DOCUMENT_TYPES[0].value);
  const [file, setFile] = useState(null);

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const res = await documentService.list({ internId, page: 1, pageSize: 50 });
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

  async function upload() {
    if (!file) return toast.error("Choose a file first.");
    setUploading(true);
    try {
      await documentService.upload({ internId, type, file });
      toast.success("Document uploaded.");
      setFile(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
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
      header: "",
      render: (r) => (
        <Button size="sm" variant="secondary" onClick={() => download(r)}>
          Download
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload and track your required documents."
      />

      <Card>
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <Select
            label="Document type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="sm:max-w-xs">
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
          />
          <Button onClick={upload} loading={uploading}>
            Upload
          </Button>
        </div>
      </Card>

      <Card>
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">
            My Documents
          </h3>
        </div>
        {loading ? (
          <Spinner label="Loading documents…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <div className="p-4 text-center text-sm text-slate-500">
                No documents uploaded yet.
              </div>
            }
          />
        )}
      </Card>
    </div>
  );
}
