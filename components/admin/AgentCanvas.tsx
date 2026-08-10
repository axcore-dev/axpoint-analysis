"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Icons } from "@/components/ui";
import { api } from "@/lib/api";

/**
 * 멀티 에이전트 캔버스 — 메인 에이전트를 사용자 동선 순서로 잇고, 그 메인을 거드는 지시문을
 * 서브로 매단 관계도 (작업요청 v6-1 스케치 + v7-3 서브 연결).
 *
 *        [외부 API]                    ← 위: 이 에이전트가 부르는 외부 서비스
 *            │
 *        [메인 에이전트] ───▶ [다음 메인]   ← 가운데: 좌→우로 진단이 흐른다
 *            ├ [도구] [도구]            ← 아래: 이 에이전트가 쓸 수 있는 도구
 *            ├─ 전처리 ▸ [서브 지시문]   ← 왼쪽 통로를 타고 내려가 서브로 갈라진다
 *            └─ 폴백   ▸ [서브 지시문]
 *
 * 노드 하나가 곧 편집 가능한 지시문 하나다 — 이 화면에 없는 지시문은 없다.
 * 관계·순서의 원본은 서버(PROMPT_FLOW)다. 그래프 엣지(agent-graph.ts)는 파일럿 실행 순서라
 * 운영 동선과 어긋나므로 여기서 그리지 않는다 — 설계도를 실제인 것처럼 보여 주면 안 된다.
 */

export type GraphNode = {
  id: string;
  type: "agent" | "code" | "hitl";
  label?: string;
  promptKey?: string;
  tools?: string[];
  maxSteps?: number;
  outputSchema?: Record<string, unknown>;
  impl?: string;
};
export type GraphDef = { nodes: GraphNode[]; edges: { from: string; to: string }[] };
export type ToolMeta = Record<string, { label: string; source: string; external: boolean }>;

/** 캔버스가 그리는 지시문 한 칸 — 어드민 프롬프트 목록 항목에서 필요한 것만 추린 모양 */
export type CanvasPrompt = {
  key: string;
  label: string;
  provider: string;
  model: string;
  usingDefault: boolean;
  activeVersion: number | null;
};
/** 서버 PROMPT_FLOW — 메인 하나와 그에 매달린 서브들. uses는 코드가 넣어 주는 자료 */
export type FlowMain = {
  key: string;
  mark: string;
  desc: string;
  after: string[];
  uses?: string[];
  subs: { key: string; role: string; uses?: string[] }[];
};

/** 메인별 색 — 파이프라인 순서를 따라간다 */
const MAIN_TONE: Record<string, string> = {
  classify: "#7A5AF8",
  digest: "#0A50FF",
  agent_judge: "#0F9D58",
  agent_narrative: "#F59E0B",
  agent_tasks: "#EC4899",
  agent_review: "#EF4444",
};
const FALLBACK_TONE = "#6B7684";

const COL_W = 400;
/** 같은 단계의 메인끼리 세로 간격 */
const ROW_GAP = 56;
const MAIN_W = 232;
/* 카드 높이는 고정 — 배치 계산이 상수를 쓰므로 제목이 2행으로 늘어도 자리가 밀리지 않게
   2행 제목까지 들어가는 높이로 잡는다 (제목은 2행에서 잘라 낸다) */
const MAIN_H = 114;
/** 왼쪽 통로 — 서브로 내려가는 연결선이 도구·자료 위를 지나지 않도록 비워 둔다 */
const LANE = 44;
const SUB_W = MAIN_W;
const SUB_H = 80;
/** 서브 하나(카드+자료 줄) 다음까지의 간격 */
const SUB_GAP = 18;
/** 카드 아래 첫 자료 줄까지의 간격 */
const BELOW_CARD = 26;

/** 캔버스 기본 높이 — 화면을 채우되 위 챠트 밖 요소(제목·캡션·탭·안내 줄·페이지 여백,
    합쳐서 약 300px)를 빼고, 너무 작거나 큰 화면에서는 480~1200px 사이로 잡는다 */
const DEFAULT_HEIGHT = "clamp(480px, calc(100vh - 300px), 1200px)";

