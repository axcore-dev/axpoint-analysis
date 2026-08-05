"use client";

import { createElement, type CSSProperties, type ReactNode } from "react";

/**
 * 텍스트 시머 — 분석·로딩 문구용 텍스트 자체 애니메이션 (작업 요청 v5-1).
 * 글자 위로 밝은 띠가 지나가는 효과 — 그라데이션을 background-clip: text로 글자에만 입힌다.
 * 키프레임은 globals.css의 ax-text-shimmer.
 */
export function TextShimmer({
  children,
  as = "span",
  duration = 2.2,
  spread = 140,
  delay = 0,
  className,
  style,
}: {
  children: ReactNode;
  as?: "span" | "p" | "div";
  /** 띠가 한 번 지나가는 시간 (초) */
  duration?: number;
  /** 밝은 띠의 폭 — 클수록 넓게 퍼진다 (%) */
  spread?: number;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return createElement(
    as,
    {
      className: `ax-text-shimmer ${className ?? ""}`,
      style: {
        backgroundSize: `${Math.max(200, spread * 2)}% 100%`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
        ...style,
      },
    },
    children,
  );
}
