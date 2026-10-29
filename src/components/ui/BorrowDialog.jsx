import { useState } from "react";
import { appApi } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assetDisplay, todayStr } from "@/lib/assetUtils";
import { toast } from "sonner";

export default function BorrowDialog({ open, onOpenChange, asset, onDone }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    borrower_name: user?.full_name || "",
    borrower_department: user?.department || "",
    borrower_building: user?.building || "",
    borrower_phone: "",
    quantity: 1,
    borrow_date: todayStr(),
    due_date: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleBorrow() {
    const requiredFields = [
      [form.borrower_name, "ชื่อ-นามสกุล"],
      [form.borrower_department, "แผนก/ฝ่าย"],
      [form.borrower_building, "ตึก"],
      [form.borrower_phone, "เบอร์โทร"],
      [form.borrow_date, "วันที่ยืม"],
      [form.due_date, "กำหนดวันที่คืน"],
    ];
    const missingField = requiredFields.find(([value]) => !String(value || "").trim());
    if (missingField) return toast.error(`กรุณากรอก${missingField[1]}`);
    if (form.due_date < form.borrow_date) return toast.error("กำหนดคืนต้องไม่ก่อนวันที่ยืม");
    const qty = Number(form.quantity) || 1;
    if (qty < 1) return toast.error("จำนวนต้องมากกว่า 0");
    if (asset && qty > (asset.available_quantity ?? 0)) {
      return toast.error(`ยืมได้สูงสุด ${asset.available_quantity} ชิ้น`);
    }
    setSaving(true);
    try {
      await appApi.entities.LoanRecord.create({
        asset_id: asset?.id,
        asset_code: asset?.asset_code,
        asset_name: assetDisplay(asset),
        borrower_name: form.borrower_name.trim(),
        borrower_department: form.borrower_department.trim(),
        borrower_building: form.borrower_building.trim(),
        borrower_phone: form.borrower_phone.trim(),
        quantity: qty,
        borrow_date: form.borrow_date,
        due_date: form.due_date,
        status: "รออนุมัติยืม",
        borrower_signature: form.borrower_name.trim(),
      });
      toast.success("ส่งคำขอยืมแล้ว รอผู้ดูแลอนุมัติ");
      onDone?.();
      onOpenChange(false);
      setForm((f) => ({ ...f, quantity: 1, due_date: "" }));
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || "error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ขอยืมอุปกรณ์</DialogTitle>
        </DialogHeader>
        {asset && (
          <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
            {assetDisplay(asset)} · {asset.asset_code}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="col-span-2">
            <Label>ชื่อ-นามสกุล *</Label>
            <Input value={form.borrower_name} onChange={(e) => set("borrower_name", e.target.value)} required />
          </div>
          <div>
            <Label>แผนก/ฝ่าย *</Label>
            <Input value={form.borrower_department} onChange={(e) => set("borrower_department", e.target.value)} required />
          </div>
          <div>
            <Label>ตึก *</Label>
            <Input value={form.borrower_building} onChange={(e) => set("borrower_building", e.target.value)} required />
          </div>
          <div>
            <Label>เบอร์โทรหรือเบอร์ติดต่อ *</Label>
            <Input type="tel" inputMode="tel" value={form.borrower_phone} onChange={(e) => set("borrower_phone", e.target.value)} required />
          </div>
          <div>
            <Label>จำนวน</Label>
            <Input type="number" min="1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
          </div>
          <div>
            <Label>วันที่ยืม *</Label>
            <Input type="date" value={form.borrow_date} onChange={(e) => set("borrow_date", e.target.value)} required />
          </div>
          <div className="col-span-2">
            <Label>กำหนดวันที่คืน *</Label>
            <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleBorrow} disabled={saving}>{saving ? "กำลังบันทึก..." : "ยืม"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}