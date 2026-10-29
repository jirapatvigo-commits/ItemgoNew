import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { appApi } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, QrCode, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import AssetFormDialog from "@/components/AssetFormDialog";
import BorrowDialog from "@/components/BorrowDialog";
import SignedImage from "@/components/SignedImage";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/StatusBadge";
import { availabilityLabel, availabilityColor, conditionColor, completenessColor, formatPrice, formatThaiDate, assetDisplay, assetPhotoUris } from "@/lib/assetUtils";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

export default function Assets() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fCompleteness, setFCompleteness] = useState("all");
  const [fCondition, setFCondition] = useState("all");
  const [fStudy, setFStudy] = useState("all");
  const [fAvail, setFAvail] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [borrowAsset, setBorrowAsset] = useState(null);
  const [deleteAsset, setDeleteAsset] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [photoIndexes, setPhotoIndexes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = {};
      if (fCompleteness !== "all") query.completeness = fCompleteness;
      if (fCondition !== "all") query.condition = fCondition;
      if (fStudy !== "all") query.keep_for_study = fStudy;
      if (search.trim()) {
        query.$or = [
          { asset_name: { $regex: search.trim(), $options: "i" } },
          { asset_code: { $regex: search.trim(), $options: "i" } },
          { brand: { $regex: search.trim(), $options: "i" } },
          { model: { $regex: search.trim(), $options: "i" } },
          { serial_number: { $regex: search.trim(), $options: "i" } },
        ];
      }
      const res = await appApi.entities.Asset.filter(query, { sort: "-created_date", limit: 100 });
      let list = res.items || [];
      if (fAvail === "พร้อมยืม") list = list.filter((a) => (a.available_quantity > 0) && a.condition !== "ซ่อมไม่ได้" && a.keep_for_study !== "เก็บ");
      if (fAvail === "กำลังถูกยืม") list = list.filter((a) => a.available_quantity <= 0 && a.condition !== "ซ่อมไม่ได้" && a.keep_for_study !== "เก็บ");
      setItems(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, fCompleteness, fCondition, fStudy, fAvail]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!deleteAsset) return;
    try {
      await appApi.entities.Asset.delete(deleteAsset.id);
      toast.success("ลบสินทรัพย์แล้ว");
      setDeleteAsset(null);
      load();
    } catch {
      toast.error("ลบไม่สำเร็จ");
    }
  }

  function changePreviewPhoto(direction) {
    if (!previewPhoto || previewPhoto.photos.length < 2) return;
    const index = (previewPhoto.index + direction + previewPhoto.photos.length) % previewPhoto.photos.length;
    setPreviewPhoto({ ...previewPhoto, index });
    setPhotoIndexes((current) => ({ ...current, [previewPhoto.assetId]: index }));
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">รายการอุปกรณ์</h1>
          <p className="text-slate-500 text-sm">ค้นหาและกรองอุปกรณ์ที่ต้องการยืม</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditAsset(null); setFormOpen(true); }}>
            <Plus style={{ width: 16, height: 16 }} className="mr-1" /> เพิ่มสินทรัพย์
          </Button>
        )}
      </div>

      <Card className="mb-4">
        <CardContent className="p-3 md:p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" style={{ width: 16, height: 16 }} />
            <Input
              className="pl-9"
              placeholder="ค้นหาชื่อหรือรหัสสินทรัพย์ ยี่ห้อ Model หรือ S/N"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Select value={fAvail} onValueChange={setFAvail}>
              <SelectTrigger><SelectValue placeholder="สถานะยืม" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะยืมทั้งหมด</SelectItem>
                <SelectItem value="พร้อมยืม">พร้อมยืม</SelectItem>
                <SelectItem value="กำลังถูกยืม">กำลังถูกยืม</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fCompleteness} onValueChange={setFCompleteness}>
              <SelectTrigger><SelectValue placeholder="ความพร้อม" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ความพร้อมทั้งหมด</SelectItem>
                <SelectItem value="ครบ">ครบ</SelectItem>
                <SelectItem value="ไม่ครบ">ไม่ครบ</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fCondition} onValueChange={setFCondition}>
              <SelectTrigger><SelectValue placeholder="สภาพ" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สภาพทั้งหมด</SelectItem>
                <SelectItem value="ไม่ชำรุด">ไม่ชำรุด</SelectItem>
                <SelectItem value="ซ่อมได้">ซ่อมได้</SelectItem>
                <SelectItem value="ซ่อมไม่ได้">ซ่อมไม่ได้</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fStudy} onValueChange={setFStudy}>
              <SelectTrigger><SelectValue placeholder="เก็บศึกษา" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">เก็บศึกษาทั้งหมด</SelectItem>
                <SelectItem value="ไม่เก็บ">ไม่เก็บ</SelectItem>
                <SelectItem value="เก็บ">เก็บ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-slate-400">กำลังโหลด...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-400">ไม่พบอุปกรณ์ที่ตรงเงื่อนไข</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {items.map((a) => {
            const photos = assetPhotoUris(a);
            const photoIndex = photos.length ? (photoIndexes[a.id] || 0) % photos.length : 0;
            const currentPhoto = photos[photoIndex];
            return (
            <Card key={a.id} className="hover:shadow-md transition-shadow overflow-hidden">
              <CardContent className="p-4">
                {currentPhoto && (
                  <div className="relative mb-3 h-48 overflow-hidden rounded-md bg-slate-50">
                    <button
                      type="button"
                      aria-label={`ขยายรูป ${a.asset_name || a.asset_code} ${photoIndex + 1}`}
                      onClick={() => setPreviewPhoto({
                        assetId: a.id,
                        photos,
                        index: photoIndex,
                        alt: a.asset_name || a.asset_code,
                      })}
                      className="absolute inset-0 block h-full w-full cursor-zoom-in rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                    >
                      <SignedImage
                        fileUri={currentPhoto}
                        alt={`${a.asset_name || a.asset_code} ${photoIndex + 1}`}
                        fit="contain"
                        className="h-full w-full object-contain"
                      />
                    </button>
                    {photos.length > 1 && (
                      <>
                        <button
                          type="button"
                          aria-label="ดูรูปก่อนหน้า"
                          title="ดูรูปก่อนหน้า"
                          onClick={() => setPhotoIndexes((current) => ({
                            ...current,
                            [a.id]: (photoIndex + photos.length - 1) % photos.length,
                          }))}
                          className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          aria-label="ดูรูปถัดไป"
                          title="ดูรูปถัดไป"
                          onClick={() => setPhotoIndexes((current) => ({
                            ...current,
                            [a.id]: (photoIndex + 1) % photos.length,
                          }))}
                          className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                        <span className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-slate-900/70 px-2.5 py-1 text-xs text-white">
                          {photoIndex + 1} / {photos.length}
                        </span>
                      </>
                    )}
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{assetDisplay(a)}</div>
                    <div className="text-sm text-slate-500 truncate">{a.asset_code || "ไม่ระบุรหัส"}</div>
                  </div>
                  <Badge className={availabilityColor(a)}>{availabilityLabel(a)}</Badge>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5 mb-3">
                  <div>S/N: {a.serial_number || "-"}</div>
                  <div>ราคา: {formatPrice(a.price)} บาท · ซื้อ {formatThaiDate(a.purchase_date)}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge className={completenessColor(a.completeness)}>{a.completeness}</Badge>
                    <Badge className={conditionColor(a.condition)}>{a.condition}</Badge>
                    {a.keep_for_study === "เก็บ" && <Badge className="bg-slate-200 text-slate-600">เก็บศึกษา</Badge>}
                  </div>
                  <div>คงเหลือยืมได้: {a.available_quantity} / {a.total_quantity}</div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" asChild>
                    <Link to={`/asset/${a.id}`}><QrCode style={{ width: 14, height: 14 }} className="mr-1" /> รายละเอียด</Link>
                  </Button>
                  <Button
                    size="sm"
                    disabled={a.available_quantity <= 0 || a.condition === "ซ่อมไม่ได้" || a.keep_for_study === "เก็บ"}
                    onClick={() => setBorrowAsset(a)}
                  >
                    ขอยืม
                  </Button>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setEditAsset(a); setFormOpen(true); }}>
                        <Pencil style={{ width: 14, height: 14 }} />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteAsset(a)}>
                        <Trash2 style={{ width: 14, height: 14 }} />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewPhoto} onOpenChange={(open) => !open && setPreviewPhoto(null)}>
        <DialogContent className="flex h-[92vh] w-[96vw] max-w-[96vw] items-center justify-center border-0 bg-slate-950 p-8 text-white sm:p-10">
          <DialogTitle className="sr-only">{previewPhoto?.alt || "รูปอุปกรณ์"}</DialogTitle>
          {previewPhoto && (
            <>
              <SignedImage
                fileUri={previewPhoto.photos[previewPhoto.index]}
                alt={`${previewPhoto.alt} ${previewPhoto.index + 1}`}
                fit="contain"
                className="h-full max-h-[calc(92vh-4rem)] w-full object-contain"
              />
              {previewPhoto.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="ดูรูปก่อนหน้า"
                    title="ดูรูปก่อนหน้า"
                    onClick={() => changePreviewPhoto(-1)}
                    className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="ดูรูปถัดไป"
                    title="ดูรูปถัดไป"
                    onClick={() => changePreviewPhoto(1)}
                    className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
                    {previewPhoto.index + 1} / {previewPhoto.photos.length}
                  </span>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <AssetFormDialog open={formOpen} onOpenChange={setFormOpen} asset={editAsset} onSaved={load} />
      <BorrowDialog open={!!borrowAsset} onOpenChange={(o) => !o && setBorrowAsset(null)} asset={borrowAsset} onDone={load} />

      <AlertDialog open={!!deleteAsset} onOpenChange={(o) => !o && setDeleteAsset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบสินทรัพย์?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-slate-500 px-6">ลบ "{deleteAsset?.asset_code || deleteAsset?.asset_name}" ออกจากระบบ ไม่สามารถกู้คืนได้</p>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}