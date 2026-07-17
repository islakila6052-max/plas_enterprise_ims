// src/pages/admin/AdminAuditLogs.jsx
import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Table from "@/components/ui/Table";
import { auditLogService } from "@/services/auditLogService";
import { formatDateTime, timeAgo } from "@/utils/format";

const ACTION_TONES = {
  create: "green",
  update: "blue",
  delete: "red",
  login: "gray",
  review: "amber",
};

/** Admin read-only view of the audit trail. */
export default function AdminAuditLogs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditLogService.list({ limit: 200 });
      setRows(data);
    } catch (err) {
      // Non-fatal: audit logs are an admin-only convenience view.
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      key: "created_at",
      header: "When",
      render: (r) => (
        <div className="whitespace-nowrap">
          <div className="text-slate-700">{timeAgo(r.created_at)}</div>
          <div className="text-xs text-slate-400">{formatDateTime(r.created_at)}</div>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (r) => <Badge tone={ACTION_TONES[r.action] ?? "gray"}>{r.action}</Badge>,
    },
    {
      key: "resource_type",
      header: "Resource",
      render: (r) => (
        <span className="font-mono text-xs text-slate-600">{r.resource_type}</span>
      ),
    },
    {
      key: "resource_id",
      header: "Resource ID",
      render: (r) => (
        <span className="font-mono text-xs text-slate-500">{r.resource_id ?? "—"}</span>
      ),
    },
    {
      key: "user_id",
      header: "User",
      render: (r) => (
        <span className="font-mono text-xs text-slate-500">{r.user_id ?? "system"}</span>
      ),
    },
    {
      key: "changes",
      header: "Changes",
      render: (r) => (
        <span className="text-xs text-slate-500">
          {r.changes ? JSON.stringify(r.changes) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="A read-only trail of administrative and system actions."
      />
      <Card>
        {loading ? (
          <Spinner label="Loading audit logs…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={<div className="py-10 text-center text-sm text-slate-500">No audit logs yet.</div>}
          />
        )}
      </Card>
    </div>
  );
}
