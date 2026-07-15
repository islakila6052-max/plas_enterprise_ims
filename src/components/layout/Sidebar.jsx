import { NavLink } from "react-router-dom";
import { cn } from "@/utils/cn";
import { getNavItems } from "@/components/layout/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/lib/constants";

/** Role-aware collapsible sidebar. */
export default function Sidebar({ open, onClose }) {
  const { role, profile } = useAuth();
  const items = getNavItems(role);

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}>
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-black text-white">
            IMS
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold text-slate-800">Internship MS</p>
            <p className="text-xs text-slate-400">Plas Enterprise</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin" || item.to === "/supervisor" || item.to === "/intern"}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )
              }>
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor">
                <path d={item.icon} />
              </svg>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 px-5 py-3">
          <p className="text-xs text-slate-400">
            Signed in as{" "}
            <span className="font-medium text-slate-600">
              {ROLE_LABELS[role] ?? "User"}
            </span>
          </p>
          {profile?.full_name && (
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {profile.full_name}
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
