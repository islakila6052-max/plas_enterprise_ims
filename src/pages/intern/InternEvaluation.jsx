import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { evaluationService } from "@/services/evaluationService";
import { useAuth } from "@/contexts/AuthContext";
import { EVALUATION_CRITERIA } from "@/lib/constants";
import { formatDate } from "@/utils/format";

export default function InternEvaluation() {
  const { isConfigured, profile, user } = useAuth();
  const internId = profile?.intern_id ?? user?.id;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const res = await evaluationService.list({ internId, page: 1, pageSize: 20 });
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

  return (
    <div>
      <PageHeader
        title="My Evaluation"
        description="View evaluations submitted by your supervisor."
      />
      {loading ? (
        <Spinner label="Loading evaluations…" />
      ) : rows.length === 0 ? (
        <Card>
          <p className="p-5 text-center text-sm text-slate-500">
            No evaluations available yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((e) => (
            <Card key={e.id}>
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <Badge tone="brand">
                    {e.final_recommendation ?? "—"}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {formatDate(e.created_at)}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {EVALUATION_CRITERIA.map((c) => (
                    <div
                      key={c.key}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-600">{c.label}</span>
                      <span className="font-semibold text-slate-800">
                        {e[c.key] ?? "—"}/5
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm">
                  <span className="text-slate-600">Overall: </span>
                  <span className="font-semibold text-brand-700">
                    {e.overall_rating ?? "—"}/5
                  </span>
                </div>
                {e.comments && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-slate-700">
                      Comments
                    </p>
                    <p className="whitespace-pre-wrap text-sm text-slate-600">
                      {e.comments}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
