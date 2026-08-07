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
 * 멀티 에이전트 캔버스 — 진단이 실제로 흐르는 순서를 왼쪽에서 오른쪽으로 세운다.
 *
 *   [자료 읽기] ─▶ [공개데이터] ─▶ [판정] ─▶ [결과 서술]        [파일럿]
 *      지시문          지시문        지시문      지시문           지시문
 *
 * 여기 놓인 노드 하나가 곧 편집 가능한 지시문 하나다 — 이 화면에 없는 지시문은 없다.
 * 도구를 쓰는 에이전트는 아래에 도구를, 위에 그 도구가 부르는 외부 API를 매단다.
 *
 * 단계·순서의 원본은 서버(PROMPT_STAGES)다. 그래프 엣지는 파일럿 실행 순서라 운영 동선과
 * 어긋나므로 여기서 그리지 않는다 — 화면이 '설계도'를 '실제'인 것처럼 보여 주면 안 된다.
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
export type Stage = { id: string; label: string; desc: string; keys: string[] };

/** 단계별 색 — 파이프라인 순서를 따라간다. 파일럿은 실행에 안 쓰이므로 회색 */
const STAGE_TONE: Record<string, string> = {
  ingest: "#7A5AF8",
  public: "#0A50FF",
  judge: "#0F9D58",
  narrate: "#F59E0B",
  pilot: "#6B7684",
};

const COL_W = 330;
const CARD_W = 248;
const CARD_H = 78;
/** 카드 사이 세로 간격 — 도구가 달리면 그만큼 더 벌어진다 */
const CARD_GAP = 22;
const HEAD_Y = 0;
const FIRST_CARD_Y = 96;

/* 하위 노드는 2열로 깐다 — 한 줄로 세우면 도구 8개짜리 노드가 세로로 400px을 먹어
   전체 보기가 화면을 확 줄여 버린다(글자가 안 읽힌다).
   두 칸 폭이 카드 폭과 정확히 맞아떨어져야 카드 밖으로 삐져나오지 않는다 */
const PILL_COLS = 2;
const PILL_GAP_X = 8;
const PILL_W = (CARD_W - PILL_GAP_X) / 2;
const PILL_H = 30;
const PILL_GAP_Y = 6;

const pillX = (i: number) =>
  (CARD_W - (PILL_COLS * PILL_W + (PILL_COLS - 1) * PILL_GAP_X)) / 2 +
  (i % PILL_COLS) * (PILL_W + PILL_GAP_X);
const pillRow = (i: number) => Math.floor(i / PILL_COLS);
const pillBlockH = (n: number) =>
  n === 0 ? 0 : Math.ceil(n / PILL_COLS) * (PILL_H + PILL_GAP_Y) + 14;

type StageHeadData = { label: string; desc: string; count: number; tone: string };

function StageHeadNode({ data }: NodeProps) {
  const d = data as unknown as StageHeadData;
  return (
    <div style={{ width: CARD_W, pointerEvents: "none" }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, top: 18 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, top: 18 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{ width: 8, height: 8, borderRadius: 999, background: d.tone, flex: "none" }}
        />
        <strong style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>{d.label}</strong>
        <span style={{ font: "var(--text-caption)", color: "var(--fg-quaternary)" }}>{d.count}</span>
      </div>
      <p
        style={{
          margin: "4px 0 0",
          font: "var(--text-caption)",
          color: "var(--fg-tertiary)",
          lineHeight: 1.45,
        }}
      >
        {d.desc}
      </p>
    </div>
  );
}

type PromptCardData = {
  title: string;
  slug: string;
  tone: string;
  /** 도구를 쓰는 에이전트인지, 코드가 부르는 단일 호출인지 */
  kind: "agent" | "single";
  toolCount: number;
  model: string;
  version: string;
  selected: boolean;
};

