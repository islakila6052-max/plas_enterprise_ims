// src/layouts/DashboardLayout.jsx
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import NetworkStatus from "@/components/layout/NetworkStatus";
import OnboardingTour, {
  hasCompletedTour,
} from "@/components/layout/OnboardingTour";
import { getNavItems } from "@/components/layout/navigation";
import { useAuth } from "@/contexts/AuthContext";

/** Derive the current page title from the active nav item. */
function usePageTitle() {
  const { role } = useAuth();
  const { pathname } = useLocation();
  const items = getNavItems(role);
  const match = items.find((item) => {
    if (
      item.to === "/admin" ||
      item.to === "/supervisor" ||
      item.to === "/intern"
    ) {
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
  const { isAdmin, isSupervisor, isIntern, loading: authLoading } = useAuth();
  const location = useLocation();

  // Interactive onboarding tour: auto-starts on a user's FIRST dashboard
  // visit (any role). Restartable later via the profile menu (Sidebar).
  const tourEnabled = isAdmin || isSupervisor || isIntern;
  const homePath = isAdmin
    ? "/admin"
    : isSupervisor
      ? "/supervisor"
      : "/intern";
  const [tourActive, setTourActive] = useState(false);

  useEffect(() => {
    if (authLoading || !tourEnabled) return;
    if (!hasCompletedTour() && location.pathname === homePath) {
      setTourActive(true);
    }
  }, [authLoading, tourEnabled, location.pathname, homePath]);

  // Manual restart from the Sidebar profile menu ("Restart Tour").
  useEffect(() => {
    function onRestart() {
      if (tourEnabled) setTourActive(true);
    }
    window.addEventListener("ims:restart-tour", onRestart);
    return () => window.removeEventListener("ims:restart-tour", onRestart);
  }, [tourEnabled]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <NetworkStatus />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar title={title} onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
      <OnboardingTour
        active={tourActive}
        onFinish={() => setTourActive(false)}
      />
    </div>
  );
}
