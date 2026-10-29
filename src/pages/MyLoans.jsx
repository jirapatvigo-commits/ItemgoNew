import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { appApi } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/StatusBadge";
import { loanStatus, loanStatusColor, formatThaiDate } from "@/lib/assetUtils";
import { Undo2 } from "lucide-react";
import ReturnDialog from "@/components/ReturnDialog";

export default function MyLoans() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [returnLoan, setReturnLoan] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await appApi.entities.LoanRecord.filter(
        { $or: [{ borrower_user_id: user.id }, { created_by_id: user.id }] },
        { sort: "-created_date", limit: 100 }
      );
      setItems(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">การยืมของฉัน</h1>
      <p className="text-slate-500 text-sm mb-4">สถานะและประวัติการยืมของคุณ</p>

      {loading ? (
        <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-slate-400 text-sm">คุณยังไม่มีประวัติการยืม</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((l) => {
            const st = loanStatus(l);
            return (
              <Card key={l.id} className={st === "เกินกำหนด" ? "border-red-200 bg-red-50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="font-semibold text-slate-900">{l.asset_code || "ไม่ระบุรหัส"}</div>
                      <div className="text-sm text-slate-500">{l.asset_name || "-"}</div>
                    </div>
                    <Badge className={loanStatusColor(st)}>{st}</Badge>
                  </div>
                  <div className="text-xs text-slate-500 mt-2 space-y-0.5">
                    <div>จำนวน {l.quantity} · ยืม {formatThaiDate(l.borrow_date)} · กำหนดคืน {formatThaiDate(l.due_date)}</div>
                    {l.status === "รออนุมัติคืน" && <div>ส่งคำขอคืนแล้ว {formatThaiDate(l.return_request_date)} · รอผู้ดูแลอนุมัติ</div>}
                    {l.return_date && <div>คืนแล้ว {formatThaiDate(l.return_date)}</div>}
                    <div>แผนก/ฝ่าย {l.borrower_department || "-"} · ตึก {l.borrower_building || "-"}</div>
                    {l.return_note && <div>หมายเหตุ: {l.return_note}</div>}
                  </div>
                  <Button size="sm" variant="outline" asChild className="mt-3">
                    <Link to={`/asset/${l.asset_id}`}>ดูรายละเอียดอุปกรณ์</Link>
                  </Button>
                  {l.status === "กำลังยืม" && (
                    <Button size="sm" onClick={() => setReturnLoan(l)} className="mt-3 ml-2">
                      <Undo2 className="w-4 h-4 mr-1" /> ขอคืนอุปกรณ์
                    </Button>
                  )}
                  {l.status === "รออนุมัติยืม" && <div className="text-xs text-amber-700 mt-3">รอผู้ดูแลอนุมัติคำขอยืม</div>}
                  {l.status === "รออนุมัติคืน" && <div className="text-xs text-amber-700 mt-3">รอผู้ดูแลอนุมัติการคืน</div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {returnLoan && (
        <ReturnDialog
          open
          onOpenChange={(open) => !open && setReturnLoan(null)}
          loan={returnLoan}
          onDone={load}
        />
      )}
    </div>
  );
}