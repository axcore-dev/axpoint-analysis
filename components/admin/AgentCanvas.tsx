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
 * 멀티 에이전트 캔버스 — n8n처럼 '에이전트 하나'를 중심에 두고,
 * 그 에이전트가 붙어 있는 것들을 위아래 하위 노드로 매단다 (작업요청 v6-1 스케치).
 *
 *        [외부 API]        ← 위: 이 에이전트가 부르는 외부 서비스
 *            │
 *        [에이전트]  ──▶   ← 가운데: 좌→우로 데이터가 흐른다
 *            │
 *        [도구] [도구]     ← 아래: 이 에이전트가 쓸 수 있는 도구
 *
 * 좌표는 그래프 JSON에 없다. 위상 깊이로 순서를 정하되 에이전트마다 열을 하나씩 주어
 * 하위 노드가 옆 열과 겹치지 않게 한다.
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

const TYPE_LABEL: Record<GraphNode["type"], string> = {
  agent: "에이전트",
  code: "코드",
  hitl: "사람 확인",
};

/** 노드 성격 배지 — 아이콘 의존 없이 글자로 (색은 파이프라인 순서를 따라간다) */
const NODE_MARK: Record<string, { text: string; tone: string }> = {
  collect: { text: "수집", tone: "#0A50FF" },
  classify: { text: "분류", tone: "#7A5AF8" },
  judge: { text: "판정", tone: "#0F9D58" },
  narrative: { text: "서사", tone: "#F59E0B" },
  tasks: { text: "추천", tone: "#EC4899" },
  review: { text: "검증", tone: "#EF4444" },
};

const COL_W = 330;
const AGENT_W = 232;
/* 하위 노드는 2열로 깐다 — 한 줄로 세우면 도구 8개짜리 노드가 세로로 400px을 먹어
   fitView가 전체를 확 줄여 버린다(글자가 안 읽힌다) */
const PILL_COLS = 2;
const PILL_W = 148;
const PILL_H = 34;
const PILL_GAP_X = 10;
const PILL_GAP_Y = 8;
const AGENT_Y = 0;
const AGENT_H = 92;
/** 같은 깊이의 형제를 세로로 어긋내는 간격 */
const ROW_H = 250;

/** 하위 노드 i번째의 상대 좌표 — 위(API)는 아래에서 위로 쌓는다 */
const pillX = (i: number) =>
  (AGENT_W - (PILL_COLS * PILL_W + (PILL_COLS - 1) * PILL_GAP_X)) / 2 +
  (i % PILL_COLS) * (PILL_W + PILL_GAP_X);
const pillRow = (i: number) => Math.floor(i / PILL_COLS);

type AgentData = {
  title: string;
  /** 영문 식별자 — 로그·코드에서 쓰는 이름이라 함께 보여준다 (v6-1) */
  slug: string;
  mark: { text: string; tone: string };
  kind: GraphNode["type"];
  toolCount: number;
  apiCount: number;
  selected: boolean;
};

function AgentNode({ data }: NodeProps) {
  const d = data as unknown as AgentData;
  return (
    <div
      style={{
        width: AGENT_W,
        borderRadius: 14,
        padding: "12px 14px",
        border: `1.5px solid ${d.selected ? d.mark.tone : "var(--line-default)"}`,
        background: "var(--bg-elevated)",
        boxShadow: d.selected ? `0 0 0 3px ${d.mark.tone}22` : "var(--shadow-1)",
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="target" id="api" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" id="tools" position={Position.Bottom} style={{ opacity: 0 }} />

      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span
          aria-hidden
          style={{
            flex: "none",
            width: 32,
            height: 32,
            borderRadius: 9,
            background: `${d.mark.tone}14`,
            color: d.mark.tone,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            font: "600 12px/1 var(--font-sans)",
          }}
        >
          {d.mark.text}
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
          <span
            style={{
              display: "block",
              font: "11px/1.5 var(--font-mono)",
              color: "var(--fg-quaternary)",
            }}
          >
            {d.slug}
          </span>
        </span>
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 6,
          font: "var(--text-caption)",
          color: "var(--fg-tertiary)",
        }}
      >
        {d.kind === "agent" ? (
          <>
            <span>도구 {d.toolCount}</span>
            {d.apiCount > 0 && <span>· 외부 API {d.apiCount}</span>}
          </>
        ) : (
          <span>{TYPE_LABEL[d.kind]}</span>
        )}
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
        gap: 6,
        padding: "0 8px",
        borderRadius: 9,
        border: `1px dashed ${isApi ? "var(--line-brand)" : "var(--line-default)"}`,
        background: isApi ? "var(--bg-brand-weak)" : "var(--bg-secondary)",
      }}
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
          width: 18,
          height: 18,
          borderRadius: 5,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          font: "600 9px/1 var(--font-sans)",
          background: isApi ? "var(--fg-brand)" : "var(--grey-300)",
          color: isApi ? "#fff" : "var(--fg-secondary)",
        }}
      >
        {isApi ? "API" : "T"}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            font: "var(--text-caption)",
            color: isApi ? "var(--fg-brand)" : "var(--fg-secondary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {d.title}
        </span>
        {d.slug && (
          <span
            style={{
              display: "block",
              font: "10px/1.3 var(--font-mono)",
              color: "var(--fg-quaternary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {d.slug}
          </span>
        )}
      </span>
    </div>
  );
}

