import React, { useState } from "react";
import { Link } from "react-router-dom";
import { appApi } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    let succeeded = false;
    try {
      const result = await appApi.auth.resetPasswordRequest(email);
      setResetUrl(result?.reset_url || "");
      succeeded = true;
    } catch (err) {
      setResetUrl("");
      setError(err.message || "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
      setSent(succeeded);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="รีเซ็ตรหัสผ่าน"
      subtitle="เราจะส่งลิงก์เพื่อรีเซ็ตรหัสผ่านให้คุณ"
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" />กลับสู่หน้าเข้าสู่ระบบ
        </Link>
      }
    >
      {sent ? (
        <p className="text-sm text-foreground text-center">
          {resetUrl ? (
            <a href={resetUrl} className="text-primary underline">เปิดลิงก์ตั้งรหัสผ่านใหม่</a>
          ) : (
            "หากมีบัญชีที่ใช้อีเมลนี้ ระบบจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้"
          )}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="email">ที่อยู่อีเมล</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังส่ง...
              </>
            ) : (
              "ส่งลิงก์รีเซ็ต"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
