"use client";

import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { ImprovementTask } from "@/lib/types";
import { getTask, taskCatalog } from "@/data/catalog/tasks";
import { METHOD_STEPS, getMethodStep } from "@/data/catalog/method";
import { areaAssessments } from "@/data/scenario/areas";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { Badge, Button, Card, Icons, Tag } from "@/components/ui";

/**
 * S3 개선 과제 후보 — F-TSK-01~07 (2026-07-10 수정요청v3)
 * - 카테고리 = AX 7단계 방법론 단계, 맨 앞에 ★추천 (기본 선택)
 * - 뱃지는 카테고리(단계)·추천만. 기본 담기 없음. 기대효과는 추천 과제만.
 * - 사용 중인 프로그램으로 이미 갖춰진 과제는 선택 불가.
 * - 하단 고정 바: 밝은 서피스 + 그림자 구분.
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

/* ---------- 헤더 요약 수치 ---------- */

const TOTAL_COUNT = taskCatalog.length;
const PRIORITY_AREA_COUNT = areaAssessments.filter((a) => a.grade === "critical").length;
const RECOMMENDED_COUNT = taskCatalog.filter((t) => t.recommended).length;

/** 카테고리 칩 — ★추천 맨 앞 + 방법론 2~7단계 (v3) */
type Filter = "recommended" | "all" | number;

const STEP_FILTERS = METHOD_STEPS.filter(
  (s) => s.no !== 1 && taskCatalog.some((t) => t.methodStep === s.no),
);

/* 추천순 정렬: 추천 먼저, 이후 구축 우선순위 */
const SORTED_TASKS = [...taskCatalog].sort((a, b) =>
  a.recommended === b.recommended ? a.buildOrder - b.buildOrder : a.recommended ? -1 : 1,
);

/* ---------- 과제 카드 ---------- */

