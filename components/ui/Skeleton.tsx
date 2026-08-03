import type { CSSProperties } from "react";

/**
 * 스켈레톤 — 데이터 로딩 동안 페이지 골격을 잡아주는 자리 표시자.
 * 셔머 없이 은은한 pulse(테일윈드 animate-pulse: 투명도 1↔0.5)만 쓴다.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  radius = "var(--radius-m)",
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      className="animate-pulse"
      style={{
        display: "block",
        width,
        height,
        borderRadius: radius,
        background: "var(--grey-100)",
        ...style,
      }}
    />
  );
}
