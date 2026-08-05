"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  Badge,
  Button,
  Card,
  DotStepper,
  Icons,
  Modal,
  ProgressBar,
  Skeleton,
  TermTooltip,
} from "@/components/ui";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { SurveyModal } from "@/components/flow/SurveyModal";
import { WorkflowStandard } from "@/components/flow/WorkflowStandard";
import { api } from "@/lib/api";
import { waitForJudge, type JudgeProgress } from "@/lib/judgeWait";
import { getGlossary } from "@/data/glossary";

/* ============================================================
   S2 진단 결과 — 원본 레이아웃 복원 + 백엔드 실연동
   - 데이터는 전부 GET /api/assessments/:id/result 응답
   - 서버에 없는 데이터 블록은 렌더하지 않는다:
     기업 통계 칩 일부(특허·조달·인증 등 외부 수집 미연동), 통계 칩 상세 팝업.
     가치사슬 섹션은 삭제 확정.
   - 업종 평균(벤치마크)·점수 근거·인과 체인·축별 소견은 서버 값이 있을 때만 렌더.
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

/** 사업자번호 표기 — 000-00-00000 */
const fmtBizNo = (b: string) => `${b.slice(0, 3)}-${b.slice(3, 5)}-${b.slice(5)}`;

/** 연 매출 표기 — 백만원 단위 값을 억 원으로 */
const fmtRevenue = (m: number) => (m >= 100 ? `${Math.round(m / 10) / 10}억 원` : `${m}백만 원`);

type AxisView = {
  code: string;
  name: string;
  score: number;
  answeredCount: number;
  totalCount: number;
  /** 업종 평균 — 벤치마크 없으면 null (평균 마커·폴리곤 미렌더) */
  industryAvg: number | null;
  /** 축별 소견 한 문장 — 서사 생성분이 없으면 null */
  finding: string | null;
  /** 축별 상세 서술 2~4문장 — narrative.detail.axis_details 매칭 (구버전 서사에는 없음) */
  detail: string | null;
};

type EvidenceItem = { kind: string; label: string; snippet?: string };

type AreaView = {
  functionArea: string;
  grade: string;
  asIs: string | null;
  holdReason: string | null;
  causeChain: string[] | null;
  evidence: EvidenceItem[];
};

/** 달성 조건 미충족 강등 사유 — 점수 구간(scoreLevel)보다 낮은 level로 판정된 이유 */
type CapReasons = { level: number; reasons: string[]; taskNos: number[] };

/** 공개 데이터 수집 현황 — source: news/patent/dart/finance/procurement/employment/rnd/venture/innobiz */
type PublicStat = {
  source: string;
  status: string;
  itemCount: number;
  note: string | null;
  /** patent 행 — 등록 상태 특허 건수 */
  registeredCount?: number;
  /** procurement 행 — 조달 계약 금액 합계(원) */
  amountWon?: number;
};

type ResultPayload = {
  status: string;
  axes: {
    axisCode: string;
    axisName: string;
    score: string | null; // 축 카탈로그 LEFT JOIN — 미판정 축은 null
    answeredCount: number | null;
    totalCount: number | null;
  }[];
  levels: { level: number; name: string }[];
  company: {
    name: string;
    bizNo: string | null;
    ceoName: string | null;
    region: string | null;
    estDate: string | null;
    employees: number | null;
    revenueMillion: number | null;
    /** 재무 데이터가 DART 전자공시로 검증됨 — 헤더 출처 칩 표시 */
    dartVerified?: boolean;
  } | null;
  publicStats?: PublicStat[];
  areas: AreaView[];
  judgments: {
    questionCode: string;
    anchorLevel: number | null;
    score: number | null;
    rationale: string;
    judgedBy: string;
    questionText: string;
    axisCode: string;
    anchorCriteria: string | null;
    evidence: EvidenceItem[];
    /** 근거 상충으로 사람 검토가 필요한 문항 */
    reviewNeeded?: boolean;
    reviewReason?: string | null;
  }[];
  benchmarks: { axisCode: string | null; avgScore: string }[];
  result: {
    totalScore: string;
    level: number;
    levelName: string;
    /** 점수 구간 기준 Lv — 달성 조건 미충족이면 level보다 높을 수 있다 */
    scoreLevel?: number;
    capReasons?: CapReasons | null;
    balanceLabel: string | null;
    strengths: string[];
    bottlenecks: string[];
    narrative: {
      conclusion: string;
      strengths: { title: string; body: string }[];
      improvements: { title: string; body: string }[];
      strategy: string;
      strategyLabel?: string;
      axisFindings?: { axisCode: string; finding: string }[];
      /** 상세 서술 — 요약의 근거를 수치·문서명 인용으로 풀어쓴 본문 (구버전 서사에는 없음) */
      detail?: {
        overview?: string;
        strengths_detail?: string;
        improvements_detail?: string;
        strategy_detail?: string;
        axis_details?: { axisCode: string; text: string }[];
      } | null;
    } | null;
  } | null;
};

const KIND_LABEL: Record<string, string> = {
  upload: "업로드",
  survey: "설문",
  external: "공개 데이터",
  hitl: "확인 응답",
};