const nodeTypes = { agent: AgentNode, pill: PillNode };

/** 위상 깊이(가장 긴 선행 경로) — 실행 순서대로 좌→우 배치하기 위한 값 */
function depths(graph: GraphDef): Map<string, number> {
  const depth = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < graph.nodes.length; i += 1) {
    for (const e of graph.edges) {
      const d = (depth.get(e.from) ?? 0) + 1;
      if (d > (depth.get(e.to) ?? 0)) depth.set(e.to, d);
    }
  }
  return depth;
}

export function AgentCanvas({
  graph,
  toolMeta,
  selectedId,
  onSelect,
  height = 520,
}: {
  graph: GraphDef;
  toolMeta: ToolMeta;
  selectedId: string | null;
  onSelect: (id: string) => void;
  height?: number;
}) {
  const { nodes, edges } = useMemo(() => {
    const depth = depths(graph);
    /* 에이전트마다 열을 하나씩 준다 — 같은 깊이의 노드가 세로로 겹치면
       그 아래 매단 도구 노드끼리 부딪힌다 */
    const ordered = [...graph.nodes].sort(
      (a, b) =>
        (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0) ||
        graph.nodes.indexOf(a) - graph.nodes.indexOf(b),
    );
    const colOf = new Map(ordered.map((n, i) => [n.id, i]));
    /* 같은 깊이의 형제는 세로로 어긋나게 둔다 — 한 줄로 세우면 판정에서 갈라지는
       세 갈래(서사·추천·검증)가 일렬 체인처럼 보인다 */
    const rank = new Map<string, number>();
    const seen = new Map<number, number>();
    for (const n of ordered) {
      const d = depth.get(n.id) ?? 0;
      const k = seen.get(d) ?? 0;
      seen.set(d, k + 1);
      rank.set(n.id, k);
    }
    const yOf = (id: string) => AGENT_Y + (rank.get(id) ?? 0) * ROW_H;

    const out: Node[] = [];
    const links: Edge[] = [];

    for (const n of ordered) {
      const col = colOf.get(n.id) ?? 0;
      const x = col * COL_W;
      const tools = n.tools ?? [];
      const apis = [
        ...new Set(tools.filter((t) => toolMeta[t]?.external).map((t) => toolMeta[t].source)),
      ];

      out.push({
        id: n.id,
        type: "agent",
        position: { x, y: yOf(n.id) },
        data: {
          title: n.label ?? n.id,
          slug: n.id,
          mark: NODE_MARK[n.id] ?? { text: TYPE_LABEL[n.type].slice(0, 2), tone: "#6B7684" },
          kind: n.type,
          toolCount: tools.length,
          apiCount: apis.length,
          selected: selectedId === n.id,
        } satisfies AgentData as unknown as Record<string, unknown>,
      });

      // 위 — 외부 API (아래에서 위로 쌓아 에이전트에 가까운 줄이 첫 줄이 되게 한다)
      const apiRows = Math.ceil(apis.length / PILL_COLS);
      apis.forEach((src, i) => {
        const id = `${n.id}::api::${src}`;
        out.push({
          id,
          type: "pill",
          draggable: false,
          selectable: false,
          position: {
            x: x + pillX(i),
            y: yOf(n.id) - 56 - (apiRows - pillRow(i)) * (PILL_H + PILL_GAP_Y),
          },
          data: { title: src, slug: "", role: "api" } satisfies PillData as unknown as Record<string, unknown>,
        });
        links.push({
          id: `${id}->${n.id}`,
          source: id,
          target: n.id,
          targetHandle: "api",
          style: { stroke: "var(--line-brand)", strokeWidth: 1.2, strokeDasharray: "4 4" },
        });
      });

      // 아래 — 도구
      tools.forEach((t, i) => {
        const id = `${n.id}::tool::${t}`;
        out.push({
          id,
          type: "pill",
          draggable: false,
          selectable: false,
          position: {
            x: x + pillX(i),
            y: yOf(n.id) + AGENT_H + 34 + pillRow(i) * (PILL_H + PILL_GAP_Y),
          },
          data: {
            title: toolMeta[t]?.label ?? t,
            slug: t,
            role: "tool",
          } satisfies PillData as unknown as Record<string, unknown>,
        });
        links.push({
          id: `${n.id}->${id}`,
          source: n.id,
          sourceHandle: "tools",
          target: id,
          style: { stroke: "var(--grey-300)", strokeWidth: 1.2, strokeDasharray: "4 4" },
        });
      });
    }

    // 에이전트 사이 흐름 — 진짜 데이터가 지나가는 선이라 실선 + 화살표로 구분한다
    for (const e of graph.edges) {
      links.push({
        id: `${e.from}=>${e.to}`,
        source: e.from,
        target: e.to,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "var(--grey-500)" },
        style: { stroke: "var(--grey-500)", strokeWidth: 1.8 },
      });
    }

    return { nodes: out, edges: links };
  }, [graph, toolMeta, selectedId]);

  return (
    <div style={{ height, borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_e, node) => {
          if (node.type === "agent") onSelect(node.id);
        }}
        fitView
        minZoom={0.3}
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
