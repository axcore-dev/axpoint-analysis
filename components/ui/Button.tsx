import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "utility";
type ButtonSize = "sm" | "md" | "lg" | "xl";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
  children?: ReactNode;
};

type ButtonAsButton = CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type ButtonAsAnchor = CommonProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

/**
 * 버튼 v2 — 사이즈와 라운드가 페어(xl 56/16 · lg 48/14 · md 40/12 · sm 32/10).
 * 프레스는 오버레이(크기 변형 없음), 호버 워시 내장. 화면당 primary 하나.
 */
export function Button({
  variant = "primary",
  size = "md",
  full = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    "ax-btn",
    `ax-btn--${variant}`,
    `ax-btn--${size === "lg" ? "lg" : size}`,
    full ? "ax-btn--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if ("href" in rest && rest.href !== undefined) {
    return (
      <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
