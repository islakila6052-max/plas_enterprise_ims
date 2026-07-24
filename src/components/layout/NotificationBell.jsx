// src/components/layout/NotificationBell.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { notificationService } from "@/services/notificationService";
import { supabase } from "@/lib/supabase";
import Spinner from "@/components/ui/Spinner";

/**
 * Notification bell in the navbar. Shows an unread count badge, opens a
 * dropdown of recent notifications, and supports mark-as-read / mark-all.
 * Subscribes to real-time INSERTs on the notifications table so new
 * notifications appear without a manual refresh.
 */
export default function NotificationBell() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  const userId = user?.id;

  async function refresh() {
    if (!userId) return;
    const [list, count] = await Promise.all([
      notificationService.list({ userId, limit: 10 }),
      notificationService.unreadCount(userId),
    ]);
    setItems(list);
    setUnread(count);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Real-time subscription: listen for new notifications inserted for this user.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Refresh the list and unread count when a new notification arrives.
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function onClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleOpen() {
    setOpen((v) => !v);
    if (!open) await refresh();
  }

  async function handleItemClick(n) {
    if (!n.is_read) {
      await notificationService.markRead(n.id);
      await refresh();
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  }

  async function handleMarkAll() {
    await notificationService.markAllRead(userId);
    await refresh();
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={handleOpen}
        className="relative rounded-md p-2 text-slate-500 transition hover:bg-brand-50 hover:text-brand-700"
        aria-label="Notifications">
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-1/2 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl sm:left-auto sm:right-0 sm:translate-x-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <p className="text-sm font-semibold text-slate-700">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs font-medium text-brand-600 hover:text-brand-800">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={`flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-3 text-left transition hover:bg-slate-50 ${
                    n.is_read ? "" : "bg-brand-50/40"
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">{n.title}</span>
                    {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                  </div>
                  <span className="line-clamp-2 text-xs text-slate-500">{n.message}</span>
                  <span className="text-[10px] uppercase tracking-wide text-slate-300">{n.type}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
