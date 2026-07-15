import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import { evaluationService } from "@/services/evaluationService";
import { useAuth } from "@/contexts/AuthContext";
import { PAGE_SIZE } from "@/lib/constants";
import { formatDate } from "@/utils/format";

export default function AdminEvaluations() {
  const { isConfigured } = useAuth();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const res = await evaluationService.list({ page });
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
      key: "overall",
      header: "Overall",
      render: (r) => r.overall_rating ?? "—",
    },
    {
      key: "recommendation",
      header: "Recommendation",
      render: (r) => (
        <Badge tone="brand">{r.final_recommendation ?? "—"}</Badge>
      ),
    },
    { key: "date", header: "Date", render: (r) => formatDate(r.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Evaluations"
        description="All supervisor evaluations across interns."
      />
      <Card>
        {loading ? (
          <Spinner label="Loading evaluations…" />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            empty={
              <div className="p-4 text-center text-sm text-slate-500">
                No evaluations yet.
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
