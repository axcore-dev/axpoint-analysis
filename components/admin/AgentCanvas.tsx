"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

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
const MAIN_H = 92;
/** 왼쪽 통로 — 서브로 내려가는 연결선이 도구·자료 위를 지나지 않도록 비워 둔다 */
const LANE = 44;
const SUB_W = MAIN_W;
const SUB_H = 58;
/** 서브 하나(카드+자료 줄) 다음까지의 간격 */
const SUB_GAP = 18;
/** 카드 아래 첫 자료 줄까지의 간격 */
const BELOW_CARD = 26;

/* 자료·도구는 2열로 깐다 — 한 줄로 세우면 도구 여덟 개짜리 노드가 세로로 400px을 먹어
   전체 보기가 화면을 확 줄여 버린다(글자가 안 읽힌다) */
const PILL_COLS = 2;
const PILL_GAP_X = 8;
const PILL_W = (MAIN_W - PILL_GAP_X) / 2;
const PILL_H = 30;
const PILL_GAP_Y = 6;

/** 알약은 통로 오른쪽부터 깐다 — 통로는 서브로 내려가는 연결선 몫이다 */
const pillX = (i: number) => LANE + (i % PILL_COLS) * (PILL_W + PILL_GAP_X);
const pillRow = (i: number) => Math.floor(i / PILL_COLS);
const pillBlockH = (n: number) => (n === 0 ? 0 : Math.ceil(n / PILL_COLS) * (PILL_H + PILL_GAP_Y));

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
};

function MainNode({ data }: NodeProps) {
  const d = data as unknown as MainData;
  return (
    <div
      style={{
        width: MAIN_W,
        borderRadius: 14,
        padding: "12px 14px",
        border: `1.5px solid ${d.selected ? d.tone : "var(--line-default)"}`,
        background: "var(--bg-elevated)",
        boxShadow: d.selected ? `0 0 0 3px ${d.tone}22` : "var(--shadow-1)",
        cursor: "pointer",
      }}
      title={d.desc}
    >
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
              display: "block",
              font: "var(--text-label-s)",
              color: "var(--fg-primary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {d.title}
          </strong>
          <span style={{ display: "block", font: "11px/1.5 var(--font-mono)", color: "var(--fg-quaternary)" }}>
            {d.slug}
          </span>
        </span>
      </div>
      <div
        style={{
          marginTop: 8,
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
  version: string;
  selected: boolean;
};

function SubNode({ data }: NodeProps) {
  const d = data as unknown as SubData;
  return (
    <div
      style={{
        width: SUB_W,
        height: SUB_H,
        boxSizing: "border-box",
        borderRadius: 11,
        padding: "8px 11px",
        border: `1px solid ${d.selected ? d.tone : "var(--line-default)"}`,
        background: "var(--bg-elevated)",
        boxShadow: d.selected ? `0 0 0 3px ${d.tone}22` : "none",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {/* 관계 이름(전처리·폴백·…)은 연결선 위에 있다 — 카드에 또 쓰지 않는다 */}
      <strong
        style={{
          display: "block",
          font: "var(--text-label-s)",
          color: d.role === "파일럿" ? "var(--fg-tertiary)" : "var(--fg-primary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {d.title}
      </strong>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 3 }}>
        <span
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
          {d.slug}
        </span>
        <span style={{ flex: "none", font: "10px/1.4 var(--font-sans)", color: "var(--fg-quaternary)" }}>
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
      title={d.slug || d.title}
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
          minWidth: 0,
          font: "var(--text-caption)",
          color: isApi ? "var(--fg-brand)" : "var(--fg-secondary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {d.title}
      </span>
    </div>
  );
}

const nodeTypes = { main: MainNode, sub: SubNode, pill: PillNode };

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
  height = 640,
}: {
  graph: GraphDef;
  prompts: CanvasPrompt[];
  flow: FlowMain[];
  toolMeta: ToolMeta;
  /** 선택된 지시문 키 — 노드 강조에만 쓴다 */
  selectedKey: string | null;
  onSelect: (promptKey: string) => void;
  height?: number;
}) {
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
            version: versionOf(sp),
            selected: selectedKey === s.key,
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
            fontSize: 10,
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
  }, [graph, prompts, flow, toolMeta, selectedKey]);

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
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <Controls showInteractive={false} />
        {/* 미니맵은 붙이지 않는다 — 커스텀 노드가 그려지지 않아 빈 상자만 남는다.
            확대·축소와 '전체 보기'(Controls)로 충분하다 */}
      </ReactFlow>
    </div>
  );
}
