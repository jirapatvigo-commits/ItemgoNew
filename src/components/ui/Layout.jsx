import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { LayoutDashboard, Package, ArrowLeftRight, ClipboardList, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { appApi } from "@/api/appClient";
import itemgoLogo from "@/assets/itemgo-logo.svg";

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [pendingBorrowRequests, setPendingBorrowRequests] = useState(0);

  useEffect(() => {
    if (!isAdmin) {
      setPendingBorrowRequests(0);
      return undefined;
    }

    let active = true;
    const loadPendingBorrowRequests = async () => {
      try {
        const count = await appApi.entities.LoanRecord.count({ status: "รออนุมัติยืม" });
        if (active) setPendingBorrowRequests(count);
      } catch (error) {
        console.error("Failed to load pending borrow requests:", error);
      }
    };

    loadPendingBorrowRequests();
    const intervalId = window.setInterval(loadPendingBorrowRequests, 30000);
    window.addEventListener("focus", loadPendingBorrowRequests);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", loadPendingBorrowRequests);
    };
  }, [isAdmin, location.pathname]);

  const nav = [
    { to: "/", label: "แดชบอร์ด", icon: LayoutDashboard },
    { to: "/assets", label: "รายการอุปกรณ์", icon: Package },
    ...(isAdmin ? [{
      to: "/loans",
      label: "บันทึกยืม-คืน",
      icon: ArrowLeftRight,
      pendingBorrowRequests,
    }] : []),
    { to: "/my-loans", label: "การยืมของฉัน", icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 shrink-0">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-slate-200">
          <img src="images/NIMT.png" alt="Itemgo" className="w-9 h-9 rounded-lg" />
          <div>
            <div className="font-semibold text-slate-900 leading-tight">ระบบยืม-คืน</div>
            <div className="text-[11px] text-slate-500">สินทรัพย์องค์กร</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => {
            const active = location.pathname === n.to || (n.to !== "/" && location.pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-slate-600 hover:bg-blue-50 hover:text-[#252545]"
                )}
                aria-label={n.pendingBorrowRequests > 0
                  ? `${n.label}, ${n.pendingBorrowRequests} คำขอยืมรออนุมัติ`
                  : undefined}
              >
                <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} />
                {n.label}
                {n.pendingBorrowRequests > 0 && (
                  <span className="ml-auto min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 text-white">
                    {n.pendingBorrowRequests > 99 ? "99+" : n.pendingBorrowRequests}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="px-3 py-2 mb-2">
            <div className="text-sm font-medium text-slate-800 truncate">{user?.full_name || user?.email || "ผู้ใช้"}</div>
            <div className="text-[11px] text-slate-500">{isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้ทั่วไป"}</div>
          </div>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut style={{ width: 16, height: 16 }} /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 bg-white border-b border-slate-200 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <img src="images/NIMT.png" alt="Itemgo" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold text-slate-900 text-sm">ระบบยืม-คืนสินทรัพย์</span>
          </div>
          <button onClick={() => logout()} className="text-slate-500">
            <LogOut style={{ width: 18, height: 18 }} />
          </button>
        </header>
        <main className="flex-1 min-w-0 pb-20 md:pb-0">
          <Outlet />
        </main>
        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex z-30">
          {nav.map((n) => {
            const active = location.pathname === n.to || (n.to !== "/" && location.pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-2 text-[10px] gap-0.5",
                  active ? "text-primary" : "text-slate-400"
                )}
              >
                <span className="relative">
                  <Icon style={{ width: 20, height: 20 }} />
                  {n.pendingBorrowRequests > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-3 -top-2 min-w-5 rounded-full bg-red-600 px-1 text-center text-[10px] font-semibold leading-4 text-white"
                    >
                      {n.pendingBorrowRequests > 99 ? "99+" : n.pendingBorrowRequests}
                    </span>
                  )}
                </span>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}