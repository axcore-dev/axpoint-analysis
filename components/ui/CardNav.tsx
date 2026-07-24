"use client";

import type { CSSProperties } from "react";
import { Icons } from "./icons";

/**
 * 카드 위저드 공용 부품 (자료 올리기 · 자료 정리가 같은 문법을 재사용)
 * - BackIconButton: 카드 좌상단 뒤로 가기
 * - DotProgress: 진행 도트 (●●○ + n/N)
 */

export function BackIconButton({
  onClick,
  label,
  style,
}: {
  onClick: () => void;
  label: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--hover-overlay)";
        e.currentTarget.style.color = "var(--fg-secondary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--fg-tertiary)";
      }}
      style={{
        position: "absolute",
        top: 14,
        left: 14,
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: "var(--radius-s)",
        background: "transparent",
        color: "var(--fg-tertiary)",
        cursor: "pointer",
        transition:
          "background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
        ...style,
      }}
    >
      <span aria-hidden style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
        <Icons.chevronRight size={18} />
      </span>
    </button>
  );
}

/** 앞으로 가기 — 카드 우상단, 뒤로 가기 반대편 배치 (수정요청v6) */
export function ForwardIconButton({
  onClick,
  label,
  style,
}: {
  onClick: () => void;
  label: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--hover-overlay)";
        e.currentTarget.style.color = "var(--fg-secondary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--fg-tertiary)";
      }}
      style={{
        position: "absolute",
        top: 14,
        right: 14,
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: "var(--radius-s)",
        background: "transparent",
        color: "var(--fg-tertiary)",
        cursor: "pointer",
        transition:
          "background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
        ...style,
      }}
    >
      <span aria-hidden style={{ display: "inline-flex" }}>
        <Icons.chevronRight size={18} />
      </span>
    </button>
  );
}

export function DotProgress({ step, total }: { step: number; total: number }) {
  return (
    <div
      aria-label={`${total}단계 중 ${step}단계`}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "var(--radius-full)",
            background: i < step ? "var(--bg-brand)" : "var(--grey-300)",
            transition: "background-color var(--dur-base) var(--ease)",
          }}
        />
      ))}
      <span
        style={{
          marginLeft: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--fg-quaternary)",
        }}
      >
        {step}/{total}
      </span>
    </div>
  );
}
