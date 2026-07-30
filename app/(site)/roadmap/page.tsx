"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useInView } from "react-intersection-observer";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { RouteLoading } from "@/components/flow/RouteLoading";
import { api } from "@/lib/api";
import { Badge, Button, Card, Icons } from "@/components/ui";

/**
 * AX 로드맵 — 원본 세로 타임라인 UI + 백엔드 실연동.
 * 담은 과제를 방법론 단계로 그룹핑한 결과(기간·비용)를 서버에서 재계산해 표시.
 * 선행 과제 자동 삽입 없음(확정) — 담은 과제만 포함. 단계 순서가 곧 우선순위.
 * 세로 타임라인: 좌측 레일(도트 + '약 N개월' 마커) + 우측 단계 카드.
 * 스크롤 중앙 포커스 — 뷰포트 중앙 카드만 선명, 나머지는 은은하게.
 * 서버 응답에 없는 데이터(목표 문장·단계 설명·할 일·비용 참고문구)는 렌더하지 않는다.
 */

const mono: CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0" };

function range(min: number, max: number, unit: string): string {
  const fmt = (n: number) => n.toLocaleString("ko-KR");
  return min === max ? `${fmt(min)}${unit}` : `${fmt(min)}~${fmt(max)}${unit}`;
}

type RoadmapPayload = {
  stages: {
    order: number;
    stage: number;
    stageName: string;
    taskNos: number[];
    startMonth: number;
    durationMonths: number;
    costMin: number;
    costMax: number;
  }[];
  totalMonths: number;
  costMin: number;
  costMax: number;
  tasks: {
    no: number;
    functionArea: string;
    title: string;
    durationMinMonths: number | null;
    durationMaxMonths: number | null;
    costMin: number | null;
    costMax: number | null;
    costNote: string | null;
  }[];
};

type RoadmapStage = RoadmapPayload["stages"][number];
type RoadmapTask = RoadmapPayload["tasks"][number];

function taskDuration(t: RoadmapTask): string | null {
  if (t.durationMinMonths == null) return null;
  const max = t.durationMaxMonths ?? t.durationMinMonths;
  return t.durationMinMonths === max ? `${max}개월` : `${t.durationMinMonths}~${max}개월`;
}

/* 단계 도트 톤 — 블루 농도 변화 (첫 단계가 가장 진함) */
const STAGE_ACCENTS = ["var(--blue-500)", "var(--blue-100)", "var(--grey-300)"];

/* ---------- 스크롤 중앙 포커스 래퍼 ---------- */

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

function StageCard({
  stage,
  taskByNo,
}: {
  stage: RoadmapStage;
  taskByNo: Map<number, RoadmapTask>;
}) {
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
          STEP {stage.order} · {stage.stageName}
        </h3>
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
        {stage.taskNos.map((no) => {
          const t = taskByNo.get(no);
          if (!t) return null;
          return (
            <li
              key={no}
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
                <Badge tone="neutral">{t.functionArea}</Badge>
                {taskDuration(t) && (
                  <span style={{ ...mono, fontSize: 13, color: "var(--grey-500)" }}>
                    {taskDuration(t)}
                  </span>
                )}
                {t.costMin != null && (
                  <span style={{ ...mono, fontSize: 13, color: "var(--grey-500)" }}>
                    {range(t.costMin, t.costMax ?? t.costMin, "만원")}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* 금액 */}
      <div>
        <div style={{ font: "var(--text-body2)", color: "var(--fg-primary)" }}>
          금액{" "}
          <span style={{ ...mono, fontWeight: 600, color: "var(--fg-brand)" }}>
            {range(stage.costMin, stage.costMax, "")}
          </span>
          만 원
        </div>
      </div>
    </Card>
  );
}

/* ---------- 페이지 ---------- */

export default function RoadmapPage() {
  const router = useRouter();
  const { assessmentId, selectedTaskIds, completedSteps, completeStep } = useDiagnosis();
  const [data, setData] = useState<RoadmapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasSelection = selectedTaskIds.length > 0 || completedSteps.includes("tasks");

  useEffect(() => {
    if (!assessmentId || !hasSelection) return;
    api<RoadmapPayload>(`/api/assessments/${assessmentId}/roadmap`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."));
  }, [assessmentId, hasSelection]);

  /* 가드: 담은 과제 없음 */
  if (!assessmentId || !hasSelection) {
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
            AX 로드맵
          </h2>
          <p style={{ margin: "0 0 20px", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
            담은 과제가 아직 없어요. 개선 과제를 먼저 담으면 AX 로드맵이 만들어져요.
          </p>
          <Button variant="primary" href="/tasks">
            개선 과제 담으러 가기
          </Button>
        </Card>
      </section>
    );
  }
  if (error)
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-[var(--gutter)]">
        <p style={{ font: "var(--text-body1)", color: "var(--fg-tertiary)" }}>{error}</p>
      </div>
    );
  if (!data) return <RouteLoading messages={["로드맵을 만들고 있어요"]} />;

  const taskByNo = new Map(data.tasks.map((t) => [t.no, t]));
  const taskCount = data.stages.reduce((s, st) => s + st.taskNos.length, 0);

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
        {/* ---- 상단 헤더 — 숫자만 브랜드 컬러 ---- */}
        <header style={{ marginBottom: 40 }}>
          <h2
            style={{
              margin: "0 0 16px",
              font: "var(--text-h2)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            AX 로드맵
          </h2>
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
                {taskCount}
              </span>
              개
            </span>
            <span aria-hidden style={{ color: "var(--grey-400)" }}>
              ·
            </span>
            <span>
              총{" "}
              <span style={{ ...mono, fontWeight: 700, color: "var(--fg-brand)" }}>
                {data.totalMonths}
              </span>
              개월
            </span>
            <span aria-hidden style={{ color: "var(--grey-400)" }}>
              ·
            </span>
            <span>
              금액{" "}
              <span style={{ ...mono, fontWeight: 700, color: "var(--fg-brand)" }}>
                {range(data.costMin, data.costMax, "")}
              </span>
              만 원
            </span>
          </div>
        </header>

        {/* ---- 세로 타임라인 (스크롤 중앙 포커스) ---- */}
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
          {data.stages.map((stage, i) => {
            const accent = STAGE_ACCENTS[Math.min(i, STAGE_ACCENTS.length - 1)];
            return (
              <FocusRow
                key={stage.order}
                style={{ marginBottom: i === data.stages.length - 1 ? 0 : 28 }}
              >
                <div className="axp-rm-row">
                  {/* 기간 마커 — '약 N개월' */}
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
                    {`약 ${stage.durationMonths}개월`}
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
                    <StageCard stage={stage} taskByNo={taskByNo} />
                  </div>
                </div>
              </FocusRow>
            );
          })}
        </div>

        {/* ---- 말미 CTA — 우측 하단 ---- */}
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
