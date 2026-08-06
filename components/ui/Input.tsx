import type { InputHTMLAttributes, ReactNode } from "react";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: "box" | "pill";
  leadingIcon?: ReactNode;
  /** 필드 안쪽 오른쪽 슬롯 — 비밀번호 보기 토글처럼 값에 붙는 조작에 쓴다 */
  trailingIcon?: ReactNode;
  invalid?: boolean;
  className?: string;
};

/** Text input. `pill` matches the search grammar; `box` is the standard field. */
export function Input({
  variant = "box",
  leadingIcon,
  trailingIcon,
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
      {trailingIcon ? <span className="ax-field__icon">{trailingIcon}</span> : null}
    </div>
  );
}
