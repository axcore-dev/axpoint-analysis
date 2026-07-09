"use client";

import { useState, type CSSProperties, type HTMLAttributes } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: "light" | "dark";
  interactive?: boolean;
  padded?: boolean;
};

/**
 * Surface primitive — the hairline utility card. Flat by default (no shadow);
 * `interactive` adds a restrained hover lift for clickable cards.
 */
export function Card({
  tone = "light",
  interactive = false,
  padded = true,
  className = "",
  style,
  children,
  ...rest
}: CardProps) {
  const [hover, setHover] = useState(false);
  const dark = tone === "dark";
  const base: CSSProperties = {
    fontFamily: "var(--font-sans)",
    background: dark ? "var(--tile-dark-1)" : "var(--surface-card)",
    color: dark ? "var(--on-dark)" : "var(--text-body)",
    border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid var(--hairline)",
    borderRadius: "var(--radius-lg)",
    padding: padded ? "var(--space-lg)" : 0,
    boxShadow: interactive && hover ? "var(--shadow-soft)" : "none",
    transform: interactive && hover ? "translateY(-2px)" : "translateY(0)",
    transition: "transform .2s ease, box-shadow .2s ease",
    boxSizing: "border-box",
  };
  return (
    <div
      className={`ax-card ${className}`}
      onMouseEnter={() => interactive && setHover(true)}
      onMouseLeave={() => interactive && setHover(false)}
      style={{ ...base, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
