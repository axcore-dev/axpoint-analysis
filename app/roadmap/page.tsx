"use client";

import { useMemo, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { RoadmapStage } from "@/lib/types";
import { getTask } from "@/data/catalog/tasks";
import { areaName } from "@/data/rubric/meta";
import { generateRoadmap } from "@/lib/roadmap";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { Badge, Button, Card, Icons } from "@/components/ui";

/**
 * S4 실행 로드맵 — F-RMP-01~05 (2026-07-09 수정요청v1)
 * 참고 UI: docs/참고자료/로드맵 참고ui.png — 세로 타임라인 문법.
 * 좌측 레일(세로 라인 + 도트 + 개월차 마커) + 우측 단계 카드.
 * 단계 강조는 단일 강조색 원칙 내 블루 농도 변화(1단계 blue-500 →
 * 2단계 blue-100 → 3단계 grey)로만 구분한다.
 */

const mono: CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0" };

function range([min, max]: [number, number], unit: string): string {
  const fmt = (n: number) => n.toLocaleString("ko-KR");
  return min === max ? `${fmt(min)}${unit}` : `${fmt(min)}~${fmt(max)}${unit}`;
}

/* 단계별 레일 도트·좌측 보더 톤 — 블루 농도 변화 */
const STAGE_ACCENTS = ["var(--blue-500)", "var(--blue-100)", "var(--grey-300)"];

function monthMarker(stage: RoadmapStage): string {
  const from = stage.startMonth + 1;
  const to = stage.startMonth + stage.durationMonths;
  return from === to ? `${from}개월차` : `${from}~${to}개월차`;
}

/* ---------- 단계 카드 ---------- */

function StageCard({ stage, accent }: { stage: RoadmapStage; accent: string }) {
  const autoReasons = new Map(stage.autoInserted.map((a) => [a.taskId, a.reason]));

  return (
    <Card
      radius="2xl"
      style={{
        borderLeft: `3px solid ${accent}`,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* 단계 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
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
        <span style={{ ...mono, fontSize: 14, fontWeight: 600, color: "var(--fg-secondary)" }}>
          약 {stage.durationMonths}개월
        </span>
      </div>

      {/* 과제 리스트 (제목·영역·기간 + 자동 추가 배지·사유) */}
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

      {/* 진행 판정 게이트 (F-RMP-03) */}
      {stage.gate && (
        <div
          style={{
            border: "1px solid var(--line-default)",
            borderRadius: "var(--radius-m)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--line-subtle)",
              font: "var(--text-label-s)",
              color: "var(--fg-brand)",
            }}
          >
            다음 단계 진행 기준
          </div>
          <ul
            style={{
              margin: 0,
              padding: "12px 14px",
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              font: "var(--text-body3)",
              color: "var(--fg-primary)",
            }}
          >
            {stage.gate.criteria.map((c) => (
              <li key={c} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "var(--fg-brand)", flex: "none", marginTop: 2 }}>
                  <Icons.check size={13} />
                </span>
                {c}
              </li>
            ))}
          </ul>
          {/* 충족/미달 2톤 분기 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              borderTop: "1px solid var(--line-subtle)",
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                background: "var(--bg-brand-weak)",
                font: "var(--text-body3)",
                color: "var(--fg-brand)",
              }}
            >
              <span style={{ flex: "none", marginTop: 2 }}>
                <Icons.check size={13} />
              </span>
              <span>
                <strong style={{ fontWeight: 600 }}>충족 시</strong> — {stage.gate.threshold}
              </span>
            </div>
            <div
              style={{
                padding: "12px 14px",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                background: "var(--bg-warning-weak)",
                font: "var(--text-body3)",
                color: "var(--fg-warning)",
              }}
            >
              <span style={{ flex: "none", marginTop: 2 }}>
                <Icons.alert size={13} />
              </span>
              <span>
                <strong style={{ fontWeight: 600 }}>미달 시</strong> — {stage.gate.onFail}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 비용 밴드 (F-RMP-04) */}
      <div>
        <div style={{ font: "var(--text-body2)", color: "var(--fg-primary)" }}>
          예상 자부담{" "}
          <span style={{ ...mono, fontWeight: 600, color: "var(--fg-primary)" }}>
            {range(stage.costBand.selfPay, "만원")}
          </span>
        </div>
        <div style={{ font: "var(--text-caption)", color: "var(--grey-500)", marginTop: 3 }}>
          {stage.costBand.note}
        </div>
      </div>

      {/* 역할 분담 2열 (F-RMP-05) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {(
          [
            { label: "귀사가 할 일", items: stage.roles.company },
            { label: "AXpoint가 할 일", items: stage.roles.axpoint },
          ] as const
        ).map((col) => (
          <div
            key={col.label}
            style={{
              padding: "12px 14px",
              border: "1px solid var(--line-subtle)",
              borderRadius: "var(--radius-m)",
            }}
          >
            <div
              style={{
                font: "var(--text-label-s)",
                color: "var(--fg-primary)",
                marginBottom: 8,
              }}
            >
              {col.label}
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 5,
                font: "var(--text-body3)",
                color: "var(--fg-secondary)",
              }}
            >
              {col.items.map((item) => (
                <li key={item} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                  <span
                    aria-hidden
                    style={{
                      flex: "none",
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "var(--grey-400)",
                      marginTop: 8,
                    }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
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
        {/* ---- 상단 헤더 (라이트) ---- */}
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
              <span style={{ ...mono, fontWeight: 700, color: "var(--fg-primary)" }}>
                {selectedTaskIds.length}
              </span>
              개
            </span>
            <span aria-hidden style={{ color: "var(--grey-400)" }}>
              ·
            </span>
            <span>
              총{" "}
              <span style={{ ...mono, fontWeight: 700, color: "var(--fg-primary)" }}>
                {roadmap.totalMonths}
              </span>
              개월
            </span>
            <span aria-hidden style={{ color: "var(--grey-400)" }}>
              ·
            </span>
            <span>
              예상 자부담{" "}
              <span style={{ ...mono, fontWeight: 700, color: "var(--fg-primary)" }}>
                {range([selfMin, selfMax], "만원")}
              </span>
            </span>
          </div>
        </header>

        {/* ---- 세로 타임라인 ---- */}
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
            const accent = STAGE_ACCENTS[Math.min(i, STAGE_ACCENTS.length - 1)];
            return (
              <div
                key={stage.order}
                className="axp-rm-row"
                style={{ marginBottom: i === roadmap.stages.length - 1 ? 0 : 28 }}
              >
                {/* 개월차 마커 */}
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
                  {monthMarker(stage)}
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
                  <StageCard stage={stage} accent={accent} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ---- 말미 CTA ---- */}
        <div style={{ marginTop: 56, textAlign: "center" }}>
          <p style={{ margin: "0 0 20px", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
            로드맵과 예상 효과를 한 장으로 정리한 보고서가 준비돼 있어요.
          </p>
          <Button variant="primary" size="xl" onClick={goReport}>
            보고서 보기
            <Icons.arrow size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
