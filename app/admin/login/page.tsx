"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Button, Card, Input } from "@/components/ui";

/**
 * 어드민 로그인 — 관리자 콘솔 전용 화면.
 * 사이트 로그인(`/auth/login`)과 분리한다: 회원가입·소셜·체험하기가 없고, 관리자 계정이
 * 아니면 들어가지 못한다. admin 서브도메인의 첫 화면이 이 페이지다.
 */
export default function AdminLoginPage() {
  const { user, hydrated, login, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* 이미 관리자로 로그인돼 있으면 콘솔로 보낸다 */
  useEffect(() => {
    if (hydrated && user?.role === "admin") router.replace("/admin");
  }, [hydrated, user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      /* 로그인은 됐지만 권한이 없는 계정 — 관리자 화면에 들이지 않는다 */
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const wrongAccount = hydrated && user && user.role !== "admin";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
        padding: "var(--space-10) var(--gutter)",
      }}
    >
      <Card radius="2xl" style={{ width: "100%", maxWidth: 400 }}>
        <p
          style={{
            margin: "0 0 6px",
            font: "var(--text-label-s)",
            letterSpacing: "0.08em",
            color: "var(--fg-brand, var(--fg-tertiary))",
            textTransform: "uppercase",
          }}
        >
          AXpoint Admin
        </p>
        <h1
          style={{
            margin: "0 0 4px",
            font: "var(--text-h4)",
            letterSpacing: "var(--track-heading)",
            color: "var(--fg-primary)",
          }}
        >
          관리자 콘솔
        </h1>
        <p style={{ margin: "0 0 20px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
          관리자 계정으로만 들어올 수 있어요.
        </p>

        {wrongAccount ? (
          <div style={{ display: "grid", gap: 12 }}>
            <p role="alert" style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
              <strong>{user.email}</strong> 계정에는 관리자 권한이 없어요. 다른 계정으로 로그인해 주세요.
            </p>
            <Button variant="secondary" onClick={() => logout()}>
              로그아웃하고 다시 로그인
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>이메일</span>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>비밀번호</span>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p role="alert" style={{ margin: 0, font: "var(--text-caption)", color: "var(--fg-danger)" }}>
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={busy || !email || !password}>
              {busy ? "확인 중" : "로그인"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