function PromptCardNode({ data }: NodeProps) {
  const d = data as unknown as PromptCardData;
  return (
    <div
      style={{
        width: CARD_W,
        minHeight: CARD_H,
        boxSizing: "border-box",
        borderRadius: 12,
        padding: "10px 12px",
        border: `1.5px solid ${d.selected ? d.tone : "var(--line-default)"}`,
        background: "var(--bg-elevated)",
        boxShadow: d.selected ? `0 0 0 3px ${d.tone}22` : "var(--shadow-1)",
        cursor: "pointer",
      }}
    >
      <Handle type="target" id="api" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" id="tools" position={Position.Bottom} style={{ opacity: 0 }} />

      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <strong
          style={{
            minWidth: 0,
            flex: 1,
            font: "var(--text-label-s)",
            color: "var(--fg-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {d.title}
        </strong>
        <span
          style={{
            flex: "none",
            font: "10px/1.4 var(--font-sans)",
            color: d.kind === "agent" ? d.tone : "var(--fg-quaternary)",
          }}
        >
          {d.kind === "agent" ? `도구 ${d.toolCount}` : "단일 호출"}
        </span>
      </div>
      <div
        style={{
          marginTop: 3,
          font: "11px/1.5 var(--font-mono)",
          color: "var(--fg-quaternary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {d.slug}
      </div>
      <div
        style={{
          marginTop: 6,
          display: "flex",
          alignItems: "center",
          gap: 6,
          font: "var(--text-caption)",
          color: "var(--fg-tertiary)",
        }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          {d.model}
        </span>
        <span style={{ flex: "none", color: "var(--fg-quaternary)" }}>· {d.version}</span>
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
        title={d.slug || d.title}
      >
        {d.title}
      </span>
    </div>
  );
}

const nodeTypes = { stage: StageHeadNode, prompt: PromptCardNode, pill: PillNode };

export function AgentCanvas({
  graph,
  prompts,
  stages,
  toolMeta,
  selectedKey,
  onSelect,
  height = 620,
}: {
  graph: GraphDef;
  prompts: CanvasPrompt[];
  stages: Stage[];
  toolMeta: ToolMeta;
  /** 선택된 지시문 키 — 노드 강조에만 쓴다 */
  selectedKey: string | null;
  onSelect: (promptKey: string) => void;
  height?: number;
}) {
  /* 열 높이가 제각각이라 전체 보기를 하면 가장 긴 열에 맞춰 축소된다 —
     캔버스를 그 열 높이에 맞춰 두면 남는 여백 없이 글자가 가장 크게 보인다 */
  const { nodes, edges } = useMemo(() => {
    const byKey = new Map(prompts.map((p) => [p.key, p]));
    /* 지시문 → 그래프 노드. 도구·외부 API는 그래프가 원본이라 여기서 끌어온다 */
    const nodeByPrompt = new Map(
      graph.nodes.filter((n) => n.promptKey).map((n) => [n.promptKey as string, n]),
    );

    const out: Node[] = [];
    const links: Edge[] = [];

    stages.forEach((stage, col) => {
      const tone = STAGE_TONE[stage.id] ?? "#6B7684";
      const x = col * COL_W;
      const keys = stage.keys.filter((k) => byKey.has(k));

      out.push({
        id: `stage::${stage.id}`,
        type: "stage",
        position: { x, y: HEAD_Y },
        draggable: false,
        selectable: false,
        data: {
          label: stage.label,
          desc: stage.desc,
          count: keys.length,
          tone,
        } satisfies StageHeadData as unknown as Record<string, unknown>,
      });

      /* 단계 사이 화살표 — 파일럿은 운영 흐름에 끼어 있지 않으므로 이어 붙이지 않는다 */
      const prev = stages[col - 1];
      if (prev && stage.id !== "pilot" && prev.id !== "pilot")
        links.push({
          id: `${prev.id}=>${stage.id}`,
          source: `stage::${prev.id}`,
          target: `stage::${stage.id}`,
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "var(--grey-500)" },
          style: { stroke: "var(--grey-500)", strokeWidth: 1.6 },
        });

      let y = FIRST_CARD_Y;
      for (const key of keys) {
        const p = byKey.get(key)!;
        const node = nodeByPrompt.get(key);
        const tools = node?.tools ?? [];
        const apis = [
          ...new Set(tools.filter((t) => toolMeta[t]?.external).map((t) => toolMeta[t].source)),
        ];

        // 위 — 외부 API (에이전트에 가까운 줄이 첫 줄이 되도록 아래에서 위로 쌓는다)
        const apiRows = Math.ceil(apis.length / PILL_COLS);
        const apiH = pillBlockH(apis.length);
        y += apiH;

        apis.forEach((src, i) => {
          const id = `${key}::api::${src}`;
          out.push({
            id,
            type: "pill",
            draggable: false,
            selectable: false,
            position: { x: x + pillX(i), y: y - 12 - (apiRows - pillRow(i)) * (PILL_H + PILL_GAP_Y) },
            data: { title: src, slug: "", role: "api" } satisfies PillData as unknown as Record<string, unknown>,
          });
          links.push({
            id: `${id}->${key}`,
            source: id,
            target: `prompt::${key}`,
            targetHandle: "api",
            style: { stroke: "var(--line-brand)", strokeWidth: 1.1, strokeDasharray: "4 4" },
          });
        });

        out.push({
          id: `prompt::${key}`,
          type: "prompt",
          position: { x, y },
          data: {
            title: p.label,
            slug: p.key,
            tone,
            kind: node?.type === "agent" ? "agent" : "single",
            toolCount: tools.length,
            model: p.model,
            version: p.usingDefault ? "기본값" : `v${p.activeVersion}`,
            selected: selectedKey === key,
          } satisfies PromptCardData as unknown as Record<string, unknown>,
        });

        // 아래 — 도구
        tools.forEach((t, i) => {
          const id = `${key}::tool::${t}`;
          out.push({
            id,
            type: "pill",
            draggable: false,
            selectable: false,
            position: {
              x: x + pillX(i),
              y: y + CARD_H + 12 + pillRow(i) * (PILL_H + PILL_GAP_Y),
            },
            data: {
              title: toolMeta[t]?.label ?? t,
              slug: t,
              role: "tool",
            } satisfies PillData as unknown as Record<string, unknown>,
          });
          links.push({
            id: `${key}->${id}`,
            source: `prompt::${key}`,
            sourceHandle: "tools",
            target: id,
            style: { stroke: "var(--grey-300)", strokeWidth: 1.1, strokeDasharray: "4 4" },
          });
        });

        y += CARD_H + pillBlockH(tools.length) + CARD_GAP;
      }
    });

    return { nodes: out, edges: links };
  }, [graph, prompts, stages, toolMeta, selectedKey]);

  return (
    <div style={{ height, borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_e, node) => {
          if (node.type === "prompt") onSelect(node.id.replace("prompt::", ""));
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
