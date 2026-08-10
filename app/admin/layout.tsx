"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { Button, Icons, type IconName } from "@/components/ui";

/** 내비 접힘 상태 저장 키 — 캔버스 같은 넓은 화면을 볼 때 접어 둔 채로 다니게 기억한다 */
const NAV_COLLAPSED_KEY = "admin.navCollapsed";

/** 어드민 내비게이션 — 대시보드 · 회원 관리 · 진단 이력 · 외부 연동 · 멀티 에이전트 · 환경 관리
    어드민 화면은 전부 여기에 있다. 내비에 없이 링크로만 들어가는 화면은 두지 않는다
    — 지시문 편집이 그래서 안 보였고, 2026-08-07에 멀티 에이전트로 합쳤다 */
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
  /* 접힘 상태 — 셸은 hydrated 뒤에만 그려지므로 초기값을 localStorage에서 바로 읽어도
     서버 HTML(null)과 어긋나지 않는다 */
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(NAV_COLLAPSED_KEY) === "1",
  );
  const toggleNav = () =>
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* 저장 실패(시크릿 모드 등)여도 이번 세션의 접힘은 동작한다 */
      }
      return next;
    });

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
          /* 접으면 아이콘만 남는 최소 폭 — 캔버스 같은 넓은 화면에 자리를 내준다 */
          width: collapsed ? 64 : 220,
          transition: "width var(--dur-base) var(--ease)",
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
            padding: collapsed ? "4px 0 16px" : "4px 4px 16px 12px",
            justifyContent: collapsed ? "center" : undefined,
          }}
        >
          {!collapsed && (
            <>
              <span style={{ font: "var(--text-title2)", color: "var(--fg-primary)" }}>AXCORE</span>
              <span style={{ font: "var(--text-caption)", color: "var(--fg-brand)" }}>관리자</span>
            </>
          )}
          <button
            type="button"
            onClick={toggleNav}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
            title={collapsed ? "메뉴 펼치기" : "메뉴 접기"}
            style={{
              marginLeft: collapsed ? 0 : "auto",
              alignSelf: "center",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              padding: 0,
              border: "none",
              borderRadius: "var(--radius-s)",
              background: "transparent",
              color: "var(--fg-tertiary)",
              cursor: "pointer",
            }}
          >
            <Icons.menu size={17} aria-hidden />
          </button>
        </div>

        {NAV.map(({ path, label, icon }) => {
          const active = path === "/admin" ? pathname === "/admin" : pathname.startsWith(path);
          const Icon = Icons[icon];
          return (
            <Link
              key={path}
              href={path}
              title={collapsed ? label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : undefined,
                gap: 10,
                padding: collapsed ? "10px 0" : "10px 12px",
                borderRadius: "var(--radius-m)",
                textDecoration: "none",
                font: "var(--text-label-s)",
                color: active ? "var(--fg-brand)" : "var(--fg-secondary)",
                background: active ? "var(--bg-brand-weak)" : "transparent",
              }}
            >
              <Icon size={17} aria-hidden />
              {!collapsed && label}
            </Link>
          );
        })}

        {!collapsed && (
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
        )}
      </aside>

      {/* 콘텐츠 */}
      <div style={{ flex: 1, minWidth: 0, padding: "28px var(--gutter) 48px" }}>{children}</div>
    </div>
  );
}
