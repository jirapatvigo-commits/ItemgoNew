import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appApi } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Package, ArrowLeftRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { loanStatus, loanStatusColor, formatThaiDate } from "@/lib/assetUtils";
import { Badge } from "@/components/StatusBadge";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState({ total: 0, available: 0, borrowing: 0, overdue: 0 });
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [total, available, loans] = await Promise.all([
          appApi.entities.Asset.count(),
          appApi.entities.Asset.count({ available_quantity: { $gt: 0 }, condition: { $ne: "ซ่อมไม่ได้" }, keep_for_study: { $ne: "เก็บ" } }),
          appApi.entities.LoanRecord.filter({ status: "กำลังยืม" }, { sort: "-created_date", limit: 50 }),
        ]);
        const items = loans.items || [];
        let overdue = 0;
        const today = new Date().toISOString().slice(0, 10);
        items.forEach((l) => { if (l.due_date && l.due_date < today) overdue++; });
        setStats({ total, available, borrowing: items.length, overdue });
        setRecent(items.slice(0, 6));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = [
    { label: "สินทรัพย์ทั้งหมด", value: stats.total, icon: Package, color: "text-slate-700 bg-slate-100" },
    { label: "พร้อมยืม", value: stats.available, icon: CheckCircle2, color: "text-emerald-700 bg-emerald-100" },
    { label: "กำลังยืม", value: stats.borrowing, icon: ArrowLeftRight, color: "text-amber-700 bg-amber-100" },
    { label: "เกินกำหนดคืน", value: stats.overdue, icon: AlertTriangle, color: "text-red-700 bg-red-100" },
  ];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">แดชบอร์ด</h1>
      <p className="text-slate-500 text-sm mb-6">ภาพรวมระบบยืม-คืนสินทรัพย์</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="p-4 md:p-5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
                  <Icon style={{ width: 20, height: 20 }} />
                </div>
                <div className="text-2xl md:text-3xl font-bold text-slate-900">{loading ? "-" : c.value}</div>
                <div className="text-xs md:text-sm text-slate-500">{c.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900">{isAdmin ? "รายการกำลังยืมล่าสุด" : "รายการที่ฉันกำลังยืม"}</h2>
        <Link to={isAdmin ? "/loans" : "/my-loans"} className="text-sm text-slate-600 hover:text-slate-900">ดูทั้งหมด →</Link>
      </div>
      <Card>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">ยังไม่มีรายการกำลังยืม</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((l) => {
                const st = loanStatus(l);
                return (
                  <div key={l.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate">{l.asset_code || "ไม่ระบุรหัส"}{isAdmin ? ` · ${l.borrower_name}` : ""}</div>
                      <div className="text-xs text-slate-500">{isAdmin ? `ฝ่าย ${l.borrower_department || "-"} · ` : ""}ครบกำหนด {formatThaiDate(l.due_date)}</div>
                    </div>
                    <Badge className={loanStatusColor(st)}>{st}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
