"use client";

import { useMemo, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { RoadmapStage } from "@/lib/types";
import { getTask } from "@/data/catalog/tasks";
import { areaName } from "@/data/rubric/meta";
import { generateRoadmap } from "@/lib/roadmap";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { Badge, Button, Card, Eyebrow, Icons } from "@/components/ui";

/**
 * S4 로드맵 — F-RMP-01~05, REQ-F-16
 * 담은 과제 기반 generateRoadmap 런타임 호출. 단계 카드 순차 흐름 +
 * go/no-go 게이트, 자부담 밴드, 역할 분담 2열. 간트·정부사업 타임라인 없음(P2 제외).
 */

const mono: CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0" };

function range([min, max]: [number, number], unit: string): string {
  return min === max ? `${min}${unit}` : `${min}~${max}${unit}`;
}

/* ---------- 단계 카드 ---------- */

function StageCard({ stage }: { stage: RoadmapStage }) {
  const autoReasons = new Map(stage.autoInserted.map((a) => [a.taskId, a.reason]));

  return (
    <Card padded style={{ display: "flex", flexDirection: "column", gap: 18 }}>
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
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "-0.014em",
            lineHeight: 1.25,
            color: "var(--text-strong)",
          }}
        >
          단계 {stage.order} · {stage.title}
        </h2>
        <span style={{ ...mono, fontSize: 14, color: "var(--text-secondary)" }}>
          {stage.startMonth + 1}~{stage.startMonth + stage.durationMonths}개월차
        </span>
      </div>

      {/* 과제 목록 */}
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {stage.taskIds.map((id) => {
          const t = getTask(id);
          const autoReason = autoReasons.get(id);
          return (
            <li
              key={id}
              style={{
                padding: "12px 14px",
                border: "1px solid var(--divider-soft)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-ghost)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>
                  {t.title}
                </span>
                <Badge tone="neutral">{areaName(t.areaId)}</Badge>
                <span style={{ ...mono, fontSize: 13, color: "var(--text-muted)" }}>
                  {range(t.durationMonths, "개월")}
                </span>
                {autoReason && <Badge tone="accent">자동 추가</Badge>}
              </div>
              {autoReason && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--text-secondary)",
                  }}
                >
                  {autoReason}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* go/no-go 게이트 (F-RMP-03) */}
      {stage.gate && (
        <div
          style={{
            border: "1px solid var(--hairline)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--divider-soft)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ax-blue)",
            }}
          >
            Go / No-go 게이트
          </div>
          <ul
            style={{
              margin: 0,
              padding: "12px 14px",
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              fontSize: 14,
              lineHeight: 1.5,
              color: "var(--text-body)",
            }}
          >
            {stage.gate.criteria.map((c) => (
              <li key={c} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "var(--slate-400)", flex: "none", marginTop: 3 }}>
                  <Icons.check size={14} />
                </span>
                {c}
              </li>
            ))}
          </ul>
          {/* 분기 2열: go / no-go */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              borderTop: "1px solid var(--divider-soft)",
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                background: "var(--ax-blue-wash)",
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--ax-blue)",
              }}
            >
              <span style={{ flex: "none", marginTop: 2 }}>
                <Icons.check size={14} />
              </span>
              <span>
                <strong style={{ fontWeight: 600 }}>Go</strong> — {stage.gate.threshold}
              </span>
            </div>
            <div
              style={{
                padding: "12px 14px",
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
                background: "#fdf3e0",
                fontSize: 13,
                lineHeight: 1.5,
                color: "#9a6a12",
              }}
            >
              <span style={{ flex: "none", marginTop: 2 }}>
                <Icons.alert size={14} />
              </span>
              <span>
                <strong style={{ fontWeight: 600 }}>No-go</strong> — {stage.gate.onFail}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 비용 밴드 (F-RMP-04) */}
      <div>
        <div style={{ fontSize: 14, color: "var(--text-body)" }}>
          예상 자부담{" "}
          <span style={{ ...mono, fontWeight: 600, color: "var(--text-strong)" }}>
            {range(stage.costBand.selfPay, "만원")}
          </span>
        </div>
        <div style={{ fontSize: "var(--type-fine-size)", color: "var(--text-muted)", marginTop: 2 }}>
          {stage.costBand.note}
        </div>
      </div>

      {/* 역할 분담 2열 (F-RMP-05) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
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
              border: "1px solid var(--divider-soft)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-strong)",
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
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--text-secondary)",
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
                      background: "var(--slate-300)",
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
          padding: "var(--space-section) var(--gutter)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Card padded style={{ maxWidth: 520, textAlign: "center" }}>
          <Eyebrow tone="muted" style={{ marginBottom: 12 }}>
            로드맵
          </Eyebrow>
          <p style={{ margin: "0 0 20px", color: "var(--text-secondary)" }}>
            담은 과제가 아직 없습니다. 개선 과제를 먼저 담으면 실행 로드맵이 만들어집니다.
          </p>
          <Button variant="primary" href="/tasks">
            개선 과제 고르러 가기
          </Button>
        </Card>
      </section>
    );
  }

  const goReport = () => {
    completeStep("roadmap");
    router.push("/report");
  };

  return (
    <div>
      {/* 상단 배너 (F-RMP-01) — 다크 타일, 중복 요약 블록 없음 */}
      <section
        style={{
          background: "var(--tile-dark-1)",
          color: "var(--on-dark)",
          padding: "var(--space-section) var(--gutter)",
        }}
      >
        <div style={{ maxWidth: "var(--container-content)", margin: "0 auto" }}>
          <Eyebrow tone="on-dark" style={{ marginBottom: 16 }}>
            Step 5 · 실행 로드맵
          </Eyebrow>
          <h1
            style={{
              margin: "0 0 16px",
              fontSize: "var(--type-section-size)",
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: "var(--type-section-track)",
              maxWidth: 820,
            }}
          >
            {roadmap.goalLine}
          </h1>
          <div style={{ fontSize: 17, color: "var(--on-dark-muted)" }}>
            총{" "}
            <span style={{ ...mono, fontSize: 24, fontWeight: 600, color: "var(--on-dark)" }}>
              {roadmap.totalMonths}개월
            </span>
          </div>
        </div>
      </section>

      {/* 단계 카드 — 순차 흐름 (연결선) */}
      <section style={{ background: "var(--surface-page)", padding: "var(--space-section) var(--gutter)" }}>
        <div
          style={{
            maxWidth: "var(--container-content)",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {roadmap.stages.map((stage, i) => (
            <div key={stage.order}>
              {i > 0 && (
                <div
                  aria-hidden
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "6px 0",
                  }}
                >
                  <span style={{ width: 2, height: 26, background: "var(--ax-blue-hairline)" }} />
                  <span style={{ color: "var(--ax-blue)", display: "inline-flex", marginTop: -4 }}>
                    <Icons.chevronDown size={18} />
                  </span>
                </div>
              )}
              <StageCard stage={stage} />
            </div>
          ))}
        </div>
      </section>

      {/* 말미 CTA */}
      <section
        style={{
          background: "var(--surface-mist)",
          padding: "var(--space-section) var(--gutter)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "var(--container-content)", margin: "0 auto" }}>
          <p style={{ margin: "0 0 24px", color: "var(--text-secondary)" }}>
            로드맵과 예상 효과를 한 장으로 정리한 보고서가 준비되어 있습니다.
          </p>
          <Button variant="primary" size="lg" onClick={goReport}>
            보고서 보기
            <Icons.arrow size={18} />
          </Button>
        </div>
      </section>
    </div>
  );
}
