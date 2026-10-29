import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SignedImage from "@/components/SignedImage";
import { Badge } from "@/components/StatusBadge";
import { formatThaiDate, loanPhotoUris, loanStatus, loanStatusColor } from "@/lib/assetUtils";

export default function LoanDetailDialog({ open, onOpenChange, loan }) {
  const status = loan ? loanStatus(loan) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        {loan && (
          <>
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-7">
            <div>
              <DialogTitle className="text-xl">รายละเอียดการยืม-คืน</DialogTitle>
              <p className="text-sm text-slate-500 mt-1">{loan.asset_name || "ไม่ระบุชื่ออุปกรณ์"} · {loan.asset_code || "-"}</p>
            </div>
            <Badge className={loanStatusColor(status)}>{status}</Badge>
          </div>
        </DialogHeader>

        <section className="border-t border-slate-100 pt-4">
          <h3 className="font-semibold text-slate-800 mb-3">ข้อมูลการยืม</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <Info label="ชื่ออุปกรณ์" value={loan.asset_name} />
            <Info label="รหัสสินทรัพย์" value={loan.asset_code} />
            <Info label="จำนวน" value={loan.quantity} />
            <Info label="วันที่ยืม" value={formatThaiDate(loan.borrow_date)} />
            <Info label="กำหนดคืน" value={formatThaiDate(loan.due_date)} />
            <Info label="ชื่อ-นามสกุลผู้ยืม" value={loan.borrower_name} />
            <Info label="แผนก/ฝ่าย" value={loan.borrower_department} />
            <Info label="เบอร์โทร" value={loan.borrower_phone} />
            <Info label="ตึก" value={loan.borrower_building} />
            <Info label="ชื่อผู้อนุมัติ" value={loan.loan_approved_by_name || loan.lender_name} />
            <Info label="วันที่ส่งคำขอคืน" value={formatThaiDate(loan.return_request_date)} />
            <Info label="วันที่คืนสำเร็จ" value={formatThaiDate(loan.return_date)} />
          </div>
          {loan.asset_id && (
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link to={`/asset/${loan.asset_id}`} onClick={() => onOpenChange(false)}>ดูรายละเอียดสินทรัพย์</Link>
            </Button>
          )}
          {loan.return_note && <p className="text-sm text-slate-600 mt-3">หมายเหตุการคืน: {loan.return_note}</p>}
        </section>

        <section className="border-t border-slate-100 pt-4">
          <h3 className="font-semibold text-slate-800 mb-3">ข้อมูลผู้ส่งคืน</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SignatureValue label="ลงชื่อผู้ส่งคืน" value={loan.return_signature} />
          </div>
        </section>

        <section className="border-t border-slate-100 pt-4">
          <h3 className="font-semibold text-slate-800 mb-3">รูปภาพประกอบ</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EvidenceGallery label="รูปอุปกรณ์ก่อนยืม" fileUris={loanPhotoUris(loan, "borrow")} />
            <EvidenceGallery label="รูปอุปกรณ์ตอนคืน" fileUris={loanPhotoUris(loan, "return")} />
          </div>
        </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-slate-800 break-words">{value || "-"}</div>
    </div>
  );
}

function EvidenceImage({ label, fileUri, fit = "contain" }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {fileUri ? (
        <SignedImage fileUri={fileUri} alt={label} fit={fit} className="w-full h-32 rounded-md border border-slate-200 bg-white" />
      ) : (
        <div className="h-16 flex items-center text-sm text-slate-400">ไม่มีข้อมูล</div>
      )}
    </div>
  );
}

function SignatureValue({ label, value }) {
  const isLegacyImage = typeof value === "string" && value.startsWith("data:image/");
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {isLegacyImage ? (
        <SignedImage fileUri={value} alt={label} fit="contain" className="w-full h-32 rounded-md border border-slate-200 bg-white" />
      ) : value ? (
        <div className="min-h-16 rounded-md border border-slate-200 bg-white px-3 py-4 font-medium text-slate-800">{value}</div>
      ) : (
        <div className="h-16 flex items-center text-sm text-slate-400">ไม่มีข้อมูล</div>
      )}
    </div>
  );
}

function EvidenceGallery({ label, fileUris, fit = "cover" }) {
  return (
    <div>
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      {fileUris.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {fileUris.map((fileUri, index) => (
            <SignedImage key={fileUri} fileUri={fileUri} alt={`${label} ${index + 1}`} fit={fit} className="w-full h-40 rounded-md border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="h-16 flex items-center text-sm text-slate-400">ไม่มีข้อมูล</div>
      )}
    </div>
  );
}
