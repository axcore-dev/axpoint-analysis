import type { ButtonHTMLAttributes, CSSProperties } from "react";

export type TagProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  as?: "button" | "span";
};

/**
 * Selectable pill chip — the configurator/filter grammar. Selected state
 * upgrades to a 2px blue ring on a faint blue wash.
 */
export function Tag({ selected = false, as = "button", className = "", style, children, ...rest }: TagProps) {
  const Comp = as;
  const s: CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--type-caption-size)",
    fontWeight: 500,
    letterSpacing: "-0.006em",
    lineHeight: 1,
    padding: "11px 16px",
    borderRadius: "var(--radius-pill)",
    cursor: as === "button" ? "pointer" : "default",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: selected ? "var(--ax-blue-wash)" : "var(--canvas)",
    color: selected ? "var(--ax-blue)" : "var(--slate-700)",
    border: selected ? "2px solid var(--ax-blue-focus)" : "1px solid var(--hairline)",
    boxSizing: "border-box",
    transition: "background-color .15s ease, color .15s ease, border-color .15s ease",
    WebkitTapHighlightColor: "transparent",
    ...style,
  };
  return (
    <Comp
      className={`ax-tag ${className}`}
      aria-pressed={as === "button" ? selected : undefined}
      style={s}
      {...rest}
    >
      {children}
    </Comp>
  );
}
