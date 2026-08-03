"use client";

import { useEffect, useState } from "react";
import { Loader } from "@/components/ui";

/**
 * 라우팅 전환 로딩 — 토스 라우팅 규칙 (수정요청v2 공통)
 * - 전역 전환은 3-dot, 데이터 로딩은 스켈레톤 허용(2026-08 개정)
 * - 진입/이탈 모션은 320ms(--dur-slow) ease-out 이내, 바운스 없음
 * - 문구는 해요체 진행형("~하고 있어요")으로 지금 무슨 일이 일어나는지 말한다
 * 페이지 이동·단계 전환 로딩은 모두 이 컴포넌트를 사용한다.
 */
export function RouteLoading({
  title,
  messages,
  interval = 1200,
}: {
  /** 상단 큰 텍스트 (기업명 등, 선택) */
  title?: string;
  /** 순환 안내 문구 — 1개면 고정 표시 */
  messages: string[];
  interval?: number;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % messages.length), interval);
    return () => clearInterval(t);
  }, [messages.length, interval]);

  return (
    <div
      className="ax-step-enter"
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: "0 24px",
        textAlign: "center",
      }}
      role="status"
    >
      {title && (
        <div className="ax-heading" style={{ font: "var(--text-h3)", fontWeight: 700, color: "var(--fg-primary)" }}>
          {title}
        </div>
      )}
      <Loader style={{ color: "var(--fg-brand)" }} />
      <p
        key={idx}
        className="ax-step-enter"
        style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}
      >
        {messages[idx]}
      </p>
    </div>
  );
}
