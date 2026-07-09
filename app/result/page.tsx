"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge, Button, Card, Eyebrow, Icons } from "@/components/ui";
import { SourceChips } from "@/components/flow/SourceChip";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";

import { computeOverall, sortAxesByScore } from "@/lib/scoring/engine";
import type { AreaGrade, AxisScore, EvidenceRef, Judgment } from "@/lib/types";
import { ANCHOR_SCORE, AXES, areaName } from "@/data/rubric/meta";
import { rubricQuestions } from "@/data/rubric/questions";
import { judgments } from "@/data/scenario/judgments";
import { areaAssessments } from "@/data/scenario/areas";
import { valueChainAnalysis } from "@/data/scenario/valueChain";
import { uploadedDocs } from "@/data/scenario/documents";
import { demoCompany } from "@/data/scenario/company";
import {
  axisFindings,
  overallOpinion,
  positionFootnote,
  recommendationClose,
  strategyType,
} from "@/data/scenario/narrative";

/* ============================================================
   S2 진단 결과 (F-ANL-01~08)
   - 점수는 런타임에 computeOverall(judgments)로 산출 (하드코딩 금지)
   - 5섹션: 종합 소견(다크) → 6축(white) → 8영역(mist)
     → 가치사슬(white) → 권고 확인(mist)
   ============================================================ */

const mono: CSSProperties = { fontFamily: "var(--font-mono)" };

/** 점수 표기 — 소수 1자리까지 (정수는 정수로) */
function fmtScore(n: number | null): string {
  if (n === null) return "—";
  return String(Math.round(n * 10) / 10);
}

function fmtDelta(d: number): string {
  const r = Math.round(Math.abs(d) * 10) / 10;
  return `${d >= 0 ? "+" : "-"}${r}`;
}

/* ---- 풀블리드 타일 섹션 ---- */
function Section({
  tone,
  wide = false,
  children,
}: {
  tone: "dark" | "mist" | "white";
  wide?: boolean;
  children: ReactNode;
}) {
  const bg =
    tone === "dark"
      ? "var(--surface-dark)"
      : tone === "mist"
        ? "var(--surface-mist)"
        : "var(--surface-page)";
  return (
    <section
      style={{
        background: bg,
        color: tone === "dark" ? "var(--on-dark)" : "var(--text-body)",
        padding: "var(--space-section) 24px",
      }}
    >
      <div style={{ maxWidth: wide ? 1200 : 980, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function SectionHeader({
  eyebrow,
  title,
  caption,
}: {
  eyebrow: string;
  title: string;
  caption?: string;
}) {
  return (
    <header style={{ marginBottom: "var(--space-xl)" }}>
      <Eyebrow style={{ marginBottom: 12 }}>{eyebrow}</Eyebrow>
      <h2
        style={{
          fontSize: "var(--type-section-size)",
          fontWeight: 600,
          lineHeight: "var(--type-section-line)",
          letterSpacing: "var(--type-section-track)",
          color: "var(--text-strong)",
          margin: 0,
        }}
      >
        {title}
      </h2>
      {caption && (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: "var(--type-caption-size)",
            color: "var(--text-secondary)",
          }}
        >
          {caption}
        </p>
      )}
    </header>
  );
}

/* ============================================================
   레이더 차트 — SVG 직접 구현 (6각형)
   ============================================================ */
function RadarChart({ axes }: { axes: AxisScore[] }) {
  const cx = 170;
  const cy = 162;
  const R = 112;

  const pt = (i: number, v: number): [number, number] => {
    const ang = (Math.PI / 180) * (-90 + i * 60);
    return [cx + R * (v / 100) * Math.cos(ang), cy + R * (v / 100) * Math.sin(ang)];
  };
  const poly = (vals: number[]) =>
    vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(",")).join(" ");

  const ownVals = axes.map((a) => a.score ?? 0);
  const indVals = axes.map((a) => a.industryAvg);

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox="0 0 340 324"
        role="img"
        aria-label={`6축 준비도 레이더 차트 — 자사 점수와 업종 평균 비교. ${axes
          .map((a) => `${a.name} ${fmtScore(a.score)}점(업종 ${a.industryAvg}점)`)
          .join(", ")}`}
        style={{ width: "100%", maxWidth: 460, display: "block", margin: "0 auto" }}
      >
        {/* 그리드 링 (25/50/75/100) */}
        {[25, 50, 75, 100].map((v) => (
          <polygon
            key={v}
            points={poly(axes.map(() => v))}
            fill="none"
            stroke={v === 100 ? "var(--slate-200)" : "var(--slate-100)"}
            strokeWidth={1}
          />
        ))}
        {/* 스포크 */}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 100);
          return (
            <line
              key={a.axis}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="var(--slate-100)"
              strokeWidth={1}
            />
          );
        })}
        {/* 링 눈금 (상단 스포크) */}
        {[25, 50, 75, 100].map((v) => (
          <text
            key={v}
            x={cx + 5}
            y={cy - R * (v / 100) - 2}
            fontSize={9}
            fill="var(--slate-300)"
            fontFamily="var(--font-mono)"
          >
            {v}
          </text>
        ))}
        {/* 업종 평균 — slate 점선 스트로크만 */}
        <polygon
          points={poly(indVals)}
          fill="none"
          stroke="var(--slate-400)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeLinejoin="round"
        />
        {/* 자사 — 블루 반투명 채움 + 블루 스트로크 */}
        <polygon
          points={poly(ownVals)}
          fill="rgba(10,80,255,0.12)"
          stroke="var(--ax-blue)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {ownVals.map((v, i) => {
          const [x, y] = pt(i, v);
          return (
            <circle
              key={axes[i].axis}
              cx={x}
              cy={y}
              r={3.5}
              fill="var(--ax-blue)"
              stroke="#fff"
              strokeWidth={1.5}
            />
          );
        })}
        {/* 축 라벨 (AXES.short) */}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 117);
          const short = AXES.find((m) => m.id === a.axis)?.short ?? a.axis;
          const anchor = i === 0 || i === 3 ? "middle" : i === 1 || i === 2 ? "start" : "end";
          const dy = i === 0 ? -6 : i === 3 ? 14 : 4;
          return (
            <text
              key={a.axis}
              x={x}
              y={y + dy}
              textAnchor={anchor}
              fontSize={12.5}
              fontWeight={600}
              fill="var(--slate-700)"
              fontFamily="var(--font-sans)"
              letterSpacing="-0.01em"
            >
              {short}
            </text>
          );
        })}
      </svg>
      {/* 범례 */}
      <figcaption
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 24,
          marginTop: 14,
          fontSize: "var(--type-fine-size)",
          color: "var(--text-secondary)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <svg width="22" height="10" aria-hidden="true">
            <rect x="1" y="1" width="20" height="8" rx="2" fill="rgba(10,80,255,0.12)" stroke="var(--ax-blue)" strokeWidth="1.5" />
          </svg>
          자사
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <svg width="22" height="10" aria-hidden="true">
            <line x1="1" y1="5" x2="21" y2="5" stroke="var(--slate-400)" strokeWidth="1.5" strokeDasharray="4 3" />
          </svg>
          업종평균 (중소 금속가공 표본)
        </span>
      </figcaption>
    </figure>
  );
}

