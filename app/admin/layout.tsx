"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Button, Card, Icons, type IconName } from "@/components/ui";

/** 어드민 내비게이션 — 대시보드 · 사용자 관리 · 진단 이력 · 환경 관리 */
const NAV: { path: string; label: string; icon: IconName }[] = [
  { path: "/admin", label: "대시보드", icon: "gauge" },
  { path: "/admin/users", label: "사용자 관리", icon: "user" },
  { path: "/admin/analyses", label: "진단 이력", icon: "clipboard" },
  { path: "/admin/env", label: "환경 관리", icon: "plug" },
];

/**
 * 어드민 셸 — 전용 헤더 + 좌측 내비 + 콘텐츠.
 * 접근 가드: 세션 없음 → 로그인 안내, role !== 'admin' → 권한 안내.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, hydrated, logout } = useAuth();
  const pathname = usePathname();

  if (!hydrated) return null;

  if (!user || user.role !== "admin") {
    return (
      <section
        style={{
          padding: "var(--space-20) var(--gutter)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Card radius="2xl" style={{ maxWidth: 520, textAlign: "center" }}>
          <h2
            style={{
              margin: "0 0 10px",
              font: "var(--text-h4)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            관리자 콘솔
          </h2>
          <p style={{ margin: "0 0 20px", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
            {user
              ? "관리자 권한이 있는 계정으로 로그인해 주세요."
              : "관리자 계정으로 로그인한 뒤에 이용할 수 있어요."}
          </p>
          <Button variant="primary" href="/auth/login">
            로그인
          </Button>
        </Card>
      </section>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-primary)" }}>
      {/* 좌측 내비 */}
      <aside
        style={{
          width: 220,
          flex: "none",
          borderRight: "1px solid var(--line-default)",
          padding: "20px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "sticky",
          top: 0,
          height: "100vh",
          boxSizing: "border-box",
          background: "var(--bg-elevated)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 6,
            padding: "4px 12px 16px",
          }}
        >
          <span style={{ font: "var(--text-title2)", color: "var(--fg-primary)" }}>AXCORE</span>
          <span style={{ font: "var(--text-caption)", color: "var(--fg-brand)" }}>관리자</span>
        </div>

        {NAV.map(({ path, label, icon }) => {
          const active = path === "/admin" ? pathname === "/admin" : pathname.startsWith(path);
          const Icon = Icons[icon];
          return (
            <Link
              key={path}
              href={path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: "var(--radius-m)",
                textDecoration: "none",
                font: "var(--text-label-s)",
                color: active ? "var(--fg-brand)" : "var(--fg-secondary)",
                background: active ? "var(--bg-brand-weak)" : "transparent",
              }}
            >
              <Icon size={17} aria-hidden />
              {label}
            </Link>
          );
        })}

        <div style={{ marginTop: "auto", padding: "12px 12px 0", borderTop: "1px solid var(--line-default)" }}>
          <div style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)", marginBottom: 8 }}>
            {user.name} · {user.email}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="utility" size="sm" href="/">
              사이트로
            </Button>
            <Button variant="utility" size="sm" onClick={() => logout()}>
              로그아웃
            </Button>
          </div>
        </div>
      </aside>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, minWidth: 0, padding: "28px var(--gutter) 48px" }}>{children}</div>
    </div>
  );
}
