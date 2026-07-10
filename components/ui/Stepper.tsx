"use client";

import type { CSSProperties } from "react";
import { Icons } from "./icons";

export interface StepperStep {
  label: string;
  /** 보조 라벨 (선택) */
  sub?: string;
}

export interface FlowStep {
  label: string;
  description?: string;
}

/**
 * 플로우 스텝퍼 (수정요청v3) — 참고 코드(circle variant)를 디자인 시스템 문법으로 개선.
 * 원형 스텝 버튼(완료=브랜드 채움+체크 / 현재=브랜드 링 / 미도달=회색) + 연결선.
 * 가운데 정렬 가로 배치. 자료 정리 등 페이지 내부 단계 표시에 사용.
 */
export function FlowStepper({
  steps,
  active,
  completed,
  onStepClick,
  style,
}: {
  steps: FlowStep[];
  /** 현재 단계 (0-base) */
  active: number;
  /** 단계별 완료 여부 — 생략 시 active 이전 단계를 완료로 간주 */
  completed?: boolean[];
  /** 클릭 이동 (완료·현재 단계만 허용) */
  onStepClick?: (index: number) => void;
  style?: CSSProperties;
}) {
  const isDone = (i: number) => completed?.[i] ?? i < active;
  return (
    <div
      role="list"
      aria-label="진행 단계"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        ...style,
      }}
    >
      {steps.map((step, i) => {
        const done = isDone(i);
        const current = i === active;
        const clickable = Boolean(onStepClick) && (done || current);
        return (
          <div key={step.label} role="listitem" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {i > 0 && (
              <span
                aria-hidden
                style={{
                  width: 44,
                  height: 2,
                  borderRadius: 1,
                  background: done || current ? "var(--blue-500)" : "var(--grey-200)",
                  transition: "background-color var(--dur-base) var(--ease)",
                }}
              />
            )}
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick?.(i)}
              aria-current={current ? "step" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
                border: "none",
                background: "transparent",
                padding: 4,
                cursor: clickable ? "pointer" : "default",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  boxSizing: "border-box",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 700,
                  background: done
                    ? "var(--bg-brand)"
                    : current
                      ? "var(--bg-brand-weak)"
                      : "var(--bg-tertiary)",
                  border: current ? "2px solid var(--blue-500)" : "2px solid transparent",
                  color: done
                    ? "var(--fg-inverse)"
                    : current
                      ? "var(--fg-brand)"
                      : "var(--fg-quaternary)",
                  transition:
                    "background-color var(--dur-base) var(--ease), border-color var(--dur-base) var(--ease), color var(--dur-base) var(--ease)",
                }}
              >
                {done ? <Icons.check size={15} /> : i + 1}
              </span>
              <span style={{ textAlign: "left" }}>
                <span
                  style={{
                    display: "block",
                    font: "var(--text-label-m)",
                    letterSpacing: "var(--track-body)",
                    color: current ? "var(--fg-brand)" : done ? "var(--fg-primary)" : "var(--fg-quaternary)",
                    transition: "color var(--dur-base) var(--ease)",
                  }}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span
                    style={{
                      display: "block",
                      marginTop: 1,
                      font: "var(--text-caption)",
                      color: "var(--fg-quaternary)",
                    }}
                  >
                    {step.description}
                  </span>
                )}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
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
