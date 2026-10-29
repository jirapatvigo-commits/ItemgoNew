import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";

export default function SignaturePad({ value, onChange, label = "ลายเซ็น", height = 160 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const hasContent = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
      hasContent.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : null;
    const clientX = t ? t.clientX : e.clientX;
    const clientY = t ? t.clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function start(e) {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
  }

  function move(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    hasContent.current = true;
  }

  function end(e) {
    if (!drawing.current) return;
    e.preventDefault();
    drawing.current = false;
    if (hasContent.current && onChange) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    hasContent.current = false;
    if (onChange) onChange("");
  }

  return (
    <div>
      {label && <div className="text-sm font-medium text-slate-600 mb-1">{label}</div>}
      <div className="relative rounded-lg border border-slate-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height, touchAction: "none" }}
          className="block"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        {!hasContent.current && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm pointer-events-none">
            ลงลายเซ็นในกรอบนี้
          </div>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={clear}>
        <Eraser className="w-4 h-4 mr-1" /> ล้าง
      </Button>
    </div>
  );
}