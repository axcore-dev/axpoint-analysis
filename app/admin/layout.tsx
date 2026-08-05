"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Button, Icons, type IconName } from "@/components/ui";

/** 어드민 내비게이션 — 대시보드 · 회원 관리 · 진단 이력 · 외부 연동 · 멀티 에이전트 · 환경 관리
    (지시문 전체 편집(/admin/prompts)은 멀티 에이전트 화면에서 링크로 진입한다) */
const NAV: { path: string; label: string; icon: IconName }[] = [
  { path: "/admin", label: "대시보드", icon: "gauge" },
  { path: "/admin/users", label: "회원 관리", icon: "user" },
  { path: "/admin/analyses", label: "진단 이력", icon: "clipboard" },
  { path: "/admin/integrations", label: "외부 연동", icon: "globe" },
  { path: "/admin/agents", label: "멀티 에이전트", icon: "spark" },
  { path: "/admin/env", label: "환경 관리", icon: "plug" },
];

/**
 * 어드민 셸 — 전용 헤더 + 좌측 내비 + 콘텐츠.
 * 접근 가드: 관리자가 아니면 어드민 전용 로그인(`/admin/login`)으로 보낸다.
 * 로그인 화면 자체는 셸 밖에서 그린다 — 가드가 자기 자신을 막으면 안 된다.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, hydrated, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin/login";
  const allowed = user?.role === "admin";

  useEffect(() => {
    if (hydrated && !allowed && !isLoginPage) router.replace("/admin/login");
  }, [hydrated, allowed, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;
  if (!hydrated || !allowed) return null;

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
