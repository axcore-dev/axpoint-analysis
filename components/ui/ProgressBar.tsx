import type { CSSProperties } from "react";

/**
 * 진행률 바 — 트랙 + 채움 + 우측 퍼센트 텍스트.
 * 랜딩 업로드 진행률과 동일한 문법(둥근 트랙, 브랜드 채움, 모노 퍼센트).
 */
export function ProgressBar({ percent, style }: { percent: number; style?: CSSProperties }) {
  const p = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-valuenow={p}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ display: "flex", alignItems: "center", gap: 8, ...style }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: 6,
          overflow: "hidden",
          borderRadius: "var(--radius-full)",
          background: "var(--grey-100)",
        }}
      >
        <div
          style={{
            width: `${p}%`,
            height: "100%",
            borderRadius: "var(--radius-full)",
            background: "var(--fg-brand)",
            transition: "width 200ms var(--ease)",
          }}
        />
      </div>
      <span
        style={{
          flex: "none",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--fg-tertiary)",
        }}
      >
        {p}%
      </span>
    </div>
  );
}
