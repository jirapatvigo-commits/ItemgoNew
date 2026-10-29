import { useEffect, useState } from "react";
import { appApi } from "@/api/appClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SignedImage from "@/components/SignedImage";
import { loanPhotoUris, todayStr } from "@/lib/assetUtils";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";

const MAX_EVIDENCE_PHOTOS = 8;
const storedSignerName = (value) => typeof value === "string" && value.startsWith("data:image/") ? "" : value || "";

async function uploadFile(file) {
  const { file_uri } = await appApi.integrations.Core.UploadPrivateFile({ file });
  return file_uri;
}

// mode: "confirm" (ยืนยันรับของตอนยืม) | "return" (บันทึกการคืน)
export default function ReturnDialog({ open, onOpenChange, loan, mode = "return", onDone }) {
  const { user } = useAuth();
  const isBorrowEvidence = mode === "confirm" || mode === "approve-borrow";
  const [photoUris, setPhotoUris] = useState(() => loanPhotoUris(loan, isBorrowEvidence ? "borrow" : "return"));
  const [signerName, setSignerName] = useState(storedSignerName(isBorrowEvidence ? "" : loan?.return_signature));
  const [approverName, setApproverName] = useState(loan?.loan_approved_by_name || user?.full_name || "");
  const [lenderName, setLenderName] = useState(loan?.lender_name || "");
  const [returnDate, setReturnDate] = useState(todayStr());
  const [returnNote, setReturnNote] = useState(loan?.return_note || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSignerName(storedSignerName(isBorrowEvidence ? "" : loan?.return_signature));
    setApproverName(loan?.loan_approved_by_name || user?.full_name || "");
    setLenderName(loan?.lender_name || "");
  }, [open, isBorrowEvidence, loan?.id, loan?.lender_signature, loan?.return_signature, loan?.lender_name, loan?.loan_approved_by_name, user?.full_name]);

  async function onFile(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (photoUris.length + files.length > MAX_EVIDENCE_PHOTOS) {
      return toast.error(`แนบรูปได้สูงสุด ${MAX_EVIDENCE_PHOTOS} รูป`);
    }
    setUploading(true);
    try {
      const uploadedPhotos = await Promise.all(files.map(uploadFile));
      setPhotoUris((current) => [...current, ...uploadedPhotos]);
    } catch (err) {
      toast.error("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(uri) {
    setPhotoUris((current) => current.filter((photo) => photo !== uri));
  }

  async function handleSave() {
    if (isBorrowEvidence) {
      const approvalName = mode === "approve-borrow" ? approverName.trim() : lenderName.trim();
      if (!approvalName) return toast.error(`กรุณากรอก${mode === "approve-borrow" ? "ชื่อผู้อนุมัติ" : "ชื่อผู้ให้ยืม"}`);
      setSaving(true);
      try {
        if (mode === "approve-borrow") {
          await appApi.entities.LoanRecord.review(loan.id, "approve", {
            approver_name: approvalName,
            borrow_photo_uris: photoUris,
            borrow_photo_uri: photoUris[0] || "",
          });
          toast.success("อนุมัติการยืมและบันทึกหลักฐานแล้ว");
        } else {
          await appApi.entities.LoanRecord.update(loan.id, {
            borrow_photo_uris: photoUris,
            borrow_photo_uri: photoUris[0] || "",
            lender_signature: lenderName.trim(),
            lender_name: lenderName,
          });
          toast.success("บันทึกหลักฐานรับของแล้ว");
        }
        onDone?.();
        onOpenChange(false);
      } catch (e) {
        toast.error(e?.message || "บันทึกไม่สำเร็จ");
      } finally {
        setSaving(false);
      }
    } else {
      if (!signerName.trim()) return toast.error("กรุณากรอกชื่อผู้ส่งคืน");
      setSaving(true);
      try {
        await appApi.entities.LoanRecord.update(loan.id, {
          return_request_date: returnDate,
          return_photo_uris: photoUris,
          return_photo_uri: photoUris[0] || "",
          return_signature: signerName.trim(),
          return_note: returnNote,
          status: "รออนุมัติคืน",
        });
        toast.success("ส่งคำขอคืนแล้ว รอผู้ดูแลอนุมัติ");
        onDone?.();
        onOpenChange(false);
      } catch (e) {
        toast.error(e?.message || "บันทึกไม่สำเร็จ");
      } finally {
        setSaving(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "approve-borrow" ? "อนุมัติคำขอยืม" : mode === "confirm" ? "บันทึกหลักฐานรับของ" : "ส่งคำขอคืนอุปกรณ์"}</DialogTitle>
        </DialogHeader>
        {loan && (
          <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
            {loan.asset_code} · {loan.borrower_name} · จำนวน {loan.quantity}
          </div>
        )}
        <div className="space-y-3 py-1">
          <div>
            <Label>{isBorrowEvidence ? "รูปถ่ายอุปกรณ์ก่อนยืม" : "รูปถ่ายอุปกรณ์ตอนคืน"}</Label>
            {photoUris.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                {photoUris.map((photo) => (
                  <div key={photo} className="relative">
                    <SignedImage fileUri={photo} alt="รูปหลักฐานอุปกรณ์" className="w-full h-28 rounded-md" />
                    <Button type="button" size="icon" variant="outline" title="ลบรูปนี้" onClick={() => removePhoto(photo)} className="absolute right-1 top-1 h-7 w-7 bg-white/90">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {photoUris.length < MAX_EVIDENCE_PHOTOS && (
              <label className="mt-2 flex items-center justify-center gap-2 h-11 border border-dashed border-slate-300 rounded-md cursor-pointer hover:bg-slate-50">
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">{uploading ? "กำลังอัปโหลด..." : `เลือกรูปเพิ่มเติม (สูงสุด ${MAX_EVIDENCE_PHOTOS} รูป)`}</span>
                <input type="file" accept="image/*" multiple disabled={uploading} className="hidden" onChange={onFile} />
              </label>
            )}
          </div>
          {isBorrowEvidence ? (
            <>
              {mode === "approve-borrow" && (
                <div>
                  <Label>ชื่อผู้อนุมัติ *</Label>
                  <Input value={approverName} onChange={(e) => setApproverName(e.target.value)} placeholder="ชื่อผู้อนุมัติ" maxLength={255} required />
                </div>
              )}
              {mode !== "approve-borrow" && (
                <div>
                  <Label>ชื่อผู้ให้ยืม *</Label>
                  <Input value={lenderName} onChange={(e) => setLenderName(e.target.value)} placeholder="ชื่อผู้ให้ยืม" maxLength={255} required />
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <Label>วันที่คืน</Label>
                <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="return-signature-name">ลงชื่อผู้ส่งคืน *</Label>
                <Input
                  id="return-signature-name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="พิมพ์ชื่อ-นามสกุลเพื่อยืนยัน"
                  maxLength={255}
                  required
                />
              </div>
              <div>
                <Label>หมายเหตุ / สภาพความเสียหาย</Label>
                <Textarea rows={2} value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>
            {saving ? "กำลังบันทึก..." : mode === "approve-borrow" ? "อนุมัติยืม" : mode === "return" ? "ส่งคำขอคืน" : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}