/** 근거를 출처 텍스트로 — "업로드 · 3월 생산일지 — "종이 양식에…"" */
function EvidenceTextList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
      {items.map((e, i) => (
        <li
          key={`${e.label}-${i}`}
          style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--fg-tertiary)" }}
        >
          <span style={{ fontWeight: 600, color: "var(--fg-secondary)" }}>
            {KIND_LABEL[e.kind] ?? e.kind} · {e.label}
          </span>
          {e.snippet && <> — &ldquo;{e.snippet}&rdquo;</>}
        </li>
      ))}
    </ul>
  );
}

/** 종합 분석 상세 서술 — 추론 AI 작성 본문. 왼쪽 정렬·문단 유지, 없으면 아무것도 렌더하지 않는다 */
function DetailText({ text, style }: { text?: string | null; style?: CSSProperties }) {
  if (!text) return null;
  return (
    <p
      style={{
        margin: 0,
        font: "var(--text-body3)",
        lineHeight: 1.7,
        color: "var(--fg-secondary)",
        textAlign: "left",
        whiteSpace: "pre-line",
        maxWidth: 860,
        ...style,
      }}
    >
      {text}
    </p>
  );
}

/** 8영역 표시 순서 — 분류·분석·과제 화면 공통 체계와 동일 */
const AREA_ORDER = [
  "경영지원",
  "제품설계",
  "생산관리",
  "장비관리",
  "품질검사",
  "재고물류",
  "영업관리",
  "고객지원",
];

/* ---- 콘텐츠 래퍼 (max 1080px) ---- */
function Inner({ children }: { children: ReactNode }) {
  return <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>{children}</div>;
}

