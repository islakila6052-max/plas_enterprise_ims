// src/utils/format.js
/**
 * Formatting helpers for dates, times and numbers used across the UI.
 */

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Format an ISO string or Date as e.g. "Jul 15, 2026". */
export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

/** Format an ISO string or Date as e.g. "Jul 15, 2026, 02:30 PM". */
export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

/** Format an ISO string or Date as e.g. "02:30 PM". */
export function formatTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : timeFmt.format(d);
}

/** Today's date as YYYY-MM-DD (for <input type="date">). */
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Compute decimal hours between two ISO timestamps.
 * @returns {number} hours rounded to 2 decimals (0 if invalid).
 */
export function diffHours(startISO, endISO) {
  if (!startISO || !endISO) return 0;
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round(((end - start) / 3_600_000) * 100) / 100;
}

/** Format decimal hours as "Xh Ym". */
export function formatHours(hours) {
  if (hours == null || Number.isNaN(hours)) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

/** Format a number with thousands separators. */
export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

/** Get initials from a full name. */
export function getInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Relative time like "2 hours ago" (lightweight). */
export function timeAgo(value) {
  if (!value) return "—";
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return "—";
  const secs = Math.floor((Date.now() - d) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