/** 제목·라벨은 말줄임 대신 2행까지 편다 — 잘리면 툴팁이 전체를 보여 준다 */
const CLAMP_2: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/* 자료·도구는 2열로 깐다 — 한 줄로 세우면 도구 여덟 개짜리 노드가 세로로 400px을 먹어
   전체 보기가 화면을 확 줄여 버린다(글자가 안 읽힌다) */
const PILL_COLS = 2;
const PILL_GAP_X = 8;
const PILL_W = (MAIN_W - PILL_GAP_X) / 2;
/* 라벨이 2행까지 펴지므로 두 줄 + 여백이 들어가는 높이 */
const PILL_H = 38;
const PILL_GAP_Y = 6;

/** 알약은 통로 오른쪽부터 깐다 — 통로는 서브로 내려가는 연결선 몫이다 */
const pillX = (i: number) => LANE + (i % PILL_COLS) * (PILL_W + PILL_GAP_X);
const pillRow = (i: number) => Math.floor(i / PILL_COLS);
const pillBlockH = (n: number) => (n === 0 ? 0 : Math.ceil(n / PILL_COLS) * (PILL_H + PILL_GAP_Y));

/* ── 비용·호출 오버레이 (v9 B10) ────────────────────────────────────
   GET /api/admin/agent-stats?days=N 의 nodeId 단위 행을 promptKey로 합산해 노드 위에 겹친다.
   기본은 꺼짐 — 켠 사람에게만 데이터를 부르고, 응답이 없으면 배지 없이 조용히 지나간다. */

type NodeStat = {
  calls: number;
  failed: number;
  tokensIn: number;
  tokensOut: number;
  avgDurationMs: number;
  /** 현재 배정 모델 단가 기준 추정치 — 단가를 모르면 null */
  estCostUsd: number | null;
};

/** nodeId 행 → promptKey 합산. 평균 시간은 호출 수 가중 평균, 비용은 전부 미상일 때만 null */
function aggregateStats(items: (NodeStat & { promptKey: string | null })[]) {
  const byKey = new Map<string, NodeStat>();
  for (const it of items) {
    if (!it.promptKey) continue;
    const prev = byKey.get(it.promptKey);
    if (!prev) {
      byKey.set(it.promptKey, {
        calls: it.calls,
        failed: it.failed,
        tokensIn: it.tokensIn,
        tokensOut: it.tokensOut,
        avgDurationMs: it.avgDurationMs,
        estCostUsd: it.estCostUsd,
      });
      continue;
    }
    const calls = prev.calls + it.calls;
    prev.avgDurationMs =
      calls > 0 ? (prev.avgDurationMs * prev.calls + it.avgDurationMs * it.calls) / calls : 0;
    prev.calls = calls;
    prev.failed += it.failed;
    prev.tokensIn += it.tokensIn;
    prev.tokensOut += it.tokensOut;
    prev.estCostUsd =
      prev.estCostUsd === null && it.estCostUsd === null
        ? null
        : (prev.estCostUsd ?? 0) + (it.estCostUsd ?? 0);
  }
  return byKey;
}

