import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import { documentService } from "@/services/documentService";
import { useAuth } from "@/contexts/AuthContext";
import { DOCUMENT_STATUS_LABELS, DOCUMENT_TYPES } from "@/lib/constants";
import { formatDate } from "@/utils/format";

const TONE = { pending: "amber", approved: "green", rejected: "red" };
const TYPE_LABEL = Object.fromEntries(DOCUMENT_TYPES.map((t) => [t.value, t.label]));

function fileIcon(type) {
  const map = {
    resume: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM8 13h8v2H8v-2zm0 4h8v2H8v-2z",
    moa: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM8 13h8v2H8v-2zm0 4h8v2H8v-2z",
    endorsement: "M3 11l18-8-8 18-2-7-8-3z",
    school_requirements: "M12 3L2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 17l10 5 10-5",
    completion_report: "M9 16.2l-3.5-3.5L4 14.2 9 19l11-11-1.5-1.5z",
  };
  return map[type] ?? "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z";
}

export default function InternDocuments() {
  const { profile, internId } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [type, setType] = useState(DOCUMENT_TYPES[0].value);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await documentService.list({ internId, page: 1, pageSize: 50 });
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

  function download(row) {
    toast.success(`Downloading ${row.file_name ?? TYPE_LABEL[row.type] ?? "document"} (simulated).`);
  }

  const columns = [
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <button onClick={() => setPreview(r)} className="flex items-center gap-2 text-left hover:text-brand-700">
          <svg className="h-5 w-5 text-brand-600" viewBox="0 0 24 24" fill="currentColor">
            <path d={fileIcon(r.type)} />
          </svg>
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
      header: "",
      render: (r) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPreview(r)}>Preview</Button>
          <Button size="sm" variant="ghost" onClick={() => download(r)}>Download</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Documents" description="Upload and track your required documents." />

      <Card>
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
          <Select label="Document type" value={type} onChange={(e) => setType(e.target.value)} className="sm:max-w-xs">
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
          />
          <Button onClick={upload} loading={uploading}>Upload</Button>
        </div>
      </Card>

      <Card>
        <div className="border-b border-brand-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">My Documents</h3>
        </div>
        {loading ? (
          <Spinner label="Loading documents…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={<div className="p-4 text-center text-sm text-slate-500">No documents uploaded yet.</div>}
          />
        )}
      </Card>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Document Preview" size="md">
        {preview && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <svg className="h-10 w-10 text-brand-600" viewBox="0 0 24 24" fill="currentColor">
                <path d={fileIcon(preview.type)} />
              </svg>
              <div>
                <p className="font-medium text-slate-800">{preview.file_name ?? TYPE_LABEL[preview.type]}</p>
                <Badge tone={TONE[preview.status] ?? "gray"}>{DOCUMENT_STATUS_LABELS[preview.status]}</Badge>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-brand-200 bg-brand-50/50 p-6 text-center text-slate-500">
              Document preview is simulated in demo mode.
            </div>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => download(preview)}>Download</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
