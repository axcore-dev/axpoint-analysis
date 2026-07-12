"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import * as Collapsible from "@radix-ui/react-collapsible";

import {
  Badge,
  Button,
  Card,
  DotStepper,
  Icons,
  Loader,
  Modal,
  TermTooltip,
} from "@/components/ui";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";

import { computeOverall, mapLevel, sortAxesByScore } from "@/lib/scoring/engine";
import type {
  AreaAssessment,
  AxisId,
  AxisScore,
  CompanyStat,
  EvidenceKind,
  EvidenceRef,
  FunctionAreaId,
} from "@/lib/types";
import { AXES, INDUSTRY_AVG, LEVELS, areaName } from "@/data/rubric/meta";
import { rubricQuestions } from "@/data/rubric/questions";
import { judgments } from "@/data/scenario/judgments";
import { areaAssessments } from "@/data/scenario/areas";
import { valueChainAnalysis } from "@/data/scenario/valueChain";
import { uploadedDocs } from "@/data/scenario/documents";
import { companyStats, demoCompany } from "@/data/scenario/company";
import { publicSources } from "@/data/scenario/publicData";
import { getGlossary } from "@/data/glossary";
import {
  axisFindings,
  comprehensiveAnalysis,
  strategyType,
} from "@/data/scenario/narrative";

/* ============================================================
   S2 진단 결과 — 2026-07-09 수정요청v1 전면 재작성
   - 점수는 전부 computeOverall(judgments) 런타임 계산 (하드코딩 금지)
   - 라이트 연속 흐름 (다크 히어로 폐지), 콘텐츠 max-width 1080px
   - 섹션: 기업 개요·현재 단계 → 카테고리별 준비도 → 8영역 →
     가치사슬 → 종합 분석 결과 (권고 확인 섹션은 폐지)
   ============================================================ */

const mono: CSSProperties = { fontFamily: "var(--font-mono)" };
const clamp2: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/** 점수 표기 — 소수 1자리까지 (정수는 정수로) */
function fmtScore(n: number | null): string {
  if (n === null) return "—";
  return String(Math.round(n * 10) / 10);
}

const KIND_LABEL: Record<EvidenceKind, string> = {
  upload: "업로드",
  public: "공개 데이터",
  hitl: "확인 응답",
};

/** 근거를 출처 텍스트로 — "업로드 · 3월 생산일지 — "종이 양식에…"" */
function EvidenceTextList({ items }: { items: EvidenceRef[] }) {
  if (items.length === 0) return null;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
      {items.map((e, i) => (
        <li
          key={`${e.refId}-${i}`}
          style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg-tertiary)" }}
        >
          <span style={{ fontWeight: 600, color: "var(--fg-secondary)" }}>
            {KIND_LABEL[e.kind]} · {e.label}
          </span>
          {e.snippet && <> — &ldquo;{e.snippet}&rdquo;</>}
        </li>
      ))}
    </ul>
  );
}

/* ---- 콘텐츠 래퍼 (max 1080px) ---- */
function Inner({ children }: { children: ReactNode }) {
  return <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>{children}</div>;
}

function SectionHead({
  label,
  title,
  sub,
}: {
  label: string;
  title: string;
  sub?: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 24 }}>
      <div style={{ font: "var(--text-label-s)", color: "var(--fg-brand)", marginBottom: 8 }}>
        {label}
      </div>
      <h3
        style={{
          margin: 0,
          font: "var(--text-h3)",
          letterSpacing: "var(--track-heading)",
          color: "var(--fg-primary)",
        }}
      >
        {title}
      </h3>
      {sub && (
        <p style={{ margin: "8px 0 0", font: "var(--text-body3)", color: "var(--fg-tertiary)" }}>
          {sub}
        </p>
      )}
    </header>
  );
}

/* ============================================================
   섹션 2 보조 — 레이더 차트 (호버 점수 툴팁 + 축 클릭 선택)
   ============================================================ */