/** 1234 → 1.2k — 칩에 긴 수가 들어가지 않게 */
const abbr = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k` : String(n));
const fmtCost = (v: number) => (v > 0 && v < 0.005 ? "<$0.01" : `$${v.toFixed(2)}`);
const fmtDur = (ms: number) =>
  ms >= 60000 ? `${(ms / 60000).toFixed(1)}분` : `${(ms / 1000).toFixed(ms > 0 && ms < 10000 ? 1 : 0)}초`;

/** 노드 위에 얹는 통계 칩 — 카드 우상단 모서리에 겹쳐 배치가 밀리지 않는다 */
function StatChip({ stat, days }: { stat: NodeStat; days: number }) {
  return (
    <span
      title={`최근 ${days}일 — 호출 ${stat.calls} · 실패 ${stat.failed} · 토큰 입력 ${abbr(stat.tokensIn)}·출력 ${abbr(stat.tokensOut)} · 평균 ${fmtDur(stat.avgDurationMs)}. 비용은 현재 배정 모델 단가 기준 추정치`}
      style={{
        position: "absolute",
        top: -11,
        right: 8,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: "var(--radius-full)",
        border: "1px solid var(--line-default)",
        background: "var(--bg-elevated)",
        boxShadow: "var(--shadow-1)",
        font: "500 11px/1.4 var(--font-sans)",
        color: "var(--fg-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      <span>호출 {abbr(stat.calls)}</span>
      {stat.failed > 0 && (
        <span style={{ color: "var(--fg-danger)", fontWeight: 600 }}>실패 {abbr(stat.failed)}</span>
      )}
      {stat.estCostUsd !== null && <span>{fmtCost(stat.estCostUsd)}</span>}
      <span style={{ color: "var(--fg-quaternary)" }}>{fmtDur(stat.avgDurationMs)}</span>
    </span>
  );
}

type MainData = {
  title: string;
  slug: string;
  mark: string;
  tone: string;
  desc: string;
  toolCount: number;
  /** 아래 매단 알약 수 — 도구가 있으면 도구 수, 없으면 코드가 넣어 주는 자료 수 */
  useCount: number;
  apiCount: number;
  model: string;
  version: string;
  selected: boolean;
  /** 비용·호출 오버레이가 켜졌고 이 노드에 실행 기록이 있을 때만 */
  stat?: NodeStat;
  statDays?: number;
};

function MainNode({ data }: NodeProps) {
  const d = data as unknown as MainData;
  return (
    <div
      style={{
        width: MAIN_W,
        height: MAIN_H,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        /* 워크플로우 차트와 같은 문법 — 모서리 12px, 테두리 색이 곧 구분 색이다 */
        borderRadius: 12,
        padding: "12px 14px",
        border: `1.5px solid ${d.tone}`,
        background: "var(--bg-elevated)",
        boxShadow: d.selected ? `var(--shadow-1), 0 0 0 3px ${d.tone}22` : "var(--shadow-1)",
        cursor: "pointer",
      }}
      title={`${d.title} — ${d.desc}`}
    >
      {d.stat && <StatChip stat={d.stat} days={d.statDays ?? 7} />}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="target" id="api" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" id="tools" position={Position.Bottom} style={{ opacity: 0 }} />
      {/* 서브로 내려가는 출구는 왼쪽 통로에 둔다 — 도구 위를 지나지 않게 */}
      <Handle type="source" id="subs" position={Position.Bottom} style={{ opacity: 0, left: LANE / 2 }} />

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span
          aria-hidden
          style={{
            flex: "none",
            width: 32,
            height: 32,
            borderRadius: 9,
            background: `${d.tone}14`,
            color: d.tone,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            font: "600 12px/1 var(--font-sans)",
          }}
        >
          {d.mark}
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <strong
            style={{
              ...CLAMP_2,
              font: "var(--text-label-s)",
              lineHeight: 1.25,
              color: "var(--fg-primary)",
            }}
          >
            {d.title}
          </strong>
          <span
            style={{
              display: "block",
              font: "11px/1.5 var(--font-mono)",
              color: "var(--fg-quaternary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {d.slug}
          </span>
        </span>
      </div>
      <div
        style={{
          /* 카드 높이가 고정이라 제목이 1행이면 아래가 남는다 — 요약 줄을 바닥에 붙인다 */
          marginTop: "auto",
          display: "flex",
          gap: 6,
          alignItems: "baseline",
          font: "var(--text-caption)",
          color: "var(--fg-tertiary)",
        }}
      >
        {d.toolCount > 0 ? (
          <>
            <span>도구 {d.toolCount}</span>
            {d.apiCount > 0 && <span>· 외부 API {d.apiCount}</span>}
          </>
        ) : (
          <span>단일 호출 · 자료 {d.useCount}</span>
        )}
        <span style={{ marginLeft: "auto", font: "11px/1.4 var(--font-mono)", color: "var(--fg-quaternary)" }}>
          {d.version}
        </span>
      </div>
    </div>
  );
}

type SubData = {
  title: string;
  slug: string;
  role: string;
  tone: string;
  toolCount: number;
  useCount: number;
  /** 실제로 도는 모델 — 팝업을 열지 않아도 배정 불일치가 보여야 한다 (v9 B3) */
  model: string;
  version: string;
  selected: boolean;
  stat?: NodeStat;
  statDays?: number;
};

function SubNode({ data }: NodeProps) {
  const d = data as unknown as SubData;
  return (
    <div
      style={{
        width: SUB_W,
        height: SUB_H,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        borderRadius: 12,
        padding: "8px 11px",
        border: `1px solid ${d.selected ? d.tone : "var(--line-default)"}`,
        background: "var(--bg-elevated)",
        boxShadow: d.selected ? `0 0 0 3px ${d.tone}22` : "none",
        cursor: "pointer",
      }}
      title={d.title}
    >
      {d.stat && <StatChip stat={d.stat} days={d.statDays ?? 7} />}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {/* 관계 이름(전처리·폴백·…)은 연결선 위에 있다 — 카드에 또 쓰지 않는다 */}
      <strong
        style={{
          ...CLAMP_2,
          font: "var(--text-label-s)",
          lineHeight: 1.25,
          color: d.role === "파일럿" ? "var(--fg-tertiary)" : "var(--fg-primary)",
        }}
      >
        {d.title}
      </strong>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: "auto" }}>
        <span
          title={d.slug}
          style={{
            minWidth: 0,
            flex: 1,
            font: "11px/1.5 var(--font-mono)",
            color: "var(--fg-quaternary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {d.model}
        </span>
        <span style={{ flex: "none", font: "11px/1.4 var(--font-sans)", color: "var(--fg-quaternary)" }}>
          {d.toolCount > 0 ? `도구 ${d.toolCount}` : `자료 ${d.useCount}`} · {d.version}
        </span>
      </div>
    </div>
  );
}

type PillData = { title: string; slug: string; role: "api" | "tool" };

function PillNode({ data }: NodeProps) {
  const d = data as unknown as PillData;
  const isApi = d.role === "api";
  return (
    <div
      style={{
        width: PILL_W,
        height: PILL_H,
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "0 7px",
        borderRadius: 8,
        border: `1px dashed ${isApi ? "var(--line-brand)" : "var(--line-default)"}`,
        background: isApi ? "var(--bg-brand-weak)" : "var(--bg-secondary)",
      }}
      title={d.slug ? `${d.title} · ${d.slug}` : d.title}
    >
      {isApi ? (
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      ) : (
        <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      )}
      <span
        aria-hidden
        style={{
          flex: "none",
          width: 16,
          height: 16,
          borderRadius: 4,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          font: "600 8px/1 var(--font-sans)",
          background: isApi ? "var(--fg-brand)" : "var(--grey-300)",
          color: isApi ? "#fff" : "var(--fg-secondary)",
        }}
      >
        {isApi ? "API" : "T"}
      </span>
      <span
        style={{
          ...CLAMP_2,
          minWidth: 0,
          /* 알약은 폭이 좁아 캡션 토큰(15px)이면 두 줄로도 몇 자 못 담는다 — 최소선 11px */
          font: "500 11px/1.35 var(--font-sans)",
          overflowWrap: "anywhere",
          color: isApi ? "var(--fg-brand)" : "var(--fg-secondary)",
        }}
      >
        {d.title}
      </span>
    </div>
  );
}

const nodeTypes = { main: MainNode, sub: SubNode, pill: PillNode };

/* ── 캔버스 안 고정 범례 ─────────────────────────────────────────────
   선 종류가 곧 이 그림의 문법이라, 문장 대신 실제 선과 같은 색·모양의 샘플로 보여 준다.
   Controls가 좌하단에 있으므로 우하단에 둔다. 접을 수 있고 기본은 펼침. */

function LegendLine({
  color,
  width = 1.3,
  dash,
  arrow,
  svgWidth = 34,
}: {
  color: string;
  width?: number;
  dash?: string;
  arrow?: boolean;
  svgWidth?: number;
}) {
  const lineEnd = arrow ? svgWidth - 8 : svgWidth - 1;
  return (
    <svg width={svgWidth} height={12} aria-hidden style={{ flex: "none", display: "block" }}>
      <line x1={1} y1={6} x2={lineEnd} y2={6} stroke={color} strokeWidth={width} strokeDasharray={dash} />
      {arrow && <polygon points={`${lineEnd},2 ${svgWidth - 1},6 ${lineEnd},10`} fill={color} />}
    </svg>
  );
}

/** 연결선 위 역할 라벨의 축소판 — 실제 엣지 라벨과 같은 스타일 */
function LegendRoleChip({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <span
      style={{
        flex: "none",
        padding: "0 5px",
        borderRadius: 5,
        border: "1px solid var(--line-subtle)",
        background: "var(--bg-elevated)",
        font: `500 11px/1.5 var(--font-sans)`,
        color: muted ? "var(--fg-quaternary)" : "var(--fg-tertiary)",
      }}
    >
      {text}
    </span>
  );
}

function CanvasLegend() {
  const [open, setOpen] = useState(true);
  const row = (sample: ReactNode, name: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{ flex: "none", width: 72, display: "inline-flex", alignItems: "center", gap: 3 }}
      >
        {sample}
      </span>
      <span style={{ font: "var(--text-caption)", color: "var(--fg-secondary)", whiteSpace: "nowrap" }}>
        {name}
      </span>
    </div>
  );
  return (
    <Panel position="bottom-right">
      <div
        style={{
          borderRadius: "var(--radius-m)",
          border: "1px solid var(--line-default)",
          background: "var(--bg-elevated)",
          boxShadow: "var(--shadow-2)",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "100%",
            padding: "7px 10px",
            border: "none",
            background: "transparent",
            font: "var(--text-caption)",
            fontWeight: 600,
            fontFamily: "var(--font-sans)",
            color: "var(--fg-secondary)",
            cursor: "pointer",
          }}
        >
          범례
          <Icons.chevronDown
            size={13}
            style={{
              marginLeft: "auto",
              transform: open ? "rotate(180deg)" : undefined,
              transition: "transform var(--dur-fast) var(--ease)",
            }}
          />
        </button>
        {open && (
          <div style={{ display: "grid", gap: 6, padding: "2px 12px 10px" }}>
            {row(<LegendLine color="var(--grey-500)" width={2} arrow svgWidth={72} />, "실행 순서")}
            {row(
              <>
                <LegendLine color="var(--grey-400)" svgWidth={16} />
                <LegendRoleChip text="전처리" />
              </>,
              "서브 역할 — 폴백·보조·후처리",
            )}
            {row(
              <>
                <LegendLine color="var(--grey-300)" dash="5 4" svgWidth={16} />
                <LegendRoleChip text="파일럿" muted />
              </>,
              "파일럿",
            )}
            {row(<LegendLine color="var(--line-brand)" dash="4 4" svgWidth={72} />, "외부 API")}
            {row(<LegendLine color="var(--grey-300)" dash="4 4" svgWidth={72} />, "도구·자료")}
          </div>
        )}
      </div>
    </Panel>
  );
}

/** 메인끼리의 위상 깊이 — 진단 순서대로 좌→우로 세우기 위한 값 */
function depths(flow: FlowMain[]): Map<string, number> {
  const depth = new Map(flow.map((m) => [m.key, 0]));
  for (let i = 0; i < flow.length; i += 1)
    for (const m of flow)
      for (const prev of m.after) {
        const d = (depth.get(prev) ?? 0) + 1;
        if (d > (depth.get(m.key) ?? 0)) depth.set(m.key, d);
      }
  return depth;
}

export function AgentCanvas({
  graph,
  prompts,
  flow,
  toolMeta,
  selectedKey,
  onSelect,
  height = DEFAULT_HEIGHT,
}: {
  graph: GraphDef;
  prompts: CanvasPrompt[];
  flow: FlowMain[];
  toolMeta: ToolMeta;
  /** 선택된 지시문 키 — 노드 강조에만 쓴다 */
  selectedKey: string | null;
  onSelect: (promptKey: string) => void;
  /** 기본값은 뷰포트 기준(clamp) — 고정 px가 필요하면 숫자로 넘긴다 */
  height?: number | string;
}) {
  /* 비용·호출 오버레이 (v9 B10) — 기본 꺼짐. 켜면 그때 기간별로 한 번씩만 받아 온다 */
  const [showStats, setShowStats] = useState(false);
  const [statDays, setStatDays] = useState<7 | 30>(7);
  const [statCache, setStatCache] = useState<Record<number, Map<string, NodeStat>>>({});

  useEffect(() => {
    if (!showStats || statCache[statDays]) return;
    let alive = true;
    api<{ items: (NodeStat & { nodeId: string; promptKey: string | null })[] }>(
      `/api/admin/agent-stats?days=${statDays}`,
    )
      .then((res) => {
        if (alive) setStatCache((prev) => ({ ...prev, [statDays]: aggregateStats(res.items ?? []) }));
      })
      .catch(() => {
        /* 백엔드 미가동·권한 문제 등 — 배지 없이 조용히 지나간다. 토글을 껐다 켜면 재시도 */
      });
    return () => {
      alive = false;
    };
  }, [showStats, statDays, statCache]);

  const stats = showStats ? statCache[statDays] : undefined;

  const { nodes, edges } = useMemo(() => {
    const byKey = new Map(prompts.map((p) => [p.key, p]));
    /* 지시문 → 그래프 노드. 도구·외부 API는 그래프가 원본이라 여기서 끌어온다 */
    const nodeByPrompt = new Map(
      graph.nodes.filter((n) => n.promptKey).map((n) => [n.promptKey as string, n]),
    );
    const toolsOf = (key: string) => nodeByPrompt.get(key)?.tools ?? [];
    const versionOf = (p: CanvasPrompt) => (p.usingDefault ? "기본값" : `v${p.activeVersion}`);

    /** 이 지시문이 읽는 것 — 에이전트는 도구 목록, 단일 호출은 코드가 넣어 주는 자료 */
    const pillsOf = (key: string, uses?: string[]) => {
      const tools = toolsOf(key);
      if (tools.length)
        return tools.map((t) => ({
          slug: t,
          title: toolMeta[t]?.label ?? t,
          external: Boolean(toolMeta[t]?.external),
        }));
      return (uses ?? []).map((u) => ({ slug: "", title: u, external: false }));
    };
    /** 위에 매다는 외부 API — 도구 중 외부를 부르는 것들의 출처 이름 */
    const apisOf = (key: string) => [
      ...new Set(toolsOf(key).filter((t) => toolMeta[t]?.external).map((t) => toolMeta[t].source)),
    ];

    /* 카드 한 장이 차지하는 높이 — 위(외부 API)와 아래(도구·자료)를 따로 센다.
       위쪽은 카드 y보다 앞이라 다음 무리를 밀어내지 않고, 앞 무리와 부딪히지 않게 미리 띄운다 */
    const topH = (key: string) => {
      const n = apisOf(key).length;
      return n === 0 ? 0 : 46 + pillBlockH(n);
    };
    const bodyH = (key: string, uses: string[] | undefined, cardH: number) => {
      const n = pillsOf(key, uses).length;
      return cardH + (n ? BELOW_CARD + pillBlockH(n) : 0);
    };

    const depth = depths(flow);
    const ordered = [...flow].sort(
      (a, b) => (depth.get(a.key) ?? 0) - (depth.get(b.key) ?? 0) || flow.indexOf(a) - flow.indexOf(b),
    );

    /* 열은 진단 순서(깊이), 같은 열의 메인은 자기 무리 높이만큼 세로로 쌓는다.
       판정에서 갈라지는 서사·추천·검증이 한 열에 나란히 서야 '여기서 셋으로 갈라진다'가 보인다 */
    const subsOf = (m: FlowMain) => m.subs.filter((s) => byKey.has(s.key));
    const clusterBottom = (m: FlowMain) =>
      bodyH(m.key, m.uses, MAIN_H) +
      subsOf(m).reduce(
        (h, s) => h + SUB_GAP + topH(s.key) + bodyH(s.key, s.uses, SUB_H),
        subsOf(m).length ? SUB_GAP : 0,
      );

    const pos = new Map<string, { x: number; y: number }>();
    const colCursor = new Map<number, number>();
    for (const m of ordered) {
      const d = depth.get(m.key) ?? 0;
      const y = (colCursor.get(d) ?? 0) + topH(m.key);
      pos.set(m.key, { x: d * COL_W, y });
      colCursor.set(d, y + clusterBottom(m) + ROW_GAP);
    }

    const out: Node[] = [];
    const links: Edge[] = [];

    /** 카드에 매달리는 알약들 — 위=외부 API(점선·파랑), 아래=도구·자료(점선·회색) */
    const attachPills = (key: string, uses: string[] | undefined, x: number, y: number, cardH: number) => {
      const apis = apisOf(key);
      const apiRows = Math.ceil(apis.length / PILL_COLS);
      apis.forEach((src, i) => {
        const id = `${key}::api::${src}`;
        out.push({
          id,
          type: "pill",
          draggable: false,
          selectable: false,
          position: { x: x + pillX(i), y: y - 46 - (apiRows - pillRow(i)) * (PILL_H + PILL_GAP_Y) },
          data: { title: src, slug: "", role: "api" } satisfies PillData as unknown as Record<string, unknown>,
        });
        links.push({
          id: `${id}->${key}`,
          source: id,
          target: `p::${key}`,
          targetHandle: "api",
          style: { stroke: "var(--line-brand)", strokeWidth: 1.2, strokeDasharray: "4 4" },
        });
      });

      const pills = pillsOf(key, uses);
      const top = y + cardH + BELOW_CARD;
      pills.forEach((pill, i) => {
        const id = `${key}::use::${pill.slug || pill.title}`;
        out.push({
          id,
          type: "pill",
          draggable: false,
          selectable: false,
          position: { x: x + pillX(i), y: top + pillRow(i) * (PILL_H + PILL_GAP_Y) },
          data: {
            title: pill.title,
            slug: pill.slug,
            role: pill.external ? "api" : "tool",
          } satisfies PillData as unknown as Record<string, unknown>,
        });
        links.push({
          id: `${key}->${id}`,
          source: `p::${key}`,
          sourceHandle: "tools",
          target: id,
          style: {
            stroke: pill.external ? "var(--line-brand)" : "var(--grey-300)",
            strokeWidth: 1.2,
            strokeDasharray: "4 4",
          },
        });
      });
    };

    for (const m of ordered) {
      const p = byKey.get(m.key);
      if (!p) continue;
      const tone = MAIN_TONE[m.key] ?? FALLBACK_TONE;
      const { x, y } = pos.get(m.key)!;

      out.push({
        id: `p::${m.key}`,
        type: "main",
        position: { x, y },
        data: {
          title: p.label,
          slug: m.key,
          mark: m.mark,
          tone,
          desc: m.desc,
          toolCount: toolsOf(m.key).length,
          useCount: pillsOf(m.key, m.uses).length,
          apiCount: apisOf(m.key).length,
          model: p.model,
          version: versionOf(p),
          selected: selectedKey === m.key,
          stat: stats?.get(m.key),
          statDays,
        } satisfies MainData as unknown as Record<string, unknown>,
      });
      attachPills(m.key, m.uses, x, y, MAIN_H);

      // 아래 — 서브 지시문. 왼쪽 통로를 타고 내려가 하나씩 갈라진다
      let subY = y + bodyH(m.key, m.uses, MAIN_H) + SUB_GAP;
      for (const s of subsOf(m)) {
        const sp = byKey.get(s.key)!;
        subY += topH(s.key);
        out.push({
          id: `p::${s.key}`,
          type: "sub",
          position: { x: x + LANE, y: subY },
          data: {
            title: sp.label,
            slug: s.key,
            role: s.role,
            tone,
            toolCount: toolsOf(s.key).length,
            useCount: pillsOf(s.key, s.uses).length,
            model: sp.model,
            version: versionOf(sp),
            selected: selectedKey === s.key,
            stat: stats?.get(s.key),
            statDays,
          } satisfies SubData as unknown as Record<string, unknown>,
        });
        /* 알약은 통로 오른쪽부터 깔리므로 서브 카드(통로만큼 들여쓴)보다 왼쪽 기준이 같다 */
        attachPills(s.key, s.uses, x, subY, SUB_H);
        links.push({
          id: `${m.key}~${s.key}`,
          source: `p::${m.key}`,
          sourceHandle: "subs",
          target: `p::${s.key}`,
          type: "smoothstep",
          /* 관계 이름을 선 위에 붙인다 — 무엇을 거드는 서브인지가 연결의 뜻이다 */
          label: s.role,
          labelShowBg: true,
          labelBgPadding: [5, 2],
          labelBgBorderRadius: 5,
          labelBgStyle: { fill: "var(--bg-elevated)", stroke: "var(--line-subtle)" },
          labelStyle: {
            fill: s.role === "파일럿" ? "var(--fg-quaternary)" : "var(--fg-tertiary)",
            fontSize: 11,
            fontFamily: "var(--font-sans)",
          },
          style: {
            stroke: s.role === "파일럿" ? "var(--grey-300)" : "var(--grey-400)",
            strokeWidth: 1.3,
            strokeDasharray: s.role === "파일럿" ? "5 4" : undefined,
          },
        });
        subY += bodyH(s.key, s.uses, SUB_H) + SUB_GAP;
      }

      /* 메인 사이 흐름 — 진단이 실제로 지나가는 선이다.
         굵은 실선 + 화살표로 둔다. 점선(도구·외부 API)과 한눈에 갈라져야 한다 */
      for (const prev of m.after)
        links.push({
          id: `${prev}=>${m.key}`,
          source: `p::${prev}`,
          target: `p::${m.key}`,
          markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "var(--grey-500)" },
          style: { stroke: "var(--grey-500)", strokeWidth: 2 },
        });
    }

    return { nodes: out, edges: links };
  }, [graph, prompts, flow, toolMeta, selectedKey, stats, statDays]);

  return (
    <div style={{ height, borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_e, node) => {
          if (node.type === "main" || node.type === "sub") onSelect(node.id.replace("p::", ""));
        }}
        fitView
        minZoom={0.25}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        deleteKeyCode={null}
      >
        {/* 점 격자 배경은 깔지 않는다 — 워크플로우 차트(v8)와 같은 톤을 쓴다 */}
        <Controls showInteractive={false} />
        <CanvasLegend />
        {/* 비용·호출 오버레이 토글 + 기간 — 켠 동안만 노드에 통계 칩이 얹힌다 */}
        <Panel position="top-right">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {showStats && (
              <div
                style={{
                  display: "inline-flex",
                  gap: 2,
                  padding: 2,
                  borderRadius: "var(--radius-full)",
                  border: "1px solid var(--line-default)",
                  background: "var(--bg-secondary)",
                }}
              >
                {([7, 30] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setStatDays(d)}
                    aria-pressed={statDays === d}
                    style={{
                      padding: "3px 10px",
                      borderRadius: "var(--radius-full)",
                      border: "none",
                      background: statDays === d ? "var(--bg-elevated)" : "transparent",
                      boxShadow: statDays === d ? "var(--shadow-1)" : "none",
                      color: statDays === d ? "var(--fg-primary)" : "var(--fg-tertiary)",
                      font: "var(--text-caption)",
                      fontFamily: "var(--font-sans)",
                      cursor: "pointer",
                    }}
                  >
                    {d}일
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowStats((v) => !v)}
              aria-pressed={showStats}
              title="노드별 호출·실패·평균 시간과 비용을 겹쳐 본다 — 비용은 현재 배정 모델 단가 기준 추정치"
              style={{
                padding: "5px 12px",
                borderRadius: "var(--radius-full)",
                border: `1px solid ${showStats ? "var(--line-brand)" : "var(--line-default)"}`,
                background: showStats ? "var(--bg-brand-weak)" : "var(--bg-elevated)",
                color: showStats ? "var(--fg-brand)" : "var(--fg-secondary)",
                font: "var(--text-caption)",
                fontWeight: 600,
                fontFamily: "var(--font-sans)",
                cursor: "pointer",
              }}
            >
              비용·호출 보기
            </button>
          </div>
        </Panel>
        {/* 미니맵은 붙이지 않는다 — 커스텀 노드가 그려지지 않아 빈 상자만 남는다.
            확대·축소와 '전체 보기'(Controls)로 충분하다 */}
      </ReactFlow>
    </div>
  );
}
