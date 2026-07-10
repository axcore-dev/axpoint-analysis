import type { CSSProperties, HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** v2: 라이트 서피스만 — 다크 카드는 사용하지 않는다 (다크 모드 토큰이 담당) */
  tone?: "light" | "dark";
  interactive?: boolean;
  padded?: boolean;
  /** 라운드 단계: m(12) l(16) xl(20) 2xl(24) */
  radius?: "m" | "l" | "xl" | "2xl";
};

/**
 * 카드 v2 — 플랫 화이트 + 1px 헤어라인. 호버 반응은 배경 워시(크기 변형 없음).
 */
export function Card({
  tone = "light",
  interactive = false,
  padded = true,
  radius = "xl",
  className = "",
  style,
  children,
  ...rest
}: CardProps) {
  const radiusVar =
    radius === "m"
      ? "var(--radius-m)"
      : radius === "l"
        ? "var(--radius-xl)"
        : radius === "2xl"
          ? "var(--radius-3xl)"
          : "var(--radius-2xl)";
  const dark = tone === "dark";
  const base: CSSProperties = {
    fontFamily: "var(--font-sans)",
    background: dark ? "var(--grey-800)" : "var(--bg-elevated)",
    color: dark ? "var(--fg-inverse)" : "var(--fg-primary)",
    border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--line-default)",
    borderRadius: radiusVar,
    padding: padded ? "var(--space-6)" : 0,
    boxSizing: "border-box",
  };
  return (
    <div
      className={`ax-card ${interactive ? "ax-card--interactive" : ""} ${className}`}
      style={{ ...base, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
