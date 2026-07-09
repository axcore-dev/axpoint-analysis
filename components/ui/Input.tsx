import type { InputHTMLAttributes, ReactNode } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: "box" | "pill";
  leadingIcon?: ReactNode;
  invalid?: boolean;
  className?: string;
};

/** Text input. `pill` matches the search grammar; `box` is the standard field. */
export function Input({
  variant = "box",
  leadingIcon,
  invalid = false,
  disabled = false,
  className = "",
  ...rest
}: InputProps) {
  const cls = [
    "ax-field",
    variant === "pill" ? "ax-field--pill" : "ax-field--box",
    invalid ? "ax-field--invalid" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} aria-disabled={disabled || undefined}>
      {leadingIcon ? <span className="ax-field__icon">{leadingIcon}</span> : null}
      <input disabled={disabled} {...rest} />
    </div>
  );
}
