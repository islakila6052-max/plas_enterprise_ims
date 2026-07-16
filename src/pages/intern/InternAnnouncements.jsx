import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { announcementService } from "@/services/announcementService";

import { ANNOUNCEMENT_CATEGORIES } from "@/lib/constants";
import { formatDateTime, timeAgo } from "@/utils/format";

const catLabel = Object.fromEntries(ANNOUNCEMENT_CATEGORIES.map((c) => [c.value, c.label]));

export default function InternAnnouncements() {

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await announcementService.list({});
      setRows(res.data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pinned = rows.filter((a) => a.pinned);
  const recent = rows.filter((a) => !a.pinned);

  return (
    <div>
      <PageHeader title="Announcements" description="Company news and important reminders." />
      {loading ? (
        <Spinner label="Loading announcements…" />
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Pinned</h3>
              <div className="space-y-4">
                {pinned.map((a) => (
                  <Card key={a.id} className="border-brand-200 bg-brand-50/40">
                    <div className="p-5">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge tone="green">Pinned</Badge>
                        <Badge tone="brand">{catLabel[a.category] ?? a.category}</Badge>
                        <span className="text-xs text-slate-400">
                          {timeAgo(a.created_at)} · {formatDateTime(a.created_at)}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-800">{a.title}</h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Recent</h3>
            <div className="space-y-4">
              {recent.map((a) => (
                <Card key={a.id}>
                  <div className="p-5">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge tone="brand">{catLabel[a.category] ?? a.category}</Badge>
                      <span className="text-xs text-slate-400">
                        {timeAgo(a.created_at)} · {formatDateTime(a.created_at)}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-800">{a.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
                  </div>
                </Card>
              ))}
              {recent.length === 0 && pinned.length === 0 && (
                <Card>
                  <p className="p-5 text-center text-sm text-slate-500">No announcements yet.</p>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
