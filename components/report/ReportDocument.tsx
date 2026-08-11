import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * PDF용 상세 보고서 DOM — 컨설팅 보고서판 (작업 요청 v7 전면 확장)
 *
 * v6까지는 표지·요약·ROI 세 장이었다. 진단 결과 화면에 있는 것(종합 서술·축별 근거·업무영역
 * 판정·문항별 판정 사유)이 하나도 담기지 않아 "받아 보니 너무 짧다"는 그대로였다. 그래서
 * 화면이 가진 데이터를 전부 실어 나른다 — 없는 절은 그리지 않는다(값이 없으면 그 장이 사라진다).
 *
 * 페이지 구성
 *   1  표지            2  목차
 *   3  진단 개요       4  종합 결과
 *   5~ 종합 분석 서술 · 강점/보완/전략
 *   ~  축별 상세 5장 (점수·소견·상세·업무영역 연계·그 축의 문항 판정)
 *   ~  업무영역 8개 판정
 *   ~  문항별 판정 근거표 (47문항)
 *   ~  개선 과제 상세 · 로드맵 · 예상 효과 산출 내역
 *   ~  부록 A 제출 자료 목록 · 부록 B 공개 데이터 수집 내역
 *   끝 한계 고지
 *
 * 페이지 단위 렌더 — 각 페이지가 794×1123px(A4 @96dpi) 고정 컨테이너(`data-report-page`)로
 * 분리되고, lib/pdf.ts가 페이지별로 개별 캡처해 jsPDF에 삽입한다. 넘칠 내용은 여기서 미리
 * 높이를 어림해 페이지로 나눈다 — 컨테이너가 잘라 내면 글이 통째로 사라진다.
 *
 * 중요 1: html2canvas는 oklch 등 최신 CSS 색상 함수를 지원하지 않는다. 이 파일은 Tailwind 색상
 *   유틸리티를 쓰지 않고 인라인 hex 스타일만 사용한다.
 * 중요 2: 배지·알약은 padding + 기본 line-height 조합에서 글자가 위로 밀려 찍힌다(html2canvas).
 *   그래서 Pill은 세로 padding 없이 height와 lineHeight를 같은 px로 맞춘다.
 */

/* ---- report/page.tsx와 공유하는 타입 ---- */

export type ReportRoi = {
  items: { taskNo: number; label: string; annualSaving: number; assumption: string }[];
  totalAnnualSaving: number;
  totalSelfPay: number;
  paybackMonths: number | null;
};

export type ReportAxis = {
  code: string;
  name: string;
  score: number | null;
  answeredCount: number;
  totalCount: number;
  industryAvg: number | null;
  finding: string | null;
  detail: string | null;
  functionLinks: string | null;
};

export type ReportJudgment = {
  questionCode: string;
  axisCode: string;
  questionText: string;
  anchorLevel: number | null;
  score: number | null;
  rationale: string;
  anchorCriteria: string | null;
  judgedBy: string;
};

export type ReportArea = {
  functionArea: string;
  grade: string;
  asIs: string | null;
  detail: string | null;
  holdReason: string | null;
  causeChain: string[] | null;
};

export type ReportNarrative = {
  conclusion: string;
  strengths: { title: string; body: string }[];
  improvements: { title: string; body: string }[];
  strategy: string;
  strategyLabel?: string;
  detail?: {
    overview?: string;
    strengths_detail?: string;
    improvements_detail?: string;
    strategy_detail?: string;
  } | null;
  report?: { title: string; body: string[]; summary: string } | null;
  workflow_note?: string | null;
};

export type ReportTask = {
  no: number;
  functionArea: string;
  title: string;
  description: string | null;
  expectedEffect: string | null;
  durationMinMonths: number | null;
  durationMaxMonths: number | null;
  costMin: number | null;
  costMax: number | null;
  recommendReason: string | null;
};

export type ReportStage = {
  order: number;
  stageName: string;
  taskNos: number[];
  startMonth: number;
  durationMonths: number;
  costMin: number;
  costMax: number;
};

export type ReportFile = {
  name: string;
  docTypeName: string | null;
  digitalLevel: number | null;
  status: string | null;
};

export type ReportPublicSource = {
  label: string;
  status: string;
  itemCount: number;
  note: string | null;
  summary: string[] | null;
};

export type ReportSummary = {
  level: number;
  levelName: string;
  totalScore: string;
  /** 점수 구간 Lv — 달성 조건 미충족이면 level보다 높다 */
  scoreLevel: number | null;
  capReasons: { level: number; reasons: string[] } | null;
  balanceLabel: string | null;
  diagnosedAt: string | null; // YYYY-MM-DD
  industryAvg: number | null;
  taskCount: number;
  totalMonths: number;
  costMin: number;
  costMax: number;
  roi: ReportRoi | null;
};

export type ReportCompany = {
  bizNo: string | null;
  ceoName: string | null;
  region: string | null;
  estDate: string | null;
  employees: number | null;
  revenueMillion: number | null;
  dartVerified?: boolean;
};

export type ReportStat = { label: string; value: string };

export interface ReportDocumentProps {
  companyName: string;
  summary: ReportSummary;
  company: ReportCompany | null;
  stats: ReportStat[];
  levels: { level: number; name: string }[];
  axes: ReportAxis[];
  judgments: ReportJudgment[];
  areas: ReportArea[];
  narrative: ReportNarrative | null;
  tasks: ReportTask[];
  stages: ReportStage[];
  files: ReportFile[];
  publicSources: ReportPublicSource[];
}

/* ---- 색 상수 (전부 hex — 디자인 시스템 v2 토큰과 동일 값) ---- */
const INK = "#191F28";
const SECONDARY = "#4E5968";
const MUTED = "#8B95A1";
const BLUE = "#0A50FF";
const HAIRLINE = "#E5E8EB";
const MIST = "#F9FAFB";
const WASH = "#EEF3FF";
const WHITE = "#FFFFFF";
const TRACK = "#E5E8EB";
const AMBER = "#B45608";
const GREEN = "#0F7B4F";

const SANS = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

