"use client";

import { useEffect, useState } from "react";
import { Loader } from "@/components/ui";
import { TextShimmer } from "@/components/ui/text-shimmer";

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
  hint,
  interval = 2600,
}: {
  /** 상단 큰 텍스트 (기업명 등, 선택) */
  title?: string;
  /** 순환 안내 문구 — 1개면 고정 표시 */
  messages: string[];
  /** 예상 소요 시간 등 기다림의 기준 (v7-2) — 얼마나 걸리는지 알고 기다리게 한다 */
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
      {/* 문구 자체에 시머 애니메이션 (작업 요청 v5-1).
          v7-2: key 재마운트·진입 모션·시작 지연을 걷어냈다 — 문구가 바뀔 때마다 흐리게 깜빡이고
          띠가 처음부터 다시 도는 것이 겹쳐 부자연스러웠다. 이제 띠는 끊기지 않고 계속 흐르고
          글자만 조용히 바뀐다 */}
      <TextShimmer as="p" style={{ margin: 0, font: "var(--text-body2)" }}>
        {messages[idx]}
      </TextShimmer>
      {hint && (
        <p style={{ margin: 0, font: "var(--text-caption)", color: "var(--fg-quaternary)" }}>
          {hint}
          {elapsed >= 10 && (
            <>
              {" · 지난 시간 "}
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
