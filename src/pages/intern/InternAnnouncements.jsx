import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { announcementService } from "@/services/announcementService";
import { useAuth } from "@/contexts/AuthContext";
import { ANNOUNCEMENT_CATEGORIES } from "@/lib/constants";
import { formatDateTime, timeAgo } from "@/utils/format";

const catLabel = Object.fromEntries(
  ANNOUNCEMENT_CATEGORIES.map((c) => [c.value, c.label]),
);

export default function InternAnnouncements() {
  const { isConfigured } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isConfigured) return setLoading(false);
    setLoading(true);
    try {
      const res = await announcementService.list({});
      setRows(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Announcements"
        description="Company news and important reminders."
      />
      {loading ? (
        <Spinner label="Loading announcements…" />
      ) : (
        <div className="space-y-4">
          {rows.map((a) => (
            <Card key={a.id}>
              <div className="p-5">
                <div className="mb-1 flex items-center gap-2">
                  <Badge tone="brand">{catLabel[a.category] ?? a.category}</Badge>
                  <span className="text-xs text-slate-400">
                    {timeAgo(a.created_at)} · {formatDateTime(a.created_at)}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-800">
                  {a.title}
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {a.body}
                </p>
              </div>
            </Card>
          ))}
          {rows.length === 0 && (
            <Card>
              <p className="p-5 text-center text-sm text-slate-500">
                No announcements yet.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
