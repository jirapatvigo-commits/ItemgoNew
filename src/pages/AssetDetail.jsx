import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { appApi } from "@/api/appClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import QrCode from "@/components/QrCode";
import BorrowDialog from "@/components/BorrowDialog";
import SignedImage from "@/components/SignedImage";
import { Badge } from "@/components/StatusBadge";
import { availabilityLabel, availabilityColor, conditionColor, completenessColor, formatPrice, formatThaiDate, loanStatus, loanStatusColor, assetDisplay, assetPhotoUris, loanPhotoUris } from "@/lib/assetUtils";

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [borrowOpen, setBorrowOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const a = await appApi.entities.Asset.get(id);
      setAsset(a);
      const res = await appApi.entities.LoanRecord.filter({ asset_id: id }, { sort: "-created_date", limit: 50 });
      setLoans(res.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>;
  if (!asset) return <div className="p-8 text-center text-slate-400">ไม่พบสินทรัพย์</div>;

  const scanUrl = `${window.location.origin}/qr/${id}`;
  const photos = assetPhotoUris(asset);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3">
        <ArrowLeft style={{ width: 16, height: 16 }} className="mr-1" /> ย้อนกลับ
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{assetDisplay(asset)}</CardTitle>
                <p className="text-slate-500 text-sm">รหัสสินทรัพย์ {asset.asset_code || "ไม่ระบุรหัส"}</p>
                {(asset.brand || asset.model) && <p className="text-slate-500 text-sm">{[asset.brand, asset.model].filter(Boolean).join(" / ")}</p>}
              </div>
              <Badge className={availabilityColor(asset)}>{availabilityLabel(asset)}</Badge>
            </div>
          </CardHeader>
          {photos.length > 0 && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {photos.map((photo, index) => (
                  <SignedImage key={photo} fileUri={photo} alt={`${asset.asset_name || asset.asset_code} ${index + 1}`} className="w-full h-56 rounded-lg" />
                ))}
              </div>
            </CardContent>
          )}
          <CardContent className="space-y-2 text-sm">
            <Row label="S/N" value={asset.serial_number} />
            <Row label="ราคาสินทรัพย์" value={`${formatPrice(asset.price)} บาท`} />
            <Row label="วันที่ซื้อ" value={formatThaiDate(asset.purchase_date)} />
            <Row label="จำนวนทั้งหมด" value={asset.total_quantity} />
            <Row label="ยืมได้" value={asset.available_quantity} />
            <Row label="สถานะความพร้อม" value={<Badge className={completenessColor(asset.completeness)}>{asset.completeness}</Badge>} />
            <Row label="สภาพชำรุด" value={<Badge className={conditionColor(asset.condition)}>{asset.condition}</Badge>} />
            <Row label="เก็บไว้ศึกษา" value={asset.keep_for_study} />
            <Row label="หมายเหตุ" value={asset.note || "-"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">QR Code สติกเกอร์</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center">
            <QrCode value={scanUrl} size={200} />
            <p className="text-xs text-slate-500 mt-2 text-center">สแกนเพื่อดูข้อมูลและขอยืม</p>
            <Button variant="outline" className="mt-3 w-full" onClick={() => window.print()}>
              <Printer style={{ width: 16, height: 16 }} className="mr-1" /> พิมพ์สติกเกอร์
            </Button>
            <Button
              className="mt-2 w-full"
              disabled={asset.available_quantity <= 0 || asset.condition === "ซ่อมไม่ได้" || asset.keep_for_study === "เก็บ"}
              onClick={() => setBorrowOpen(true)}
            >
              ขอยืมอุปกรณ์นี้
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">ประวัติการยืม-คืน</h2>
        <Card>
          <CardContent className="p-0">
            {loans.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">ยังไม่มีประวัติการยืม</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {loans.map((l) => {
                  const st = loanStatus(l);
                  return (
                    <div key={l.id} className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-slate-800">{l.borrower_name}</div>
                        <Badge className={loanStatusColor(st)}>{st}</Badge>
                      </div>
                      <div className="text-xs text-slate-500">
                        ฝ่าย {l.borrower_department || "-"} · เบอร์ {l.borrower_phone || "-"} · จำนวน {l.quantity}
                      </div>
                      <div className="text-xs text-slate-500">
                        ยืม {formatThaiDate(l.borrow_date)} · กำหนดคืน {formatThaiDate(l.due_date)} · คืน {formatThaiDate(l.return_date)}
                      </div>
                      <div className="flex gap-3 mt-2">
                        {loanPhotoUris(l, "borrow").map((photo, index) => (
                          <div key={photo}>
                            <div className="text-[10px] text-slate-400 mb-1">รูปก่อนยืม {index + 1}</div>
                            <SignedImage fileUri={photo} className="w-20 h-20 rounded" />
                          </div>
                        ))}
                        {loanPhotoUris(l, "return").map((photo, index) => (
                          <div key={photo}>
                            <div className="text-[10px] text-slate-400 mb-1">รูปตอนคืน {index + 1}</div>
                            <SignedImage fileUri={photo} className="w-20 h-20 rounded" />
                          </div>
                        ))}
                      </div>
                      {l.return_note && <div className="text-xs text-slate-600 mt-2">หมายเหตุ: {l.return_note}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BorrowDialog open={borrowOpen} onOpenChange={setBorrowOpen} asset={asset} onDone={load} />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-slate-50 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 text-right">{value ?? "-"}</span>
    </div>
  );
}