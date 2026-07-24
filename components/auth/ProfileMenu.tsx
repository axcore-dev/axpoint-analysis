"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/ui";
import { useAuth } from "./AuthContext";

/**
 * 헤더 우측 프로필 드롭다운 (수정요청v6 — 공통)
 * 원형 아바타(기본 사람 아이콘, 수정요청v7) + 이름 칩 → 클릭 시 내 정보/로그아웃 메뉴.
 * 바깥 클릭·Esc로 닫기. 외부 라이브러리 없이 직접 구현.
 */
export function ProfileMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  /* 바깥 클릭 · Esc 닫기 */
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) return null;

  /* 메뉴 항목 — 호버는 CSS로 처리 (state 불필요) */
  const itemClass =
    "block w-full cursor-pointer rounded-[var(--radius-s)] border-0 bg-transparent px-3 py-[9px] text-left [font:var(--text-label-s)] text-ink transition-colors duration-[var(--dur-fast)] hover:bg-[var(--hover-overlay)]";

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {/* 프로필 칩 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="내 계정 메뉴"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 12px 4px 4px",
          border: "1px solid var(--line-default)",
          borderRadius: "var(--radius-full)",
          background: open ? "var(--hover-overlay)" : "var(--bg-elevated)",
          cursor: "pointer",
          transition: "background var(--dur-fast) var(--ease)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
            background: "var(--bg-brand-weak)",
            color: "var(--fg-brand)",
          }}
        >
          <Icons.user size={15} />
        </span>
        <span
          style={{
            font: "var(--text-label-s)",
            color: "var(--fg-primary)",
            whiteSpace: "nowrap",
          }}
        >
          {user.name}
        </span>
      </button>

      {/* 드롭다운 메뉴 */}
      {open && (
        <div
          role="menu"
          aria-label="계정"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 60,
            minWidth: 224,
            background: "var(--bg-elevated)",
            border: "1px solid var(--line-default)",
            borderRadius: "var(--radius-l)",
            boxShadow: "var(--shadow-3)",
            padding: 6,
            animation: "ax-fade-in var(--dur-fast) var(--ease-out)",
          }}
        >
          {/* 계정 정보 */}
          <div style={{ padding: "8px 12px 10px" }}>
            <div style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
              {user.name}
            </div>
            <div
              style={{
                marginTop: 2,
                font: "var(--text-caption)",
                color: "var(--fg-tertiary)",
                wordBreak: "break-all",
              }}
            >
              {user.email}
            </div>
          </div>

          <div aria-hidden style={{ height: 1, background: "var(--line-default)", margin: "0 0 6px" }} />

          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              router.push("/mypage");
            }}
          >
            내 정보
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              logout();
            }}
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
