"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, DotStepper, Icons } from "@/components/ui";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { RouteLoading } from "@/components/flow/RouteLoading";
import { api } from "@/lib/api";

/* ============================================================
   S2 진단 결과 — 원본 레이아웃 복원 + 백엔드 실연동
   - 데이터는 전부 GET /api/assessments/:id/result 응답
   - 서버에 없는 데이터 블록은 렌더하지 않는다:
     업종 평균 비교(벤치마크 미구현), 기업 통계 칩·공개데이터(회사 상세 미제공),
     점수 근거 팝업(문항 텍스트·앵커 미제공), 관리 대상 인과 체인(cause_chain 미생성),
     단계 스테퍼(전체 레벨 명칭 미제공). 가치사슬 섹션은 삭제 확정.
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
  } | null;
  areas: {
    functionArea: string;
    grade: string;
    asIs: string | null;
    holdReason: string | null;
  }[];
  judgments: { anchorLevel: number | null }[];
  result: {
    totalScore: string;
    level: number;
    levelName: string;
    balanceLabel: string | null;
    strengths: string[];
    bottlenecks: string[];
    narrative: {
      conclusion: string;
      strengths: { title: string; body: string }[];
      improvements: { title: string; body: string }[];
      strategy: string;
    } | null;
  } | null;
};

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

  const pt = (i: number, v: number): [number, number] => {
    const ang = (Math.PI / 180) * (-90 + i * step);
    return [cx + R * (v / 100) * Math.cos(ang), cy + R * (v / 100) * Math.sin(ang)];
  };
  const poly = (vals: number[]) =>
    vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");

  const ownVals = axes.map((a) => a.score);

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox="0 0 360 336"
        role="img"
        aria-label={`카테고리별 준비도 차트. ${axes
          .map((a) => `${a.name} ${fmtScore(a.score)}점`)
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
        {/* 호버 툴팁 — 자사 점수 */}
        {hover !== null &&
          (() => {
            const ownLine = `자사 ${fmtScore(axes[hover].score)}`;
            const [x, y] = pt(hover, ownVals[hover]);
            const w = ownLine.length * 7 + 22;
            const h = 25;
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
      </figcaption>
    </figure>
  );
}

/* ---- 프로그레스바 (자사 채움 — 평균 마커는 벤치마크 도입 시 재추가) ---- */
function ScoreBar({ score }: { score: number }) {
  return (
    <div style={{ position: "relative", padding: "14px 0 12px" }}>
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
            background: "var(--blue-500)",
            transition: "width var(--dur-slow) var(--ease)",
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   페이지
   ============================================================ */
export default function ResultPage() {
  const router = useRouter();
  const { companyInput, assessmentId, completedSteps, completeStep } = useDiagnosis();
  const [data, setData] = useState<ResultPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ---- 화면 상태 ---- */
  const [selectedAxis, setSelectedAxis] = useState<string | null>(null);
  const [showAllAxes, setShowAllAxes] = useState(false);
  const statRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!assessmentId) return;
    api<ResultPayload>(`/api/assessments/${assessmentId}/result`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."));
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
  if (!data) return <RouteLoading messages={["진단 결과를 불러오고 있어요"]} />;

  const { areas, result } = data;
  const axes: AxisView[] = data.axes.map((a) => ({
    code: a.axisCode,
    name: a.axisName,
    score: Number(a.score ?? 0), // 미판정 축은 0점으로 표시 (레이더 5축 고정)
    answeredCount: a.answeredCount ?? 0,
    totalCount: a.totalCount ?? 0,
  }));
  const axisByCode = new Map(axes.map((a) => [a.code, a]));
  const axesByBottleneck = [...axes].sort((a, b) => a.score - b.score);

  const answered = data.judgments.filter((j) => j.anchorLevel !== null).length;
  const totalQ = data.judgments.length;
  const lowCoverage = totalQ > 0 && answered / totalQ < 0.5;

  const companyName = companyInput.trim();
  const totalScore = result ? Number(result.totalScore) : null;
  const selectedScore = selectedAxis ? axisByCode.get(selectedAxis) : undefined;

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

  /* ---- 통계 칩 — 수집된 값만 (외부 데이터 연동 전까지는 비어 있을 수 있음) ---- */
  const companyStats = [
    co?.revenueMillion != null ? { label: "연 매출", value: fmtRevenue(co.revenueMillion) } : null,
    co?.employees != null ? { label: "고용", value: `${co.employees}명` } : null,
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
                  <p
                    style={{
                      margin: "10px 0 0",
                      font: "var(--text-body2)",
                      color: "var(--fg-secondary)",
                    }}
                  >
                    종합 {fmtScore(totalScore)}점 · 판정 {answered}/{totalQ}문항
                    {result.balanceLabel ? ` · ${result.balanceLabel}` : ""}
                  </p>
                  {lowCoverage && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        font: "var(--text-caption)",
                        color: "var(--fg-quaternary)",
                      }}
                    >
                      자료가 부족해 일부 문항은 판정을 보류했어요. 자료를 더 올리면 진단이
                      정확해져요.
                    </p>
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
                <p
                  style={{
                    margin: "10px 0 0",
                    font: "var(--text-body1)",
                    color: "var(--fg-tertiary)",
                  }}
                >
                  판정 가능한 자료가 부족해 점수를 산출하지 못했어요.
                </p>
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
            <SectionHead title="카테고리별 준비도" />
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
                        <ScoreBar score={a.score} />
                        <p style={{ margin: 0, font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                          판정 {a.answeredCount}/{a.totalCount}
                        </p>
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
                        <ScoreBar score={selectedScore.score} />
                        <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-tertiary)" }}>
                          판정 {selectedScore.answeredCount}/{selectedScore.totalCount}
                        </p>
                      </div>
                    ) : (
                      /* 기본 상태 — 요약 */
                      <div style={{ display: "grid", gap: 14 }}>
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
                            </div>
                            <ScoreBar score={totalScore} />
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
                              <strong style={{ color: "var(--fg-danger)", fontWeight: 600 }}>병목</strong> ·{" "}
                              {axisScoreLine(result.bottlenecks)}
                            </p>
                            <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
                              <strong style={{ color: "var(--fg-success)", fontWeight: 600 }}>강점</strong> ·{" "}
                              {axisScoreLine(result.strengths)}
                            </p>
                          </div>
                        )}
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
      )}

      {/* ================= 섹션 3 — 8영역 (은은한 밴드) ================= */}
      {areas.length > 0 && (
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
                  </Card>
                );
              })}
            </div>
          </Inner>
        </section>
      )}

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

                <div style={{ marginTop: 24, display: "grid", gap: 22 }}>
                  {(
                    [
                      {
                        label: "강점",
                        color: "var(--fg-success)",
                        items: result.narrative.strengths,
                      },
                      {
                        label: "보완",
                        color: "var(--fg-warning)",
                        items: result.narrative.improvements,
                      },
                      {
                        label: "AX 전략 제안",
                        color: "var(--fg-brand)",
                        items: [{ title: null, body: result.narrative.strategy }],
                      },
                    ] as { label: string; color: string; items: { title: string | null; body: string }[] }[]
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
    </div>
  );
}
