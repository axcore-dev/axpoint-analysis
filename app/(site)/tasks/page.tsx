"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { RouteLoading } from "@/components/flow/RouteLoading";
import { api } from "@/lib/api";
import { Badge, Button, Card, Icons, Modal, Tag } from "@/components/ui";

/**
 * 개선 과제 선택 — 원본 카드 UI + 백엔드 실연동.
 * 서버 카탈로그(추천·보유 시스템 대체·담김 여부)를 카드 그리드로 표시하고,
 * 담기 확정 시 PUT으로 저장한 뒤 로드맵으로 이동한다.
 * 카테고리 칩 = ★추천(기본) → 전체 → 업무영역. 이미 갖춰진 과제는 선택 불가.
 * 서버 응답에 없는 데이터(우선 개선 영역 수·착수 조건·비추천 사유)는 렌더하지 않는다.
 */

const mono: CSSProperties = { fontFamily: "var(--font-mono)", letterSpacing: "0" };

type TaskRow = {
  no: number;
  stage: number;
  functionArea: string;
  title: string;
  description: string | null;
  expectedEffect: string | null;
  durationMinMonths: number | null;
  durationMaxMonths: number | null;
  recommended: boolean;
  /** 추천 사유 — 추천 에이전트가 판정 근거를 인용해 쓴다 (에이전트 산출이 없으면 null) */
  recommendReason: string | null;
  coveredBySystem: string | null;
  selected: boolean;
  dependsOn: number[];
  /** 고정 추천 4카드 — 추천 목록 최상단에 고정 표시 */
  pinned: boolean;
  /** 대상 (예: 작업표준서, 점검표) — 고정 카드 하단 2행 표기용 */
  target: string | null;
  /** 서비스 구성 (예: 스캔·OCR·인덱싱) */
  services: string | null;
};

/** 달성 조건 미충족 강등 사유 — 연계 과제(taskNos)는 이미 추천 최상단에 온다 */
type CapReasons = { level: number; reasons: string[]; taskNos: number[] };

function duration(t: TaskRow): string | null {
  if (t.durationMinMonths == null) return null;
  const max = t.durationMaxMonths ?? t.durationMinMonths;
  return t.durationMinMonths === max ? `${max}개월` : `${t.durationMinMonths}~${max}개월`;
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

/* ---------- 과제 카드 ---------- */

/**
 * 과제 카드 — 카드에는 고르는 데 필요한 것만 둔다: 영역·추천 배지 · 제목 · 예상 기간.
 * 설명·기대효과·추천 사유·대상·서비스는 '자세히' 팝업에 있다.
 */
function TaskCard({
  task,
  selected,
  onToggle,
  onDetail,
}: {
  task: TaskRow;
  selected: boolean;
  onToggle: () => void;
  onDetail: () => void;
}) {
  /* 사용 중인 프로그램으로 이미 갖춰짐 — 선택 불가 */
  const disabled = task.coveredBySystem !== null;
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
      {/* 상단: 좌 배지(카테고리·추천만) · 우 원형 체크 */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge tone="neutral">{task.functionArea}</Badge>
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

      {/* 갖춰짐 안내 — 이미 갖춰진 과제만 (착수 조건은 서버에 없어 생략) */}
      {disabled && (
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
          {task.coveredBySystem} 사용 중 — 이미 갖춰져 있어요
        </span>
      )}

      {/* 하단: 예상 기간 · 자세히 (카드 클릭은 담기라 여기서 전파를 끊는다) */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {duration(task) ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              font: "var(--text-caption)",
              color: "var(--fg-tertiary)",
            }}
          >
            <ClockIcon size={13} />
            예상 <span style={{ ...mono, fontWeight: 600 }}>{duration(task)}</span>
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="axp-task-more"
          onClick={(e) => {
            e.stopPropagation();
            onDetail();
          }}
          onKeyDown={(e) => e.stopPropagation()}
          aria-label={`${task.title} 자세히 보기`}
          style={{
            flex: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            border: "none",
            background: "transparent",
            padding: "4px 0 4px 8px",
            font: "var(--text-label-s)",
            fontFamily: "var(--font-sans)",
            color: "var(--fg-tertiary)",
            cursor: "pointer",
            transition: "color var(--dur-fast) var(--ease)",
          }}
        >
          자세히
          <Icons.chevronRight size={14} />
        </button>
      </div>
    </Card>
  );
}

/* ---------- 과제 상세 팝업 (v7) ---------- */

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
      <span
        style={{
          flex: "none",
          width: 64,
          font: "var(--text-label-s)",
          color: "var(--fg-tertiary)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          minWidth: 0,
          font: "var(--text-body3)",
          lineHeight: 1.7,
          color: "var(--fg-secondary)",
        }}
      >
        {children}
      </span>
    </div>
  );
}