function RadarChart({
  axes,
  selected,
  onSelect,
}: {
  axes: AxisScore[];
  selected: AxisId | null;
  onSelect: (id: AxisId) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const cx = 180;
  const cy = 168;
  const R = 114;

  const pt = (i: number, v: number): [number, number] => {
    const ang = (Math.PI / 180) * (-90 + i * 60);
    return [cx + R * (v / 100) * Math.cos(ang), cy + R * (v / 100) * Math.sin(ang)];
  };
  const poly = (vals: number[]) =>
    vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");

  const ownVals = axes.map((a) => a.score ?? 0);
  const avgVals = axes.map((a) => a.industryAvg);

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox="0 0 360 336"
        role="img"
        aria-label={`카테고리별 준비도 차트 — 자사 점수와 평균 비교. ${axes
          .map((a) => `${a.name} ${fmtScore(a.score)}점(평균 ${a.industryAvg}점)`)
          .join(", ")}`}
        style={{ width: "100%", maxWidth: 460, display: "block", margin: "0 auto" }}
      >
        {/* 그리드 링 */}
        {[25, 50, 75, 100].map((v) => (
          <polygon
            key={v}
            points={poly(axes.map(() => v))}
            fill="none"
            stroke={v === 100 ? "var(--grey-200)" : "var(--grey-100)"}
            strokeWidth={1}
          />
        ))}
        {/* 스포크 */}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 100);
          const isSel = selected === a.axis;
          return (
            <line
              key={a.axis}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={isSel ? "var(--blue-100)" : "var(--grey-100)"}
              strokeWidth={isSel ? 1.5 : 1}
            />
          );
        })}
        {/* 선택 축 그라데이션 — 선택 꼭짓점은 블루 유지, 멀어질수록 회색 (v3) */}
        {selected !== null &&
          (() => {
            const selIdx = axes.findIndex((a) => a.axis === selected);
            if (selIdx < 0) return null;
            const [sx, sy] = pt(selIdx, ownVals[selIdx]);
            return (
              <defs>
                <radialGradient
                  id="ax-radar-sel"
                  gradientUnits="userSpaceOnUse"
                  cx={sx}
                  cy={sy}
                  r={R * 2.1}
                >
                  <stop offset="0%" stopColor="var(--blue-500)" />
                  <stop offset="55%" stopColor="var(--grey-400)" />
                  <stop offset="100%" stopColor="var(--grey-400)" />
                </radialGradient>
              </defs>
            );
          })()}
        {/* 평균 — 회색 점선 */}
        <polygon
          points={poly(avgVals)}
          fill="none"
          stroke="var(--grey-400)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeLinejoin="round"
        />
        {/* 자사 — 선택 없으면 블루, 선택 시 그라데이션 (전환 시 부드러운 페이드) */}
        <g key={selected ?? "none"} style={{ animation: "ax-fade-in var(--dur-slow) var(--ease)" }}>
          <polygon
            points={poly(ownVals)}
            fill={selected ? "url(#ax-radar-sel)" : "var(--blue-500)"}
            fillOpacity={0.12}
            stroke={selected ? "url(#ax-radar-sel)" : "var(--blue-500)"}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </g>
        {/* 꼭짓점 도트 (호버 툴팁 + 클릭 선택) */}
        {ownVals.map((v, i) => {
          const [x, y] = pt(i, v);
          const isSel = selected === axes[i].axis;
          const dimmed = selected !== null && !isSel;
          return (
            <g key={axes[i].axis}>
              <circle
                cx={x}
                cy={y}
                r={isSel || hover === i ? 5 : 3.5}
                fill={dimmed ? "var(--grey-400)" : "var(--blue-500)"}
                stroke="var(--white)"
                strokeWidth={1.5}
                style={{
                  transition:
                    "r var(--dur-base) var(--ease), fill var(--dur-base) var(--ease)",
                }}
              />
              {/* 히트 영역 */}
              <circle
                cx={x}
                cy={y}
                r={13}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(axes[i].axis)}
                role="button"
                aria-label={`${axes[i].name} ${fmtScore(axes[i].score)}점 — 상세 보기`}
              />
            </g>
          );
        })}
        {/* 축 라벨 — 호버·선택 시 부드러운 강조 (v3) */}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 118);
          const short = AXES.find((m) => m.id === a.axis)?.short ?? a.axis;
          const anchor = i === 0 || i === 3 ? "middle" : i === 1 || i === 2 ? "start" : "end";
          const dy = i === 0 ? -8 : i === 3 ? 16 : 4;
          const isSel = selected === a.axis;
          const isHover = hover === i;
          return (
            <text
              key={a.axis}
              x={x}
              y={y + dy}
              textAnchor={anchor}
              fontSize={12.5}
              fontWeight={isSel || isHover ? 700 : 600}
              fill={isSel || isHover ? "var(--blue-500)" : "var(--grey-700)"}
              fontFamily="var(--font-sans)"
              letterSpacing="-0.01em"
              style={{ cursor: "pointer", transition: "fill var(--dur-base) var(--ease)" }}
              onClick={() => onSelect(a.axis)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              role="button"
              aria-label={`${a.name} 상세 보기`}
            >
              {short}
            </text>
          );
        })}
        {/* 호버 툴팁 — 2줄(자사/평균), 평균은 회색 저채도 (v4) */}
        {hover !== null &&
          (() => {
            const ownLine = `자사 ${fmtScore(axes[hover].score)}`;
            const avgLine = `평균 ${axes[hover].industryAvg}`;
            const [x, y] = pt(hover, ownVals[hover]);
            const w = Math.max(ownLine.length, avgLine.length) * 7 + 22;
            const h = 40;
            const tx = Math.min(Math.max(x, w / 2 + 4), 360 - w / 2 - 4);
            const ty = Math.max(y - h - 10, 4);
            return (
              <g
                pointerEvents="none"
                style={{ animation: "ax-fade-in var(--dur-base) var(--ease)" }}
              >
                <rect
                  x={tx - w / 2}
                  y={ty}
                  width={w}
                  height={h}
                  rx={6}
                  fill="var(--bg-elevated)"
                  stroke="var(--line-default)"
                  strokeWidth={1}
                  style={{ filter: "drop-shadow(0 2px 6px rgba(2,9,19,0.1))" }}
                />
                <text
                  x={tx - w / 2 + 11}
                  y={ty + 16}
                  textAnchor="start"
                  fontSize={11}
                  fontWeight={600}
                  fill="var(--fg-primary)"
                  fontFamily="var(--font-mono)"
                >
                  {ownLine}
                </text>
                <text
                  x={tx - w / 2 + 11}
                  y={ty + 31}
                  textAnchor="start"
                  fontSize={11}
                  fontWeight={500}
                  fill="var(--grey-500)"
                  fontFamily="var(--font-mono)"
                >
                  {avgLine}
                </text>
              </g>
            );
          })()}
      </svg>
      <figcaption
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          marginTop: 12,
          font: "var(--text-caption)",
          color: "var(--fg-tertiary)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <svg width="22" height="10" aria-hidden="true">
            <rect
              x="1"
              y="1"
              width="20"
              height="8"
              rx="2"
              fill="rgba(10,80,255,0.12)"
              stroke="var(--blue-500)"
              strokeWidth="1.5"
            />
          </svg>
          자사
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <svg width="22" height="10" aria-hidden="true">
            <line
              x1="1"
              y1="5"
              x2="21"
              y2="5"
              stroke="var(--grey-400)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          </svg>
          평균 (중소 금속가공 표본)
        </span>
      </figcaption>
    </figure>
  );
}

