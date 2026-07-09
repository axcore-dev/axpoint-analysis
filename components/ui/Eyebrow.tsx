import type { HTMLAttributes } from "react";

export type EyebrowProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "accent" | "muted" | "on-dark";
};

/**
 * Eyebrow — the tracked-out uppercase label that sits above a headline.
 * Carries the accent by default; pass tone="muted" for a quiet variant.
 */
export function Eyebrow({ tone = "accent", className = "", style, children, ...rest }: EyebrowProps) {
  const color =
    tone === "muted"
      ? "var(--slate-500)"
      : tone === "on-dark"
        ? "var(--ax-blue-on-dark)"
        : "var(--ax-blue)";
  return (
    <div
      className={`ax-eyebrow ${className}`}
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--type-eyebrow-size)",
        fontWeight: 600,
        letterSpacing: "var(--type-eyebrow-track)",
        lineHeight: 1,
        textTransform: "uppercase",
        color,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
