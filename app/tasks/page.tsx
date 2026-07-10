"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FunctionAreaId, ImprovementTask } from "@/lib/types";
import { getTask, recommendedTasks, taskCatalog } from "@/data/catalog/tasks";
import { FUNCTION_AREAS, areaName } from "@/data/rubric/meta";
import { areaAssessments } from "@/data/scenario/areas";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { Badge, Button, Card, Icons, Tag } from "@/components/ui";

/**
 * S3 개선 과제 후보 — F-TSK-01~07 (2026-07-09 수정요청v1)
 * 참고 UI: docs/참고자료/개선과제.png
 * 헤더 카드(큰 숫자 요약 3개) + 필터 칩 행 + 3열 카드 그리드(20종 전부 노출)
 * + 하단 고정 바(grey-800) + 기반과제 연관 제안 토스트.
 * 진입 시 추천 5종 미리 담아두기(1회).
 */

const mono: CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0" };

function range([min, max]: [number, number], unit: string): string {
  return min === max ? `${min}${unit}` : `${min}~${max}${unit}`;
}

/* 시계 아이콘 — 페이지 로컬 (Icons 서브셋과 동일 문법: 2px 스트로크, 24 그리드) */
function ClockIcon({ size = 13 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/* ---------- 헤더 요약 수치 (taskCatalog·8영역 평가에서 계산) ---------- */

const TOTAL_COUNT = taskCatalog.length; // 20
const PRIORITY_AREA_COUNT = areaAssessments.filter((a) => a.grade === "critical").length; // 3
const FEASIBLE_COUNT = taskCatalog.filter((t) => t.feasibility).length; // 즉시 착수

const AREA_IDS = FUNCTION_AREAS.map((a) => a.id);
const AREA_COUNTS: Record<FunctionAreaId, number> = FUNCTION_AREAS.reduce(
  (acc, a) => {
    acc[a.id] = taskCatalog.filter((t) => t.areaId === a.id).length;
    return acc;
  },
  {} as Record<FunctionAreaId, number>,
);

/* 추천순 정렬: 추천 먼저, 이후 구축 우선순위 */
const SORTED_TASKS = [...taskCatalog].sort((a, b) =>
  a.recommended === b.recommended ? a.buildOrder - b.buildOrder : a.recommended ? -1 : 1,
);

/* ---------- 과제 카드 (참고 이미지 문법) ---------- */

function TaskCard({
  task,
  selected,
  onToggle,
}: {
  task: ImprovementTask;
  selected: boolean;
  onToggle: () => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <Card
      radius="2xl"
      interactive
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onToggle}
      onKeyDown={onKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...(selected
          ? {
              background: "var(--bg-brand-weak)",
              border: "1px solid var(--line-brand)",
            }
          : undefined),
      }}
    >
      {/* 상단: 좌 배지 · 우 원형 체크 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge tone="neutral">{areaName(task.areaId)}</Badge>
          {task.recommended && <Badge tone="accent">추천</Badge>}
          {task.feasibility && <Badge tone="success">즉시 착수</Badge>}
          {task.isFoundation && <Badge tone="dark">기반 과제</Badge>}
        </div>
        <span
          aria-hidden
          style={{
            flex: "none",
            width: 22,
            height: 22,
            borderRadius: "50%",
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: selected ? "var(--blue-500)" : "var(--bg-base)",
            border: selected ? "1px solid var(--blue-500)" : "1.5px solid var(--grey-300)",
            color: "var(--white)",
            transition:
              "background-color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
          }}
        >
          {selected && <Icons.check size={13} />}
        </span>
      </div>

      {/* 제목 + 영문 보조 태그 */}
      <div>
        <h3
          style={{
            margin: 0,
            font: "var(--text-title1)",
            letterSpacing: "var(--track-heading)",
            color: "var(--fg-primary)",
          }}
        >
          {task.title}
        </h3>
        {task.subtitle && (
          <div
            style={{
              marginTop: 4,
              font: "var(--text-caption)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--grey-500)",
            }}
          >
            {task.subtitle}
          </div>
        )}
      </div>

      {/* 요약 (2줄) */}
      <p
        style={{
          margin: 0,
          font: "var(--text-body3)",
          letterSpacing: "var(--track-body)",
          color: "var(--fg-secondary)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {task.summary}
      </p>

      {/* 기대효과 정량 한 줄 (블루) */}
      {task.beforeAfter && (
        <div
          style={{
            font: "var(--text-label-s)",
            letterSpacing: "var(--track-body)",
            color: "var(--fg-brand)",
          }}
        >
          {task.beforeAfter}
        </div>
      )}

      {/* 예상 기간 */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          font: "var(--text-caption)",
          color: "var(--fg-tertiary)",
        }}
      >
        <ClockIcon size={13} />
        예상 <span style={{ ...mono, fontWeight: 600 }}>{range(task.durationMonths, "개월")}</span>
      </div>

      {/* 하단: 착수 조건 1줄 */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 10,
          borderTop: "1px solid var(--line-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {task.feasibility ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "flex-start",
              gap: 6,
              font: "var(--text-caption)",
              fontWeight: 600,
              color: "var(--fg-success)",
            }}
          >
            <span style={{ flex: "none", display: "inline-flex", marginTop: 1 }}>
              <Icons.check size={13} />
            </span>
            {task.feasibility.badge}
          </span>
        ) : (
          <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>
            {task.dataRequirements[0]}
          </span>
        )}
        {!task.recommended && (
          <span
            style={{
              font: "var(--text-caption)",
              color: "var(--grey-500)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {task.reason}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ---------- 본문 (useSearchParams — Suspense 경계 내부) ---------- */

function TasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completedSteps, selectedTaskIds, addTask, toggleTask, completeStep } = useDiagnosis();

  const initialArea = searchParams.get("area");
  const [area, setArea] = useState<FunctionAreaId | "all">(
    initialArea && (AREA_IDS as string[]).includes(initialArea)
      ? (initialArea as FunctionAreaId)
      : "all",
  );
  /** 기반과제 연관 제안 토스트 (F-TSK-04) */
  const [suggestion, setSuggestion] = useState<{ foundationIds: string[] } | null>(null);

  /* 추천 과제 미리 담아두기 — 상태 복원 후 1회만 판단 */
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (!completedSteps.includes("result")) return; // 저장 상태 복원 전이면 대기
    seeded.current = true;
    if (!completedSteps.includes("tasks") && selectedTaskIds.length === 0) {
      recommendedTasks.forEach((t) => addTask(t.id));
    }
  }, [completedSteps, selectedTaskIds, addTask]);

  const filtered = useMemo(
    () => (area === "all" ? SORTED_TASKS : SORTED_TASKS.filter((t) => t.areaId === area)),
    [area],
  );

  /* 가드: 진단 결과 미완료 */
  if (!completedSteps.includes("result")) {
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
            개선 과제 후보
          </h2>
          <p style={{ margin: "0 0 20px", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
            개선 과제는 진단 결과를 확인한 뒤에 열려요. 먼저 진단 결과를 확인해 주세요.
          </p>
          <Button variant="primary" href="/result">
            진단 결과 보러 가기
          </Button>
        </Card>
      </section>
    );
  }

  const handleToggle = (task: ImprovementTask) => {
    const wasSelected = selectedTaskIds.includes(task.id);
    toggleTask(task.id);
    if (!wasSelected) {
      /* 담을 때 — 미담긴 선행 기반과제가 있으면 연관 제안 */
      const missingFoundations = (task.dependsOn ?? [])
        .map((id) => getTask(id))
        .filter((dep) => dep.isFoundation && !selectedTaskIds.includes(dep.id))
        .map((dep) => dep.id);
      if (missingFoundations.length > 0) {
        setSuggestion({ foundationIds: missingFoundations });
      }
    } else if (suggestion) {
      setSuggestion(null);
    }
  };

  const goRoadmap = () => {
    completeStep("tasks");
    router.push("/roadmap");
  };

  const count = selectedTaskIds.length;
  const overLimit = count >= 4;
  const suggestionTitles = suggestion
    ? suggestion.foundationIds.map((id) => getTask(id).title).join("’, ‘")
    : "";

  return (
    <div className="ax-step-enter" style={{ padding: "40px var(--gutter) 200px" }}>
      <style>{`
        .axp-task-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        @media (max-width: 980px) { .axp-task-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { .axp-task-grid { grid-template-columns: 1fr; } }
      `}</style>

      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* ---- 헤더 카드 ---- */}
        <Card radius="2xl" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <h2
              style={{
                margin: "0 0 8px",
                font: "var(--text-h2)",
                letterSpacing: "var(--track-heading)",
                color: "var(--fg-primary)",
              }}
            >
              개선 과제 후보
            </h2>
            <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
              진단 결과에 기반해 도출한 과제예요. 지금 자료로 바로 착수 가능한 과제를 함께
              표시했어요.
            </p>
          </div>

          {/* 큰 숫자 요약 3개 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 36px" }}>
            {(
              [
                { n: TOTAL_COUNT, label: "개 후보 과제" },
                { n: PRIORITY_AREA_COUNT, label: "곳 우선 개선 영역" },
                { n: FEASIBLE_COUNT, label: "개 보유 자료로 즉시 착수" },
              ] as const
            ).map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span
                  style={{
                    ...mono,
                    fontSize: 30,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: "var(--fg-primary)",
                  }}
                >
                  {s.n}
                </span>
                <span style={{ font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              font: "var(--text-caption)",
              color: "var(--grey-500)",
            }}
          >
            <span style={{ flex: "none", display: "inline-flex" }}>
              <Icons.info size={13} />
            </span>
            예상 기간은 정부 스마트공장 보급·확산사업 표준 일정을 기준으로 한 현실 추정이에요.
          </div>
        </Card>

        {/* ---- 필터 칩 행 ---- */}
        <Card
          radius="2xl"
          padded={false}
          style={{
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <Tag selected={area === "all"} onClick={() => setArea("all")}>
            전체{" "}
            <span style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{TOTAL_COUNT}</span>
          </Tag>
          {FUNCTION_AREAS.map((a) => (
            <Tag key={a.id} selected={area === a.id} onClick={() => setArea(a.id)}>
              {a.name}{" "}
              <span style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{AREA_COUNTS[a.id]}</span>
            </Tag>
          ))}
          <span
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              font: "var(--text-caption)",
              color: "var(--grey-500)",
              whiteSpace: "nowrap",
            }}
          >
            정렬 · 추천순
            <Icons.chevronDown size={13} />
          </span>
        </Card>

        {/* ---- 카드 그리드 (20종 전부 — 필터로 탐색) ---- */}
        <div className="axp-task-grid">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              selected={selectedTaskIds.includes(t.id)}
              onToggle={() => handleToggle(t)}
            />
          ))}
        </div>
      </div>

      {/* ---- 하단 고정: 연관 제안 토스트 + 담기 바 ---- */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          padding: "0 var(--gutter) 20px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            maxWidth: 1080,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: 10,
          }}
        >
          {suggestion && (
            <div
              role="status"
              style={{
                pointerEvents: "auto",
                alignSelf: "center",
                maxWidth: 640,
                background: "var(--grey-800)",
                color: "var(--fg-inverse)",
                borderRadius: "var(--radius-l)",
                boxShadow: "var(--shadow-toast)",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ flex: "none", display: "inline-flex", color: "var(--ax-blue-on-dark)" }}>
                <Icons.info size={17} />
              </span>
              <span style={{ flex: "1 1 240px", font: "var(--text-body3)", color: "var(--fg-inverse)" }}>
                ‘{suggestionTitles}’이 선행되면 효과가 커요. 함께 담을까요?
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    suggestion.foundationIds.forEach((id) => addTask(id));
                    setSuggestion(null);
                  }}
                >
                  함께 담기
                </Button>
                <button
                  type="button"
                  onClick={() => setSuggestion(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: "6px 10px",
                    font: "var(--text-label-s)",
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  나중에
                </button>
              </span>
            </div>
          )}

          {/* 담기 바 — grey-800 서피스(토스트 문법), radius 16 */}
          <div
            style={{
              pointerEvents: "auto",
              background: "var(--grey-800)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-toast)",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 4 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1.3,
                  color: "var(--fg-inverse)",
                }}
              >
                과제 <span style={{ ...mono }}>{count}</span>개 담음
              </div>
              <div style={{ font: "var(--text-caption)", color: "rgba(255,255,255,0.62)" }}>
                {count === 0
                  ? "아직 담은 게 없어요"
                  : "보통 2~3개로 시작해요 — 정부 지원사업 1회 신청 단위"}
              </div>
              {overLimit && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    font: "var(--text-caption)",
                    color: "#ffc06e",
                  }}
                >
                  <span style={{ flex: "none", display: "inline-flex" }}>
                    <Icons.alert size={13} />
                  </span>
                  4개 이상은 한 번에 추진하기 어려워요. 우선순위가 높은 2~3개로 좁히는 걸 권해요.
                </div>
              )}
            </div>
            <div style={{ flex: "none", marginLeft: "auto" }}>
              <Button variant="primary" size="lg" onClick={goRoadmap} disabled={count === 0}>
                이 과제로 로드맵 보기
                <Icons.arrow size={17} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Next 정적 프리렌더 — useSearchParams는 Suspense 경계 안에서만 (기존 방식 유지) */
export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksContent />
    </Suspense>
  );
}
