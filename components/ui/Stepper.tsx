import type { CSSProperties } from "react";

export interface StepperStep {
  label: string;
  /** 보조 라벨 (선택) */
  sub?: string;
}

/**
 * 도트 스텝퍼 — 참고 이미지((예시)현재 단계와 목표단계.png) 문법.
 * 완료 = 채운 도트, 현재 = 링 도트, 미도달 = 회색 도트. 연결선이 진행을 표현.
 * 진단 결과의 "현재 단계 → 목표 단계" 시각화 등에 사용.
 */
export function DotStepper({
  steps,
  current,
  target,
  accent = "var(--blue-500)",
  style,
}: {
  steps: StepperStep[];
  /** 현재 위치 (0-base) — 이하 완료 처리 */
  current: number;
  /** 목표 위치 (선택) — 현재~목표 구간을 옅은 강조로 표시 */
  target?: number;
  accent?: string;
  style?: CSSProperties;
}) {
  return (
    <div style={{ width: "100%", ...style }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {steps.map((_, i) => {
          const done = i < current;
          const isCurrent = i === current;
          const inTargetSpan = target !== undefined && i > current && i <= target;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i === 0 ? "0 0 auto" : "1 1 0" }}>
              {i > 0 && (
                <div
                  style={{
                    height: 2,
                    flex: 1,
                    background: i <= current ? accent : inTargetSpan ? "var(--blue-100)" : "var(--grey-200)",
                    transition: "background-color var(--dur-base) var(--ease)",
                  }}
                />
              )}
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  flex: "none",
                  boxSizing: "border-box",
                  background: done || isCurrent ? (isCurrent ? "var(--bg-base)" : accent) : inTargetSpan ? "var(--blue-100)" : "var(--grey-200)",
                  border: isCurrent ? `3.5px solid ${accent}` : "none",
                }}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        {steps.map((s, i) => {
          const emphasized = i === current || i === target;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: i === 0 ? "left" : i === steps.length - 1 ? "right" : "center",
                fontSize: 12,
                fontWeight: emphasized ? 700 : 500,
                color: i === current ? accent : i === target ? "var(--fg-primary)" : i < current ? "var(--fg-secondary)" : "var(--fg-quaternary)",
                letterSpacing: "var(--track-body)",
                lineHeight: 1.35,
              }}
            >
              <div>{s.label}</div>
              {s.sub && <div style={{ fontWeight: 400, fontSize: 11, marginTop: 2 }}>{s.sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
