import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { appApi } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import QrCode from "@/components/QrCode";
import BorrowDialog from "@/components/BorrowDialog";
import { Badge } from "@/components/StatusBadge";
import { availabilityLabel, availabilityColor, conditionColor, completenessColor, formatPrice, formatThaiDate, loanStatus, loanStatusColor, assetDisplay, assetPhotoUris } from "@/lib/assetUtils";
import { LogIn } from "lucide-react";

export default function QRView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [asset, setAsset] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [borrowOpen, setBorrowOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const a = await appApi.entities.Asset.get(id);
        setAsset(a);
        if (!isLoadingAuth && isAuthenticated) {
          const res = await appApi.entities.LoanRecord.filter({ asset_id: id }, { sort: "-created_date", limit: 20 });
          setLoans(res.items || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isAuthenticated, isLoadingAuth]);

  if (loading) return <div className="p-8 text-center text-slate-400">กำลังโหลด...</div>;
  if (!asset) return <div className="p-8 text-center text-slate-400">ไม่พบสินทรัพย์</div>;

  const canBorrow = isAuthenticated && asset.available_quantity > 0 && asset.condition !== "ซ่อมไม่ได้" && asset.keep_for_study !== "เก็บ";
  const photos = assetPhotoUris(asset);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center mb-4">
          <QrCode value={`${window.location.origin}/qr/${id}`} size={120} />
        </div>
        <Card>
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
          <CardContent className="space-y-2 text-sm">
            {photos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pb-2">
                {photos.map((photo, index) => (
                  <SignedImage key={photo} fileUri={photo} alt={`${asset.asset_name || asset.asset_code} ${index + 1}`} className="w-full h-32 rounded-md" />
                ))}
              </div>
            )}
            <Row label="S/N" value={asset.serial_number} />
            <Row label="ราคา" value={`${formatPrice(asset.price)} บาท`} />
            <Row label="วันที่ซื้อ" value={formatThaiDate(asset.purchase_date)} />
            <Row label="ความพร้อม" value={<Badge className={completenessColor(asset.completeness)}>{asset.completeness}</Badge>} />
            <Row label="สภาพ" value={<Badge className={conditionColor(asset.condition)}>{asset.condition}</Badge>} />
            <Row label="ยืมได้" value={`${asset.available_quantity} / ${asset.total_quantity}`} />
            {asset.note && <Row label="หมายเหตุ" value={asset.note} />}
          </CardContent>
        </Card>

        <div className="mt-4">
          {isLoadingAuth ? (
            <Button className="w-full" disabled>กำลังตรวจสอบ...</Button>
          ) : !isAuthenticated ? (
            <Button className="w-full" onClick={() => appApi.auth.redirectToLogin(window.location.href)}>
              <LogIn style={{ width: 16, height: 16 }} className="mr-1" /> เข้าสู่ระบบเพื่อขอยืม
            </Button>
          ) : (
            <Button className="w-full" disabled={!canBorrow} onClick={() => setBorrowOpen(true)}>
              {canBorrow ? "ขอยืมอุปกรณ์นี้" : "ไม่พร้อมให้ยืม"}
            </Button>
          )}
        </div>

        {loans.length > 0 && (
          <div className="mt-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">ประวัติการยืม-คืน</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {loans.map((l) => {
                    const st = loanStatus(l);
                    return (
                      <div key={l.id} className="p-3 flex items-center justify-between">
                        <div className="text-sm">
                          <div className="font-medium text-slate-800">{l.borrower_name}</div>
                          <div className="text-xs text-slate-500">ยืม {formatThaiDate(l.borrow_date)} · กำหนดคืน {formatThaiDate(l.due_date)}</div>
                        </div>
                        <Badge className={loanStatusColor(st)}>{st}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <BorrowDialog open={borrowOpen} onOpenChange={setBorrowOpen} asset={asset} onDone={() => navigate(`/asset/${id}`)} />
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