function TaskCard({
  task,
  selected,
  equippedBy,
  onToggle,
}: {
  task: ImprovementTask;
  selected: boolean;
  /** 사용 중인 프로그램으로 이미 갖춰짐 — 선택 불가 (v3) */
  equippedBy: string | null;
  onToggle: () => void;
}) {
  const disabled = equippedBy !== null;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <Card
      radius="2xl"
      interactive={!disabled}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onToggle}
      onKeyDown={onKeyDown}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        ...(disabled
          ? { opacity: 0.55, cursor: "default" }
          : selected
            ? {
                background: "var(--bg-brand-weak)",
                border: "1px solid var(--line-brand)",
              }
            : undefined),
      }}
    >
      {/* 상단: 좌 배지(카테고리·추천만, v3) · 우 원형 체크 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge tone="neutral">{getMethodStep(task.methodStep).shortLabel}</Badge>
          {task.recommended && <Badge tone="accent">★ 추천</Badge>}
        </div>
        {!disabled && (
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
        )}
      </div>

      {/* 제목 */}
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

      {/* 기대효과 정량 한 줄 — 추천 과제만 (v3) */}
      {task.recommended && task.beforeAfter && (
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

      {/* 하단: 착수 조건 또는 갖춰짐 안내 */}
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
        {disabled ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              font: "var(--text-caption)",
              fontWeight: 600,
              color: "var(--fg-success)",
            }}
          >
            <Icons.check size={13} />
            {equippedBy} 사용 중 — 이미 갖춰져 있어요
          </span>
        ) : (
          <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>
            {task.dataRequirements[0]}
          </span>
        )}
        {!disabled && !task.recommended && (
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

/* ---------- 페이지 ---------- */

export default function TasksPage() {
  const router = useRouter();
  const { completedSteps, systems, selectedTaskIds, addTask, toggleTask, completeStep } =
    useDiagnosis();

  const [filter, setFilter] = useState<Filter>("recommended");
  /** 기반과제 연관 제안 토스트 (F-TSK-04) */
  const [suggestion, setSuggestion] = useState<{ foundationIds: string[] } | null>(null);

  /** 이미 갖춰진 과제 → 근거 시스템명 (사용 중인 프로그램과 교차) */
  const equippedBy = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of taskCatalog) {
      const hit = t.coveredBySystems?.find((s) => systems.includes(s));
      if (hit) map.set(t.id, hit);
    }
    return map;
  }, [systems]);

  const filtered = useMemo(() => {
    if (filter === "recommended") return SORTED_TASKS.filter((t) => t.recommended);
    if (filter === "all") return SORTED_TASKS;
    return SORTED_TASKS.filter((t) => t.methodStep === filter);
  }, [filter]);

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
            개선 과제는 진단 결과를 확인한 뒤에 열려요.
          </p>
          <Button variant="primary" href="/result">
            진단 결과 보러 가기
          </Button>
        </Card>
      </section>
    );
  }

  const handleToggle = (task: ImprovementTask) => {
    if (equippedBy.has(task.id)) return;
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
              진단 결과로 도출한 과제예요.
            </p>
          </div>

          {/* 큰 숫자 요약 3개 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 36px" }}>
            {(
              [
                { n: TOTAL_COUNT, label: "개 후보 과제" },
                { n: PRIORITY_AREA_COUNT, label: "곳 우선 개선 영역" },
                { n: RECOMMENDED_COUNT, label: "개 추천 과제" },
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
            예상 기간은 정부 스마트공장 사업 표준 일정 기준이에요.
          </div>
        </Card>

        {/* ---- 카테고리 칩 — ★추천 맨 앞 + 방법론 단계 (v3) ---- */}
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
          <Tag selected={filter === "recommended"} onClick={() => setFilter("recommended")}>
            ★ 추천{" "}
            <span style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{RECOMMENDED_COUNT}</span>
          </Tag>
          <Tag selected={filter === "all"} onClick={() => setFilter("all")}>
            전체 <span style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{TOTAL_COUNT}</span>
          </Tag>
          {STEP_FILTERS.map((s) => (
            <Tag key={s.no} selected={filter === s.no} onClick={() => setFilter(s.no)}>
              {s.shortLabel}{" "}
              <span style={{ ...mono, fontSize: 13, fontWeight: 600 }}>
                {taskCatalog.filter((t) => t.methodStep === s.no).length}
              </span>
            </Tag>
          ))}
        </Card>

        {/* ---- 카드 그리드 ---- */}
        <div className="axp-task-grid">
          {filtered.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              selected={selectedTaskIds.includes(t.id)}
              equippedBy={equippedBy.get(t.id) ?? null}
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
                background: "var(--bg-elevated)",
                color: "var(--fg-primary)",
                border: "1px solid var(--line-default)",
                borderRadius: "var(--radius-l)",
                boxShadow: "var(--shadow-3)",
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ flex: "none", display: "inline-flex", color: "var(--fg-brand)" }}>
                <Icons.info size={17} />
              </span>
              <span style={{ flex: "1 1 240px", font: "var(--text-body3)" }}>
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
                    color: "var(--fg-tertiary)",
                  }}
                >
                  나중에
                </button>
              </span>
            </div>
          )}

          {/* 담기 바 — 밝은 서피스 + 그림자 구분 (v3: 컬러 대신 그림자) */}
          <div
            style={{
              pointerEvents: "auto",
              background: "var(--bg-elevated)",
              border: "1px solid var(--line-default)",
              borderRadius: "var(--radius-xl)",
              boxShadow: "var(--shadow-3)",
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
                  color: "var(--fg-primary)",
                }}
              >
                과제 <span style={{ ...mono }}>{count}</span>개 담음
              </div>
              <div style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                정부 지원사업 1회 신청 단위: 2~3개
              </div>
              {overLimit && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    font: "var(--text-caption)",
                    color: "var(--fg-warning)",
                  }}
                >
                  <span style={{ flex: "none", display: "inline-flex" }}>
                    <Icons.alert size={13} />
                  </span>
                  우선순위 높은 2~3개를 권해요
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
