import moment from "moment";

export function formatThaiDate(dateStr) {
  if (!dateStr) return "-";
  const d = moment(dateStr);
  if (!d.isValid()) return "-";
  return d.format("DD/MM/YYYY");
}

export function todayStr() {
  return moment().format("YYYY-MM-DD");
}

// Pending and rejected states are explicit; active loans may be overdue.
export function loanStatus(loan) {
  if (!loan) return "กำลังยืม";
  if (["รออนุมัติยืม", "รออนุมัติคืน", "ไม่อนุมัติยืม"].includes(loan.status)) return loan.status;
  if (loan.status === "คืนแล้ว") return "คืนแล้ว";
  if (loan.due_date) {
    const due = moment(loan.due_date);
    const today = moment().startOf("day");
    if (due.isBefore(today)) return "เกินกำหนด";
  }
  return "กำลังยืม";
}

export function loanStatusColor(status) {
  switch (status) {
    case "คืนแล้ว":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "กำลังยืม":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "รออนุมัติยืม":
    case "รออนุมัติคืน":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "ไม่อนุมัติยืม":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "เกินกำหนด":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function conditionColor(condition) {
  switch (condition) {
    case "ไม่ชำรุด":
      return "bg-emerald-100 text-emerald-700";
    case "ซ่อมได้":
      return "bg-amber-100 text-amber-700";
    case "ซ่อมไม่ได้":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function completenessColor(c) {
  return c === "ครบ"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-red-100 text-red-700";
}

export function availabilityLabel(asset) {
  const avail = asset?.available_quantity ?? 0;
  if (asset?.condition === "ซ่อมไม่ได้") return "ซ่อมไม่ได้";
  if (asset?.keep_for_study === "เก็บ") return "เก็บไว้ศึกษา";
  if (avail <= 0) return "กำลังถูกยืม";
  return "พร้อมยืม";
}

export function availabilityColor(asset) {
  const label = availabilityLabel(asset);
  switch (label) {
    case "พร้อมยืม":
      return "bg-emerald-100 text-emerald-700";
    case "กำลังถูกยืม":
      return "bg-amber-100 text-amber-700";
    case "เก็บไว้ศึกษา":
      return "bg-slate-200 text-slate-600";
    case "ซ่อมไม่ได้":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function assetDisplay(asset) {
  if (!asset) return "-";
  if (asset.asset_name?.trim()) return asset.asset_name.trim();
  const parts = [asset.brand, asset.model].filter(Boolean);
  return parts.length ? parts.join(" / ") : asset.asset_code;
}

function normalizePhotoUris(multiple, single) {
  const values = [...(Array.isArray(multiple) ? multiple : []), single];
  return [...new Set(values.filter((uri) => typeof uri === "string" && uri.trim()))];
}

export function assetPhotoUris(asset) {
  return normalizePhotoUris(asset?.photo_uris, asset?.photo_uri);
}

export function loanPhotoUris(loan, phase) {
  return normalizePhotoUris(loan?.[`${phase}_photo_uris`], loan?.[`${phase}_photo_uri`]);
}

export function formatPrice(price) {
  if (price == null || isNaN(price)) return "-";
  return Number(price).toLocaleString("en-US", { maximumFractionDigits: 2 });
}