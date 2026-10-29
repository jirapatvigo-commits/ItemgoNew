import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { appApi } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      await appApi.auth.resetPassword({ resetToken, newPassword });
      window.location.href = `${import.meta.env.BASE_URL || "/"}login`;
    } catch (err) {
      setError(err.message || "รีเซ็ตรหัสผ่านล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  if (!resetToken) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง"
        subtitle="ลิงก์รีเซ็ตรหัสผ่านนี้ขาดหายไปหรือไม่ถูกต้อง"
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            ขอรับลิงก์ใหม่
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          ลิงก์ที่คุณใช้ดูเหมือนจะไม่สมบูรณ์ กรุณาขออีเมลรีเซ็ตรหัสผ่านใหม่อีกครั้ง
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="รหัสผ่านใหม่"
      subtitle="กรอกรหัสผ่านใหม่ด้านล่าง"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">รหัสผ่านใหม่</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">ยืนยันรหัสผ่าน</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังรีเซ็ต...
            </>
          ) : (
            "รีเซ็ตรหัสผ่าน"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
