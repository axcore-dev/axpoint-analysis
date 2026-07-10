"use client";

import type { ReactNode } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

/**
 * 용어 툴팁 — 전문 용어에 마우스 호버 시 쉬운 풀이 제공 (라이팅 규칙 4.1).
 * Radix Tooltip 기반(포지셔닝·지연·키보드 접근성 내장).
 * 수정요청v3: 소형(캡션 급) · 밝은 서피스 + 어두운 텍스트 — 스타일은 .ax-tooltip(globals.css).
 */
export function TermTooltip({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={150} skipDelayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span
            tabIndex={0}
            style={{
              textDecoration: "underline dotted var(--grey-400) 1.5px",
              textUnderlineOffset: 3,
              cursor: "help",
            }}
          >
            {term}
          </span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="ax-tooltip" side="top" sideOffset={6} collisionPadding={8}>
            {children}
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
