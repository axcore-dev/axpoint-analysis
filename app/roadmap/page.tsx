"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useInView } from "react-intersection-observer";
import type { RoadmapStage } from "@/lib/types";
import { getTask } from "@/data/catalog/tasks";
import { areaName } from "@/data/rubric/meta";
import { generateRoadmap } from "@/lib/roadmap";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { Badge, Button, Card, Icons } from "@/components/ui";

/**
 * S4 실행 로드맵 — F-RMP-01~05 (2026-07-10 수정요청v3)
 * 단계 축 = AX 7단계 방법론 (1단계 경영문제 정의는 진단으로 완료 표시).
 * 세로 타임라인: 좌측 레일(도트 + '약 N개월' 마커) + 우측 단계 카드.
 * 스크롤 중앙 포커스 — 뷰포트 중앙 카드만 선명, 나머지는 은은하게.
 * 귀사/AXpoint 할 일은 단일 리스트로 통합, 진행 기준(게이트) 카드는 폐지.
 */

const mono: CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0" };

function range([min, max]: [number, number], unit: string): string {
  const fmt = (n: number) => n.toLocaleString("ko-KR");
  return min === max ? `${fmt(min)}${unit}` : `${fmt(min)}~${fmt(max)}${unit}`;
}

/* 비완료 단계 도트 톤 — 블루 농도 변화 (첫 실행 단계가 가장 진함) */
const STAGE_ACCENTS = ["var(--blue-500)", "var(--blue-100)", "var(--grey-300)"];

/* ---------- 스크롤 중앙 포커스 래퍼 (v3) ---------- */

