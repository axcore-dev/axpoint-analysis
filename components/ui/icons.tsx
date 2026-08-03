import type { ReactNode, SVGProps } from "react";

/* Lucide-style inline icons (stroke 2, round caps) — AXCORE 아이콘 서브셋.
   docs/design-system/README.md ICONOGRAPHY 참조. 모노크롬 전용. */

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function I(paths: ReactNode, { size = 20, ...props }: IconProps = {}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths}
    </svg>
  );
}

export const Icons = {
  search: (p?: IconProps) =>
    I(
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>,
      p,
    ),
  arrow: (p?: IconProps) =>
    I(
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>,
      p,
    ),
  menu: (p?: IconProps) => I(<path d="M4 6h16M4 12h16M4 18h16" />, p),
  check: (p?: IconProps) => I(<path d="M20 6 9 17l-5-5" />, p),
  spark: (p?: IconProps) =>
    I(
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />,
      p,
    ),
  layers: (p?: IconProps) =>
    I(
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </>,
      p,
    ),
  cloud: (p?: IconProps) =>
    I(<path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6 1.5A4 4 0 0 0 7 19Z" />, p),
  gauge: (p?: IconProps) =>
    I(
      <>
        <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        <path d="m13.4 12.6 3.6-3.6" />
        <path d="M20 16a8 8 0 1 0-16 0" />
      </>,
      p,
    ),
  shield: (p?: IconProps) =>
    I(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />, p),
  bolt: (p?: IconProps) => I(<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />, p),
  globe: (p?: IconProps) =>
    I(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
      </>,
      p,
    ),
  plug: (p?: IconProps) =>
    I(
      <>
        <path d="M12 22v-5" />
        <path d="M9 8V2M15 8V2" />
        <path d="M18 8H6v4a6 6 0 0 0 12 0Z" />
      </>,
      p,
    ),
  /* 진단 데모 확장 아이콘 — 동일 문법(2px 스트로크, 24px 그리드) */
  upload: (p?: IconProps) =>
    I(
      <>
        <path d="M12 15V3" />
        <path d="m7 8 5-5 5 5" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </>,
      p,
    ),
  download: (p?: IconProps) =>
    I(
      <>
        <path d="M12 3v12" />
        <path d="m7 10 5 5 5-5" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </>,
      p,
    ),
  file: (p?: IconProps) =>
    I(
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
      </>,
      p,
    ),
  building: (p?: IconProps) =>
    I(
      <>
        <path d="M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" />
        <path d="M16 8h2a2 2 0 0 1 2 2v12" />
        <path d="M2 22h20" />
        <path d="M8 6h2M8 10h2M8 14h2M8 18h2" />
      </>,
      p,
    ),
  chevronDown: (p?: IconProps) => I(<path d="m6 9 6 6 6-6" />, p),
  chevronRight: (p?: IconProps) => I(<path d="m9 6 6 6-6 6" />, p),
  x: (p?: IconProps) => I(<path d="M18 6 6 18M6 6l12 12" />, p),
  alert: (p?: IconProps) =>
    I(
      <>
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
        <path d="M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" />
      </>,
      p,
    ),
  alertCircle: (p?: IconProps) =>
    I(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </>,
      p,
    ),
  info: (p?: IconProps) =>
    I(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </>,
      p,
    ),
  mail: (p?: IconProps) =>
    I(
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </>,
      p,
    ),
  plus: (p?: IconProps) => I(<path d="M12 5v14M5 12h14" />, p),
  minus: (p?: IconProps) => I(<path d="M5 12h14" />, p),
  cart: (p?: IconProps) =>
    I(
      <>
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
        <path d="M2 3h3l2.7 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 8H6" />
      </>,
      p,
    ),
  factory: (p?: IconProps) =>
    I(
      <>
        <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
        <path d="M17 18h1M12 18h1M7 18h1" />
      </>,
      p,
    ),
  clipboard: (p?: IconProps) =>
    I(
      <>
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      </>,
      p,
    ),
  link: (p?: IconProps) =>
    I(
      <>
        <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
        <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
      </>,
      p,
    ),
  user: (p?: IconProps) =>
    I(
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>,
      p,
    ),
} as const;

export type IconName = keyof typeof Icons;
