import React, { useState } from "react";
import { Link } from "react-router-dom";
import { appApi } from "@/api/appClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogIn, Mail, Lock, Loader2, ShieldCheck, UserRound } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { safeReturnTo, withRoleContext } from "@/lib/authReturnTo";

export default function Login({ role }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const returnTo = safeReturnTo();

  if (role !== "admin" && role !== "user") {
    return (
      <AuthLayout icon={LogIn} title="เข้าสู่ระบบ TrainingNIMT" subtitle="เลือกประเภทบัญชีของคุณ">
        <div className="space-y-3">
          <Button asChild className="w-full h-12 justify-start">
            <Link to="/user/login">
              <UserRound className="w-4 h-4 mr-2" /> เข้าสู่ระบบผู้ใช้ทั่วไป
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-12 justify-start">
            <Link to="/admin/login">
              <ShieldCheck className="w-4 h-4 mr-2" /> เข้าสู่ระบบผู้ดูแลระบบ
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await appApi.auth.loginViaEmailPassword(email, password, role);
      window.location.href = withRoleContext(returnTo, role);
    } catch (err) {
      setError(err.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={role === "admin" ? ShieldCheck : UserRound}
      title={role === "admin" ? "เข้าสู่ระบบผู้ดูแลระบบ" : "เข้าสู่ระบบผู้ใช้ทั่วไป"}
      subtitle="กรอกอีเมลและรหัสผ่านเพื่อดำเนินการต่อ"
      footer={
        role === "user" ? (
          <>
            ยังไม่มีบัญชี?{" "}
            <Link
              to={"/register" + (returnTo !== "/" ? "?returnTo=" + encodeURIComponent(returnTo) : "")}
              className="text-primary font-medium hover:underline"
            >
              สมัครผู้ใช้ทั่วไป
            </Link>
          </>
        ) : (
          <Link to="/login" className="text-primary font-medium hover:underline">
            <ArrowLeft className="w-3 h-3 inline mr-1" />กลับไปเลือกประเภทบัญชี
          </Link>
        )
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">อีเมล</Label>
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              ลืมรหัสผ่าน?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังเข้าสู่ระบบ...
            </>
          ) : (
            "เข้าสู่ระบบ"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
