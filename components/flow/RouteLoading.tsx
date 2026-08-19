"use client";

import { useEffect, useState } from "react";
import { TextShimmer } from "@/components/ui/text-shimmer";

/**
 * 라우팅 전환 로딩 — 토스 라우팅 규칙 (수정요청v2 공통)
 * - 진입/이탈 모션은 320ms(--dur-slow) ease-out 이내, 바운스 없음
 * - 문구는 해요체 진행형("~하고 있어요")으로 지금 무슨 일이 일어나는지 말한다
 * 페이지 이동·단계 전환 로딩은 모두 이 컴포넌트를 사용한다.
 *
 * 2026-08-13 개편: 3-dot 로더를 없애고 문구가 주인공이다 — 문구가 바뀔 때마다
 * 아래→위로 올라오며(ax-step-enter) 등장한다. 경과 시간은 중앙 맨 위 타이머로
 * (hint가 있는 분석 로딩에만), 전체 크기는 종전의 2배다.
 */

/** 경과 타이머가 나타나는 시점(초) — 그 전에는 문구만 보인다 */
const TIMER_AFTER = 10;
export function RouteLoading({
  title,
  messages,
  hint,
  interval = 2600,
}: {
  /** 상단 큰 텍스트 (기업명 등, 선택) */
  title?: string;
  /** 순환 안내 문구 — 1개면 고정 표시 */
  messages: string[];
  /** 예상 소요 시간 등 기다림의 기준 (v7-2) — 있으면 경과 타이머도 맨 위에 함께 돈다 */
  hint?: string;
  /** 문구 교체 주기 — 시머 한 바퀴(2.6s)에 맞춰 문구가 끝까지 밝아진 뒤 넘어간다 */
  interval?: number;
}) {
  const [idx, setIdx] = useState(0);
  /** 경과 시간 — 예상 시간과 나란히 두면 '얼마나 남았나'가 가늠된다 */
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), interval);
    return () => clearInterval(t);
  }, [messages.length, interval]);

  useEffect(() => {
    if (!hint) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [hint]);

  return (
    <div
      className="ax-step-enter"
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 36,
        padding: "0 24px",
        textAlign: "center",
      }}
      role="status"
    >
      {/* 경과 타이머 — 중앙 맨 위. 분석 로딩(hint 있음)에서만.
          10초를 넘겨야 나타난다 — 금방 끝나는 전환에서 시계부터 보여 주면 오래 걸린다는 인상만 남는다 */}
      {hint && elapsed >= TIMER_AFTER && (
        <div
          className="ax-step-enter"
          aria-label="지난 시간"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--fg-quaternary)",
            letterSpacing: "0.02em",
          }}
        >
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </div>
      )}
      {title && (
        <div
          className="ax-heading"
          style={{ font: "var(--text-display2)", color: "var(--fg-primary)" }}
        >
          {title}
        </div>
      )}
      {/* 문구 자체에 시머 애니메이션 (작업 요청 v5-1).
          문구가 바뀔 때마다 key 재마운트로 아래→위 진입 모션(ax-step-enter)을 다시 탄다 */}
      <div key={idx} className="ax-step-enter">
        <TextShimmer as="p" style={{ margin: 0, font: "500 30px/1.45 var(--font-sans)" }}>
          {messages[idx]}
        </TextShimmer>
      </div>
      {hint && (
        <p style={{ margin: 0, font: "400 22px/1.5 var(--font-sans)", color: "var(--fg-quaternary)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
