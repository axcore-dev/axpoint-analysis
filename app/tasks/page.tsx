"use client";

import { Suspense, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FunctionAreaId, ImprovementTask } from "@/lib/types";
import { getTask, moreTasks, recommendedTasks } from "@/data/catalog/tasks";
import { FUNCTION_AREAS, areaName } from "@/data/rubric/meta";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { Badge, Button, Card, Eyebrow, Icons, Tag } from "@/components/ui";

/**
 * S3 개선 과제(통합) — F-TSK-01~07
 * 추천 과제 기본 노출 + 더보기, 영역 필터(8대 기능영역 공유 체계),
 * 담기 바(2~3개 권장 가이드), 기반과제 연관 제안 토스트.
 */

const mono: CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0" };

function range([min, max]: [number, number], unit: string): string {
  return min === max ? `${min}${unit}` : `${min}~${max}${unit}`;
}

const AREA_IDS = FUNCTION_AREAS.map((a) => a.id);

/* ---------- 과제 카드 ---------- */

function TaskCard({
  task,
  selected,
  onToggle,
}: {
  task: ImprovementTask;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <Card padded style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 제목 + 배지 */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: "-0.014em",
            lineHeight: 1.25,
            color: "var(--text-strong)",
          }}
        >
          {task.title}
        </h3>
        <Badge tone="neutral">{areaName(task.areaId)}</Badge>
        {task.isFoundation && <Badge tone="dark">기반 과제</Badge>}
      </div>

      {task.feasibility && (
        <div>
          <Badge tone="accent">
            <Icons.bolt size={12} />
            즉시 착수 — {task.feasibility.badge}
          </Badge>
        </div>
      )}

      <p
        style={{
          margin: 0,
          fontSize: "var(--type-caption-size)",
          lineHeight: 1.5,
          color: "var(--text-secondary)",
        }}
      >
        {task.summary}
      </p>

      {/* 진단 근거 상속 (F-TSK-05) — 인용 스타일 */}
      <div
        style={{
          borderLeft: "2px solid var(--ax-blue)",
          paddingLeft: 12,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-body)" }}>
          <span style={{ fontWeight: 600, color: "var(--ax-blue)" }}>귀사 진단</span>{" "}
          {task.inheritedAsIs}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>
          {task.recommended ? task.reason : `미추천 사유 — ${task.reason}`}
        </div>
      </div>

      {/* 기대효과 · 난이도 · 기간 · 자부담 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px 16px",
          padding: "12px 14px",
          background: "var(--surface-ghost)",
          border: "1px solid var(--divider-soft)",
          borderRadius: "var(--radius-md)",
          fontSize: 14,
          lineHeight: 1.45,
        }}
      >
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>기대효과</div>
          <div style={{ color: "var(--text-body)" }}>
            {task.effect.summary}
            {task.effect.annualSavingRange && (
              <>
                {" "}
                <span style={{ ...mono, fontWeight: 600, color: "var(--text-strong)" }}>
                  연 {range(task.effect.annualSavingRange, "만원")}
                </span>
              </>
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>난이도</div>
          <div style={{ color: "var(--text-body)" }}>{task.difficulty}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>구축 기간</div>
          <div style={{ ...mono, color: "var(--text-body)" }}>
            {range(task.durationMonths, "개월")}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
            예상 자부담
          </div>
          <div>
            <span style={{ ...mono, color: "var(--text-body)" }}>
              {range(task.costBand.selfPay, "만원")}
            </span>
            <span
              style={{
                display: "block",
                fontSize: "var(--type-fine-size)",
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              {task.costBand.note}
            </span>
          </div>
        </div>
      </div>

      {/* 매칭 솔루션 카운트 (F-TSK-01) */}
      <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icons.plug size={14} />
          매칭 솔루션 <span style={{ ...mono, fontWeight: 600, color: "var(--text-strong)" }}>{task.solutionCount}개</span>
        </span>
        <span
          style={{
            display: "block",
            fontSize: "var(--type-fine-size)",
            color: "var(--text-muted)",
            marginTop: 2,
          }}
        >
          솔루션 연결은 로드맵·보고서 단계에서 이어집니다
        </span>
      </div>

      {/* 담기 토글 */}
      <div style={{ marginTop: "auto" }}>
        {selected ? (
          <Button variant="primary" size="sm" onClick={onToggle} aria-pressed="true">
            <Icons.check size={15} />
            담김
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onToggle} aria-pressed="false">
            담기
          </Button>
        )}
      </div>
    </Card>
  );
}