/* ============================================================
   축별 리스트 행 — 점수·업종 비교·근거·채점 기준 접기
   ============================================================ */
function MiniBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 26, fontSize: 11, color: "var(--slate-500)", flex: "none" }}>
        {label}
      </span>
      <span
        style={{
          flex: 1,
          height: 6,
          borderRadius: "var(--radius-pill)",
          background: "var(--slate-100)",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${Math.max(0, Math.min(100, value))}%`,
            borderRadius: "var(--radius-pill)",
            background: color,
          }}
        />
      </span>
      <span style={{ ...mono, fontSize: 12, color: "var(--slate-600)", width: 36, textAlign: "right", flex: "none" }}>
        {fmtScore(value)}
      </span>
    </span>
  );
}

function QuestionEvidenceRow({ judgment }: { judgment: Judgment | undefined }) {
  if (!judgment) {
    return (
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--slate-500)" }}>
        판정 데이터 없음 — 자료 보완 시 판정이 가능해집니다.
      </p>
    );
  }
  const deferred = judgment.anchor === null;
  return (
    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        {deferred ? (
          <Badge tone="outline">판정 보류 — 감점이 아닌 커버리지 하락</Badge>
        ) : (
          <Badge tone="neutral">
            <span style={mono}>{judgment.anchor}</span>
            <span style={mono}>{ANCHOR_SCORE[judgment.anchor!]}점</span>
          </Badge>
        )}
        {judgment.lowConfidence && <Badge tone="outline">신뢰도 낮음</Badge>}
      </div>
      {deferred && judgment.deferReason && (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--slate-600)" }}>
          {judgment.deferReason}
        </p>
      )}
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--slate-600)" }}>
        {judgment.rationale}
      </p>
      {judgment.evidence.length > 0 && <SourceChips items={judgment.evidence} />}
    </div>
  );
}

function AxisRow({ axis }: { axis: AxisScore }) {
  const [open, setOpen] = useState(false);
  const questions = rubricQuestions.filter((q) => q.axis === axis.axis);
  const byId = useMemo(() => new Map(judgments.map((j) => [j.questionId, j])), []);
  const delta = (axis.score ?? 0) - axis.industryAvg;
  const partial = axis.judgedCount < axis.totalCount;

  return (
    <Card style={{ padding: "20px 22px" }}>
      {/* 헤더: 축명 + 점수 */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <strong style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-strong)" }}>
            {axis.name}
          </strong>
          {axis.estimated && <Badge tone="outline">추정(신뢰도 낮음)</Badge>}
          {partial && (
            <Badge tone="outline">
              <span style={mono}>
                판정 {axis.judgedCount}/{axis.totalCount} · 커버리지 {Math.round(axis.coverage * 100)}%
              </span>
            </Badge>
          )}
        </div>
        <span style={{ ...mono, fontSize: 26, fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap" }}>
          {fmtScore(axis.score)}
          <span style={{ fontSize: 13, fontWeight: 400, color: "var(--slate-400)" }}>/100</span>
        </span>
      </div>

      {/* 업종 평균 미니 비교 */}
      <div style={{ display: "grid", gap: 5, margin: "14px 0 0" }}>
        <MiniBar label="자사" value={axis.score ?? 0} color="var(--ax-blue)" />
        <MiniBar label="업종" value={axis.industryAvg} color="var(--slate-300)" />
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--slate-500)" }}>
        업종 평균 대비{" "}
        <span style={{ ...mono, color: delta >= 0 ? "var(--ax-blue)" : "var(--slate-700)", fontWeight: 600 }}>
          {fmtDelta(delta)}
        </span>
      </p>

      {/* 근거 문장 */}
      <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)" }}>
        {axisFindings[axis.axis]}
      </p>

      {/* 채점 기준·근거 접기 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          marginTop: 14,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "transparent",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ax-blue)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform .15s ease",
          }}
        >
          <Icons.chevronDown size={14} />
        </span>
        채점 기준·근거 보기
      </button>

      {open && (
        <div style={{ marginTop: 6 }}>
          {questions.map((q) => (
            <div key={q.id} style={{ borderTop: "1px solid var(--divider-soft)", padding: "14px 0" }}>
              <div style={{ ...mono, fontSize: 11, color: "var(--slate-400)", marginBottom: 4 }}>{q.id}</div>
              <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.006em", color: "var(--text-strong)" }}>
                {q.question}
              </div>
              <QuestionEvidenceRow judgment={byId.get(q.id)} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   8영역 평가 — 등급 배지 (숫자 점수 미노출, REQ-F-12)
   ============================================================ */
const GRADE_META: Record<AreaGrade, { label: string; tone: "danger" | "neutral" | "success" | "outline" }> = {
  critical: { label: "심각", tone: "danger" },
  normal: { label: "보통", tone: "neutral" },
  strength: { label: "강점", tone: "success" },
  hold: { label: "판단 보류", tone: "outline" },
};

/* ============================================================
   페이지
   ============================================================ */
export default function ResultPage() {
  const router = useRouter();
  const { companyInput, completedSteps, completeStep } = useDiagnosis();

  const overall = useMemo(() => computeOverall(judgments), []);
  const sortedAxes = useMemo(() => sortAxesByScore(overall.axes), [overall]);
  const docById = useMemo(() => new Map(uploadedDocs.map((d) => [d.id, d])), []);

  /* 가드 — 자료 정리(collect) 미완료 시 안내만 렌더 */
  if (!completedSteps.includes("collect")) {
    return (
      <Section tone="white">
        <Card style={{ maxWidth: 560, margin: "48px auto", padding: "40px 36px", textAlign: "center" }}>
          <Eyebrow style={{ marginBottom: 14, justifyContent: "center", display: "flex" }}>진단 결과</Eyebrow>
          <h1
            style={{
              margin: "0 0 12px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.014em",
              color: "var(--text-strong)",
            }}
          >
            아직 진단 결과가 준비되지 않았습니다
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: 15, lineHeight: 1.55, color: "var(--text-secondary)" }}>
            자료 정리 단계를 완료하면 업로드 자료·공개 데이터·확인 응답을 근거로 진단 결과가 생성됩니다.
          </p>
          <Button variant="primary" href="/collect">
            자료 정리로 돌아가기
          </Button>
        </Card>
      </Section>
    );
  }

  const companyName = companyInput.trim() || demoCompany.name;

  return (
    <div>
      {/* ================= 섹션 1 — 종합 소견 (다크 히어로) ================= */}
      <Section tone="dark">
        <Eyebrow tone="on-dark" style={{ marginBottom: 18 }}>
          진단 결과 — 종합 소견
        </Eyebrow>

        {/* 회사 요약 1줄 */}
        <p style={{ margin: "0 0 6px", fontSize: 15, color: "var(--on-dark-muted)" }}>
          <strong style={{ color: "var(--on-dark)", fontWeight: 600 }}>{companyName}</strong>
          {" · "}
          {demoCompany.industry} · <span style={mono}>{demoCompany.employees}</span>명
          <sup style={{ fontSize: 10, marginLeft: 2 }}>*</sup>
        </p>
        <p style={{ margin: "0 0 36px", fontSize: "var(--type-fine-size)", color: "var(--slate-500)" }}>
          * {demoCompany.infoSource}
        </p>

        {/* 대표 지표 — 단계(Lv) 하나만 초대형 (REQ-F-10) */}
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(44px, 8vw, 72px)",
            fontWeight: 700,
            lineHeight: 1.07,
            letterSpacing: "-0.02em",
            color: "var(--on-dark)",
          }}
        >
          {overall.level.label}
        </h1>
        <p style={{ margin: "14px 0 0", fontSize: 13, color: "var(--on-dark-muted)" }}>
          <span style={{ ...mono, color: "var(--on-dark)" }}>
            AX 준비도 {overall.score}/100
          </span>
        </p>
        <p
          style={{
            margin: "10px 0 0",
            maxWidth: 700,
            fontSize: 17,
            lineHeight: 1.47,
            color: "var(--on-dark-muted)",
          }}
        >
          {overall.level.description}
        </p>

        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.12)", margin: "40px 0" }} />

        {/* 3단 소견: 한마디로 / 그래서 / 권고 */}
        <div style={{ marginBottom: 32 }}>
          <Eyebrow tone="on-dark" style={{ marginBottom: 12 }}>
            한마디로
          </Eyebrow>
          <p
            style={{
              margin: 0,
              maxWidth: 820,
              fontSize: "clamp(22px, 3.4vw, 30px)",
              fontWeight: 600,
              lineHeight: 1.25,
              letterSpacing: "-0.014em",
              color: "var(--on-dark)",
            }}
          >
            {overallOpinion.oneLiner}
          </p>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 32,
          }}
        >
          <div>
            <Eyebrow tone="on-dark" style={{ marginBottom: 10 }}>
              그래서
            </Eyebrow>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--on-dark-muted)" }}>
              {overallOpinion.soWhat}
            </p>
          </div>
          <div>
            <Eyebrow tone="on-dark" style={{ marginBottom: 10 }}>
              권고
            </Eyebrow>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "var(--on-dark-muted)" }}>
              {overallOpinion.recommendation}
            </p>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.12)", margin: "40px 0 24px" }} />

        <p style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--on-dark)" }}>
          지금 시작하면 전국 중소 제조 상위 <span style={mono}>20%</span> 진입 흐름에 올라탑니다
        </p>
        <p style={{ margin: "8px 0 0", fontSize: "var(--type-fine-size)", color: "var(--slate-500)", maxWidth: 700 }}>
          {positionFootnote}
        </p>
      </Section>

      {/* ================= 섹션 2 — 6축 준비도 (white) ================= */}
      <Section tone="white" wide>
        <SectionHeader
          eyebrow="6축 준비도"
          title="어디가 강하고, 어디가 병목인가"
          caption="업종 평균(중소 금속가공 표본)과 비교합니다. 오른쪽 목록은 병목(낮은 점수) 축 우선 정렬."
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 48,
            alignItems: "start",
          }}
        >
          <div style={{ position: "sticky", top: 120 }}>
            <RadarChart axes={overall.axes} />
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {sortedAxes.map((axis) => (
              <AxisRow key={axis.axis} axis={axis} />
            ))}
          </div>
        </div>
      </Section>

      {/* ================= 섹션 3 — 8영역 평가 (mist) ================= */}
      <Section tone="mist">
        <SectionHeader
          eyebrow="8영역 평가"
          title="기능영역별 현재 상태"
          caption="점수가 아닌 등급으로 표기합니다 — 심각 영역부터. 자료가 부족한 영역은 판단을 보류합니다."
        />
        <div style={{ display: "grid", gap: 14 }}>
          {[...areaAssessments]
            .sort((a, b) => a.priority - b.priority)
            .map((area) => {
              const meta = GRADE_META[area.grade];
              return (
                <Card key={area.areaId} style={{ padding: "20px 22px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                    <strong style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-strong)" }}>
                      {areaName(area.areaId)}
                    </strong>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--text-body)" }}>
                    {area.asIs}
                  </p>
                  {area.grade === "hold" && area.holdReason && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "12px 14px",
                        borderRadius: "var(--radius-md)",
                        background: "var(--surface-ghost)",
                        border: "1px dashed var(--slate-200)",
                        fontSize: 13,
                        lineHeight: 1.55,
                        color: "var(--slate-600)",
                      }}
                    >
                      {area.holdReason}{" "}
                      <Link
                        href="/collect"
                        style={{ color: "var(--ax-blue)", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}
                      >
                        자료 추가하기
                      </Link>
                    </div>
                  )}
                  {area.evidence.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <SourceChips items={area.evidence} />
                    </div>
                  )}
                  {area.taskIds.length > 0 && (
                    <p style={{ margin: "12px 0 0" }}>
                      <Link
                        href={`/tasks?area=${area.areaId}`}
                        onClick={() => completeStep("result")}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--ax-blue)",
                          textDecoration: "none",
                        }}
                      >
                        이 영역 개선과제 <span style={mono}>{area.taskIds.length}</span>건 보기
                        <Icons.arrow size={13} />
                      </Link>
                    </p>
                  )}
                </Card>
              );
            })}
        </div>
      </Section>

      {/* ================= 섹션 4 — 가치사슬 흐름 (white) ================= */}
      {valueChainAnalysis.available && (
        <Section tone="white" wide>
          <header style={{ marginBottom: "var(--space-xl)" }}>
            <Eyebrow style={{ marginBottom: 12 }}>가치사슬 흐름</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <h2
                style={{
                  fontSize: "var(--type-section-size)",
                  fontWeight: 600,
                  lineHeight: "var(--type-section-line)",
                  letterSpacing: "var(--type-section-track)",
                  color: "var(--text-strong)",
                  margin: 0,
                }}
              >
                발주에서 출하까지, 자료가 말하는 신호
              </h2>
              <Badge tone="accent">귀사 자료로만 산출</Badge>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
              {valueChainAnalysis.usedDocTypes.map((t) => (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid var(--hairline)",
                    background: "var(--surface-ghost)",
                    fontSize: 12,
                    color: "var(--slate-600)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </header>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            {valueChainAnalysis.signals.map((signal) => {
              const warning = signal.severity === "warning";
              const docs: EvidenceRef[] = signal.sourceDocIds.map((id) => {
                const doc = docById.get(id);
                return {
                  kind: "upload",
                  refId: id,
                  label: doc?.fileName ?? id,
                  snippet: doc?.summaryTeaser,
                };
              });
              return (
                <Card key={signal.id} style={{ padding: "20px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        color: warning ? "#9a6a12" : "var(--ax-blue)",
                      }}
                      aria-label={warning ? "주의 신호" : "참고 신호"}
                    >
                      {warning ? <Icons.alert size={18} /> : <Icons.info size={18} />}
                    </span>
                    <Badge tone={warning ? "warning" : "accent"}>{warning ? "주의" : "참고"}</Badge>
                  </div>
                  <strong
                    style={{
                      display: "block",
                      fontSize: 16,
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      lineHeight: 1.3,
                      color: "var(--text-strong)",
                    }}
                  >
                    {signal.title}
                  </strong>
                  <p style={{ margin: "10px 0 14px", fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                    {signal.finding}
                  </p>
                  <SourceChips items={docs} />
                </Card>
              );
            })}
          </div>
        </Section>
      )}

      {/* ================= 섹션 5 — 권고 확인 (mist) ================= */}
      <Section tone="mist">
        <div style={{ maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
          <Eyebrow style={{ marginBottom: 14 }}>권고 확인</Eyebrow>
          <h2
            style={{
              margin: "0 0 14px",
              fontSize: "var(--type-section-size)",
              fontWeight: 600,
              lineHeight: "var(--type-section-line)",
              letterSpacing: "var(--type-section-track)",
              color: "var(--text-strong)",
            }}
          >
            {recommendationClose.title}
          </h2>
          <p style={{ margin: "0 0 28px", fontSize: 16, lineHeight: 1.6, color: "var(--text-secondary)" }}>
            {recommendationClose.body}
          </p>

          <div
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              marginBottom: 32,
            }}
          >
            <Badge tone="accent">전략 유형 · {strategyType.label}</Badge>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)", maxWidth: 620 }}>
              {strategyType.description}
            </p>
          </div>

          <div>
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                completeStep("result");
                router.push("/tasks");
              }}
            >
              개선 과제 보기
            </Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