function FocusRow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  /* 뷰포트 세로 중앙 ±24% 밴드에 걸치면 포커스 (react-intersection-observer) */
  const { ref, inView } = useInView({ rootMargin: "-38% 0px -38% 0px", threshold: 0 });

  return (
    <div
      ref={ref}
      style={{
        opacity: inView ? 1 : 0.55,
        transition: "opacity var(--dur-slow) var(--ease)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ---------- 단계 카드 ---------- */

function StageCard({ stage }: { stage: RoadmapStage }) {
  const autoReasons = new Map(stage.autoInserted.map((a) => [a.taskId, a.reason]));

  /* 1단계 경영문제 정의 — 이번 진단으로 완료 */
  if (stage.done) {
    return (
      <Card radius="2xl" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3
            style={{
              margin: 0,
              font: "var(--text-h4)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            단계 {stage.methodStepNo} · {stage.title}
          </h3>
          <Badge tone="success">완료</Badge>
        </div>
        <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
          {stage.purpose} — 이번 AXpoint 진단으로 마쳤어요.
        </p>
      </Card>
    );
  }

  return (
    <Card radius="2xl" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* 단계 헤더 */}
      <div>
        <h3
          style={{
            margin: 0,
            font: "var(--text-h4)",
            letterSpacing: "var(--track-heading)",
            color: "var(--fg-primary)",
          }}
        >
          단계 {stage.order} · {stage.title}
        </h3>
        <p style={{ margin: "6px 0 0", font: "var(--text-body3)", color: "var(--fg-tertiary)" }}>
          {stage.purpose}
        </p>
      </div>

      {/* 과제 리스트 — 카드마다 해당 로드맵 데이터 표기 */}
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {stage.taskIds.map((id) => {
          const t = getTask(id);
          const autoReason = autoReasons.get(id);
          return (
            <li
              key={id}
              style={{
                padding: "12px 14px",
                border: "1px solid var(--line-subtle)",
                borderRadius: "var(--radius-m)",
                background: "var(--bg-secondary)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                  {t.title}
                </span>
                <Badge tone="neutral">{areaName(t.areaId)}</Badge>
                <span style={{ ...mono, fontSize: 13, color: "var(--grey-500)" }}>
                  {t.durationMonths[0] === t.durationMonths[1]
                    ? `${t.durationMonths[0]}개월`
                    : `${t.durationMonths[0]}~${t.durationMonths[1]}개월`}
                </span>
                <span style={{ ...mono, fontSize: 13, color: "var(--grey-500)" }}>
                  {range(t.costBand.selfPay, "만원")}
                </span>
                {autoReason && <Badge tone="accent">자동 추가</Badge>}
              </div>
              {autoReason && (
                <div
                  style={{
                    marginTop: 6,
                    font: "var(--text-body3)",
                    color: "var(--fg-tertiary)",
                  }}
                >
                  {autoReason}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* 금액 (F-RMP-04, v3: '자부담' → '금액') */}
      <div>
        <div style={{ font: "var(--text-body2)", color: "var(--fg-primary)" }}>
          금액{" "}
          <span style={{ ...mono, fontWeight: 600, color: "var(--fg-brand)" }}>
            {range(stage.costBand.selfPay, "")}
          </span>
          만 원
        </div>
        <div style={{ font: "var(--text-caption)", color: "var(--grey-500)", marginTop: 3 }}>
          {stage.costBand.note}
        </div>
      </div>

      {/* 할 일 — 귀사/AXpoint 통합 리스트 (F-RMP-05, v3) */}
      {stage.todos.length > 0 && (
        <div
          style={{
            padding: "12px 14px",
            border: "1px solid var(--line-subtle)",
            borderRadius: "var(--radius-m)",
          }}
        >
          <div style={{ font: "var(--text-label-s)", color: "var(--fg-primary)", marginBottom: 8 }}>
            할 일
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              font: "var(--text-body3)",
              color: "var(--fg-secondary)",
            }}
          >
            {stage.todos.map((todo) => (
              <li
                key={`${todo.owner}-${todo.text}`}
                style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
              >
                <span
                  style={{
                    flex: "none",
                    marginTop: 1,
                    display: "inline-flex",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-full)",
                    background: todo.owner === "AXpoint" ? "var(--bg-brand-weak)" : "var(--bg-tertiary)",
                    font: "var(--text-caption)",
                    fontWeight: 600,
                    color: todo.owner === "AXpoint" ? "var(--fg-brand)" : "var(--fg-secondary)",
                  }}
                >
                  {todo.owner}
                </span>
                {todo.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/* ---------- 페이지 ---------- */

export default function RoadmapPage() {
  const router = useRouter();
  const { selectedTaskIds, completeStep } = useDiagnosis();

  const roadmap = useMemo(
    () => (selectedTaskIds.length > 0 ? generateRoadmap(selectedTaskIds) : null),
    [selectedTaskIds],
  );

  /* 가드: 담은 과제 없음 */
  if (!roadmap) {
    return (
      <section
        style={{
          padding: "var(--space-20) var(--gutter)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Card radius="2xl" style={{ maxWidth: 520, textAlign: "center" }}>
          <h2
            style={{
              margin: "0 0 10px",
              font: "var(--text-h4)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            실행 로드맵
          </h2>
          <p style={{ margin: "0 0 20px", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
            담은 과제가 아직 없어요. 개선 과제를 먼저 담으면 실행 로드맵이 만들어져요.
          </p>
          <Button variant="primary" href="/tasks">
            개선 과제 담으러 가기
          </Button>
        </Card>
      </section>
    );
  }

  const selfMin = roadmap.stages.reduce((a, s) => a + s.costBand.selfPay[0], 0);
  const selfMax = roadmap.stages.reduce((a, s) => a + s.costBand.selfPay[1], 0);

  const goReport = () => {
    completeStep("roadmap");
    router.push("/report");
  };

  /* 비완료 단계 도트 톤 인덱스 */
  let accentIdx = 0;

  return (
    <div className="ax-step-enter" style={{ padding: "48px var(--gutter) 80px" }}>
      <style>{`
        .axp-rm-row { display: grid; grid-template-columns: 88px 24px 1fr; }
        .axp-rm-line { left: 99px; }
        @media (max-width: 640px) {
          .axp-rm-row { grid-template-columns: 56px 20px 1fr; }
          .axp-rm-line { left: 65px; }
        }
      `}</style>

      <div style={{ maxWidth: "var(--container-content)", margin: "0 auto" }}>
        {/* ---- 상단 헤더 — 숫자만 브랜드 컬러 (v3) ---- */}
        <header style={{ marginBottom: 40 }}>
          <h2
            style={{
              margin: "0 0 10px",
              font: "var(--text-h2)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            실행 로드맵
          </h2>
          <p
            style={{
              margin: "0 0 16px",
              font: "var(--text-body1)",
              letterSpacing: "var(--track-body)",
              color: "var(--fg-secondary)",
              maxWidth: 720,
            }}
          >
            {roadmap.goalLine}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: "4px 10px",
              font: "var(--text-label-m)",
              color: "var(--fg-secondary)",
            }}
          >
            <span>
              담은 과제{" "}
              <span style={{ ...mono, fontWeight: 700, color: "var(--fg-brand)" }}>
                {selectedTaskIds.length}
              </span>
              개
            </span>
            <span aria-hidden style={{ color: "var(--grey-400)" }}>
              ·
            </span>
            <span>
              총{" "}
              <span style={{ ...mono, fontWeight: 700, color: "var(--fg-brand)" }}>
                {roadmap.totalMonths}
              </span>
              개월
            </span>
            <span aria-hidden style={{ color: "var(--grey-400)" }}>
              ·
            </span>
            <span>
              금액{" "}
              <span style={{ ...mono, fontWeight: 700, color: "var(--fg-brand)" }}>
                {range([selfMin, selfMax], "")}
                
              </span>
              만 원
            </span>
          </div>
        </header>

        {/* ---- 세로 타임라인 (스크롤 중앙 포커스, v3) ---- */}
        <div style={{ position: "relative" }}>
          {/* 레일 세로 라인 */}
          <span
            aria-hidden
            className="axp-rm-line"
            style={{
              position: "absolute",
              top: 10,
              bottom: 10,
              width: 2,
              background: "var(--grey-200)",
            }}
          />
          {roadmap.stages.map((stage, i) => {
            const accent = stage.done
              ? "var(--green-500)"
              : STAGE_ACCENTS[Math.min(accentIdx++, STAGE_ACCENTS.length - 1)];
            return (
              <FocusRow
                key={stage.order}
                style={{ marginBottom: i === roadmap.stages.length - 1 ? 0 : 28 }}
              >
                <div className="axp-rm-row">
                  {/* 기간 마커 — '약 N개월' (v3) */}
                  <div
                    style={{
                      ...mono,
                      paddingTop: 4,
                      paddingRight: 6,
                      textAlign: "right",
                      fontSize: 12,
                      fontWeight: 600,
                      lineHeight: 1.4,
                      color: "var(--fg-tertiary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {stage.done ? "완료" : `약 ${stage.durationMonths}개월`}
                  </div>
                  {/* 도트 */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <span
                      aria-hidden
                      style={{
                        position: "relative",
                        zIndex: 1,
                        marginTop: 6,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: accent,
                        boxShadow: "0 0 0 3px var(--bg-base)",
                      }}
                    />
                  </div>
                  {/* 단계 카드 */}
                  <div style={{ paddingLeft: 12, minWidth: 0 }}>
                    <StageCard stage={stage} />
                  </div>
                </div>
              </FocusRow>
            );
          })}
        </div>

        {/* ---- 말미 CTA — 우측 하단 (v3) ---- */}
        <div style={{ marginTop: 56, display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" size="xl" onClick={goReport}>
            보고서 보기
            <Icons.arrow size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
