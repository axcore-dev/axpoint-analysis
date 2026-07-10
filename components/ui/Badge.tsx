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

/* washed 배경 + 시맨틱 텍스트 — 22px 높이, 6px 라운드 문법 */
const tones: Record<BadgeTone, CSSProperties> = {
  neutral: { background: "var(--bg-tertiary)", color: "var(--fg-secondary)" },
  accent: { background: "var(--bg-brand-weak)", color: "var(--fg-brand)" },
  solid: { background: "var(--bg-brand)", color: "var(--fg-inverse)" },
  dark: { background: "var(--grey-800)", color: "var(--fg-inverse)" },
  success: { background: "var(--bg-success-weak)", color: "var(--fg-success)" },
  warning: { background: "var(--bg-warning-weak)", color: "var(--fg-warning)" },
  danger: { background: "var(--bg-danger-weak)", color: "var(--fg-danger)" },
  outline: {
    background: "transparent",
    color: "var(--fg-secondary)",
    boxShadow: "inset 0 0 0 1px var(--line-default)",
  },
};

export function Badge({ tone = "neutral", className = "", style, children, ...rest }: BadgeProps) {
  return (
    <span
      className={`ax-badge ${className}`}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "var(--track-body)",
        lineHeight: 1,
        height: 22,
        padding: "0 8px",
        borderRadius: 6,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
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