function TaskDetailModal({
  task,
  selected,
  onClose,
  onToggle,
}: {
  task: TaskRow | null;
  selected: boolean;
  onClose: () => void;
  onToggle: () => void;
}) {
  const disabled = task?.coveredBySystem != null;
  return (
    <Modal open={task !== null} onClose={onClose} title={task?.title} wide>
      {task && (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Badge tone="neutral">{task.functionArea}</Badge>
            {task.recommended && <Badge tone="accent">★ 추천</Badge>}
            {duration(task) && <Badge tone="outline">예상 {duration(task)}</Badge>}
          </div>

          {task.description && <DetailRow label="개요">{task.description}</DetailRow>}
          {task.expectedEffect && (
            <DetailRow label="기대효과">
              <span style={{ color: "var(--fg-brand)", fontWeight: 600 }}>
                {task.expectedEffect}
              </span>
            </DetailRow>
          )}
          {task.target && <DetailRow label="대상">{task.target}</DetailRow>}
          {task.services && <DetailRow label="서비스">{task.services}</DetailRow>}

          {/* 추천 사유 — 추천 에이전트가 이 기업의 판정 근거를 인용해 쓴다 (없으면 미표시) */}
          {task.recommendReason && (
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: "12px 14px",
                borderRadius: "var(--radius-m)",
                background: "var(--bg-brand-weak)",
              }}
            >
              <span aria-hidden style={{ flex: "none", color: "var(--fg-brand)", marginTop: 2 }}>
                <Icons.check size={13} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    font: "var(--text-label-s)",
                    color: "var(--fg-brand)",
                    marginBottom: 3,
                  }}
                >
                  이 기업에 추천한 이유
                </span>
                <span
                  style={{ font: "var(--text-body3)", lineHeight: 1.7, color: "var(--fg-secondary)" }}
                >
                  {task.recommendReason}
                </span>
              </span>
            </div>
          )}

          {disabled ? (
            <p
              style={{
                margin: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                font: "var(--text-caption)",
                fontWeight: 600,
                color: "var(--fg-success)",
              }}
            >
              <Icons.check size={13} />
              {task.coveredBySystem} 사용 중 — 이미 갖춰져 있어요
            </p>
          ) : (
            <div style={{ marginTop: 4 }}>
              <Button variant={selected ? "secondary" : "primary"} full onClick={onToggle}>
                {selected ? "담기 해제" : "이 과제 담기"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* ---------- 페이지 ---------- */

export default function TasksPage() {
  const router = useRouter();
  const { assessmentId, completedSteps, completeStep } = useDiagnosis();

  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [capReasons, setCapReasons] = useState<CapReasons | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<string>("recommended");
  /** 담을 때 미담긴 선행 과제가 있으면 함께 담기를 제안하는 토스트 */
  const [suggestion, setSuggestion] = useState<{ taskNos: number[] } | null>(null);
  /** '자세히' 팝업 대상 과제 (v7) — 카드에서 뺀 설명·사유·대상·서비스를 여기서 본다 */
  const [detail, setDetail] = useState<TaskRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assessmentId) return;
    api<{ items: TaskRow[]; capReasons?: CapReasons | null }>(
      `/api/assessments/${assessmentId}/tasks`,
    )
      .then(({ items, capReasons }) => {
        setTasks(items);
        setCapReasons(capReasons ?? null);
        setSelected(new Set(items.filter((t) => t.selected).map((t) => t.no)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."));
  }, [assessmentId]);

  /* 추천순 정렬 — 고정 카드 최상단 → 추천 → 나머지. 그룹 안에서는 서버 우선순위 순서 유지 */
  const sorted = useMemo(() => {
    const rank = (t: TaskRow) => (t.pinned ? 0 : t.recommended ? 1 : 2);
    return [...(tasks ?? [])].sort((a, b) => rank(a) - rank(b));
  }, [tasks]);
  const areas = useMemo(() => [...new Set((tasks ?? []).map((t) => t.functionArea))], [tasks]);
  const taskByNo = useMemo(() => new Map((tasks ?? []).map((t) => [t.no, t])), [tasks]);

  /* 가드: 진단 결과 미완료 */
  if (!assessmentId || !completedSteps.includes("result")) {
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
  if (error)
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-[var(--gutter)]">
        <p style={{ font: "var(--text-body1)", color: "var(--fg-tertiary)" }}>{error}</p>
      </div>
    );
  if (!tasks) return <RouteLoading messages={["개선 과제를 불러오고 있어요"]} />;

  const totalCount = tasks.length;
  const recommendedCount = tasks.filter((t) => t.recommended).length;
  const filtered =
    filter === "recommended"
      ? sorted.filter((t) => t.recommended || t.pinned)
      : filter === "all"
        ? sorted
        : sorted.filter((t) => t.functionArea === filter);

  const handleToggle = (task: TaskRow) => {
    if (task.coveredBySystem) return;
    const wasSelected = selected.has(task.no);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(task.no)) next.delete(task.no);
      else next.add(task.no);
      return next;
    });
    if (!wasSelected) {
      /* 담을 때 — 미담긴 선행 과제(선택 가능한 것만)가 있으면 연관 제안 */
      const missing = task.dependsOn.filter((no) => {
        const dep = taskByNo.get(no);
        return dep != null && !dep.coveredBySystem && !selected.has(no);
      });
      if (missing.length > 0) {
        setSuggestion({ taskNos: missing });
      }
    } else if (suggestion) {
      setSuggestion(null);
    }
  };

  /* 담기 확정 — 서버 저장 후 로드맵으로 이동 */
  const goRoadmap = async () => {
    if (!selected.size || saving) return;
    setSaving(true);
    try {
      await api(`/api/assessments/${assessmentId}/tasks`, {
        method: "PUT",
        body: JSON.stringify({ taskNos: [...selected] }),
      });
      completeStep("tasks");
      router.push("/roadmap");
    } catch (e) {
      setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  };

  const count = selected.size;
  const overLimit = count >= 4;
  const suggestionTitles = suggestion
    ? suggestion.taskNos
        .map((no) => taskByNo.get(no)?.title)
        .filter(Boolean)
        .join("’, ‘")
    : "";

  return (
    <div className="ax-step-enter" style={{ padding: "40px var(--gutter) 200px" }}>
      <style>{`
        .axp-task-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        @media (max-width: 980px) { .axp-task-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { .axp-task-grid { grid-template-columns: 1fr; } }
        .axp-task-more:hover { color: var(--fg-brand); }
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

          {/* 큰 숫자 요약 — 서버에서 받은 추천 과제 수 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 36px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span
                style={{
                  ...mono,
                  fontSize: 30,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: "var(--fg-primary)",
                }}
              >
                {recommendedCount}
              </span>
              <span style={{ font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                개 추천 과제
              </span>
            </div>
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

        {/* ---- 카테고리 칩 — ★추천 맨 앞 + 업무영역 ---- */}
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
            <span style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{recommendedCount}</span>
          </Tag>
          <Tag selected={filter === "all"} onClick={() => setFilter("all")}>
            전체 <span style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{totalCount}</span>
          </Tag>
          {areas.map((a) => (
            <Tag key={a} selected={filter === a} onClick={() => setFilter(a)}>
              {a}{" "}
              <span style={{ ...mono, fontSize: 13, fontWeight: 600 }}>
                {tasks.filter((t) => t.functionArea === a).length}
              </span>
            </Tag>
          ))}
        </Card>

        {/* ---- 안내 배너 — 달성 조건 미충족 강등 사유 (연계 과제는 이미 추천 최상단) ---- */}
        {capReasons && capReasons.reasons.length > 0 && (
          <Card
            radius="2xl"
            style={{
              background: "var(--bg-warning-weak)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                font: "var(--text-label-m)",
                fontWeight: 700,
                color: "var(--fg-warning)",
              }}
            >
              <span style={{ flex: "none", display: "inline-flex" }}>
                <Icons.alert size={15} />
              </span>
              우선 해결 과제
            </span>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
              {capReasons.reasons.map((r) => (
                <li key={r} style={{ font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                  {r}
                </li>
              ))}
            </ul>
            <p style={{ margin: 0, font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
              아래 추천 과제부터 담는 것을 권해요
            </p>
          </Card>
        )}

        {/* ---- 카드 그리드 ---- */}
        <div className="axp-task-grid">
          {filtered.map((t) => (
            <TaskCard
              key={t.no}
              task={t}
              selected={selected.has(t.no)}
              onToggle={() => handleToggle(t)}
              onDetail={() => setDetail(t)}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <p
            style={{
              font: "var(--text-body2)",
              color: "var(--fg-quaternary)",
              textAlign: "center",
              margin: "32px 0",
            }}
          >
            이 카테고리에는 과제가 없어요.
          </p>
        )}
      </div>

      {/* ---- 과제 상세 팝업 — 카드에서 뺀 설명·기대효과·추천 사유·대상·서비스 (v7) ---- */}
      <TaskDetailModal
        task={detail}
        selected={detail ? selected.has(detail.no) : false}
        onClose={() => setDetail(null)}
        onToggle={() => {
          if (detail) handleToggle(detail);
          setDetail(null);
        }}
      />

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
                    setSelected((prev) => {
                      const next = new Set(prev);
                      suggestion.taskNos.forEach((no) => next.add(no));
                      return next;
                    });
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

          {/* 담기 바 — 밝은 서피스 + 그림자 구분 */}
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
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    lineHeight: 1.3,
                    color: "var(--fg-primary)",
                  }}
                >
                  과제 <span style={{ ...mono }}>{count}</span>개 담음
                </span>
                {/* 초과 경고 — 담음 카운트 바로 오른쪽 */}
                {overLimit && (
                  <span
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
                  </span>
                )}
              </div>
              <div style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                정부 지원사업 1회 신청 단위: 2~3개
              </div>
            </div>
            <div
              style={{
                flex: "none",
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {/* 2개 이상 담으면 모두 해제 노출 */}
              {count >= 2 && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setSelected(new Set());
                    setSuggestion(null);
                  }}
                >
                  모두 해제
                </Button>
              )}
              <Button
                variant="primary"
                size="lg"
                onClick={goRoadmap}
                disabled={count === 0 || saving}
              >
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
