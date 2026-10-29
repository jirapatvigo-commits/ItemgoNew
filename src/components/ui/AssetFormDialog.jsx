import { useState, useEffect } from "react";
import { appApi } from "@/api/appClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SignedImage from "@/components/SignedImage";
import { assetPhotoUris } from "@/lib/assetUtils";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";

const MAX_ASSET_PHOTOS = 8;
const MAX_ASSET_PHOTO_BYTES = 8 * 1024 * 1024;

async function uploadFile(file) {
  const { file_uri } = await appApi.integrations.Core.UploadPrivateFile({ file });
  return file_uri;
}

const empty = {
  asset_name: "", asset_code: "", brand: "", model: "", serial_number: "", price: "",
  purchase_date: "", completeness: "ครบ", condition: "ไม่ชำรุด",
  keep_for_study: "ไม่เก็บ", note: "", total_quantity: 1, available_quantity: 1,
  photo_uri: "", photo_uris: [],
};

const formForAsset = (asset) => {
  const photos = assetPhotoUris(asset);
  return { ...empty, ...asset, photo_uri: photos[0] || "", photo_uris: photos };
};

export default function AssetFormDialog({ open, onOpenChange, asset, onSaved }) {
  const [form, setForm] = useState(() => formForAsset(asset));
  const [photos, setPhotos] = useState(() => assetPhotoUris(asset));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(formForAsset(asset));
      setPhotos(assetPhotoUris(asset));
    }
  }, [open, asset]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function onFile(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (photos.length + files.length > MAX_ASSET_PHOTOS) {
      toast.error(`แนบรูปสินทรัพย์ได้สูงสุด ${MAX_ASSET_PHOTOS} รูป`);
      return;
    }
    const oversizedFile = files.find((file) => file.size > MAX_ASSET_PHOTO_BYTES);
    if (oversizedFile) {
      toast.error(`ไฟล์ ${oversizedFile.name} มีขนาดเกิน 8 MB`);
      return;
    }
    setUploading(true);
    try {
      const uploadedPhotos = await Promise.all(files.map(uploadFile));
      const nextPhotos = [...photos, ...uploadedPhotos];
      setPhotos(nextPhotos);
      setForm((current) => ({ ...current, photo_uris: nextPhotos, photo_uri: nextPhotos[0] || "" }));
    } catch (err) {
      toast.error(err.message || "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(uri) {
    const nextPhotos = photos.filter((photo) => photo !== uri);
    setPhotos(nextPhotos);
    setForm((current) => ({ ...current, photo_uris: nextPhotos, photo_uri: nextPhotos[0] || "" }));
  }

  async function handleSave() {
    if (!form.asset_name?.trim()) {
      toast.error("กรุณากรอกชื่อสินทรัพย์");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: form.price === "" ? null : Number(form.price),
        total_quantity: Number(form.total_quantity) || 1,
        available_quantity: Number(form.available_quantity) || 0,
      };
      if (asset?.id) {
        await appApi.entities.Asset.update(asset.id, payload);
        toast.success("บันทึกการแก้ไขแล้ว");
      } else {
        await appApi.entities.Asset.create(payload);
        toast.success("เพิ่มสินทรัพย์แล้ว");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ: " + (e?.message || "error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{asset ? "แก้ไขสินทรัพย์" : "เพิ่มสินทรัพย์"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2">
            <Label>รูปภาพอุปกรณ์ (สูงสุด {MAX_ASSET_PHOTOS} รูป, รูปละไม่เกิน 8 MB)</Label>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {photos.map((photo) => (
                  <div key={photo} className="relative">
                    <SignedImage fileUri={photo} alt={form.asset_name} className="w-full h-24 rounded-md" />
                    <Button type="button" size="icon" variant="outline" title="ลบรูปนี้" onClick={() => removePhoto(photo)} className="absolute right-1 top-1 h-7 w-7 bg-white/90">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < MAX_ASSET_PHOTOS && (
              <label className="mt-2 flex items-center justify-center gap-2 h-11 border border-dashed border-slate-300 rounded-md cursor-pointer hover:bg-slate-50">
                <Upload className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">{uploading ? "กำลังอัปโหลด..." : "เลือกรูปภาพเพิ่มเติม"}</span>
                <input type="file" accept="image/*" multiple disabled={uploading} className="hidden" onChange={onFile} />
              </label>
            )}
          </div>
          <div className="col-span-2">
            <Label htmlFor="asset-name">ชื่อสินทรัพย์ *</Label>
            <Input
              id="asset-name"
              value={form.asset_name || ""}
              onChange={(e) => set("asset_name", e.target.value)}
              placeholder="เช่น เครื่องฉายโปรเจกเตอร์ ห้องประชุม"
              required
            />
          </div>
          <div className="col-span-1">
            <Label>รหัสสินทรัพย์ </Label>
            <Input value={form.asset_code} onChange={(e) => set("asset_code", e.target.value)} />
          </div>
          <div>
            <Label>ยี่ห้อ</Label>
            <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </div>
          <div>
            <Label>Model</Label>
            <Input value={form.model} onChange={(e) => set("model", e.target.value)} />
          </div>
          <div>
            <Label>S/N</Label>
            <Input value={form.serial_number} onChange={(e) => set("serial_number", e.target.value)} />
          </div>
          <div>
            <Label>ราคาสินทรัพย์ (บาท)</Label>
            <Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} />
          </div>
          <div>
            <Label>วันที่ซื้อ</Label>
            <Input type="date" value={form.purchase_date || ""} onChange={(e) => set("purchase_date", e.target.value)} />
          </div>
          <div>
            <Label>จำนวนทั้งหมด</Label>
            <Input type="number" min="1" value={form.total_quantity} onChange={(e) => set("total_quantity", e.target.value)} />
          </div>
          <div>
            <Label>จำนวนที่ยืมได้</Label>
            <Input type="number" min="0" value={form.available_quantity} onChange={(e) => set("available_quantity", e.target.value)} />
          </div>
          <div>
            <Label>สถานะความพร้อม</Label>
            <Select value={form.completeness} onValueChange={(v) => set("completeness", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ครบ">ครบ</SelectItem>
                <SelectItem value="ไม่ครบ">ไม่ครบ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>สภาพชำรุด</Label>
            <Select value={form.condition} onValueChange={(v) => set("condition", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ไม่ชำรุด">ไม่ชำรุด</SelectItem>
                <SelectItem value="ซ่อมได้">ซ่อมได้</SelectItem>
                <SelectItem value="ซ่อมไม่ได้">ซ่อมไม่ได้</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>เก็บไว้ศึกษา</Label>
            <Select value={form.keep_for_study} onValueChange={(v) => set("keep_for_study", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ไม่เก็บ">ไม่เก็บ</SelectItem>
                <SelectItem value="เก็บ">เก็บ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>หมายเหตุ</Label>
            <Textarea rows={2} value={form.note || ""} onChange={(e) => set("note", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}