/* ---------- 본문 (useSearchParams — Suspense 내부) ---------- */

function TasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completedSteps, selectedTaskIds, addTask, removeTask, toggleTask, completeStep } =
    useDiagnosis();

  const initialArea = searchParams.get("area");
  const [area, setArea] = useState<FunctionAreaId | "all">(
    initialArea && (AREA_IDS as string[]).includes(initialArea)
      ? (initialArea as FunctionAreaId)
      : "all",
  );
  const [showMore, setShowMore] = useState(false);
  /** 기반과제 연관 제안 토스트 (F-TSK-04, REQ-F-15③) */
  const [suggestion, setSuggestion] = useState<{ foundationIds: string[] } | null>(null);

  const filteredRecommended = useMemo(
    () => (area === "all" ? recommendedTasks : recommendedTasks.filter((t) => t.areaId === area)),
    [area],
  );
  const filteredMore = useMemo(
    () => (area === "all" ? moreTasks : moreTasks.filter((t) => t.areaId === area)),
    [area],
  );

  /* 가드: 진단 결과 미완료 */
  if (!completedSteps.includes("result")) {
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
            개선 과제
          </Eyebrow>
          <p style={{ margin: "0 0 20px", color: "var(--text-secondary)" }}>
            개선 과제는 진단 결과를 확인한 뒤에 열립니다. 먼저 진단 결과를 확인해 주세요.
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

  const overLimit = selectedTaskIds.length >= 4;
  const suggestionTitles = suggestion
    ? suggestion.foundationIds.map((id) => getTask(id).title).join("', '")
    : "";

  return (
    <div style={{ paddingBottom: 220 }}>
      {/* 헤더 */}
      <section style={{ background: "var(--surface-page)", padding: "var(--space-section) var(--gutter) 48px" }}>
        <div style={{ maxWidth: "var(--container-content)", margin: "0 auto" }}>
          <Eyebrow style={{ marginBottom: 14 }}>Step 4 · 과제 선택</Eyebrow>
          <h1
            style={{
              margin: "0 0 12px",
              fontSize: "var(--type-display-size)",
              fontWeight: 600,
              lineHeight: 1.1,
              letterSpacing: "var(--type-display-track)",
              color: "var(--text-strong)",
            }}
          >
            개선 과제 고르기
          </h1>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            분석 결과를 바탕으로 추천 과제만 먼저 보여드립니다.
          </p>

          {/* 영역 필터 (F-CMN-02 — 분석·분류와 동일 명칭) */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 28 }}>
            <Tag selected={area === "all"} onClick={() => setArea("all")}>
              전체
            </Tag>
            {FUNCTION_AREAS.map((a) => (
              <Tag key={a.id} selected={area === a.id} onClick={() => setArea(a.id)}>
                {a.name}
              </Tag>
            ))}
          </div>
        </div>
      </section>

      {/* 과제 목록 */}
      <section
        style={{
          background: "var(--surface-mist)",
          padding: "48px var(--gutter) var(--space-section)",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {filteredRecommended.length === 0 ? (
            <p style={{ margin: "0 0 24px", color: "var(--text-muted)", fontSize: 14 }}>
              {area === "all"
                ? "추천 과제가 없습니다."
                : `${areaName(area)} 영역에는 추천 과제가 없습니다. 아래 더보기에서 다른 과제를 확인할 수 있습니다.`}
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
                gap: 20,
              }}
            >
              {filteredRecommended.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  selected={selectedTaskIds.includes(t.id)}
                  onToggle={() => handleToggle(t)}
                />
              ))}
            </div>
          )}

          {/* 더보기 (F-TSK-02) */}
          {filteredMore.length > 0 && (
            <div style={{ marginTop: 32, textAlign: "center" }}>
              {!showMore ? (
                <Button variant="secondary" onClick={() => setShowMore(true)}>
                  다른 개선 과제 더보기 ({filteredMore.length}건)
                  <Icons.chevronDown size={16} />
                </Button>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))",
                    gap: 20,
                    textAlign: "left",
                  }}
                >
                  {filteredMore.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      selected={selectedTaskIds.includes(t.id)}
                      onToggle={() => handleToggle(t)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 하단 고정: 연관 제안 토스트 + 담기 바 */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50 }}>
        {suggestion && (
          <div style={{ display: "flex", justifyContent: "center", padding: "0 var(--gutter)", marginBottom: 10 }}>
            <Card
              padded={false}
              style={{
                maxWidth: 620,
                width: "100%",
                padding: "14px 18px",
                boxShadow: "var(--shadow-pop)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: "var(--ax-blue)", display: "inline-flex", flex: "none" }}>
                <Icons.info size={18} />
              </span>
              <span style={{ flex: "1 1 260px", fontSize: 14, lineHeight: 1.5, color: "var(--text-body)" }}>
                &lsquo;{suggestionTitles}&rsquo;이 선행되면 효과가 커요. 함께 담을까요?
              </span>
              <span style={{ display: "inline-flex", gap: 8, flex: "none" }}>
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
                <Button variant="ghost" size="sm" onClick={() => setSuggestion(null)}>
                  나중에
                </Button>
              </span>
            </Card>
          </div>
        )}

        <div
          style={{
            background: "rgba(245,246,248,0.82)",
            backdropFilter: "var(--blur-frost)",
            WebkitBackdropFilter: "var(--blur-frost)",
            borderTop: "1px solid var(--divider-soft)",
            padding: "14px var(--gutter)",
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap" }}>
                  담은 과제{" "}
                  <span style={{ ...mono, color: "var(--ax-blue)" }}>{selectedTaskIds.length}개</span>
                </span>
                {selectedTaskIds.map((id) => {
                  const t = getTask(id);
                  return (
                    <span
                      key={id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 8px 6px 12px",
                        borderRadius: "var(--radius-pill)",
                        background: "var(--canvas)",
                        border: "1px solid var(--hairline)",
                        fontSize: 13,
                        lineHeight: 1,
                        color: "var(--slate-700)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.title}
                      <button
                        type="button"
                        aria-label={`${t.title} 빼기`}
                        onClick={() => removeTask(id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 18,
                          height: 18,
                          padding: 0,
                          border: "none",
                          borderRadius: "var(--radius-pill)",
                          background: "var(--slate-100)",
                          color: "var(--slate-600)",
                          cursor: "pointer",
                        }}
                      >
                        <Icons.x size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
              <div style={{ fontSize: "var(--type-fine-size)", color: "var(--text-muted)" }}>
                보통 2~3개로 시작하는 것을 권장합니다 (정부 지원사업 1회 신청 단위)
              </div>
              {overLimit && (
                <div
                  style={{
                    fontSize: 13,
                    color: "#9a6a12",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icons.alert size={14} />
                  4개 이상은 한 번에 추진하기 어려울 수 있어요. 우선순위가 높은 2~3개로 좁히는 것을
                  권장합니다.
                </div>
              )}
            </div>
            <div style={{ flex: "none", marginLeft: "auto" }}>
              <Button
                variant="primary"
                onClick={goRoadmap}
                disabled={selectedTaskIds.length === 0}
              >
                로드맵 보기
                <Icons.arrow size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Next 16 정적 프리렌더 — useSearchParams는 Suspense 경계 안에서만 */
export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksContent />
    </Suspense>
  );
}
