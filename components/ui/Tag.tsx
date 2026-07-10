import type { ButtonHTMLAttributes, CSSProperties } from "react";

export type TagProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  as?: "button" | "span";
};

/**
 * 선택형 칩 v2 — 선택 상태는 얇은 표현(블루 워시 + 1px 블루 보더).
 * 두꺼운 링·크기 변형 없음. 호버 워시 반응.
 */
export function Tag({ selected = false, as = "button", className = "", style, children, ...rest }: TagProps) {
  const Comp = as;
  const s: CSSProperties = {
    fontFamily: "var(--font-sans)",
    fontSize: 14,
    fontWeight: 500,
    letterSpacing: "var(--track-body)",
    lineHeight: 1,
    height: 36,
    padding: "0 14px",
    borderRadius: "var(--radius-full)",
    cursor: as === "button" ? "pointer" : "default",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: selected ? "var(--bg-brand-weak)" : "var(--bg-base)",
    color: selected ? "var(--fg-brand)" : "var(--fg-secondary)",
    border: selected ? "1px solid var(--line-brand)" : "1px solid var(--line-default)",
    boxSizing: "border-box",
    transition:
      "background-color var(--dur-base) var(--ease), color var(--dur-base) var(--ease), border-color var(--dur-base) var(--ease)",
    WebkitTapHighlightColor: "transparent",
    ...style,
  };
  return (
    <Comp
      className={`ax-tag ${className}`}
      aria-pressed={as === "button" ? selected : undefined}
      style={s}
      onMouseEnter={(e) => {
        if (as === "button" && !selected)
          (e.currentTarget as HTMLElement).style.background = "var(--grey-50)";
        rest.onMouseEnter?.(e as never);
      }}
      onMouseLeave={(e) => {
        if (as === "button" && !selected)
          (e.currentTarget as HTMLElement).style.background = "var(--bg-base)";
        rest.onMouseLeave?.(e as never);
      }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