const PAGE_W = 794; // A4 210mm @ 96dpi
const PAGE_H = 1123; // A4 297mm @ 96dpi
const PAGE_PAD = 56;
/** 본문에 쓸 수 있는 세로 — 위 여백 + 아래 꼬리말을 뺀 값. 페이지 나누기의 기준 */
const BODY_H = PAGE_H - PAGE_PAD * 2;
/** 실제로 채우는 한도 — 어림 높이가 행마다 몇 px씩 모자라면 마지막 행이 잘린다. 그 오차분을 비워 둔다 */
const FILL_H = BODY_H - 28;

const fmt = (n: number) => n.toLocaleString("ko-KR");
const LEVEL_LABEL: Record<number, string> = {
  1: "L1 수기",
  2: "L2 개인문서",
  3: "L3 정형양식",
  4: "L4 시스템출력",
};

/** 본문 폭에서 12.5px 글자가 한 줄에 들어가는 대략의 글자 수 — 넉넉하게 잡아 넘침을 막는다 */
const linesOf = (text: string, perLine = 46) =>
  Math.max(1, Math.ceil((text?.length ?? 0) / perLine));

/** 점수 표기 — 화면과 같은 소수 1자리 */
const score1 = (v: string | number) => {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n * 10) / 10) : String(v);
};

/**
 * 서술의 축 표기를 사용자 말로 (작업 요청 v7) — "IT 축" 같은 약어를 축 이름으로 편다.
 * 화면(result/page.tsx)의 renderRich와 같은 규칙이되, PDF는 굵기 마크업 없이 글자만 바꾼다.
 * 축 코드는 영문 2글자라 정규식 특수문자가 없다 — 이스케이프는 필요 없다.
 */
const withAxisNames = (text: string | null | undefined, axes: { code: string; name: string }[]) => {
  let out = text ?? "";
  for (const a of axes) {
    if (!/^[A-Za-z]{2,4}$/.test(a.code) || !a.name) continue;
    out = out.replace(new RegExp(`(^|[^A-Za-z0-9_])\\(?${a.code}\\)?(\\s*)축`, "g"), `$1${a.name}$2축`);
  }
  return out;
};

/**
 * `**굵게**` 마크업을 실제 굵기로 바꾼다. PDF에는 마크다운 파서가 없어 그대로 두면
 * 별표가 본문에 그대로 찍힌다(서사 에이전트가 강조에 이 표기를 쓴다).
 */
const boldify = (s: string): ReactNode =>
  s
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} style={{ fontWeight: 700, color: INK }}>
          {part}
        </strong>
      ) : (
        part
      ),
    );

/** 축 표기를 펴고 굵기 마크업까지 처리한 본문 노드 */
const rich = (text: string | null | undefined, axes: { code: string; name: string }[]): ReactNode =>
  boldify(withAxisNames(text, axes));

/* ============ 페이지 골격 ============ */