/* ---- 프로그레스바 (자사 채움 + 평균 위치 점선 마커, 평균 미달 = 저채도 주황 v3) ---- */
function ScoreBar({ score, avg }: { score: number; avg: number }) {
  const belowAvg = score < avg;
  return (
    <div style={{ position: "relative", padding: "22px 0 20px" }}>
      <div
        style={{
          height: 8,
          borderRadius: "var(--radius-full)",
          background: "var(--grey-100)",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <div
          style={{
            width: `${Math.max(0, Math.min(100, score))}%`,
            height: "100%",
            borderRadius: "var(--radius-full)",
            background: belowAvg ? "var(--orange-muted)" : "var(--blue-500)",
            transition: "width var(--dur-slow) var(--ease), background-color var(--dur-base) var(--ease)",
          }}
        />
      </div>
      {/* 평균 마커 — 세로 점선 + 상단 "평균" / 하단 점수 */}
      <div
        style={{
          position: "absolute",
          left: `${Math.max(0, Math.min(100, avg))}%`,
          top: 0,
          bottom: 0,
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
        aria-label={`평균 ${avg}점`}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--grey-500)", lineHeight: 1 }}>
          평균
        </span>
        <span
          style={{
            flex: 1,
            width: 0,
            borderLeft: "1.5px dashed var(--grey-400)",
            margin: "3px 0",
          }}
        />
        <span style={{ ...mono, fontSize: 11, color: "var(--grey-500)", lineHeight: 1 }}>{avg}</span>
      </div>
    </div>
  );
}

/* ============================================================
   섹션 3 보조 — 관리 대상 인과 체인 (장비.png 문법, 화면 로컬 상수)
   시나리오 정합: areas.ts asIs · valueChain.ts 신호와 일치
   ============================================================ */
const CAUSE_CHAINS: Partial<Record<FunctionAreaId, string[]>> = {
  production: ["수기 기록 4회 재입력", "이관 오류·수량 불일치", "월 집계 반나절", "현황 파악 지연"],
  logistics: ["품목 표기 제각각", "재고 대사 불가", "감(感) 발주", "과잉 재고 2.5주치"],
  quality: ["불량 사유 미기록", "원인 분석 불가", "같은 불량 반복", "클레임 대응 지연"],
};

function CauseChain({ steps }: { steps: string[] }) {
  const last = steps.length - 1;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        padding: "4px 0",
      }}
    >
      {steps.map((s, i) => (
        <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {i > 0 && (
            <span style={{ display: "inline-flex", color: "var(--grey-400)" }} aria-hidden="true">
              <Icons.arrow size={13} />
            </span>
          )}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 14px",
              borderRadius: "var(--radius-s)",
              fontSize: 13,
              lineHeight: 1.35,
              ...(i === 0
                ? {
                    background: "var(--bg-danger-weak)",
                    color: "var(--fg-danger)",
                    fontWeight: 600,
                  }
                : i === last
                  ? {
                      background: "var(--bg-base)",
                      border: "1px solid var(--line-strong)",
                      color: "var(--fg-primary)",
                      fontWeight: 700,
                    }
                  : {
                      background: "var(--bg-tertiary)",
                      color: "var(--fg-secondary)",
                    }),
            }}
          >
            {s}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ============================================================
   섹션 4 보조 — 품목별 재고 흐름 표 (가치사슬.png 문법, 화면 로컬 상수)
   vc2 신호와 정합: 브라켓 B-102 계열 과잉(회전 0.3회) · 발주점 부재
   ============================================================ */
type StockTone = "danger" | "warning" | "success";
const STOCK_ROWS: {
  item: string;
  stock: string;
  safety: string;
  daily: string;
  days: number;
  tone: StockTone;
  turn: string;
  action: string;
  actionTone: "danger" | "strong" | "plain";
  /** 이 행이 근거가 되는 가치사슬 신호 id — 태그 호버 시 하이라이트 (v4) */
  signals: string[];
}[] = [
  { item: "기어 D", stock: "15", safety: "80", daily: "5", days: 3, tone: "danger", turn: "1.4회", action: "즉시 발주", actionTone: "danger", signals: ["vc3"] },
  { item: "샤프트 B", stock: "40", safety: "120", daily: "8", days: 5, tone: "danger", turn: "1.1회", action: "즉시 발주", actionTone: "danger", signals: ["vc3"] },
  { item: "핀 F", stock: "60", safety: "150", daily: "9", days: 7, tone: "warning", turn: "0.9회", action: "이번 주 발주", actionTone: "strong", signals: [] },
  { item: "하우징 C", stock: "560", safety: "400", daily: "22", days: 25, tone: "success", turn: "0.4회", action: "정상", actionTone: "plain", signals: [] },
  { item: "브라켓 B-102", stock: "1,240", safety: "800", daily: "45", days: 27, tone: "success", turn: "0.3회", action: "정상 · 과잉 주의", actionTone: "strong", signals: ["vc1", "vc2"] },
];

const STOCK_TONE_COLOR: Record<StockTone, string> = {
  danger: "var(--fg-danger)",
  warning: "var(--fg-warning)",
  success: "var(--fg-success)",
};

/* ============================================================
   페이지
   ============================================================ */
export default function ResultPage() {
  const router = useRouter();
  const { companyInput, completedSteps, completeStep } = useDiagnosis();

  /* ---- 점수: 전부 런타임 계산 ---- */
  const overall = useMemo(() => computeOverall(judgments), []);
  const judgmentById = useMemo(() => new Map(judgments.map((j) => [j.questionId, j])), []);
  const axisById = useMemo(
    () => new Map(overall.axes.map((a) => [a.axis, a])),
    [overall],
  );
  const axesByBottleneck = useMemo(() => sortAxesByScore(overall.axes), [overall]);

  /* ---- 화면 상태 ---- */
  const [ready, setReady] = useState(false);
  const [selectedAxis, setSelectedAxis] = useState<AxisId | null>(null);
  const [showAllAxes, setShowAllAxes] = useState(false);
  const [basisAxis, setBasisAxis] = useState<AxisId | null>(null);
  const [statDetail, setStatDetail] = useState<CompanyStat | null>(null);
  const [chainArea, setChainArea] = useState<AreaAssessment | null>(null);
  /** 가치사슬 신호 아코디언 — 디폴트 접힘 (v3) */
  const [vcOpen, setVcOpen] = useState(false);
  /** 호버 중인 가치사슬 신호 태그 — 표의 관련 행을 브랜드 컬러로 연동 (v4) */
  const [hoverSignal, setHoverSignal] = useState<string | null>(null);
  const statRowRef = useRef<HTMLDivElement>(null);

  const collectDone = completedSteps.includes("collect");
  const resultDone = completedSteps.includes("result");

  /* 최초 진입 시 약 2초 로딩 — 재방문(result 완료)이면 생략 */
  useEffect(() => {
    if (!collectDone) return;
    if (resultDone) {
      setReady(true);
      return;
    }
    const t = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(t);
  }, [collectDone, resultDone]);

  /* ---- 가드: 자료 정리(collect) 미완료 ---- */
  if (!collectDone) {
    return (
      <Inner>
        <Card
          radius="2xl"
          style={{ maxWidth: 560, margin: "64px auto", padding: "40px 36px", textAlign: "center" }}
        >
          <div style={{ font: "var(--text-label-s)", color: "var(--fg-brand)", marginBottom: 12 }}>
            진단 결과
          </div>
          <h1
            style={{
              margin: "0 0 12px",
              font: "var(--text-h2)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            아직 진단 결과가 준비되지 않았어요
          </h1>
          <p style={{ margin: "0 0 24px", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
            자료 정리 단계를 마치면 업로드 자료·공개 데이터·확인 응답을 근거로 진단 결과가
            만들어져요.
          </p>
          <Button variant="primary" href="/collect">
            자료 정리로 돌아가기
          </Button>
        </Card>
      </Inner>
    );
  }

  /* ---- 로딩 (약 2초) ---- */
  if (!ready) {
    return (
      <div
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <Loader style={{ color: "var(--fg-brand)" }} />
        <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
          방금 정리된 자료를 기준으로 진단하고 있어요
        </p>
      </div>
    );
  }

  const companyName = companyInput.trim() || demoCompany.name;
  const foundedYear = new Date(demoCompany.established).getFullYear();
  const yearsInBusiness = new Date().getFullYear() - foundedYear;
  const region = demoCompany.address.split(" ").slice(0, 2).join(" ");

  /* 목표 단계 = 현재 +1 (최대 Lv.5) */
  const currentIdx = overall.level.level - 1;
  const targetIdx = Math.min(currentIdx + 1, LEVELS.length - 1);

  /* 업종 평균 위치 — INDUSTRY_AVG 평균을 mapLevel로 환산 */
  const industryAvgScore =
    Object.values(INDUSTRY_AVG).reduce((a, b) => a + b, 0) / Object.values(INDUSTRY_AVG).length;
  const industryLevel = mapLevel(industryAvgScore);

  const stepperSteps = LEVELS.map((l, i) => ({
    label: l.label,
    sub: i === targetIdx ? "목표 단계" : undefined,
  }));

  /** 축 선택 — 같은 축 재클릭 시 해제 (v4) */
  const selectAxis = (id: AxisId) => {
    setSelectedAxis((prev) => (prev === id ? null : id));
    setShowAllAxes(false);
  };

  const goTasks = () => {
    completeStep("result");
    router.push("/tasks");
  };

  const basisScore = basisAxis ? axisById.get(basisAxis) : undefined;
  const basisQuestions = basisAxis ? rubricQuestions.filter((q) => q.axis === basisAxis) : [];
  const statSource = statDetail?.sourceId
    ? publicSources.find((s) => s.id === statDetail.sourceId)
    : undefined;

  const selectedScore = selectedAxis ? axisById.get(selectedAxis) : undefined;

  return (
    <div className="ax-step-enter" style={{ background: "var(--bg-base)" }}>
      {/* ================= 섹션 1 — 기업 개요 + 현재 단계 (통합 카드, v3) ================= */}
      <section style={{ padding: "40px 0 12px" }}>
        <Inner>
          <div style={{ display: "grid", gap: 16 }}>
            <Card radius="2xl" style={{ padding: 28 }}>
              {/* 기업 식별 */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
                <h2
                  style={{
                    margin: 0,
                    font: "var(--text-title1)",
                    letterSpacing: "var(--track-heading)",
                    color: "var(--fg-primary)",
                  }}
                >
                  {companyName}
                </h2>
                <span style={{ ...mono, fontSize: 13, color: "var(--grey-500)" }}>
                  {demoCompany.bizNo}
                </span>
              </div>
              <p style={{ margin: "8px 0 0", font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                대표 {demoCompany.ceo} · 설립 <span style={mono}>{foundedYear}</span>년 (업력{" "}
                <span style={mono}>{yearsInBusiness}</span>년) · {region} ·{" "}
                {demoCompany.infoSource}
              </p>

              {/* 현재 단계 — 라벨 · 큰 레벨 · 서브 (v4) */}
              <div style={{ marginTop: 30 }}>
                <div style={{ font: "var(--text-label-s)", color: "var(--fg-tertiary)" }}>
                  현재
                </div>
                <h3
                  style={{
                    margin: "8px 0 0",
                    font: "var(--text-display2)",
                    letterSpacing: "var(--track-display)",
                    color: "var(--fg-primary)",
                  }}
                >
                  <b style={{ color: "var(--fg-brand)" }}>Lv.{overall.level.level}</b>{" "}
                  {overall.level.label.replace(/^Lv\.\d+\s*/, "")}
                </h3>
                <p
                  style={{
                    margin: "10px 0 0",
                    font: "var(--text-body2)",
                    color: "var(--fg-secondary)",
                  }}
                >
                  업종 평균(Lv.{industryLevel.level})
                  {overall.level.level === industryLevel.level
                    ? "과 비슷한"
                    : overall.level.level > industryLevel.level
                      ? "보다 높은"
                      : "보다 낮은"}{" "}
                  수준이에요
                </p>
                <DotStepper
                  steps={stepperSteps}
                  current={currentIdx}
                  target={targetIdx}
                  style={{ marginTop: 28 }}
                />
              </div>

              {/* 연한 구분선 + 통계 칩 */}
              <div
                style={{
                  position: "relative",
                  marginTop: 28,
                  paddingTop: 24,
                  borderTop: "1px solid var(--line-subtle)",
                }}
              >
                <div
                  ref={statRowRef}
                  style={{
                    display: "flex",
                    gap: 10,
                    overflowX: "auto",
                    paddingRight: 48,
                    scrollbarWidth: "none",
                  }}
                >
                  {companyStats.map((stat) => (
                    <button
                      key={stat.id}
                      type="button"
                      onClick={() => setStatDetail(stat)}
                      style={{
                        flex: "none",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 5,
                        minWidth: 136,
                        boxSizing: "border-box",
                        padding: "12px 18px",
                        borderRadius: "var(--radius-l)",
                        border: "1px solid var(--line-default)",
                        background: "var(--bg-base)",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                        whiteSpace: "nowrap",
                        transition: "background-color var(--dur-fast) var(--ease)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--grey-50)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "var(--bg-base)";
                      }}
                      aria-label={`${stat.label} ${stat.value} — 상세 보기`}
                    >
                      <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>
                        {stat.label}
                        {stat.basis ? ` (${stat.basis})` : ""}
                      </span>
                      <span style={{ ...mono, fontSize: 15, fontWeight: 600, color: "var(--fg-primary)" }}>
                        {stat.value}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => statRowRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
                  aria-label="통계 칩 더 보기"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    border: "1px solid var(--line-default)",
                    background: "var(--bg-elevated)",
                    boxShadow: "var(--shadow-1)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--grey-600)",
                    cursor: "pointer",
                  }}
                >
                  <Icons.chevronRight size={16} />
                </button>
              </div>
            </Card>

            {/* 뭐부터 해야 할지 — 별도 블록 (v4: 섹션 분리) */}
            <Card radius="2xl" style={{ padding: "22px 28px" }}>
              <div style={{ font: "var(--text-label-s)", color: "var(--fg-brand)" }}>
                지금 당장은
              </div>
              <p
                style={{
                  margin: "8px 0 0",
                  font: "var(--text-title1)",
                  letterSpacing: "var(--track-heading)",
                  color: "var(--fg-primary)",
                }}
              >
                품목 코드 표준화 · 재고·발주점 자동 알림
              </p>
              <p
                style={{
                  margin: "6px 0 0",
                  font: "var(--text-body3)",
                  color: "var(--fg-tertiary)",
                }}
              >
                보유하신 자료로 바로 시작할 수 있어요
              </p>
            </Card>
          </div>
        </Inner>
      </section>

      {/* ================= 섹션 2 — 카테고리별 준비도 ================= */}
      <section style={{ padding: "56px 0" }}>
        <Inner>
          <SectionHead label="카테고리별 준비도" title="어디가 강하고, 어디가 병목일까요" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 32,
              alignItems: "start",
            }}
          >
            {/* 좌 — 레이더 */}
            <RadarChart axes={overall.axes} selected={selectedAxis} onSelect={selectAxis} />

            {/* 우 — 상세 카드 (모두 보기 버튼은 카드 밖 우측, v3) */}
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAllAxes((v) => !v);
                    setSelectedAxis(null);
                  }}
                >
                  {showAllAxes ? "접기" : "모두 보기"}
                </Button>
              </div>
              {showAllAxes ? (
                /* 전체 보기 — 상세 카드 대신 6개 카드 그대로 노출 (v4: 박스인박스 제거) */
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                    gap: 12,
                  }}
                >
                  {axesByBottleneck.map((a) => (
                    <Card key={a.axis} radius="l" style={{ padding: "16px 18px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <span style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                          {a.name}
                        </span>
                        <span style={{ ...mono, fontSize: 17, fontWeight: 600, color: "var(--fg-primary)" }}>
                          {fmtScore(a.score)}
                          <span style={{ fontSize: 11, fontWeight: 400, color: "var(--grey-400)" }}>점</span>
                        </span>
                      </div>
                      <ScoreBar score={a.score ?? 0} avg={a.industryAvg} />
                      <p
                        style={{
                          margin: 0,
                          font: "var(--text-body3)",
                          color: "var(--fg-tertiary)",
                          ...clamp2,
                        }}
                      >
                        {axisFindings[a.axis]}
                      </p>
                      <div style={{ marginTop: 10 }}>
                        <Button variant="secondary" size="sm" onClick={() => setBasisAxis(a.axis)}>
                          점수 근거
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
              <Card radius="2xl" style={{ padding: 26 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {selectedAxis && (
                  <button
                    type="button"
                    aria-label="요약으로 돌아가기"
                    onClick={() => setSelectedAxis(null)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      margin: "-2px 0 -2px -6px",
                      border: "none",
                      borderRadius: "var(--radius-s)",
                      background: "transparent",
                      color: "var(--fg-tertiary)",
                      cursor: "pointer",
                      transition: "background-color var(--dur-fast) var(--ease)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--hover-overlay)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span aria-hidden style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
                      <Icons.chevronRight size={16} />
                    </span>
                  </button>
                )}
                <strong
                  style={{
                    font: "var(--text-title1)",
                    letterSpacing: "var(--track-heading)",
                    color: "var(--fg-primary)",
                  }}
                >
                  {selectedAxis && selectedScore ? selectedScore.name : "AX 진단 결과 상세"}
                </strong>
              </div>

              {selectedAxis && selectedScore ? (
                /* 카테고리 선택 상태 */
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ ...mono, fontSize: 32, fontWeight: 700, color: "var(--fg-primary)" }}>
                      {fmtScore(selectedScore.score)}
                    </span>
                    <span style={{ font: "var(--text-body3)", color: "var(--grey-400)" }}>/ 100점</span>
                  </div>
                  <ScoreBar
                    score={selectedScore.score ?? 0}
                    avg={selectedScore.industryAvg}
                  />
                  <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
                    {axisFindings[selectedAxis]}
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                    <Button variant="secondary" size="sm" onClick={() => setBasisAxis(selectedAxis)}>
                      점수 근거
                    </Button>
                  </div>
                </div>
              ) : (
                /* 기본 상태 — 요약 */
                <div style={{ display: "grid", gap: 14 }}>
                  <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
                    여섯 카테고리 평균이 종합 <span style={{ ...mono, fontWeight: 600 }}>{overall.score}</span>
                    점이에요. 분포는 &ldquo;{overall.balanceLabel}&rdquo; 유형으로, 강점과 병목이
                    뚜렷하게 갈려요.
                  </p>
                  {/* 종합 점수 vs 업종 평균 비교 (v4) */}
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ ...mono, fontSize: 28, fontWeight: 700, color: "var(--fg-primary)" }}>
                        {overall.score}
                      </span>
                      <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>종합</span>
                      <span
                        style={{
                          ...mono,
                          fontSize: 16,
                          fontWeight: 600,
                          color: "var(--grey-500)",
                          marginLeft: "auto",
                        }}
                      >
                        {Math.round(industryAvgScore)}
                      </span>
                      <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>
                        업종 평균
                      </span>
                    </div>
                    <ScoreBar score={overall.score} avg={Math.round(industryAvgScore)} />
                  </div>
                  <div>
                    <Badge tone="accent">전략 유형 · {strategyType.label}</Badge>
                    <p style={{ margin: "8px 0 0", font: "var(--text-body3)", color: "var(--fg-tertiary)" }}>
                      {strategyType.description}
                    </p>
                  </div>
                  <div style={{ display: "grid", gap: 8, paddingTop: 6, borderTop: "1px solid var(--line-subtle)" }}>
                    <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                      <strong style={{ color: "var(--fg-danger)", fontWeight: 600 }}>병목</strong> ·{" "}
                      {overall.bottlenecks
                        .map((id) => {
                          const a = axisById.get(id);
                          return `${a?.name} ${fmtScore(a?.score ?? null)}점`;
                        })
                        .join(" · ")}{" "}
                      — 여기부터 채우면 효과가 빨라요.
                    </p>
                    <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                      <strong style={{ color: "var(--fg-success)", fontWeight: 600 }}>강점</strong> ·{" "}
                      {overall.strengths
                        .map((id) => {
                          const a = axisById.get(id);
                          return `${a?.name} ${fmtScore(a?.score ?? null)}점`;
                        })
                        .join(" · ")}{" "}
                      — 도입을 감당할 체력이에요.
                    </p>
                  </div>
                  <p style={{ margin: 0, font: "var(--text-caption)", color: "var(--grey-500)" }}>
                    왼쪽 차트의 카테고리 이름이나 점을 눌러 보세요.
                  </p>
                </div>
              )}
              </Card>
              )}
            </div>
          </div>
        </Inner>
      </section>

      {/* ================= 섹션 3 — 8영역 (은은한 밴드) ================= */}
      <section style={{ background: "var(--bg-secondary)", padding: "56px 0" }}>
        <Inner>
          <SectionHead
            label="기능영역"
            title="기능영역별 현재 상태"
            sub="점수 대신 등급으로 표기해요."
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 12,
            }}
          >
            {[...areaAssessments]
              .sort((a, b) => a.priority - b.priority)
              .map((area) => {
                const gradeMeta =
                  area.grade === "critical"
                    ? { label: "관리 대상", tone: "danger" as const }
                    : area.grade === "normal"
                      ? { label: "보통", tone: "neutral" as const }
                      : area.grade === "strength"
                        ? { label: "강점", tone: "success" as const }
                        : { label: "판단 보류", tone: "outline" as const };
                return (
                  <Card
                    key={area.areaId}
                    radius="l"
                    style={{
                      padding: "18px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                        {areaName(area.areaId)}
                      </strong>
                      <Badge tone={gradeMeta.tone}>{gradeMeta.label}</Badge>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        font: "var(--text-body3)",
                        color: "var(--fg-secondary)",
                        minHeight: 39,
                        ...clamp2,
                      }}
                    >
                      {area.grade === "hold" && area.holdReason ? area.holdReason : area.asIs}
                    </p>
                    {area.grade === "critical" && (
                      <div style={{ marginTop: "auto" }}>
                        <Button variant="secondary" size="sm" onClick={() => setChainArea(area)}>
                          사유 보기
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
          </div>
        </Inner>
      </section>

      {/* ============ 섹션 4 — 종합 분석 결과 (가치사슬 신호 통합, v3) ============ */}
      <section style={{ padding: "56px 0 80px" }}>
        <Inner>
          <SectionHead label="종합 분석" title="종합 분석 결과" />

          {/* 가치사슬 신호 — 아코디언 (Radix Collapsible, 디폴트 접힘), 신호는 #태그로만 */}
          {valueChainAnalysis.available && (
            <Card radius="2xl" padded={false} style={{ overflow: "hidden", marginBottom: 16 }}>
              <Collapsible.Root open={vcOpen} onOpenChange={setVcOpen}>
              <Collapsible.Trigger asChild>
              <button
                type="button"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "18px 22px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  textAlign: "left",
                  transition: "background-color var(--dur-fast) var(--ease)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--hover-overlay)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <strong
                  style={{
                    font: "var(--text-title2)",
                    letterSpacing: "var(--track-heading)",
                    color: "var(--fg-primary)",
                    flex: "none",
                  }}
                >
                  가치사슬 신호
                </strong>
                <span style={{ display: "flex", flexWrap: "wrap", gap: 6, flex: "1 1 auto" }}>
                  {valueChainAnalysis.signals.map((signal) => {
                    const hovered = hoverSignal === signal.id;
                    return (
                      <span
                        key={signal.id}
                        onMouseEnter={() => setHoverSignal(signal.id)}
                        onMouseLeave={() => setHoverSignal(null)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: "var(--radius-full)",
                          background: hovered ? "var(--bg-brand-weak)" : "var(--bg-tertiary)",
                          font: "var(--text-caption)",
                          fontWeight: 600,
                          color: hovered ? "var(--fg-brand)" : "var(--fg-secondary)",
                          whiteSpace: "nowrap",
                          transition:
                            "background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
                        }}
                      >
                        #{signal.title}
                      </span>
                    );
                  })}
                </span>
                <span
                  aria-hidden
                  style={{
                    display: "inline-flex",
                    flex: "none",
                    color: "var(--grey-500)",
                    transform: vcOpen ? "rotate(-90deg)" : "rotate(90deg)",
                    transition: "transform var(--dur-base) var(--ease)",
                  }}
                >
                  <Icons.chevronRight size={16} />
                </span>
              </button>
              </Collapsible.Trigger>

              <Collapsible.Content>
                <div className="ax-step-enter" style={{ borderTop: "1px solid var(--line-subtle)" }}>
              {/* 어떤 자료를 결합해서 나온 결과인지 (v4) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  padding: "16px 22px 4px",
                }}
              >
                <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>
                  올려주신 자료를 결합했어요
                </span>
                {valueChainAnalysis.usedDocTypes.map((docType, i) => (
                  <span key={docType} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    {i > 0 && (
                      <span
                        aria-hidden
                        style={{ color: "var(--grey-400)", fontSize: 12, fontWeight: 600 }}
                      >
                        +
                      </span>
                    )}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        borderRadius: "var(--radius-full)",
                        border: "1px solid var(--line-default)",
                        background: "var(--bg-secondary)",
                        font: "var(--text-caption)",
                        fontWeight: 600,
                        color: "var(--fg-secondary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Icons.file size={12} />
                      {docType}
                    </span>
                  </span>
                ))}
                <span aria-hidden style={{ display: "inline-flex", color: "var(--grey-400)" }}>
                  <Icons.arrow size={13} />
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--bg-brand-weak)",
                    font: "var(--text-caption)",
                    fontWeight: 700,
                    color: "var(--fg-brand)",
                    whiteSpace: "nowrap",
                  }}
                >
                  품목별 재고 흐름
                </span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {[
                        { key: "item", label: <>자재/품목</>, align: "left" as const },
                        { key: "stock", label: <>현재고</>, align: "right" as const },
                        { key: "safety", label: <>안전재고</>, align: "right" as const },
                        { key: "daily", label: <>일평균 소진</>, align: "right" as const },
                        { key: "days", label: <>재고 소진일</>, align: "right" as const },
                        { key: "turn", label: <>월 회전</>, align: "right" as const },
                        { key: "action", label: <>권장 조치</>, align: "left" as const },
                      ].map((h) => (
                        <th
                          key={h.key}
                          style={{
                            textAlign: h.align,
                            padding: "14px 18px",
                            font: "var(--text-caption)",
                            color: "var(--grey-500)",
                            borderBottom: "1px solid var(--line-default)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {STOCK_ROWS.map((r, idx) => {
                      /* 태그 호버 시 근거 행을 브랜드 컬러로 (v4) */
                      const linked = hoverSignal !== null && r.signals.includes(hoverSignal);
                      return (
                      <tr
                        key={r.item}
                        style={{
                          background: linked
                            ? "var(--bg-brand-weak)"
                            : r.tone === "danger"
                              ? "var(--bg-danger-weak)"
                              : "transparent",
                          transition: "background-color var(--dur-fast) var(--ease)",
                        }}
                      >
                        <td
                          style={{
                            padding: "13px 18px",
                            fontSize: 14,
                            fontWeight: 600,
                            color: linked ? "var(--fg-brand)" : "var(--fg-primary)",
                            transition: "color var(--dur-fast) var(--ease)",
                            borderBottom:
                              idx === STOCK_ROWS.length - 1 ? "none" : "1px solid var(--line-subtle)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.item}
                        </td>
                        {[r.stock, r.safety, r.daily].map((v, i) => (
                          <td
                            key={i}
                            style={{
                              ...mono,
                              padding: "13px 18px",
                              fontSize: 14,
                              textAlign: "right",
                              color: "var(--fg-secondary)",
                              borderBottom:
                                idx === STOCK_ROWS.length - 1 ? "none" : "1px solid var(--line-subtle)",
                            }}
                          >
                            {v}
                          </td>
                        ))}
                        <td
                          style={{
                            ...mono,
                            padding: "13px 18px",
                            fontSize: 14,
                            fontWeight: 700,
                            textAlign: "right",
                            color: STOCK_TONE_COLOR[r.tone],
                            borderBottom:
                              idx === STOCK_ROWS.length - 1 ? "none" : "1px solid var(--line-subtle)",
                          }}
                        >
                          D-{r.days}
                        </td>
                        <td
                          style={{
                            ...mono,
                            padding: "13px 18px",
                            fontSize: 14,
                            textAlign: "right",
                            color: "var(--fg-secondary)",
                            borderBottom:
                              idx === STOCK_ROWS.length - 1 ? "none" : "1px solid var(--line-subtle)",
                          }}
                        >
                          {r.turn}
                        </td>
                        <td
                          style={{
                            padding: "13px 18px",
                            fontSize: 13.5,
                            fontWeight: r.actionTone === "plain" ? 400 : 700,
                            color:
                              r.actionTone === "danger"
                                ? "var(--fg-danger)"
                                : r.actionTone === "strong"
                                  ? "var(--fg-primary)"
                                  : "var(--fg-secondary)",
                            borderBottom:
                              idx === STOCK_ROWS.length - 1 ? "none" : "1px solid var(--line-subtle)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.action}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
                </div>
              </Collapsible.Content>
              </Collapsible.Root>
            </Card>
          )}

          {/* 종합 분석 — 보고서형 단일 카드 (강점/보완/AX 전략 제안 불릿, v3) */}
          <Card radius="2xl" style={{ padding: 28 }}>
            <p
              style={{
                margin: 0,
                font: "var(--text-h4)",
                letterSpacing: "var(--track-heading)",
                lineHeight: 1.4,
                color: "var(--fg-primary)",
                maxWidth: 820,
              }}
            >
              {comprehensiveAnalysis.conclusion}
            </p>

            <div style={{ marginTop: 24, display: "grid", gap: 22 }}>
              {(
                [
                  {
                    label: "강점",
                    color: "var(--fg-success)",
                    items: comprehensiveAnalysis.strengths,
                  },
                  {
                    label: "보완",
                    color: "var(--fg-warning)",
                    items: comprehensiveAnalysis.improvements,
                  },
                  {
                    label: "AX 전략 제안",
                    color: "var(--fg-brand)",
                    items: [
                      {
                        title: strategyType.label,
                        body: comprehensiveAnalysis.strategyDirection,
                      },
                    ],
                  },
                ] as const
              ).map((group) => (
                <div key={group.label}>
                  <div
                    style={{
                      font: "var(--text-label-s)",
                      color: group.color,
                      marginBottom: 8,
                    }}
                  >
                    {group.label}
                  </div>
                  {/* 동그라미 불릿 + 제목/본문 개행 (v4) */}
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}>
                    {group.items.map((it) => (
                      <li
                        key={it.title}
                        style={{ display: "flex", gap: 10, alignItems: "flex-start", maxWidth: 860 }}
                      >
                        <span
                          aria-hidden
                          style={{
                            flex: "none",
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: group.color,
                            marginTop: 8,
                          }}
                        />
                        <span style={{ minWidth: 0 }}>
                          <strong
                            style={{
                              display: "block",
                              font: "var(--text-label-m)",
                              color: "var(--fg-primary)",
                            }}
                          >
                            {it.title}
                          </strong>
                          <span
                            style={{
                              display: "block",
                              marginTop: 3,
                              font: "var(--text-body3)",
                              color: "var(--fg-secondary)",
                            }}
                          >
                            {it.body}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          {/* CTA — 우측 하단 (v3) */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32 }}>
            <Button variant="primary" size="xl" onClick={() => goTasks()}>
              개선 과제 고르러 가기
              <Icons.arrow size={17} />
            </Button>
          </div>
        </Inner>
      </section>

      {/* ================= 팝업 1 — 통계 칩 상세 ================= */}
      <Modal
        open={statDetail !== null}
        onClose={() => setStatDetail(null)}
        title={statDetail?.label}
      >
        {statDetail && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ ...mono, fontSize: 26, fontWeight: 700, color: "var(--fg-primary)" }}>
                {statDetail.value}
              </span>
              {statDetail.basis && (
                <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>
                  {statDetail.basis} 기준
                </span>
              )}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
              {statDetail.detail.map((d) => (
                <li key={d} style={{ font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
                  {d}
                </li>
              ))}
            </ul>
            {statSource && (
              <p
                style={{
                  margin: 0,
                  paddingTop: 12,
                  borderTop: "1px solid var(--line-subtle)",
                  font: "var(--text-caption)",
                  color: "var(--grey-500)",
                }}
              >
                출처: {statSource.name} — {statSource.sourceApi} (데모 데이터)
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ================= 팝업 2 — 점수 근거 (문항·판정·근거) ================= */}
      <Modal
        open={basisAxis !== null}
        onClose={() => setBasisAxis(null)}
        title={basisScore ? `${basisScore.name} — 점수 근거` : undefined}
        wide
      >
        {basisAxis && basisScore && (
          <div>
            <p
              style={{
                margin: "0 0 4px",
                font: "var(--text-body3)",
                color: "var(--fg-secondary)",
              }}
            >
              <span style={{ ...mono, fontWeight: 600, color: "var(--fg-primary)" }}>
                판정 {basisScore.judgedCount}/{basisScore.totalCount} · 자료 충분도{" "}
                {Math.round(basisScore.coverage * 100)}%
              </span>
            </p>
            <p style={{ margin: 0, font: "var(--text-caption)", color: "var(--grey-500)" }}>
              자료가 부족한 문항은{" "}
              <TermTooltip term="판정 보류">{getGlossary("판정 보류")?.easy}</TermTooltip>로 두고
              감점하지 않아요. 판정은 문항별 기준 서술에 분류하는 방식이에요.
            </p>
            {/* 스크롤은 팝업 안쪽 리스트에서만 (v3) */}
            <div
              className="ax-scrollbar-none"
              style={{ marginTop: 12, maxHeight: "48vh", overflowY: "auto" }}
            >
              {basisQuestions.map((q) => {
                const j = judgmentById.get(q.id);
                const deferred = !j || j.anchor === null;
                return (
                  <div
                    key={q.id}
                    style={{ borderTop: "1px solid var(--line-subtle)", padding: "16px 0" }}
                  >
                    <div style={{ ...mono, fontSize: 11, color: "var(--grey-400)", marginBottom: 4 }}>
                      {q.id}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                        {q.question}
                      </strong>
                      {deferred && <Badge tone="outline">판정 보류</Badge>}
                    </div>
                    {!deferred && j?.anchor && (
                      <p
                        style={{
                          margin: "0 0 6px",
                          font: "var(--text-body3)",
                          color: "var(--fg-primary)",
                        }}
                      >
                        판정 기준: &ldquo;{q.anchors[j.anchor]}&rdquo;
                      </p>
                    )}
                    {deferred && j?.deferReason && (
                      <p
                        style={{
                          margin: "0 0 6px",
                          font: "var(--text-body3)",
                          color: "var(--fg-secondary)",
                        }}
                      >
                        {j.deferReason}
                      </p>
                    )}
                    {j && (
                      <p
                        style={{
                          margin: "0 0 10px",
                          font: "var(--text-body3)",
                          color: "var(--fg-secondary)",
                        }}
                      >
                        {j.rationale}
                      </p>
                    )}
                    {j && <EvidenceTextList items={j.evidence} />}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* ================= 팝업 3 — 관리 대상 사유 (인과 체인) ================= */}
      <Modal
        open={chainArea !== null}
        onClose={() => setChainArea(null)}
        title={chainArea ? areaName(chainArea.areaId) : undefined}
        wide
      >
        {chainArea && (
          <div style={{ display: "grid", gap: 16 }}>
            <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
              {chainArea.asIs}
            </p>
            <CauseChain steps={CAUSE_CHAINS[chainArea.areaId] ?? []} />
            <div style={{ paddingTop: 12, borderTop: "1px solid var(--line-subtle)" }}>
              <div style={{ font: "var(--text-label-s)", color: "var(--fg-secondary)", marginBottom: 6 }}>
                근거
              </div>
              <EvidenceTextList items={chainArea.evidence} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
