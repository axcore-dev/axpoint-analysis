import type { CSSProperties, HTMLAttributes } from "react";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "solid"
  | "dark"
  | "success"
  | "warning"
  | "danger"
  | "outline";

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone };

const tones: Record<BadgeTone, CSSProperties> = {
  neutral: { background: "var(--slate-100)", color: "var(--slate-700)" },
  accent: { background: "var(--ax-blue-wash)", color: "var(--ax-blue)" },
  solid: { background: "var(--ax-blue)", color: "var(--on-primary)" },
  dark: { background: "var(--slate-900)", color: "var(--on-dark)" },
  success: { background: "#e7f6ec", color: "#1b7a3d" },
  /* 진단 등급 표기용 확장 톤 — 채도 낮은 앰버/레드, DS 헤어라인 문법 유지 */
  warning: { background: "#fdf3e0", color: "#9a6a12" },
  danger: { background: "#fdecea", color: "#b3261e" },
  outline: {
    background: "transparent",
    color: "var(--slate-600)",
    boxShadow: "inset 0 0 0 1px var(--hairline)",
  },
};

/** Small status / metadata label. Quiet by default; `accent` carries the blue. */
export function Badge({ tone = "neutral", className = "", style, children, ...rest }: BadgeProps) {
  return (
    <span
      className={`ax-badge ${className}`}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "-0.004em",
        lineHeight: 1,
        padding: "5px 10px",
        borderRadius: "var(--radius-pill)",
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        whiteSpace: "nowrap",
        ...(tones[tone] || tones.neutral),
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