function Page({
  no,
  total,
  companyName,
  children,
}: {
  no: number;
  total: number;
  companyName: string;
  children: ReactNode;
}) {
  return (
    <div
      data-report-page=""
      style={{
        width: PAGE_W,
        height: PAGE_H,
        boxSizing: "border-box",
        background: WHITE,
        color: INK,
        fontFamily: SANS,
        letterSpacing: "-0.01em",
        padding: `${PAGE_PAD}px ${PAGE_PAD}px 0`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>{children}</div>
      {/* 페이지 하단 — AXpoint 표기 + 페이지 번호 */}
      <div
        style={{
          flex: "none",
          height: PAGE_PAD,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${HAIRLINE}`,
          fontSize: 10.5,
          color: MUTED,
        }}
      >
        <span>
          <span style={{ fontWeight: 700, color: BLUE }}>AXpoint</span>
          <span> · {companyName} AX 진단 상세 보고서</span>
        </span>
        <span style={{ fontFamily: MONO }}>
          {no} / {total}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ no, sub, children }: { no: string; sub?: string; children: ReactNode }) {
  return (
    <div
      style={{
        paddingBottom: 10,
        borderBottom: `1px solid ${HAIRLINE}`,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: BLUE }}>{no}</span>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.012em", color: INK }}>
          {children}
        </span>
      </div>
      {sub && <div style={{ marginTop: 5, fontSize: 11.5, color: MUTED }}>{sub}</div>}
    </div>
  );
}

/**
 * 배지·알약 — html2canvas가 세로 padding + line-height 조합에서 글자를 위로 밀어 찍는다.
 * 세로 padding을 0으로 두고 height와 lineHeight를 같은 px로 맞추면 그 어긋남이 사라진다.
 */
function Pill({
  children,
  tone = "brand",
  size = 22,
}: {
  children: ReactNode;
  tone?: "brand" | "muted" | "warn" | "ok";
  size?: number;
}) {
  const palette = {
    brand: { bg: WASH, fg: BLUE },
    muted: { bg: MIST, fg: SECONDARY },
    warn: { bg: "#FFF6E9", fg: AMBER },
    ok: { bg: "#EAF7F0", fg: GREEN },
  }[tone];
  return (
    <span
      style={{
        display: "inline-block",
        height: size,
        lineHeight: `${size}px`,
        padding: "0 11px",
        borderRadius: size / 2,
        boxSizing: "border-box",
        background: palette.bg,
        color: palette.fg,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: "nowrap",
        verticalAlign: "top",
      }}
    >
      {children}
    </span>
  );
}

const th: CSSProperties = {
  textAlign: "left",
  fontSize: 11.5,
  fontWeight: 600,
  color: SECONDARY,
  padding: "7px 10px",
  borderBottom: `1px solid ${HAIRLINE}`,
  background: MIST,
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.55,
  color: INK,
  padding: "7px 10px",
  borderBottom: `1px solid ${HAIRLINE}`,
  verticalAlign: "top",
};

const tdMono: CSSProperties = { ...td, fontFamily: MONO, whiteSpace: "nowrap" };

const note: CSSProperties = { marginTop: 10, fontSize: 11, lineHeight: 1.6, color: MUTED };

const para: CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  lineHeight: 1.75,
  color: SECONDARY,
  whiteSpace: "pre-wrap",
};

/** 요약 스탯 타일 — 화면의 요약 카드와 같은 구성 */
function Stat({ label, value, caption }: { label: string; value: ReactNode; caption?: string }) {
  return (
    <div
      style={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 12,
        padding: "14px 16px",
        flex: "1 1 0",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: INK, lineHeight: 1.2 }}>
        {value}
      </div>
      {caption && <div style={{ marginTop: 6, fontSize: 10.5, color: MUTED }}>{caption}</div>}
    </div>
  );
}

/** 점수 막대 — 자사 대비 업종 평균 마커 */
function ScoreBar({ score, avg }: { score: number; avg: number | null }) {
  const pct = Math.min(Math.max(score, 0), 100);
  return (
    <div style={{ position: "relative", height: 8, background: TRACK, borderRadius: 4 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: 8,
          width: `${pct}%`,
          background: BLUE,
          borderRadius: 4,
        }}
      />
      {avg !== null && (
        <div
          style={{
            position: "absolute",
            left: `${Math.min(Math.max(avg, 0), 100)}%`,
            top: -3,
            width: 2,
            height: 14,
            background: SECONDARY,
          }}
        />
      )}
    </div>
  );
}

/* ============ 페이지 나누기 ============ */

/** fixed=쪽을 통째로 차지해야 하는 블록. 실측값으로 줄이면 뒤에 다른 블록이 얹힌다 */
type Block = { key: string; h: number; node: ReactNode; fixed?: boolean };

/**
 * 블록을 쪽에 채운다 — 한 블록이 한 쪽보다 크면 그 쪽을 혼자 쓴다.
 * height는 실측 높이를 돌려주는 함수다. 측정 전 첫 렌더에서는 어림값이 쓰인다.
 */
function pack(blocks: Block[], height: (b: Block) => number): Block[][] {
  const pages: Block[][] = [];
  let cur: Block[] = [];
  let used = 0;
  for (const b of blocks) {
    const h = height(b);
    if (cur.length > 0 && used + h > FILL_H) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(b);
    used += h;
  }
  if (cur.length > 0) pages.push(cur);
  return pages;
}

/** 표를 쪽마다 나눠 담는다 — 행 높이를 어림해 넘치기 전에 끊는다 */
function tableBlocks<T>({
  key,
  head,
  rows,
  rowHeight,
  renderRow,
  title,
  headerH,
}: {
  key: string;
  head: ReactNode;
  rows: T[];
  rowHeight: (row: T) => number;
  renderRow: (row: T, i: number) => ReactNode;
  /** 첫 쪽에 붙는 절 제목 블록 (있으면 그 높이를 함께 계산) */
  title?: { node: ReactNode; h: number };
  headerH: number;
}): Block[] {
  const out: Block[] = [];
  let chunk: T[] = [];
  let used = (title?.h ?? 0) + headerH;
  let part = 0;
  const flush = () => {
    if (chunk.length === 0) return;
    const rowsNow = chunk;
    const first = part === 0;
    out.push({
      key: `${key}-${part}`,
      h: BODY_H, // 쪽을 통째로 쓴다 — 표 뒤에 다른 블록을 얹지 않는다
      fixed: true,
      node: (
        <div>
          {first && title ? title.node : null}
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>{head}</thead>
            <tbody>{rowsNow.map((r, i) => renderRow(r, i))}</tbody>
          </table>
        </div>
      ),
    });
    part += 1;
    chunk = [];
    used = headerH;
  };
  for (const r of rows) {
    const h = rowHeight(r);
    if (chunk.length > 0 && used + h > FILL_H) flush();
    chunk.push(r);
    used += h;
  }
  flush();
  return out;
}

/* ============ 본문 ============ */

export function ReportDocument({
  companyName,
  summary,
  company,
  stats,
  levels,
  axes,
  judgments,
  areas,
  narrative,
  tasks,
  stages,
  files,
  publicSources,
}: ReportDocumentProps) {
  /* 쪽 나누기는 원래 어림 높이로만 했다. 어림이 모자라면 쪽이 overflow:hidden이라 잘리고,
     넉넉하면 쪽 하단에 큰 여백이 남았다(perLine 46자는 실제 폭보다 보수적이라 후자가 잦았다).
     그래서 첫 렌더에서 블록을 화면 밖에 실제로 그려 높이를 재고, 그 값으로 다시 나눈다.
     어림값은 측정 전 1패스용 폴백으로만 남는다 */
  const [measured, setMeasured] = useState<Record<string, number> | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const roi = summary.roi;
  const scoreNum = Number(summary.totalScore);
  const detail = narrative?.detail ?? null;

  /* 업종 대비 포지션 — 화면과 동일 계산 */
  const industryDiff = summary.industryAvg !== null ? scoreNum - summary.industryAvg : null;
  const diffAhead = industryDiff !== null && industryDiff >= 0;
  const diffLabel =
    industryDiff !== null
      ? `${industryDiff >= 0 ? "+" : "-"}${Math.abs(industryDiff).toFixed(1)}점`
      : null;

  const hasPayback = roi !== null && roi.totalAnnualSaving > 0 && roi.paybackMonths !== null;
  const monthlySaving =
    roi && roi.totalAnnualSaving > 0 ? Math.round(roi.totalAnnualSaving / 12) : 0;

  const answered = judgments.filter((j) => j.anchorLevel !== null).length;
  const taskByNo = new Map(tasks.map((t) => [t.no, t]));

  /* 절 번호는 순차 발급 — 데이터가 없어 빠지는 절이 있어도 번호가 비지 않는다 */
  let sec = 0;
  const nextNo = () => String(++sec).padStart(2, "0");
  /** 목차용 — 절 제목을 발급 순서대로 모은다 */
  const toc: { no: string; title: string }[] = [];
  const section = (title: string, sub?: string) => {
    const no = nextNo();
    toc.push({ no, title });
    return {
      node: (
        <SectionTitle no={no} sub={sub}>
          {title}
        </SectionTitle>
      ),
      h: sub ? 74 : 52,
    };
  };

  /* ── 본문 블록 만들기 ─────────────────────────────────────────────
     여기서 만든 블록을 pack()이 쪽에 나눠 담는다. 표지·목차는 따로 앞에 붙인다 */
  const blocks: Block[] = [];
  const push = (key: string, h: number, node: ReactNode) => blocks.push({ key, h, node });
  /** 이 블록부터 새 쪽에서 시작 — 절이 쪽 아래에 반쪽만 걸치지 않게 */
  const pageBreak = (key: string) => blocks.push({ key, h: BODY_H + 1, node: null });

  /* ── 진단 개요 ── */
  {
    const t = section("진단 개요", `진단일 ${summary.diagnosedAt ?? "—"}`);
    const rows: [string, string][] = [
      ["상호", companyName],
      ...(company?.bizNo
        ? ([
            [
              "사업자번호",
              `${company.bizNo.slice(0, 3)}-${company.bizNo.slice(3, 5)}-${company.bizNo.slice(5)}`,
            ],
          ] as [string, string][])
        : []),
      ...(company?.ceoName ? ([["대표", company.ceoName]] as [string, string][]) : []),
      ...(company?.estDate ? ([["설립", company.estDate]] as [string, string][]) : []),
      ...(company?.region ? ([["소재지", company.region]] as [string, string][]) : []),
      ...(company?.employees != null
        ? ([["직원 수", `${fmt(company.employees)}명`]] as [string, string][])
        : []),
      /* 문항 수는 뺐다 — 문항별 판정은 축별 상세와 판정 근거표에서 그대로 볼 수 있다 */
      [
        "진단 범위",
        `제출 자료 ${files.length}건 · 공개 데이터 ${publicSources.length}종`,
      ],
    ];
    push(
      "overview",
      t.h + rows.length * 32 + (stats.length ? 110 : 0) + 40,
      <div>
        {t.node}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <td style={{ ...td, width: 110, fontWeight: 600, color: SECONDARY }}>{label}</td>
                <td style={td}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {stats.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: SECONDARY, marginBottom: 10 }}>
              공개 데이터로 확인한 기업 지표
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {stats.map((s) => (
                <span
                  key={s.label}
                  style={{
                    border: `1px solid ${HAIRLINE}`,
                    borderRadius: 10,
                    padding: "9px 14px",
                    minWidth: 118,
                  }}
                >
                  <span style={{ display: "block", fontSize: 10.5, color: MUTED }}>{s.label}</span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontFamily: MONO,
                      fontSize: 14,
                      fontWeight: 700,
                      color: INK,
                    }}
                  >
                    {s.value}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
        {company?.dartVerified && (
          <div style={note}>재무 데이터는 DART 전자공시로 검증된 값입니다.</div>
        )}
      </div>,
    );
  }

  /* ── 종합 결과 ── */
  {
    const t = section("종합 결과");
    const capLines = summary.capReasons?.reasons.length ?? 0;
    push(
      "summary",
      t.h + 130 + (industryDiff !== null ? 150 : 0) + capLines * 26 + 120,
      <div>
        {t.node}
        <div style={{ display: "flex", gap: 12 }}>
          <Stat label="현재 단계" value={`Lv.${summary.level} ${summary.levelName}`} />
          <Stat
            label="종합 점수"
            value={<span style={{ fontFamily: MONO, color: BLUE }}>{score1(summary.totalScore)}점</span>}
            caption={`분석 완료 ${answered}/${judgments.length}문항`}
          />
          {diffLabel !== null && summary.industryAvg !== null ? (
            <Stat
              label="업종 대비"
              value={<span style={{ fontFamily: MONO, color: BLUE }}>{diffLabel}</span>}
              caption={`업종 표본 평균 ${Math.round(summary.industryAvg)}점 대비`}
            />
          ) : (
            <Stat label="균형" value={summary.balanceLabel ?? "—"} />
          )}
        </div>

        {/* 달성 조건 미충족 강등 — 점수 구간과 판정 단계가 다른 이유 */}
        {summary.capReasons && (
          <div
            style={{
              marginTop: 18,
              border: `1px solid ${HAIRLINE}`,
              borderLeft: `3px solid ${AMBER}`,
              borderRadius: 10,
              padding: "14px 16px",
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, color: AMBER }}>
              점수 구간은 Lv.{summary.scoreLevel ?? summary.level}이지만 달성 조건 미충족으로 Lv.
              {summary.capReasons.level}로 분석됐습니다
            </div>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {summary.capReasons.reasons.map((r) => (
                <li key={r} style={{ fontSize: 11.5, lineHeight: 1.7, color: SECONDARY }}>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {industryDiff !== null && summary.industryAvg !== null && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: SECONDARY, marginBottom: 10 }}>
              업종 대비 포지션 — 업종 평균보다 {diffLabel} {diffAhead ? "앞서 있습니다" : "뒤에 있습니다"}
            </div>
            <div style={{ maxWidth: 600 }}>
              {[
                { label: "귀사", value: scoreNum, color: BLUE },
                { label: "업종 평균", value: summary.industryAvg, color: "#B0B8C1" },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}
                >
                  <span
                    style={{ flex: "none", width: 64, fontSize: 12, fontWeight: 600, color: SECONDARY }}
                  >
                    {row.label}
                  </span>
                  <div
                    style={{ flex: "1 1 auto", position: "relative", height: 8, background: TRACK, borderRadius: 4 }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: 8,
                        width: `${Math.min(Math.max(row.value, 0), 100)}%`,
                        background: row.color,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      flex: "none",
                      width: 44,
                      textAlign: "right",
                      fontFamily: MONO,
                      fontSize: 12.5,
                      color: INK,
                    }}
                  >
                    {row.value.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 성숙도 단계 정의 — 지금 어디에 있고 다음이 무엇인지 */}
        {levels.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: SECONDARY, marginBottom: 8 }}>
              성숙도 단계
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {levels.map((l) => {
                const here = l.level === summary.level;
                return (
                  <div
                    key={l.level}
                    style={{
                      flex: "1 1 0",
                      minWidth: 0,
                      borderRadius: 9,
                      padding: "9px 8px",
                      textAlign: "center",
                      background: here ? WASH : MIST,
                      border: `1px solid ${here ? BLUE : HAIRLINE}`,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: 11,
                        fontWeight: 700,
                        color: here ? BLUE : MUTED,
                      }}
                    >
                      Lv.{l.level}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 10.5,
                        color: here ? INK : MUTED,
                        fontWeight: here ? 700 : 400,
                      }}
                    >
                      {l.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>,
    );
  }

  /* ── 종합 분석 (서사) ── */
  if (narrative) {
    pageBreak("br-narrative");
    const t = section("종합 분석", "AI 진단 컨설턴트가 판정 근거를 인용해 작성한 소견입니다");
    const title = withAxisNames(narrative.report?.title ?? narrative.conclusion, axes);
    push(
      "narr-title",
      t.h + linesOf(title, 38) * 30 + 18,
      <div>
        {t.node}
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.45, color: INK }}>
          {boldify(title)}
        </div>
      </div>,
    );

    const bodyParas = (narrative.report?.body ?? (detail?.overview ? [detail.overview] : [])).map(
      (t) => withAxisNames(t, axes),
    );
    bodyParas.forEach((p, i) => {
      push(
        `narr-body-${i}`,
        linesOf(p) * 22 + 16,
        <p key={i} style={para}>
          {boldify(p)}
        </p>,
      );
    });

    if (narrative.report?.summary) {
      push(
        "narr-summary",
        linesOf(narrative.report.summary) * 22 + 46,
        <div
          style={{
            marginTop: 6,
            background: MIST,
            borderRadius: 10,
            padding: "14px 16px",
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, color: INK, marginBottom: 6 }}>요약</div>
          <p style={{ ...para, fontSize: 12 }}>{rich(narrative.report.summary, axes)}</p>
        </div>,
      );
    }

    /* 강점 / 보완 / 전략 */
    const groups = [
      { label: "강점", color: GREEN, items: narrative.strengths, detail: detail?.strengths_detail },
      {
        label: "개선 필요",
        color: AMBER,
        items: narrative.improvements,
        detail: detail?.improvements_detail,
      },
      {
        label: `AX 전략 제안${narrative.strategyLabel ? ` — ${narrative.strategyLabel}` : ""}`,
        color: BLUE,
        items: [{ title: "", body: narrative.strategy }],
        detail: detail?.strategy_detail,
      },
    ].filter((g) => g.items.length > 0);

    if (groups.length > 0) {
      pageBreak("br-sbi");
      const st = section("강점 · 개선 필요 · 전략");
      groups.forEach((g, gi) => {
        const h =
          (gi === 0 ? st.h : 0) +
          34 +
          g.items.reduce((s, it) => s + linesOf(it.title, 40) * 22 + linesOf(it.body) * 22 + 12, 0) +
          (g.detail ? linesOf(g.detail) * 22 + 14 : 0);
        push(
          `sbi-${g.label}`,
          h,
          <div style={{ marginBottom: 6 }}>
            {gi === 0 ? st.node : null}
            <div style={{ fontSize: 13, fontWeight: 700, color: g.color, marginBottom: 8 }}>
              {g.label}
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {g.items.map((it) => (
                <li key={it.title || it.body} style={{ display: "flex", gap: 9, marginBottom: 10 }}>
                  <span
                    style={{
                      flex: "none",
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: g.color,
                      marginTop: 8,
                    }}
                  />
                  <span style={{ minWidth: 0 }}>
                    {it.title && (
                      <span
                        style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: INK }}
                      >
                        {it.title}
                      </span>
                    )}
                    <span
                      style={{
                        display: "block",
                        marginTop: it.title ? 3 : 0,
                        fontSize: 12,
                        lineHeight: 1.7,
                        color: SECONDARY,
                      }}
                    >
                      {rich(it.body, axes)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {g.detail && (
              <p style={{ ...para, fontSize: 11.5, color: MUTED, marginTop: 4, paddingLeft: 14 }}>
                {rich(g.detail, axes)}
              </p>
            )}
          </div>,
        );
      });
    }
  }

  /* ── 축별 상세 ── */
  if (axes.length > 0) {
    pageBreak("br-axes");
    const t = section(
      "카테고리별 진단 결과",
      "카테고리마다 점수 근거와 해당 문항 판정을 함께 싣습니다",
    );
    axes.forEach((a, ai) => {
      const axisJudgments = judgments.filter((j) => j.axisCode === a.code);
      const bodyH =
        (ai === 0 ? t.h : 0) +
        96 +
        (a.finding ? linesOf(a.finding) * 22 : 0) +
        (a.detail ? linesOf(a.detail) * 22 + 10 : 0) +
        (a.functionLinks ? linesOf(a.functionLinks) * 22 + 26 : 0);
      push(
        `axis-${a.code}`,
        bodyH + 20,
        <div>
          {ai === 0 ? t.node : null}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{a.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: BLUE }}>
              {a.score === null ? "—" : a.score.toFixed(1)}
            </span>
            <span style={{ fontSize: 11, color: MUTED }}>/ 100점</span>
            <span style={{ marginLeft: "auto" }}>
              <Pill tone="muted">
                분석 {a.answeredCount}/{a.totalCount}문항
              </Pill>
            </span>
          </div>
          <ScoreBar score={a.score ?? 0} avg={a.industryAvg} />
          {a.industryAvg !== null && (
            <div style={{ marginTop: 6, fontSize: 10.5, color: MUTED }}>
              세로 눈금은 업종 표본 평균 {Math.round(a.industryAvg)}점
            </div>
          )}
          {a.finding && (
            <p style={{ ...para, fontSize: 12.5, color: INK, marginTop: 10 }}>
              {rich(a.finding, axes)}
            </p>
          )}
          {a.detail && <p style={{ ...para, marginTop: 8 }}>{rich(a.detail, axes)}</p>}
          {a.functionLinks && (
            <div style={{ marginTop: 12, background: MIST, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: SECONDARY, marginBottom: 5 }}>
                업무영역 연계
              </div>
              <p style={{ ...para, fontSize: 11.5 }}>{rich(a.functionLinks, axes)}</p>
            </div>
          )}
          {axisJudgments.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 11, color: MUTED }}>
              이 카테고리의 문항 {axisJudgments.length}건은 &lsquo;문항별 판정 근거&rsquo; 절에
              모두 실려 있습니다.
            </div>
          )}
        </div>,
      );
    });
  }

  /* ── 업무 흐름 진단 (v9 A5 워크플로우 합성) ──
     화면 ③ 워크플로우 분석에 해당한다. 차트 자체는 캔버스라 PDF에 실을 수 없지만,
     서사가 낸 진단 문단(workflow_note)은 지금까지 props로 받고도 그리지 않았다.
     문서가 어디서 끊기고 무엇이 영향을 받는지가 이 보고서에서 통째로 빠져 있던 셈이다 */
  if (narrative?.workflow_note) {
    const t = section("업무 흐름 진단", "문서가 실제로 이어지는 흐름에서 끊기는 지점입니다");
    push(
      "workflow-note",
      t.h + linesOf(narrative.workflow_note) * 22 + 24,
      <div>
        {t.node}
        <p style={para}>{rich(narrative.workflow_note, axes)}</p>
      </div>,
    );
  }

  /* ── 업무영역 판정 ── */
  if (areas.length > 0) {
    pageBreak("br-areas");
    const t = section("업무영역별 진단", "8대 기능 영역의 일하는 방식과 그 근거입니다");
    areas.forEach((area, i) => {
      const body =
        area.detail ?? (area.grade === "hold" ? (area.holdReason ?? "자료가 부족합니다") : area.asIs);
      const chain = area.causeChain ?? [];
      push(
        `area-${area.functionArea}`,
        (i === 0 ? t.h : 0) + 40 + linesOf(body ?? "") * 22 + (chain.length ? chain.length * 24 + 26 : 0),
        <div style={{ marginBottom: 14 }}>
          {i === 0 ? t.node : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{area.functionArea}</span>
            {area.grade === "critical" && <Pill tone="warn">우선 개선</Pill>}
            {area.grade === "hold" && <Pill tone="muted">자료 부족</Pill>}
            {area.grade === "good" && <Pill tone="ok">양호</Pill>}
          </div>
          {body && <p style={{ ...para, fontSize: 12 }}>{rich(body, axes)}</p>}
          {chain.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: MUTED, marginBottom: 5 }}>
                인과 사슬
              </div>
              {chain.map((step, si) => (
                <div key={step} style={{ fontSize: 11.5, lineHeight: 1.7, color: SECONDARY }}>
                  {si + 1}. {step}
                </div>
              ))}
            </div>
          )}
        </div>,
      );
    });
  }

  /* ── 문항별 판정 근거표 ── */
  if (judgments.length > 0) {
    pageBreak("br-judgments");
    const t = section(
      "문항별 판정 근거",
      `진단 문항 ${judgments.length}건 · 앵커 A0~A4 분류와 판정 사유`,
    );
    const axisName = new Map(axes.map((a) => [a.code, a.name]));
    const sorted = [...judgments].sort(
      (a, b) =>
        (axes.findIndex((x) => x.code === a.axisCode) - axes.findIndex((x) => x.code === b.axisCode)) ||
        a.questionCode.localeCompare(b.questionCode),
    );
    blocks.push(
      ...tableBlocks({
        key: "judgments",
        title: { node: t.node, h: t.h },
        headerH: 34,
        head: (
          <tr>
            <th style={{ ...th, width: 66 }}>문항</th>
            <th style={{ ...th, width: 96 }}>카테고리</th>
            <th style={th}>문항 내용 · 판정 사유</th>
            <th style={{ ...th, width: 54, textAlign: "center" }}>앵커</th>
            <th style={{ ...th, width: 46, textAlign: "right" }}>점수</th>
          </tr>
        ),
        rows: sorted,
        rowHeight: (j) =>
          Math.max(38, (linesOf(j.questionText, 34) + linesOf(j.rationale, 34)) * 18 + 20),
        renderRow: (j) => (
          <tr key={j.questionCode}>
            <td style={{ ...tdMono, fontSize: 11 }}>{j.questionCode}</td>
            <td style={{ ...td, fontSize: 11, color: SECONDARY, wordBreak: "keep-all" }}>
              {axisName.get(j.axisCode) ?? j.axisCode}
            </td>
            <td style={{ ...td, wordBreak: "break-all" }}>
              <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: INK }}>
                {j.questionText}
              </span>
              <span
                style={{ display: "block", marginTop: 3, fontSize: 11, lineHeight: 1.55, color: MUTED }}
              >
                {j.rationale}
              </span>
            </td>
            <td style={{ ...tdMono, textAlign: "center", fontSize: 11.5 }}>
              {j.anchorLevel === null ? "보류" : `A${j.anchorLevel}`}
            </td>
            <td style={{ ...tdMono, textAlign: "right", fontSize: 11.5 }}>
              {j.score === null ? "—" : j.score}
            </td>
          </tr>
        ),
      }),
    );
    push(
      "judgment-note",
      70,
      <div style={note}>
        &lsquo;보류&rsquo;는 감점이 아니라 판단 근거가 없어 점수를 매기지 않은 문항입니다. 해당 자료를
        추가하거나 설문에 답하면 그 문항도 점수에 반영됩니다.
      </div>,
    );
  }

  /* ── 개선 과제 ── */
  if (tasks.length > 0) {
    pageBreak("br-tasks");
    const t = section("개선 과제", `담으신 과제 ${tasks.length}건의 상세입니다`);
    tasks.forEach((task, i) => {
      const durMax = task.durationMaxMonths ?? task.durationMinMonths;
      const dur =
        task.durationMinMonths == null
          ? null
          : durMax === 0 // 1단계 교육·워크숍·컨설팅은 하루짜리라 개월 단위로 0이다
            ? "1개월 미만"
            : task.durationMinMonths === durMax
              ? `${durMax}개월`
              : `${task.durationMinMonths}~${task.durationMaxMonths}개월`;
      const cost =
        task.costMin == null || task.costMax == null
          ? null
          : `${fmt(task.costMin)}~${fmt(task.costMax)}만원`;
      push(
        `task-${task.no}`,
        (i === 0 ? t.h : 0) +
          50 +
          linesOf(task.description ?? "") * 20 +
          (task.expectedEffect ? 24 : 0) +
          (task.recommendReason ? linesOf(task.recommendReason) * 20 + 26 : 0) +
          22,
        <div
          style={{
            marginBottom: 12,
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 12,
            padding: "14px 16px",
          }}
        >
          {i === 0 ? t.node : null}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
            <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>No.{task.no}</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{task.title}</span>
            <span style={{ marginLeft: "auto", display: "inline-flex", gap: 5 }}>
              <Pill tone="muted" size={20}>
                {task.functionArea}
              </Pill>
              {dur && (
                <Pill tone="brand" size={20}>
                  {dur}
                </Pill>
              )}
            </span>
          </div>
          {task.description && <p style={{ ...para, fontSize: 11.5 }}>{task.description}</p>}
          {task.expectedEffect && (
            <div style={{ marginTop: 6, fontSize: 11.5, fontWeight: 600, color: BLUE }}>
              기대효과 · {task.expectedEffect}
            </div>
          )}
          {cost && (
            <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>
              자부담 밴드 <span style={{ fontFamily: MONO }}>{cost}</span>
            </div>
          )}
          {task.recommendReason && (
            <div style={{ marginTop: 8, background: WASH, borderRadius: 8, padding: "9px 11px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: BLUE, marginBottom: 3 }}>
                이 기업에 추천한 이유
              </div>
              <p style={{ ...para, fontSize: 11 }}>{task.recommendReason}</p>
            </div>
          )}
        </div>,
      );
    });
  }

  /* ── 로드맵 ── */
  if (stages.length > 0) {
    pageBreak("br-roadmap");
    const t = section("AX 로드맵", `총 ${summary.totalMonths}개월 · ${stages.length}단계`);
    push(
      "roadmap",
      t.h + 60 + stages.length * 56 + 130,
      <div>
        {t.node}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 44 }}>순서</th>
              <th style={{ ...th, width: 132 }}>단계</th>
              <th style={th}>과제</th>
              <th style={{ ...th, width: 74, textAlign: "right" }}>기간</th>
              <th style={{ ...th, width: 118, textAlign: "right" }}>자부담(만원)</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <tr key={s.order}>
                <td style={{ ...tdMono, textAlign: "center" }}>{s.order}</td>
                <td style={{ ...td, fontWeight: 600 }}>{s.stageName}</td>
                <td style={{ ...td, fontSize: 11.5 }}>
                  {s.taskNos
                    .map((no) => taskByNo.get(no)?.title ?? `No.${no}`)
                    .join(" · ")}
                </td>
                <td style={{ ...tdMono, textAlign: "right" }}>
                  {s.durationMonths === 0 ? "1개월 미만" : `${s.durationMonths}개월`}
                </td>
                <td style={{ ...tdMono, textAlign: "right" }}>
                  {fmt(s.costMin)}~{fmt(s.costMax)}
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ ...td, fontWeight: 700 }} colSpan={3}>
                합계
              </td>
              <td style={{ ...tdMono, textAlign: "right", fontWeight: 700 }}>
                {summary.totalMonths}개월
              </td>
              <td style={{ ...tdMono, textAlign: "right", fontWeight: 700, color: BLUE }}>
                {fmt(summary.costMin)}~{fmt(summary.costMax)}
              </td>
            </tr>
          </tbody>
        </table>
        <div style={note}>
          자부담은 정부 지원사업(스마트공장 등) 선정 기준의 추정 밴드입니다. 사업 선정 결과에 따라
          달라질 수 있습니다.
        </div>
      </div>,
    );
  }

  /* ── 예상 효과 산출 내역 ── */
  if (roi) {
    pageBreak("br-roi");
    const t = section("예상 효과 산출 내역");
    push(
      "roi",
      t.h + 60 + roi.items.length * 56 + (hasPayback ? 90 : 0) + 90,
      <div>
        {t.node}
        {roi.items.length === 0 ? (
          <div style={{ fontSize: 13, color: MUTED }}>
            정량 효과 산출 대상 과제가 없습니다 (기반 과제는 정성 효과로 분류됩니다).
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 180 }}>항목</th>
                <th style={th}>산출 가정 (기준 단가·시간)</th>
                <th style={{ ...th, width: 116, textAlign: "right" }}>연 절감액 (만원)</th>
              </tr>
            </thead>
            <tbody>
              {roi.items.map((item) => (
                <tr key={item.taskNo}>
                  <td style={{ ...td, fontWeight: 600, fontSize: 11.5 }}>{item.label}</td>
                  <td style={{ ...td, fontSize: 11, color: SECONDARY }}>{item.assumption}</td>
                  <td style={{ ...tdMono, textAlign: "right" }}>{fmt(item.annualSaving)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700 }} colSpan={2}>
                  합산 연 효과 · 총 자부담 · 투자 회수
                </td>
                <td style={{ ...tdMono, textAlign: "right", fontWeight: 700, color: BLUE }}>
                  {fmt(roi.totalAnnualSaving)} · {fmt(roi.totalSelfPay)} ·{" "}
                  {hasPayback ? `약 ${roi.paybackMonths}개월` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {hasPayback && (
          <div
            style={{
              marginTop: 16,
              background: MIST,
              borderRadius: 10,
              padding: "14px 16px",
              fontFamily: MONO,
              fontSize: 12.5,
              lineHeight: 1.7,
              color: INK,
            }}
          >
            총 자부담 {fmt(roi.totalSelfPay)}만원 ÷ 월 효과 {fmt(monthlySaving)}만원 (연{" "}
            {fmt(roi.totalAnnualSaving)}만원 ÷ 12) ≈{" "}
            <span style={{ fontWeight: 700 }}>약 {roi.paybackMonths}개월</span>
          </div>
        )}
        <div style={note}>
          귀사 업로드 자료의 공수·재고 신호와 기준 단가로 산출한 추정 밴드입니다. 기반 과제(코드
          표준화 등)의 효과는 정성 효과로 분류되어 합산에서 제외됩니다.
        </div>
      </div>,
    );
  }

  /* ── 부록 A 제출 자료 ── */
  if (files.length > 0) {
    pageBreak("br-files");
    const t = section("부록 A · 제출 자료 목록", `이 진단이 근거로 삼은 자료 ${files.length}건`);
    blocks.push(
      ...tableBlocks({
        key: "files",
        title: { node: t.node, h: t.h },
        headerH: 34,
        head: (
          <tr>
            <th style={{ ...th, width: 34, textAlign: "right" }}>#</th>
            <th style={th}>파일명</th>
            <th style={{ ...th, width: 170 }}>소분류</th>
            <th style={{ ...th, width: 118 }}>디지털화 수준</th>
          </tr>
        ),
        rows: files,
        rowHeight: (f) => Math.max(34, linesOf(f.name, 38) * 18 + 16),
        renderRow: (f, i) => (
          <tr key={`${f.name}-${i}`}>
            <td style={{ ...tdMono, textAlign: "right", fontSize: 11, color: MUTED }}>{i + 1}</td>
            <td style={{ ...td, fontSize: 11.5, wordBreak: "break-all" }}>{f.name}</td>
            <td style={{ ...td, fontSize: 11, color: SECONDARY }}>{f.docTypeName ?? "미분류"}</td>
            <td style={{ ...td, fontSize: 11, color: SECONDARY }}>
              {f.digitalLevel != null ? (LEVEL_LABEL[f.digitalLevel] ?? `L${f.digitalLevel}`) : "—"}
            </td>
          </tr>
        ),
      }),
    );
  }

  /* ── 부록 B 공개 데이터 ── */
  if (publicSources.length > 0) {
    pageBreak("br-public");
    const t = section("부록 B · 공개 데이터 수집 내역", "기업 외부 신호로 교차 확인한 자료입니다");
    publicSources.forEach((s, i) => {
      const lines = s.summary ?? [];
      push(
        `pub-${s.label}-${i}`,
        (i === 0 ? t.h : 0) + 34 + lines.reduce((acc, l) => acc + linesOf(l, 52) * 19, 0) + 16,
        <div style={{ marginBottom: 12 }}>
          {i === 0 ? t.node : null}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{s.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: BLUE }}>{s.itemCount}건</span>
            {s.status === "failed" && <Pill tone="warn" size={19}>수집 실패</Pill>}
            {s.status === "skipped" && <Pill tone="muted" size={19}>미수집</Pill>}
          </div>
          {lines.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {lines.map((l) => (
                <li key={l} style={{ fontSize: 11, lineHeight: 1.7, color: SECONDARY }}>
                  {l}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ fontSize: 11, color: MUTED }}>{s.note ?? "수집된 자료가 없습니다."}</div>
          )}
        </div>,
      );
    });
  }

  /* ── 한계 고지 ── */
  push(
    "limit",
    120,
    <div
      style={{
        marginTop: 20,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 12,
        padding: "16px 20px",
        fontSize: 11.5,
        lineHeight: 1.7,
        color: MUTED,
      }}
    >
      한계 고지 — 이 결과는 공개 자료·제출 자료 범위 내 추정입니다. 자료를 더 주시면 정확도가
      올라갑니다. 문의: https://axcore.ai.kr
    </div>,
  );

  /* ── 쪽으로 나눈다 (페이지 브레이크 블록은 자리만 차지하고 그려지지 않는다) ── */
  /* 블록 구성이 바뀌면 다시 잰다 — 키 목록이 곧 구성이다 */
  const blockSig = blocks.map((b) => b.key).join("|");
  const sigRef = useRef<string>("");
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    if (measured && sigRef.current === blockSig) return;
    const next: Record<string, number> = {};
    el.querySelectorAll<HTMLElement>("[data-mb]").forEach((n) => {
      next[n.dataset.mb as string] = n.getBoundingClientRect().height;
    });
    sigRef.current = blockSig;
    setMeasured(next);
  }, [blockSig, measured]);

  const heightOf = (b: Block) => (b.fixed ? b.h : (measured?.[b.key] ?? b.h));
  const packed = pack(blocks, heightOf).map((page) => page.filter((b) => b.node !== null));
  const bodyPages = packed.filter((page) => page.length > 0);

  /* 표지 · 목차 2장 + 본문 */
  const totalPages = bodyPages.length + 2;

  const cover = (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: BLUE }}>
          AXpoint
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>by 주식회사 에이엑스코어</span>
      </div>

      <div style={{ marginTop: 130 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: BLUE,
          }}
        >
          AX 진단 상세 보고서
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: INK,
          }}
        >
          {companyName}
        </div>
        {summary.diagnosedAt && (
          <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 13, color: SECONDARY }}>
            진단일 {summary.diagnosedAt}
          </div>
        )}
      </div>

      <div style={{ marginTop: 60, paddingTop: 36, borderTop: `1px solid ${HAIRLINE}` }}>
        <div style={{ fontSize: 13, color: SECONDARY }}>현재 단계</div>
        <div
          style={{
            marginTop: 8,
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: INK,
          }}
        >
          {`Lv.${summary.level} ${summary.levelName}`}
        </div>
        <div style={{ marginTop: 18, display: "flex", gap: 6 }}>
          <Pill size={26}>종합 점수 {score1(summary.totalScore)}점</Pill>
          {summary.industryAvg !== null && (
            <Pill tone="muted" size={26}>
              업종 평균 {Math.round(summary.industryAvg)}점
            </Pill>
          )}
        </div>
      </div>
    </div>
  );

  const contents = (
    <div>
      <div
        style={{
          fontSize: 19,
          fontWeight: 700,
          color: INK,
          paddingBottom: 10,
          borderBottom: `1px solid ${HAIRLINE}`,
          marginBottom: 18,
        }}
      >
        목차
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {toc.map((row) => (
            <tr key={row.no}>
              <td
                style={{
                  ...tdMono,
                  width: 46,
                  color: BLUE,
                  fontWeight: 600,
                  borderBottom: `1px solid ${HAIRLINE}`,
                }}
              >
                {row.no}
              </td>
              <td style={{ ...td, fontSize: 13, padding: "10px 10px" }}>{row.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={note}>
        이 보고서는 제출 자료 {files.length}건과 공개 데이터 {publicSources.length}종을 근거로 진단
        문항 {judgments.length}건을 판정한 결과입니다.
      </div>
    </div>
  );

  return (
    <div>
      {/* 높이 측정용 — 본문과 같은 폭으로 화면 밖에 한 번 그려 재기만 한다.
          data-report-page가 없으므로 PDF 캡처 대상에 잡히지 않는다.
          display:none이면 높이가 0이라 쓸 수 없어 화면 밖 배치로 둔다 */}
      <div
        ref={measureRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -20000,
          top: 0,
          width: PAGE_W - PAGE_PAD * 2,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        {blocks
          .filter((b) => b.node !== null && !b.fixed)
          .map((b) => (
            <div key={b.key} data-mb={b.key}>
              {b.node}
            </div>
          ))}
      </div>
      <Page no={1} total={totalPages} companyName={companyName}>
        {cover}
      </Page>
      <Page no={2} total={totalPages} companyName={companyName}>
        {contents}
      </Page>
      {bodyPages.map((page, i) => (
        <Page key={page[0].key} no={i + 3} total={totalPages} companyName={companyName}>
          {page.map((b) => (
            <div key={b.key}>{b.node}</div>
          ))}
        </Page>
      ))}
    </div>
  );
}
