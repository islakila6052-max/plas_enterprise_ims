// src/components/layout/navigation.js
import { ROLES } from "@/lib/constants";

/**
 * Sidebar navigation definition per role. Each item: { to, label, icon }.
 * Icons are inline SVG path elements rendered by the Sidebar.
 */

const icon = (paths) => paths;

const icons = {
  dashboard: icon([
    "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  ]),
  interns: icon([
    "M16 11a4 4 0 10-4-4 4 4 0 004 4zm-8 0a4 4 0 10-4-4 4 4 0 004 4zm0 2c-2.7 0-8 1.34-8 4v3h10v-3c0-.97.74-1.85 1.93-2.5A14 14 0 008 13zm8 0c-2.7 0-8 1.34-8 4v3h16v-3c0-2.66-5.3-4-8-4z",
  ]),
  attendance: icon([
    "M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h-4v-2h2V7h2v6z",
  ]),
  journal: icon([
    "M4 4h12v16H4V4zm2 2v2h8V6H6zm0 4v2h8v-2H6zm0 4v2h5v-2H6z",
  ]),
  documents: icon([
    "M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z",
  ]),
  evaluation: icon([
    "M12 17.3l5.2 3.1-1.4-5.9 4.6-4-6.1-.5L12 4l-2.3 5.9-6.1.5 4.6 4-1.4 5.9z",
  ]),
  announcements: icon([
    "M3 11l18-8-8 18-2-7-8-3z",
  ]),
  reports: icon([
    "M5 9h3v12H5V9zm11 6h3v6h-3v-6zm-5-3h3v9h-3v-9zM3 21h18v2H3v-2z",
  ]),
  settings: icon([
    "M12 8a4 4 0 104 4 4 4 0 00-4-4zm9 4l2-2-2-3-2.5 1a7.8 7.8 0 00-1.7-1L16 4h-3l-.8 2.5a7.8 7.8 0 00-1.7 1L8 6l-2 3-2 2 2 2 2 3 2.5-1a7.8 7.8 0 001.7 1L13 20h3l.8-2.5a7.8 7.8 0 001.7-1l2.5 1 2-3-2-2z",
  ]),
  profile: icon([
    "M12 12a5 5 0 10-5-5 5 5 0 005 5zm0 2c-4 0-9 2-9 5v3h18v-3c0-3-5-5-9-5z",
  ]),
  assigned: icon([
    "M9 11a3 3 0 103-3 3 3 0 00-3 3zm0 2c-3 0-7 1.5-7 4v3h9v-3c0-1.2.8-2.3 2-3.1A12 12 0 009 13zm8 0c-1.7 0-5 1-5 3v3h10v-3c0-2-3.3-3-5-3z",
  ]),
};

export const NAVIGATION = {
  [ROLES.ADMIN]: [
    { to: "/admin", label: "Dashboard", icon: icons.dashboard },
    { to: "/admin/interns", label: "Interns", icon: icons.interns },
    { to: "/admin/supervisors", label: "Supervisors", icon: icons.assigned },
    { to: "/admin/attendance", label: "Attendance", icon: icons.attendance },
    { to: "/admin/journals", label: "Daily Journals", icon: icons.journal },
    { to: "/admin/documents", label: "Documents", icon: icons.documents },
    { to: "/admin/evaluations", label: "Evaluations", icon: icons.evaluation },
    { to: "/admin/announcements", label: "Announcements", icon: icons.announcements },
    { to: "/admin/reports", label: "Reports", icon: icons.reports },
    { to: "/admin/settings", label: "Settings", icon: icons.settings },
    { to: "/profile", label: "Profile", icon: icons.profile },
  ],
  [ROLES.HR_STAFF]: [
    { to: "/admin", label: "Dashboard", icon: icons.dashboard },
    { to: "/admin/interns", label: "Interns", icon: icons.interns },
    { to: "/admin/supervisors", label: "Supervisors", icon: icons.assigned },
    { to: "/admin/documents", label: "Documents", icon: icons.documents },
    { to: "/admin/announcements", label: "Announcements", icon: icons.announcements },
    { to: "/profile", label: "Profile", icon: icons.profile },
  ],
  [ROLES.SUPERVISOR]: [
    { to: "/supervisor", label: "Dashboard", icon: icons.dashboard },
    { to: "/supervisor/interns", label: "Assigned Interns", icon: icons.assigned },
    { to: "/supervisor/attendance", label: "Attendance", icon: icons.attendance },
    { to: "/supervisor/journals", label: "Daily Journals", icon: icons.journal },
    { to: "/supervisor/evaluations", label: "Evaluations", icon: icons.evaluation },
    { to: "/profile", label: "Profile", icon: icons.profile },
  ],
  [ROLES.INTERN]: [
    { to: "/intern", label: "Dashboard", icon: icons.dashboard },
    { to: "/intern/attendance", label: "My Attendance", icon: icons.attendance },
    { to: "/intern/journal", label: "Daily Journal", icon: icons.journal },
    { to: "/intern/documents", label: "Documents", icon: icons.documents },
    { to: "/intern/evaluation", label: "Evaluation", icon: icons.evaluation },
    { to: "/intern/announcements", label: "Announcements", icon: icons.announcements },
    { to: "/profile", label: "Profile", icon: icons.profile },
  ],
};

export function getNavItems(role) {
  return NAVIGATION[role] ?? [];
}