function SectionHead({
  label,
  title,
  sub,
}: {
  label?: string;
  title: string;
  sub?: ReactNode;
}) {
  return (
    <header style={{ marginBottom: 24 }}>
      {label && (
        <div style={{ font: "var(--text-label-s)", color: "var(--fg-brand)", marginBottom: 8 }}>
          {label}
        </div>
      )}
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
   벤치마크 미구현으로 평균 폴리곤·평균 범례는 제외
   ============================================================ */
function RadarChart({
  axes,
  selected,
  onSelect,
}: {
  axes: AxisView[];
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const cx = 180;
  const cy = 168;
  const R = 114;
  const step = 360 / axes.length;
  /* viewBox 좌우 여백 — 좌·우 끝 축 라벨(예: 'AI활용 및 성과')이 잘리지 않게 음수 x부터 그린다 */
  const vbX = -40;
  const vbW = 440;

  const pt = (i: number, v: number): [number, number] => {
    const ang = (Math.PI / 180) * (-90 + i * step);
    return [cx + R * (v / 100) * Math.cos(ang), cy + R * (v / 100) * Math.sin(ang)];
  };
  const poly = (vals: number[]) =>
    vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");

  const ownVals = axes.map((a) => a.score);
  const hasAvg = axes.length > 0 && axes.every((a) => a.industryAvg !== null);
  const avgVals = axes.map((a) => a.industryAvg ?? 0);

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`${vbX} 0 ${vbW} 336`}
        role="img"
        aria-label={`카테고리별 준비도 차트${hasAvg ? " — 자사 점수와 평균 비교" : ""}. ${axes
          .map(
            (a) =>
              `${a.name} ${fmtScore(a.score)}점${hasAvg ? `(평균 ${a.industryAvg}점)` : ""}`,
          )
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
          const isSel = selected === a.code;
          return (
            <line
              key={a.code}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={isSel ? "var(--blue-100)" : "var(--grey-100)"}
              strokeWidth={isSel ? 1.5 : 1}
            />
          );
        })}
        {/* 선택 축 그라데이션 — 선택 꼭짓점은 블루 유지, 멀어질수록 회색 */}
        {selected !== null &&
          (() => {
            const selIdx = axes.findIndex((a) => a.code === selected);
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
        {/* 업종 평균 — 회색 점선 폴리곤 (벤치마크 있을 때만) */}
        {hasAvg && (
          <polygon
            points={poly(avgVals)}
            fill="none"
            stroke="var(--grey-400)"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            strokeLinejoin="round"
          />
        )}
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
          const isSel = selected === axes[i].code;
          const dimmed = selected !== null && !isSel;
          return (
            <g key={axes[i].code}>
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
                onClick={() => onSelect(axes[i].code)}
                role="button"
                aria-label={`${axes[i].name} ${fmtScore(axes[i].score)}점 — 상세 보기`}
              />
            </g>
          );
        })}
        {/* 축 라벨 — 호버·선택 시 부드러운 강조 */}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 118);
          const ang = (Math.PI / 180) * (-90 + i * step);
          const cos = Math.cos(ang);
          const sin = Math.sin(ang);
          const anchor = cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle";
          const dy = sin < -0.9 ? -8 : sin > 0.9 ? 16 : 4;
          const isSel = selected === a.code;
          const isHover = hover === i;
          return (
            <text
              key={a.code}
              x={x}
              y={y + dy}
              textAnchor={anchor}
              fontSize={12.5}
              fontWeight={isSel || isHover ? 700 : 600}
              fill={isSel || isHover ? "var(--blue-500)" : "var(--grey-700)"}
              fontFamily="var(--font-sans)"
              letterSpacing="-0.01em"
              style={{ cursor: "pointer", transition: "fill var(--dur-base) var(--ease)" }}
              onClick={() => onSelect(a.code)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              role="button"
              aria-label={`${a.name} 상세 보기`}
            >
              {a.name}
            </text>
          );
        })}
        {/* 호버 툴팁 — 자사 점수 (+ 벤치마크 있으면 평균 줄) */}
        {hover !== null &&
          (() => {
            const ownLine = `자사 ${fmtScore(axes[hover].score)}`;
            const avgLine = `평균 ${axes[hover].industryAvg ?? "-"}`;
            const [x, y] = pt(hover, ownVals[hover]);
            const w = Math.max(ownLine.length, avgLine.length) * 7 + 22;
            const h = 40;
            const tx = Math.min(Math.max(x, vbX + w / 2 + 4), vbX + vbW - w / 2 - 4);
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
          평균 (업종 표본)
        </span>
      </figcaption>
      <p
        style={{
          margin: "8px 0 0",
          textAlign: "center",
          font: "var(--text-caption)",
          color: "var(--fg-quaternary)",
        }}
      >
        이름이나 점을 눌러 보세요.
      </p>
    </figure>
  );
}

/* ---- 프로그레스바 (자사 채움 + 평균 위치 점선 마커, 평균 미달 = 저채도 주황) ---- */
function ScoreBar({ score, avg }: { score: number; avg?: number | null }) {
  const belowAvg = avg != null && score < avg;
  return (
    <div style={{ position: "relative", padding: avg != null ? "22px 0 20px" : "14px 0 12px" }}>
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
            transition:
              "width var(--dur-slow) var(--ease), background-color var(--dur-base) var(--ease)",
          }}
        />
      </div>
      {/* 평균 마커 — 세로 점선 + 상단 "평균" / 하단 점수 */}
      {avg != null && (
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
          <span style={{ ...mono, fontSize: 11, color: "var(--grey-500)", lineHeight: 1 }}>
            {avg}
          </span>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   섹션 3 보조 — 관리 대상 인과 체인 (사유 보기 팝업)
   ============================================================ */
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
   페이지
   ============================================================ */
/** 결과 응답의 목록 필드를 배열로 보정한다 — 한 곳에서 막아야 화면 곳곳이 안전하다 */
const normalizeResult = (p: ResultPayload): ResultPayload => ({
  ...p,
  axes: p.axes ?? [],
  judgments: p.judgments ?? [],
  levels: p.levels ?? [],
  benchmarks: p.benchmarks ?? [],
  areas: p.areas ?? [],
  publicStats: p.publicStats ?? [],
});

export default function ResultPage() {
  const router = useRouter();
  const { companyInput, assessmentId, completedSteps, completeStep } = useDiagnosis();
  const [data, setData] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ---- 화면 상태 ---- */
  const [selectedAxis, setSelectedAxis] = useState<string | null>(null);
  const [showAllAxes, setShowAllAxes] = useState(false);
  /* 점수 근거 팝업 대상 축 (null이면 닫힘) */
  const [basisAxis, setBasisAxis] = useState<string | null>(null);
  /* 결측 보완 설문 팝업 */
  const [surveyOpen, setSurveyOpen] = useState(false);
  /* 사유 보기 팝업 대상 영역 (null이면 닫힘) */
  const [chainArea, setChainArea] = useState<AreaView | null>(null);
  /* 판정 진행 중 — 완료를 기다리는 동안 진행 현황 프로그레스바를 보여준다 */
  const [judging, setJudging] = useState(false);
  const [judgeProgress, setJudgeProgress] = useState<JudgeProgress | null>(null);
  const statRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!assessmentId) return;
    let cancelled = false;
    const load = () =>
      api<ResultPayload>(`/api/assessments/${assessmentId}/result`)
        .then((p) => {
          if (cancelled) return;
          if (p.status === "judging") {
            /* 아직 판정 중 — 문항 판정 진행 수를 받아 보여주고, 끝나면 결과를 다시 불러온다 */
            setJudging(true);
            void waitForJudge(assessmentId, {
              isCancelled: () => cancelled,
              onProgress: setJudgeProgress,
            }).then((outcome) => {
              if (cancelled || outcome === "cancelled") return;
              setJudging(false);
              if (outcome === "failed") {
                setError("분석에 실패했어요. 다시 시도해 주세요.");
              } else if (outcome === "timeout") {
                setError("분석이 예상보다 오래 걸려요. 잠시 후 마이페이지에서 결과를 확인해 주세요.");
              } else {
                void load();
              }
            });
            return;
          }
          setData(normalizeResult(p));
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
        });
    void load();
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  /* 진입 가드 — 자료 정리 미완료 (기존 정책 유지) */
  if (!assessmentId || !completedSteps.includes("collect")) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-[var(--gutter)]">
        <Card radius="2xl" style={{ maxWidth: 480, width: "100%", padding: 36, textAlign: "center" }}>
          <p style={{ font: "var(--text-h3)", color: "var(--fg-primary)", margin: 0 }}>
            자료 정리를 먼저 마쳐주세요
          </p>
          <div style={{ marginTop: 22 }}>
            <Button variant="primary" size="lg" full onClick={() => router.push("/collect")}>
              자료 정리로 가기
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (error)
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-[var(--gutter)]">
        <p style={{ font: "var(--text-body1)", color: "var(--fg-tertiary)" }}>{error}</p>
      </div>
    );

  /* 판정 진행 중 — 3-dot 대신 문항 판정 진행 현황 프로그레스바 */
  if (judging) {
    const percent =
      judgeProgress && judgeProgress.total > 0
        ? Math.round((judgeProgress.judged / judgeProgress.total) * 100)
        : 0;
    return (
      <div
        className="ax-step-enter"
        role="status"
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          padding: "0 24px",
          textAlign: "center",
        }}
      >
        <ProgressBar percent={percent} style={{ width: "min(360px, 100%)" }} />
        <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
          진단 결과를 불러오고 있어요
        </p>
      </div>
    );
  }

  /* 데이터 로딩 — 페이지 골격 스켈레톤 (헤더 블록 + 카드 그리드 자리) */
  if (!data)
    return (
      <div className="ax-step-enter" style={{ padding: "40px 0 80px" }} role="status">
        <Inner>
          <Card radius="2xl" style={{ padding: 28 }}>
            <Skeleton width={240} height={26} />
            <Skeleton width={320} height={14} style={{ marginTop: 12 }} />
            <Skeleton width={280} height={44} style={{ marginTop: 30 }} />
            <Skeleton width={200} height={14} style={{ marginTop: 12 }} />
          </Card>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 12,
              marginTop: 24,
            }}
          >
            {Array.from({ length: 6 }, (_, i) => (
              <Card key={i} radius="l" style={{ padding: "18px 20px" }}>
                <Skeleton width={120} height={16} />
                <Skeleton height={12} style={{ marginTop: 12 }} />
                <Skeleton width="70%" height={12} style={{ marginTop: 8 }} />
              </Card>
            ))}
          </div>
        </Inner>
      </div>
    );

  const { areas, result } = data;
  /* 업종 벤치마크 — 축별 평균 + 종합 평균 (없으면 관련 UI 미렌더) */
  const benchByAxis = new Map(
    data.benchmarks.filter((b) => b.axisCode !== null).map((b) => [b.axisCode!, Number(b.avgScore)]),
  );
  const overallAvgRow = data.benchmarks.find((b) => b.axisCode === null);
  const industryAvgScore = overallAvgRow ? Number(overallAvgRow.avgScore) : null;
  /* 축별 소견 — 종합 서사에 포함해 생성 (구버전 서사에는 없음) */
  const findingByAxis = new Map(
    (result?.narrative?.axisFindings ?? []).map((f) => [f.axisCode, f.finding]),
  );
  /* 상세 서술 — 요약 아래에 붙는 본문. 구버전 서사에는 없어 관용적으로 접근 */
  const narrativeDetail = result?.narrative?.detail ?? null;
  const axisDetailByCode = new Map(
    (narrativeDetail?.axis_details ?? []).map((d) => [d.axisCode, d.text]),
  );

  const axes: AxisView[] = data.axes.map((a) => ({
    code: a.axisCode,
    name: a.axisName,
    score: Number(a.score ?? 0), // 미판정 축은 0점으로 표시 (레이더 5축 고정)
    answeredCount: a.answeredCount ?? 0,
    totalCount: a.totalCount ?? 0,
    industryAvg: benchByAxis.get(a.axisCode) ?? null,
    finding: findingByAxis.get(a.axisCode) ?? null,
    detail: axisDetailByCode.get(a.axisCode) ?? null,
  }));
  const axisByCode = new Map(axes.map((a) => [a.code, a]));
  const axesByBottleneck = [...axes].sort((a, b) => a.score - b.score);

  const answered = data.judgments.filter((j) => j.anchorLevel !== null).length;
  const totalQ = data.judgments.length;
  const lowCoverage = totalQ > 0 && answered / totalQ < 0.5;

  const companyName = companyInput.trim();
  const totalScore = result ? Number(result.totalScore) : null;
  const selectedScore = selectedAxis ? axisByCode.get(selectedAxis) : undefined;
  const basisScore = basisAxis ? axisByCode.get(basisAxis) : undefined;
  const basisQuestions = basisAxis
    ? data.judgments.filter((j) => j.axisCode === basisAxis)
    : [];

  /* ---- 기업 개요 (서버 기업 정보 — 값이 있는 조각만 표시) ---- */
  const co = data.company;
  const displayName = co?.name || companyName;
  const foundedYear = co?.estDate ? Number(co.estDate.slice(0, 4)) : null;
  const yearsInBusiness = foundedYear ? new Date().getFullYear() - foundedYear : null;
  const infoParts = [
    co?.ceoName ? `대표 ${co.ceoName}` : null,
    foundedYear ? `설립 ${foundedYear}년${yearsInBusiness ? ` (업력 ${yearsInBusiness}년)` : ""}` : null,
    co?.region ?? null,
  ].filter(Boolean) as string[];

  /* ---- Lv.1~5 단계 스테퍼 — 목표 단계 = 현재 +1 (최대 마지막 단계) ---- */
  const currentIdx = result ? result.level - 1 : 0;
  const targetIdx = Math.min(currentIdx + 1, Math.max(data.levels.length - 1, 0));
  const stepperSteps = data.levels.map((l, i) => ({
    label: `Lv.${l.level} ${l.name}`,
    sub: i === targetIdx ? "목표 단계" : undefined,
  }));

  /* ---- 통계 칩 — 기존 연 매출·고용 + 공개 데이터 수집 현황(publicStats) ---- */
  const statBySource = new Map((data.publicStats ?? []).map((s) => [s.source, s]));
  const hasCertSource = statBySource.has("venture") || statBySource.has("innobiz");
  const certLabels = [
    (statBySource.get("venture")?.itemCount ?? 0) > 0 ? "벤처" : null,
    (statBySource.get("innobiz")?.itemCount ?? 0) > 0 ? "이노비즈" : null,
  ].filter(Boolean) as string[];
  const smartFactory = statBySource.get("rnd"); // rnd 행 = 스마트공장 사업 수혜 이력
  const patent = statBySource.get("patent");
  const news = statBySource.get("news");
  const procurement = statBySource.get("procurement");
  const procurementAmountWon = procurement?.amountWon ?? 0;
  const companyStats = [
    co?.revenueMillion != null ? { label: "연 매출", value: fmtRevenue(co.revenueMillion) } : null,
    smartFactory
      ? {
          label: "스마트공장",
          value: (smartFactory.itemCount ?? 0) > 0 ? "수혜 기업" : "수혜 이력 없음",
        }
      : null,
    patent ? { label: "특허", value: `등록 ${patent.registeredCount ?? 0}건` } : null,
    news ? { label: "최근 보도", value: `${news.itemCount ?? 0}건` } : null,
    co?.employees != null ? { label: "고용", value: `${co.employees}명` } : null,
    procurement
      ? {
          label: "조달 실적",
          value:
            procurementAmountWon > 0
              ? /* 원 단위 합계를 억 원 소수 1자리로 */
                `${procurement.itemCount ?? 0}건 · ${Math.round(procurementAmountWon / 1e7) / 10}억 원`
              : `${procurement.itemCount ?? 0}건`,
        }
      : null,
    hasCertSource
      ? { label: "인증", value: certLabels.length > 0 ? certLabels.join(" · ") : "—" }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const sortedAreas = [...areas].sort(
    (a, b) => AREA_ORDER.indexOf(a.functionArea) - AREA_ORDER.indexOf(b.functionArea),
  );

  /** 축 선택 — 같은 축 재클릭 시 해제 */
  const selectAxis = (code: string) => {
    setSelectedAxis((prev) => (prev === code ? null : code));
    setShowAllAxes(false);
  };

  const goTasks = () => {
    completeStep("result");
    router.push("/tasks");
  };

  /** 축코드 목록 → "이름 점수점 · …" (병목/강점 표기) */
  const axisScoreLine = (codes: string[]) =>
    codes
      .map((code) => {
        const a = axisByCode.get(code);
        return `${a?.name ?? code} ${fmtScore(a?.score ?? null)}점`;
      })
      .join(" · ");

  return (
    <div className="ax-step-enter" style={{ background: "var(--bg-base)" }}>
      {/* ================= 섹션 1 — 기업 개요 + 현재 단계 (통합 카드) ================= */}
      <section style={{ padding: "40px 0 12px" }}>
        <Inner>
          <Card radius="2xl" style={{ padding: 28 }}>
            {/* 기업 식별 — 기업명 + 사업자번호 */}
            {(displayName || co?.bizNo) && (
              <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
                <h2
                  style={{
                    margin: 0,
                    font: "var(--text-title1)",
                    letterSpacing: "var(--track-heading)",
                    color: "var(--fg-primary)",
                  }}
                >
                  {displayName}
                </h2>
                {co?.bizNo && (
                  <span style={{ ...mono, fontSize: 13, color: "var(--grey-500)" }}>
                    {fmtBizNo(co.bizNo)}
                  </span>
                )}
                {/* 출처 칩 — 재무 데이터가 DART 전자공시로 검증된 경우 */}
                {co?.dartVerified && (
                  <span
                    style={{
                      marginLeft: "auto",
                      alignSelf: "center",
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "5px 10px",
                      borderRadius: "var(--radius-full)",
                      border: "1px solid var(--line-default)",
                      font: "var(--text-caption)",
                      color: "var(--fg-tertiary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    출처 · DART 전자공시 (재무 데이터)
                  </span>
                )}
              </span>
            )}
            {infoParts.length > 0 && (
              <p style={{ margin: "8px 0 0", font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                {infoParts.join(" · ")}
              </p>
            )}

            {/* 현재 단계 — 라벨 · 큰 레벨 · 서브 */}
            <div style={{ marginTop: displayName ? 30 : 0 }}>
              <div style={{ font: "var(--text-label-s)", color: "var(--fg-tertiary)" }}>현재</div>
              {result ? (
                <>
                  <h3
                    style={{
                      margin: "8px 0 0",
                      font: "var(--text-display2)",
                      letterSpacing: "var(--track-display)",
                      color: "var(--fg-primary)",
                    }}
                  >
                    <b style={{ color: "var(--fg-brand)" }}>Lv.{result.level}</b> {result.levelName}
                  </h3>
                  {/* 강등 사유 — 점수 구간 Lv과 판정 Lv이 다른 이유 */}
                  {result.capReasons && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-warning)" }}>
                        점수 구간은 Lv.{result.scoreLevel ?? result.level}이지만 달성 조건 미충족으로
                        Lv.{result.capReasons.level}로 분석됐어요
                      </p>
                      {result.capReasons.reasons.length > 0 && (
                        <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 2 }}>
                          {result.capReasons.reasons.map((r) => (
                            <li
                              key={r}
                              style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}
                            >
                              {r}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {lowCoverage && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        font: "var(--text-caption)",
                        color: "var(--fg-quaternary)",
                      }}
                    >
                      자료가 부족해 일부 문항은 분석을 보류했어요. 설문에 답하면 그 문항도 점수에
                      반영돼요.
                    </p>
                  )}
                  {lowCoverage && (
                    <div style={{ marginTop: 10 }}>
                      <Button variant="secondary" size="sm" onClick={() => setSurveyOpen(true)}>
                        설문으로 보완하기
                      </Button>
                    </div>
                  )}
                  {/* Lv.1~5 단계 흐름 — 현재·목표 단계 시각화 */}
                  {stepperSteps.length > 0 && (
                    <DotStepper
                      steps={stepperSteps}
                      current={currentIdx}
                      target={targetIdx}
                      style={{ marginTop: 28 }}
                    />
                  )}
                </>
              ) : (
                /* 점수를 못 낸 상태를 그대로 알리지 않고 보완 경로를 준다 (수정요청v9) */
                <div style={{ marginTop: 10 }}>
                  <p style={{ margin: 0, font: "var(--text-body1)", color: "var(--fg-secondary)" }}>
                    아직 분석할 자료가 모자라 점수를 내지 못했어요. 설문에 답하거나 자료를 더
                    올리면 바로 점수가 나와요.
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <Button variant="primary" onClick={() => setSurveyOpen(true)}>
                      설문으로 보완하기
                    </Button>
                    <Button variant="secondary" onClick={() => router.push("/")}>
                      자료 더 올리기
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 연한 구분선 + 통계 칩 — 수집된 값이 있을 때만 */}
            {companyStats.length > 0 && (
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
                    <div
                      key={stat.label}
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
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>
                        {stat.label}
                      </span>
                      <span
                        style={{ ...mono, fontSize: 15, fontWeight: 600, color: "var(--fg-primary)" }}
                      >
                        {stat.value}
                      </span>
                    </div>
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
            )}
          </Card>
        </Inner>
      </section>

      {/* ================= 섹션 2 — 카테고리별 준비도 ================= */}
      {axes.length > 0 && (
        <section style={{ padding: "56px 0" }}>
          <Inner>
            {/* 타이틀 — 벤치마크 있으면 업계 평균 ±10 기준 3구간 비교 문구 */}
            {totalScore !== null && industryAvgScore !== null ? (
              <SectionHead
                label="카테고리별 준비도"
                title={
                  Math.round(totalScore) < Math.round(industryAvgScore) - 10
                    ? `${Math.round(totalScore)}점은 업계 평균(${Math.round(industryAvgScore)}점)보다 낮은 점수예요`
                    : Math.round(totalScore) <= Math.round(industryAvgScore) + 10
                      ? `${Math.round(totalScore)}점은 업계 대비 평균 점수예요`
                      : `${Math.round(totalScore)}점은 업계 평균(${Math.round(industryAvgScore)}점)보다 높은 점수예요`
                }
              />
            ) : (
              <SectionHead title="카테고리별 준비도" />
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: 32,
                alignItems: "start",
              }}
            >
              {/* 좌 — 레이더 */}
              {axes.length >= 3 && (
                <RadarChart axes={axes} selected={selectedAxis} onSelect={selectAxis} />
              )}

              {/* 우 — 상세 카드 (모두 보기 버튼은 카드 밖 우측) */}
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
                  /* 전체 보기 — 축 카드 1열 구성 (병목 순) */
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
                    {axesByBottleneck.map((a) => (
                      <Card key={a.code} radius="l" style={{ padding: "16px 18px" }}>
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
                          <span
                            style={{ ...mono, fontSize: 17, fontWeight: 600, color: "var(--fg-primary)" }}
                          >
                            {fmtScore(a.score)}
                            <span style={{ fontSize: 11, fontWeight: 400, color: "var(--grey-400)" }}>
                              점
                            </span>
                          </span>
                        </div>
                        <ScoreBar score={a.score} avg={a.industryAvg} />
                        <p
                          style={{
                            margin: 0,
                            font: a.finding ? "var(--text-body3)" : "var(--text-caption)",
                            color: "var(--fg-tertiary)",
                            ...(a.finding ? clamp2 : {}),
                          }}
                        >
                          {a.finding ?? `분석 ${a.answeredCount}/${a.totalCount}`}
                        </p>
                        <div style={{ marginTop: 10 }}>
                          <Button variant="secondary" size="sm" onClick={() => setBasisAxis(a.code)}>
                            근거
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
                          <span
                            aria-hidden
                            style={{ display: "inline-flex", transform: "rotate(180deg)" }}
                          >
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
                          <span
                            style={{ ...mono, fontSize: 32, fontWeight: 700, color: "var(--fg-primary)" }}
                          >
                            {fmtScore(selectedScore.score)}
                          </span>
                          <span style={{ font: "var(--text-body3)", color: "var(--grey-400)" }}>
                            / 100점
                          </span>
                        </div>
                        <ScoreBar score={selectedScore.score} avg={selectedScore.industryAvg} />
                        <p
                          style={{
                            margin: 0,
                            font: selectedScore.finding ? "var(--text-body2)" : "var(--text-body3)",
                            color: selectedScore.finding
                              ? "var(--fg-secondary)"
                              : "var(--fg-tertiary)",
                          }}
                        >
                          {selectedScore.finding ??
                            `분석 ${selectedScore.answeredCount}/${selectedScore.totalCount}`}
                        </p>
                        {/* 축별 상세 서술 — 소견 요약 아래 본문 (없으면 미렌더) */}
                        <DetailText
                          text={selectedScore.detail}
                          style={{ marginTop: 10, color: "var(--fg-tertiary)" }}
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                          <Button variant="secondary" size="sm" onClick={() => setBasisAxis(selectedAxis)}>
                            근거
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* 기본 상태 — 요약 */
                      <div style={{ display: "grid", gap: 14 }}>
                        {result && totalScore !== null && result.balanceLabel && (
                          <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
                            {axes.length}개 카테고리 평균이 종합{" "}
                            <span style={{ ...mono, fontWeight: 600 }}>{fmtScore(totalScore)}</span>
                            점이에요. 분포는 &ldquo;{result.balanceLabel}&rdquo; 유형이에요.
                          </p>
                        )}
                        {result && totalScore !== null && (
                          <div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                              <span
                                style={{ ...mono, fontSize: 28, fontWeight: 700, color: "var(--fg-primary)" }}
                              >
                                {fmtScore(totalScore)}
                              </span>
                              <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>
                                종합
                              </span>
                              {industryAvgScore !== null && (
                                <>
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
                                </>
                              )}
                            </div>
                            <ScoreBar
                              score={totalScore}
                              avg={industryAvgScore !== null ? Math.round(industryAvgScore) : null}
                            />
                          </div>
                        )}
                        {result?.narrative?.strategyLabel && (
                          <div>
                            <p
                              style={{
                                margin: "8px 0 0",
                                font: "var(--text-body3)",
                                color: "var(--fg-tertiary)",
                              }}
                            >
                              {result.narrative.strategy}
                            </p>
                          </div>
                        )}
                        {result && result.bottlenecks.length > 0 && result.strengths.length > 0 && (
                          <div
                            style={{
                              display: "grid",
                              gap: 8,
                              paddingTop: 6,
                              borderTop: "1px solid var(--line-subtle)",
                            }}
                          >
                            <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                              <strong style={{ color: "var(--fg-danger)", fontWeight: 600 }}>약점</strong> ·{" "}
                              {axisScoreLine(result.bottlenecks)}
                            </p>
                            <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                              <strong style={{ color: "var(--fg-success)", fontWeight: 600 }}>강점</strong> ·{" "}
                              {axisScoreLine(result.strengths)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </Inner>
        </section>
      )}

      {/* ================= 섹션 3 — 8영역 (은은한 밴드) ================= */}
      {areas.length > 0 && (
        <section style={{ background: "var(--bg-secondary)", padding: "56px 0" }}>
          <Inner>
            <SectionHead
              label="업무영역"
              title="업무영역별 현재 상태"
              sub="점수 대신 등급으로 표기해요."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                gap: 12,
              }}
            >
              {sortedAreas.map((area) => {
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
                    key={area.functionArea}
                    radius="l"
                    style={{
                      padding: "18px 20px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <strong style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                        {area.functionArea}
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
                      {area.grade === "hold" ? (area.holdReason ?? "자료가 부족해요") : area.asIs}
                    </p>
                    {area.grade === "critical" &&
                      ((area.causeChain?.length ?? 0) > 0 || area.evidence.length > 0) && (
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
      )}

      {/* ================= 섹션 3.5 — 표준 워크플로우 (8대 기능 + 문서 보유 여부) ================= */}
      <WorkflowStandard assessmentId={assessmentId} />

      {/* ============ 섹션 4 — 종합 분석 결과 ============ */}
      <section style={{ padding: "56px 0 80px" }}>
        <Inner>
          {result?.narrative && (
            <>
              <SectionHead label="종합 분석" title="종합 분석 결과" />

              {/* 종합 분석 — 보고서형 단일 카드 (강점/보완/AX 전략 제안 불릿) */}
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
                  {result.narrative.conclusion}
                </p>
                {/* 종합 상태 상세 서술 — 결론 요약 아래 본문 (구버전 서사에는 없어 미렌더) */}
                <DetailText text={narrativeDetail?.overview} style={{ marginTop: 14 }} />

                <div style={{ marginTop: 24, display: "grid", gap: 22 }}>
                  {(
                    [
                      {
                        label: "강점",
                        color: "var(--fg-success)",
                        items: result.narrative.strengths,
                        detail: narrativeDetail?.strengths_detail,
                      },
                      {
                        label: "보완",
                        color: "var(--fg-warning)",
                        items: result.narrative.improvements,
                        detail: narrativeDetail?.improvements_detail,
                      },
                      {
                        label: "AX 전략 제안",
                        color: "var(--fg-brand)",
                        items: [{ title: null, body: result.narrative.strategy }],
                        detail: narrativeDetail?.strategy_detail,
                      },
                    ] as {
                      label: string;
                      color: string;
                      items: { title: string | null; body: string }[];
                      detail?: string;
                    }[]
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
                      {/* 동그라미 불릿 + 제목/본문 개행 */}
                      <ul
                        style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 12 }}
                      >
                        {group.items.map((it) => (
                          <li
                            key={it.title ?? it.body}
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
                              {it.title && (
                                <strong
                                  style={{
                                    display: "block",
                                    font: "var(--text-label-m)",
                                    color: "var(--fg-primary)",
                                  }}
                                >
                                  {it.title}
                                </strong>
                              )}
                              <span
                                style={{
                                  display: "block",
                                  marginTop: it.title ? 3 : 0,
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
                      {/* 블록별 상세 서술 — 불릿 본문과 같은 들여쓰기(불릿 5 + 간격 10) */}
                      <DetailText
                        text={group.detail}
                        style={{ marginTop: 10, paddingLeft: 15, color: "var(--fg-tertiary)" }}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* CTA — 우측 하단 */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32 }}>
            <Button variant="primary" size="xl" onClick={() => goTasks()}>
              개선 과제 고르러 가기
              <Icons.arrow size={17} />
            </Button>
          </div>
        </Inner>
      </section>

      {/* 결측 보완 설문 — 응답을 저장하고 재판정까지 끝나면 결과를 다시 불러온다 (수정요청v9) */}
      {assessmentId && (
        <SurveyModal
          assessmentId={assessmentId}
          open={surveyOpen}
          onClose={() => setSurveyOpen(false)}
          onApplied={() => {
            api<ResultPayload>(`/api/assessments/${assessmentId}/result`)
              .then((p) => setData(normalizeResult(p)))
              .catch(() => undefined);
          }}
        />
      )}

      {/* ================= 팝업 — 점수 근거 (문항·판정·근거) ================= */}
      <Modal
        open={basisAxis !== null}
        onClose={() => setBasisAxis(null)}
        title={basisScore ? `${basisScore.name} — 근거` : undefined}
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
                분석 {basisScore.answeredCount}/{basisScore.totalCount} · 자료 충분도{" "}
                {basisScore.totalCount > 0
                  ? Math.round((basisScore.answeredCount / basisScore.totalCount) * 100)
                  : 0}
                %
              </span>
            </p>
            <p style={{ margin: 0, font: "var(--text-caption)", color: "var(--grey-500)" }}>
              자료가 부족한 문항은{" "}
              <TermTooltip term="분석 보류">{getGlossary("분석 보류")?.easy}</TermTooltip>로 두고
              감점하지 않아요. 분석은 문항별 기준 서술에 분류하는 방식이에요.
            </p>
            {/* 스크롤은 팝업 안쪽 리스트에서만 */}
            <div
              className="ax-scrollbar-none"
              /* 스크롤은 이 리스트 안에서만 — 모달 외곽(.ax-modal max-height 84vh·720px)보다
                 항상 작게 잡아 제목·안내가 밀려 올라가지 않게 한다 */
              style={{ marginTop: 12, maxHeight: "min(calc(84vh - 220px), 500px)", overflowY: "auto" }}
            >
              {basisQuestions.map((j) => {
                const deferred = j.anchorLevel === null;
                return (
                  <div
                    key={j.questionCode}
                    style={{ borderTop: "1px solid var(--line-subtle)", padding: "16px 0" }}
                  >
                    <div style={{ ...mono, fontSize: 11, color: "var(--grey-400)", marginBottom: 4 }}>
                      {j.questionCode}
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
                        {j.questionText}
                      </strong>
                      {deferred && <Badge tone="outline">분석 보류</Badge>}
                      {j.reviewNeeded && <Badge tone="warning">검토 필요</Badge>}
                    </div>
                    {!deferred && j.anchorCriteria && (
                      <p
                        style={{
                          margin: "0 0 6px",
                          font: "var(--text-body3)",
                          color: "var(--fg-primary)",
                        }}
                      >
                        분석 기준: &ldquo;{j.anchorCriteria}&rdquo;
                      </p>
                    )}
                    <p
                      style={{
                        margin: "0 0 10px",
                        font: "var(--text-body3)",
                        color: "var(--fg-secondary)",
                      }}
                    >
                      {j.rationale}
                    </p>
                    {/* 근거 상충 — 검토 사유와 자료 보완 경로 */}
                    {j.reviewNeeded && (
                      <div
                        style={{
                          margin: "0 0 10px",
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 10,
                        }}
                      >
                        {j.reviewReason && (
                          <span style={{ font: "var(--text-caption)", color: "var(--fg-warning)" }}>
                            {j.reviewReason}
                          </span>
                        )}
                        <Button variant="secondary" size="sm" href="/collect">
                          자료 보완하기
                        </Button>
                      </div>
                    )}
                    <EvidenceTextList items={j.evidence} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* ================= 팝업 — 관리 대상 사유 (인과 체인) ================= */}
      <Modal
        open={chainArea !== null}
        onClose={() => setChainArea(null)}
        title={chainArea?.functionArea}
        wide
      >
        {chainArea && (
          <div style={{ display: "grid", gap: 16 }}>
            {chainArea.asIs && (
              <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                {chainArea.asIs}
              </p>
            )}
            {(chainArea.causeChain?.length ?? 0) > 0 && (
              <CauseChain steps={chainArea.causeChain!} />
            )}
            {chainArea.evidence.length > 0 && (
              <div style={{ paddingTop: 12, borderTop: "1px solid var(--line-subtle)" }}>
                <div
                  style={{ font: "var(--text-label-s)", color: "var(--fg-secondary)", marginBottom: 6 }}
                >
                  근거
                </div>
                <EvidenceTextList items={chainArea.evidence} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
