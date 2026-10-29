import { useEffect, useState, useCallback } from "react";
import { appApi } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, CheckCircle2, XCircle, Eye } from "lucide-react";
import ReturnDialog from "@/components/ReturnDialog";
import LoanDetailDialog from "@/components/ui/LoanDetailDialog";
import { Badge } from "@/components/StatusBadge";
import { loanPhotoUris, loanStatus, loanStatusColor, formatThaiDate } from "@/lib/assetUtils";
import { toast } from "sonner";

export default function Loans() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState("all");
  const [dialog, setDialog] = useState(null); // { loan, mode }
  const [detailLoan, setDetailLoan] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = {};
      if (fStatus === "กำลังยืม") query.status = "กำลังยืม";
      if (fStatus === "รออนุมัติยืม") query.status = "รออนุมัติยืม";
      if (fStatus === "รออนุมัติคืน") query.status = "รออนุมัติคืน";
      if (fStatus === "คืนแล้ว") query.status = "คืนแล้ว";
      if (fStatus === "ไม่อนุมัติยืม") query.status = "ไม่อนุมัติยืม";
      if (search.trim()) {
        query.$or = [
          { asset_code: { $regex: search.trim(), $options: "i" } },
          { borrower_name: { $regex: search.trim(), $options: "i" } },
          { borrower_department: { $regex: search.trim(), $options: "i" } },
        ];
      }
      const res = await appApi.entities.LoanRecord.filter(query, { sort: "-created_date", limit: 100 });
      let list = res.items || [];
      if (fStatus === "เกินกำหนด") {
        const today = new Date().toISOString().slice(0, 10);
        list = list.filter((l) => l.status === "กำลังยืม" && l.due_date && l.due_date < today);
      }
      setItems(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, fStatus]);

  useEffect(() => { load(); }, [load]);

  async function handleReview(loan, decision) {
    setProcessingId(loan.id);
    try {
      await appApi.entities.LoanRecord.review(loan.id, decision);
      toast.success(decision === "approve" ? "อนุมัติรายการแล้ว" : "ปฏิเสธรายการแล้ว");
      await load();
    } catch (error) {
      toast.error(error.message || "ดำเนินการไม่สำเร็จ");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">บันทึกยืม-คืน</h1>
      <p className="text-slate-500 text-sm mb-4">{isAdmin ? "ตรวจสอบการยืม-คืนทั้งหมด" : "ประวัติการยืมของทุกคน"}</p>

      <Card className="mb-4">
        <CardContent className="p-3 md:p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ width: 16, height: 16 }} />
            <Input className="pl-9" placeholder="ค้นหารหัสสินทรัพย์ ชื่อผู้ยืม หรือฝ่าย" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">สถานะทั้งหมด</SelectItem>
              <SelectItem value="รออนุมัติยืม">รออนุมัติยืม</SelectItem>
              <SelectItem value="รออนุมัติคืน">รออนุมัติคืน</SelectItem>
              <SelectItem value="กำลังยืม">กำลังยืม</SelectItem>
              <SelectItem value="เกินกำหนด">เกินกำหนดคืน</SelectItem>
              <SelectItem value="คืนแล้ว">คืนแล้ว</SelectItem>
              <SelectItem value="ไม่อนุมัติยืม">ไม่อนุมัติยืม</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-400">ไม่พบรายการ</div>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className={`w-full table-fixed text-sm ${isAdmin ? "min-w-[1125px]" : "min-w-[945px]"}`}>
              <colgroup>
                <col className="w-[110px]" />
                <col className="w-[115px]" />
                <col className="w-[100px]" />
                <col className="w-[90px]" />
                <col className="w-[70px]" />
                <col className="w-[60px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                <col className="w-[100px]" />
                {isAdmin && <col className="w-[180px]" />}
              </colgroup>
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="whitespace-nowrap px-2 py-3 text-left font-medium">รหัสสินทรัพย์</th>
                  <th className="whitespace-nowrap px-2 py-3 text-left font-medium">ชื่ออุปกรณ์</th>
                  <th className="whitespace-nowrap px-2 py-3 text-left font-medium">ผู้ยืม</th>
                  <th className="whitespace-nowrap px-2 py-3 text-left font-medium">ฝ่าย</th>
                  <th className="whitespace-nowrap px-2 py-3 text-left font-medium">ตึก</th>
                  <th className="whitespace-nowrap px-2 py-3 text-center font-medium">จำนวน</th>
                  <th className="whitespace-nowrap px-2 py-3 text-center font-medium">วันที่ยืม</th>
                  <th className="whitespace-nowrap px-2 py-3 text-center font-medium">กำหนดคืน</th>
                  <th className="whitespace-nowrap px-2 py-3 text-center font-medium">วันที่คืน</th>
                  <th className="whitespace-nowrap px-2 py-3 text-center font-medium">สถานะ</th>
                  {isAdmin && <th className="sticky right-0 z-20 whitespace-nowrap border-l border-slate-200 bg-slate-50 px-2 py-3 text-center font-medium">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((l) => {
                  const st = loanStatus(l);
                  return (
                    <tr key={l.id} className={st === "เกินกำหนด" ? "bg-red-50" : ""}>
                      <td className="px-2 py-3 align-top">
                        <div className="font-medium text-slate-800 break-words">{l.asset_code || "-"}</div>
                        <Button size="sm" variant="ghost" onClick={() => setDetailLoan(l)} className="mt-1 -ml-2 h-8 px-2 text-xs">
                          <Eye className="w-3.5 h-3.5 mr-1" /> รายละเอียด
                        </Button>
                      </td>
                      <td className="px-2 py-3 break-words text-slate-700">{l.asset_name || "-"}</td>
                      <td className="px-2 py-3 break-words text-slate-700">{l.borrower_name}</td>
                      <td className="px-2 py-3 break-words text-slate-600">{l.borrower_department || "-"}</td>
                      <td className="px-2 py-3 break-words text-slate-600">{l.borrower_building || "-"}</td>
                      <td className="px-2 py-3 text-center text-slate-600">{l.quantity}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-center text-slate-600">{formatThaiDate(l.borrow_date)}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-center text-slate-600">{formatThaiDate(l.due_date)}</td>
                      <td className="whitespace-nowrap px-2 py-3 text-center text-slate-600">
                        {formatThaiDate(l.return_date || l.return_request_date)}
                        {l.status === "รออนุมัติคืน" && <div className="text-xs text-sky-700">รออนุมัติ</div>}
                      </td>
                      <td className="px-2 py-3 text-center"><Badge className={loanStatusColor(st)}>{st}</Badge></td>
                      {isAdmin && (
                        <td className={`sticky right-0 z-10 border-l border-slate-100 px-2 py-3 text-center align-middle ${st === "เกินกำหนด" ? "bg-red-50" : "bg-white"}`}>
                          <div className="flex flex-wrap justify-center gap-1">
                          {l.status === "รออนุมัติยืม" && (
                            <div className="flex flex-wrap justify-center gap-1">
                              <Button size="sm" onClick={() => setDialog({ loan: l, mode: "approve-borrow" })} disabled={processingId === l.id}>
                                <CheckCircle2 className="w-4 h-4 mr-1" /> ตรวจหลักฐานและอนุมัติ
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleReview(l, "reject")} disabled={processingId === l.id}>
                                <XCircle className="w-4 h-4 mr-1" /> ไม่อนุมัติ
                              </Button>
                            </div>
                          )}
                          {l.status === "รออนุมัติคืน" && (
                            <div className="flex flex-wrap justify-center gap-1">
                              <Button size="sm" onClick={() => handleReview(l, "approve")} disabled={processingId === l.id}>
                                <CheckCircle2 className="w-4 h-4 mr-1" /> อนุมัติคืน
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleReview(l, "reject")} disabled={processingId === l.id}>
                                <XCircle className="w-4 h-4 mr-1" /> ปฏิเสธการคืน
                              </Button>
                            </div>
                          )}
                          {l.status === "กำลังยืม" && loanPhotoUris(l, "borrow").length === 0 && (
                            <div className="flex flex-wrap justify-center gap-1">
                              <Button size="sm" variant="outline" onClick={() => setDialog({ loan: l, mode: "confirm" })}>
                                เพิ่มหลักฐานรับของ
                              </Button>
                            </div>
                          )}
                          {l.status === "คืนแล้ว" && <CheckCircle2 className="mx-auto block text-emerald-500" style={{ width: 18, height: 18 }} />}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {dialog && (
        <ReturnDialog
          open={!!dialog}
          onOpenChange={(o) => !o && setDialog(null)}
          loan={dialog.loan}
          mode={dialog.mode}
          onDone={load}
        />
      )}
      <LoanDetailDialog
        open={!!detailLoan}
        onOpenChange={(open) => !open && setDetailLoan(null)}
        loan={detailLoan}
      />
    </div>
  );
}
