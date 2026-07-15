import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { getNavItems } from "@/components/layout/navigation";
import { useAuth } from "@/contexts/AuthContext";

/** Derive the current page title from the active nav item. */
function usePageTitle() {
  const { role } = useAuth();
  const { pathname } = useLocation();
  const items = getNavItems(role);
  const match = items.find((item) => {
    if (item.to === "/admin" || item.to === "/supervisor" || item.to === "/intern") {
      return pathname === item.to;
    }
    return pathname === item.to || pathname.startsWith(item.to + "/");
  });
  if (match) return match.label;
  if (pathname === "/profile") return "Profile";
  return "Dashboard";
}

/** Authenticated application shell. */
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const title = usePageTitle();

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
