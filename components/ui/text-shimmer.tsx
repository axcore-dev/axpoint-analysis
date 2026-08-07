"use client";

import { createElement, type CSSProperties, type ReactNode } from "react";

/**
 * 텍스트 시머 — 분석·로딩 문구용 텍스트 자체 애니메이션 (작업 요청 v5-1).
 * 글자 위로 밝은 띠가 지나가는 효과 — 그라데이션을 background-clip: text로 글자에만 입힌다.
 * 키프레임은 globals.css의 ax-text-shimmer.
 *
 * v7-2: 띠 폭을 background-size로 바꾸던 것을 **그라데이션 정지점**으로 옮겼다.
 * background-position의 %는 (요소폭 − 배경폭) 기준이라, background-size를 200%에서 흔들면
 * 한 바퀴 이동 거리가 배경 타일 폭의 정수배가 아니게 되고 루프가 끊겨 보인다(띠가 튄다).
 * 배경은 200%로 고정하고 폭은 정지점으로만 조절하면 매 바퀴가 매끄럽게 이어진다.
 */
export function TextShimmer({
  children,
  as = "span",
  duration = 2.6,
  spread = 12,
  delay = 0,
  className,
  style,
}: {
  children: ReactNode;
  as?: "span" | "p" | "div";
  /** 띠가 한 번 지나가는 시간 (초) */
  duration?: number;
  /** 밝은 띠의 반폭 — 그라데이션 정지점 기준 % (클수록 넓고 부드럽다) */
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
        ["--shimmer-spread" as string]: `${spread}%`,
        animationDuration: `${duration}s`,
        ...(delay ? { animationDelay: `${delay}s` } : {}),
        ...style,
      },
    },
    children,
  );
}
