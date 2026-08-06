"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Loader } from "@/components/ui";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { api } from "@/lib/api";
import { type WorkflowStage } from "@/components/flow/WorkflowStandard";

/**
 * 워크플로우 플로우차트 — 업무(task) 흐름을 계층으로 그린다 (작업 요청 v7 전면 개편).
 *
 * v5까지는 8대 기능 영역을 세로 레인 8개로 세우고 그 안에 업무를 위→아래로 쌓았다.
 * 영역을 가로지르는 문서 흐름이 레인을 무시하고 지나가 선이 전부 엉켰다. 그래서 배치 기준을
 * **연결 그래프**로 바꿨다 — mermaid가 하는 것과 같은 방식이다.
 *  ① 층 나누기: 선행 업무가 없는 업무가 1층, 나머지는 (가장 깊은 선행 + 1)층
 *  ② 층 안 정렬: 이어진 업무의 평균 자리로 옮기는 계산을 위·아래로 몇 번 반복해 교차를 줄인다
 *  ③ 되돌아가는 연결(순환)은 층 계산에서 빼고 점선으로 그린다 — 층이 무한히 밀리지 않게
 * 영역 구분은 자리 대신 색과 라벨이 맡는다.
 *
 * 병목: 표준상 산출 문서가 나와야 하는 자리인데 한 건도 보유하지 않았고, 앞뒤로 흐름이 이어지는
 * 업무. 흐름은 지나가는데 기록이 끊긴 자리라 붉게 표시한다.
 *
 * 드래그는 업무 단위로만 한다 — 좌우로 끌면 그 영역 안 업무 순서가 바뀌고, 놓는 순간 저장된다.
 * (영역 자체의 순서는 표준 고정이라 옮기지 않는다)
 */
type ChartStage = WorkflowStage & { deviates?: boolean };
type Connection = { from: number; to: number; reason: string };

const NODE_W = 196;
const LAYER_X = 268; // 층 간격 (노드 폭 + 여백)
const ROW_H = 104; // 같은 층 안 세로 간격
/** 캔버스 높이 — 층 안 줄 수에 맞춘다. 고정 높이는 위아래로 빈 띠만 남겼다 (v7) */
const canvasHeight = (rows: number) => Math.max(420, Math.min(760, rows * ROW_H + 110));
/** 첫 화면 배율 — 40개 업무는 어차피 한 화면에 안 들어온다. 줄여서 못 읽게 하느니 왼쪽부터 읽게 둔다 */
const START_ZOOM = 0.62;

/** 8대 기능 영역 색 — 자리로 구분하지 않으니 색이 영역을 알려 준다 */
const STAGE_TONE: Record<string, string> = {
  sales: "#0A50FF",
  design: "#7A5AF8",
  production: "#0F9D58",
  quality: "#E8710A",
  equipment: "#06A0C7",
  logistics: "#EC4899",
  cs: "#0891B2",
  admin: "#6B7684",
};
const toneOf = (code: string) => STAGE_TONE[code] ?? "#6B7684";

/** 이 기업이 보유한 산출 문서만 — 미보유 칩은 그리지 않는다 (v5) */
const coveredDocs = (act: ChartStage["activities"][number]) =>
  act.outputDocs.filter((d) => d.covered);

const ARROW = { type: MarkerType.ArrowClosed, width: 15, height: 15 } as const;

/* ── 업무 노드 ─────────────────────────────────────────────────────── */

type TaskData = {
  name: string;
  stageName: string;
  tone: string;
  docs: string[];
  /** 화면에 못 담은 나머지 문서 수 */
  moreDocs: number;
  bottleneck: boolean;
  grabbable: boolean;
  dragging: boolean;
};

function TaskNode({ data }: NodeProps) {
  const d = data as unknown as TaskData;
  const border = d.dragging
    ? d.tone
    : d.bottleneck
      ? "var(--fg-danger)"
      : "var(--line-default)";
  return (
    <div
      style={{
        width: NODE_W,
        boxSizing: "border-box",
        borderRadius: 12,
        padding: "9px 11px",
        borderLeft: `4px solid ${d.tone}`,
        borderTop: `1.5px solid ${border}`,
        borderRight: `1.5px solid ${border}`,
        borderBottom: `1.5px solid ${border}`,
        background: d.bottleneck ? "var(--bg-danger-weak)" : "var(--bg-elevated)",
        boxShadow: d.dragging
          ? `0 14px 30px rgba(16,24,40,0.18), 0 0 0 4px ${d.tone}2e`
          : "var(--shadow-1)",
        transform: d.dragging ? "scale(1.04)" : undefined,
        transition:
          "box-shadow 160ms var(--ease, ease), transform 160ms var(--ease, ease), border-color 160ms var(--ease, ease)",
        cursor: d.grabbable ? (d.dragging ? "grabbing" : "grab") : "default",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          font: "var(--text-caption)",
          color: d.tone,
        }}
      >
        <span
          aria-hidden
          style={{ width: 5, height: 5, borderRadius: 999, background: d.tone, flex: "none" }}
        />
        {d.stageName}
        {d.bottleneck && (
          <span style={{ marginLeft: "auto", color: "var(--fg-danger)", fontWeight: 600 }}>
            기록 끊김
          </span>
        )}
      </span>

      <span
        style={{
          display: "block",
          marginTop: 3,
          font: "var(--text-label-s)",
          lineHeight: 1.35,
          color: "var(--fg-primary)",
        }}
      >
        {d.name}
      </span>

      {d.docs.length > 0 && (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {d.docs.map((name) => (
            <span
              key={name}
              style={{
                font: "10.5px/1.3 var(--font-sans)",
                padding: "2px 6px",
                borderRadius: 999,
                border: "1px solid var(--line-brand)",
                color: "var(--fg-brand)",
                background: "var(--bg-brand-weak)",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </span>
          ))}
          {d.moreDocs > 0 && (
            <span style={{ font: "10.5px/1.5 var(--font-mono)", color: "var(--fg-quaternary)" }}>
              +{d.moreDocs}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

const nodeTypes = { task: TaskNode };

/* ── 배치 계산 ─────────────────────────────────────────────────────── */

type Act = {
  id: number;
  name: string;
  stageCode: string;
  stageName: string;
  stageIdx: number;
  seq: number; // 영역 안 표시 순서
  docs: string[]; // 보유 산출 문서명
  standardDocs: number; // 표준상 나와야 하는 산출 문서 수
};

function toActs(stages: ChartStage[]): Act[] {
  return stages.flatMap((stage, stageIdx) =>
    stage.activities.map((act, seq) => ({
      id: act.id,
      name: act.name,
      stageCode: stage.code,
      stageName: stage.name,
      stageIdx,
      seq,
      docs: coveredDocs(act).map((d) => d.name),
      standardDocs: act.outputDocs.length,
    })),
  );
}

/** 영역 안 순서를 잇는 흐름 + 에이전트가 판단한 영역 횡단 흐름 */
function allEdges(acts: Act[], connections: Connection[]) {
  const ids = new Set(acts.map((a) => a.id));
  const seen = new Set<string>();
  const out: { from: number; to: number; cross: boolean }[] = [];
  const push = (from: number, to: number, cross: boolean) => {
    const key = `${from}->${to}`;
    if (from === to || seen.has(key) || !ids.has(from) || !ids.has(to)) return;
    seen.add(key);
    out.push({ from, to, cross });
  };
  // 영역 안 순서 — 사용자가 편집한 순서가 곧 이 기업의 실제 흐름이다
  const byStage = new Map<string, Act[]>();
  for (const a of acts) byStage.set(a.stageCode, [...(byStage.get(a.stageCode) ?? []), a]);
  for (const list of byStage.values())
    for (let i = 1; i < list.length; i += 1) push(list[i - 1].id, list[i].id, false);
  for (const cn of connections) push(cn.from, cn.to, true);
  return out;
}

/**
 * 되돌아가는 연결(순환)을 찾아낸다 — DFS 스택에 이미 있는 노드로 가는 간선이 그것.
 * 층 계산에서 빼지 않으면 층이 서로를 밀며 끝나지 않는다.
 */
function findBackEdges(acts: Act[], edges: { from: number; to: number }[]) {
  const next = new Map<number, number[]>();
  for (const e of edges) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  const state = new Map<number, 0 | 1 | 2>(); // 0 미방문 / 1 스택에 있음 / 2 끝남
  const back = new Set<string>();
  const walk = (id: number) => {
    state.set(id, 1);
    for (const to of next.get(id) ?? []) {
      const s = state.get(to) ?? 0;
      if (s === 1) back.add(`${id}->${to}`);
      else if (s === 0) walk(to);
    }
    state.set(id, 2);
  };
  for (const a of acts) if ((state.get(a.id) ?? 0) === 0) walk(a.id);
  return back;
}

/** 층 배정 — 선행이 없으면 0층, 있으면 (가장 깊은 선행 + 1)층 */
function assignLayers(acts: Act[], edges: { from: number; to: number }[]) {
  const layer = new Map<number, number>(acts.map((a) => [a.id, 0]));
  // 간선 수만큼 반복하면 가장 긴 경로까지 전파된다 (DAG 보장 — 순환은 이미 제거됨)
  for (let i = 0; i < acts.length; i += 1) {
    let moved = false;
    for (const e of edges) {
      const want = (layer.get(e.from) ?? 0) + 1;
      if (want > (layer.get(e.to) ?? 0)) {
        layer.set(e.to, want);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return layer;
}

/**
 * 층 안 세로 순서 — 이어진 업무의 평균 자리로 옮기는 계산(무게중심)을 위·아래로 반복한다.
 * 이어진 것끼리 같은 높이로 모이면서 선이 덜 엇갈린다.
 */
function orderLayers(
  acts: Act[],
  edges: { from: number; to: number }[],
  layer: Map<number, number>,
) {
  const maxLayer = Math.max(0, ...acts.map((a) => layer.get(a.id) ?? 0));
  const rows: number[][] = Array.from({ length: maxLayer + 1 }, () => []);
  // 첫 순서는 표준 순서 — 무게중심이 결정하지 못하는 자리는 이 순서가 남는다
  for (const a of [...acts].sort((x, y) => x.stageIdx - y.stageIdx || x.seq - y.seq))
    rows[layer.get(a.id) ?? 0].push(a.id);

  const preds = new Map<number, number[]>();
  const succs = new Map<number, number[]>();
  for (const e of edges) {
    preds.set(e.to, [...(preds.get(e.to) ?? []), e.from]);
    succs.set(e.from, [...(succs.get(e.from) ?? []), e.to]);
  }

  const sweep = (down: boolean) => {
    const idx = new Map<number, number>();
    rows.forEach((row) => row.forEach((id, i) => idx.set(id, i)));
    const order = down
      ? Array.from(rows.keys()).slice(1)
      : Array.from(rows.keys()).slice(0, -1).reverse();
    for (const l of order) {
      const near = down ? preds : succs;
      const bary = new Map<number, number>();
      rows[l].forEach((id, i) => {
        const linked = (near.get(id) ?? []).filter((o) => idx.has(o));
        bary.set(id, linked.length ? linked.reduce((s, o) => s + idx.get(o)!, 0) / linked.length : i);
      });
      rows[l] = [...rows[l]].sort((a, b) => (bary.get(a) ?? 0) - (bary.get(b) ?? 0));
      rows[l].forEach((id, i) => idx.set(id, i));
    }
  };
  for (let pass = 0; pass < 4; pass += 1) sweep(pass % 2 === 0);
  return rows;
}

type Placed = {
  pos: Map<number, { x: number; y: number }>;
  width: number;
  height: number;
  /** 가장 붐비는 층의 줄 수 — 캔버스 높이를 여기에 맞춘다 */
  rows: number;
};

/** 계층 배치 — 층은 좌→우, 층 안 순서는 세로. 각 층은 세로 가운데로 모은다 */
function placeGraph(acts: Act[], connections: Connection[]): Placed & { back: Set<string> } {
  const edges = allEdges(acts, connections);
  const back = findBackEdges(acts, edges);
  const forward = edges.filter((e) => !back.has(`${e.from}->${e.to}`));
  const layer = assignLayers(acts, forward);
  const rows = orderLayers(acts, forward, layer);
  const tallest = Math.max(1, ...rows.map((r) => r.length));
  const pos = new Map<number, { x: number; y: number }>();
  rows.forEach((row, l) => {
    const offset = ((tallest - row.length) * ROW_H) / 2;
    row.forEach((id, i) => pos.set(id, { x: l * LAYER_X, y: offset + i * ROW_H }));
  });
  return { pos, back, width: rows.length * LAYER_X, height: tallest * ROW_H, rows: tallest };
}

/** 표준 배치 — 비교용. 영역이 열, 영역 안 표준 순서가 행 (v5까지 쓰던 그림) */
function placeStandard(acts: Act[]): Placed {
  const pos = new Map<number, { x: number; y: number }>();
  const perStage = new Map<string, number>();
  let cols = 0;
  let maxRow = 0;
  for (const a of [...acts].sort((x, y) => x.stageIdx - y.stageIdx || x.seq - y.seq)) {
    const row = perStage.get(a.stageCode) ?? 0;
    perStage.set(a.stageCode, row + 1);
    pos.set(a.id, { x: a.stageIdx * LAYER_X, y: row * ROW_H });
    cols = Math.max(cols, a.stageIdx + 1);
    maxRow = Math.max(maxRow, row + 1);
  }
  return { pos, width: cols * LAYER_X, height: maxRow * ROW_H, rows: maxRow };
}

/* ── 차트 한 판 ────────────────────────────────────────────────────── */

function buildChart({
  acts,
  connections,
  placed,
  back,
  editable,
  draggingId,
  showLinks,
}: {
  acts: Act[];
  connections: Connection[];
  placed: Placed;
  back: Set<string>;
  editable: boolean;
  draggingId: number | null;
  /** 표준 배치에서는 에이전트 연결선을 그리지 않는다 — 표준 순서만 보여 주는 그림이라 */
  showLinks: boolean;
}): { nodes: Node[]; edges: Edge[]; bottlenecks: number[] } {
  const edgeList = allEdges(acts, showLinks ? connections : []);
  const hasIn = new Set(edgeList.map((e) => e.to));
  const hasOut = new Set(edgeList.map((e) => e.from));
  /* 병목 — 표준상 산출 문서가 나와야 하는데 한 건도 없고, 흐름은 앞뒤로 이어지는 자리 */
  const bottleneck = new Set(
    acts
      .filter((a) => a.standardDocs > 0 && a.docs.length === 0 && hasIn.has(a.id) && hasOut.has(a.id))
      .map((a) => a.id),
  );

  const nodes: Node[] = acts.map((a) => ({
    id: `act:${a.id}`,
    type: "task",
    position: placed.pos.get(a.id) ?? { x: 0, y: 0 },
    draggable: editable,
    data: {
      name: a.name,
      stageName: a.stageName,
      tone: toneOf(a.stageCode),
      docs: a.docs.slice(0, 2),
      moreDocs: Math.max(0, a.docs.length - 2),
      bottleneck: bottleneck.has(a.id),
      grabbable: editable,
      dragging: draggingId === a.id,
    } satisfies TaskData as unknown as Record<string, unknown>,
  }));

  const toneById = new Map(acts.map((a) => [a.id, toneOf(a.stageCode)]));
  const edges: Edge[] = edgeList.map((e) => {
    const isBack = back.has(`${e.from}->${e.to}`);
    /* 병목에서 나가는 선은 붉게 — 그 자리에서 기록이 끊긴 채 다음으로 넘어간다는 뜻 */
    const broken = bottleneck.has(e.from);
    const color = broken
      ? "var(--fg-danger)"
      : e.cross
        ? "var(--blue-500)"
        : (toneById.get(e.from) ?? "var(--grey-400)");
    return {
      id: `e:${e.from}-${e.to}`,
      source: `act:${e.from}`,
      target: `act:${e.to}`,
      markerEnd: { ...ARROW, color },
      style: {
        stroke: color,
        strokeWidth: e.cross ? 1.6 : 1.3,
        strokeDasharray: isBack ? "5 4" : undefined,
        opacity: broken ? 0.75 : e.cross ? 0.6 : 0.45,
      },
    };
  });

  return { nodes, edges, bottlenecks: [...bottleneck] };
}

/* ── 범례 ──────────────────────────────────────────────────────────── */

function Legend({ stages, bottlenecks }: { stages: ChartStage[]; bottlenecks: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px 14px",
        marginTop: 10,
        font: "var(--text-caption)",
        color: "var(--fg-tertiary)",
      }}
    >
      {stages.map((s) => (
        <span key={s.code} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: 3,
              background: toneOf(s.code),
              flex: "none",
            }}
          />
          {s.name}
        </span>
      ))}
      {bottlenecks > 0 && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: "var(--fg-danger)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 9,
              height: 9,
              borderRadius: 3,
              border: "1.5px solid var(--fg-danger)",
              background: "var(--bg-danger-weak)",
              flex: "none",
            }}
          />
          기록 끊김 {bottlenecks}곳 — 표준상 문서가 나와야 하는데 없어요
        </span>
      )}
    </div>
  );
}

/* ── 본체 ──────────────────────────────────────────────────────────── */

const canvasBox = {
  width: "100%",
  border: "1px solid var(--line-default)",
  borderRadius: "var(--radius-l)",
  overflow: "hidden",
  background: "var(--bg-primary)",
} as const;

/** 비교용 표준 배치는 폭이 좁아 다 들어온다 — 그쪽만 fitView를 쓴다 */
const FIT = { padding: 0.1, minZoom: 0.45, maxZoom: 0.95 } as const;

export function WorkflowChart({
  assessmentId,
  editable = false,
}: {
  assessmentId: string;
  editable?: boolean;
}) {
  const [stages, setStages] = useState<ChartStage[] | null>(null);
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  /** 드래그 중인 업무 — 잡고 있다는 걸 카드가 커지고 그림자가 짙어지며 알린다 (v7) */
  const [draggingId, setDraggingId] = useState<number | null>(null);
  /** 표준 워크플로우 비교 — 아래에 표준 배치를 함께 편다 (v7) */
  const [compare, setCompare] = useState(false);
  const linkRequested = useRef(false);

  const load = useCallback(() => {
    api<{ stages: ChartStage[]; connections: Connection[] | null }>(
      `/api/assessments/${assessmentId}/workflow`,
    )
      .then(({ stages, connections }) => {
        setStages(stages ?? []);
        setConnections(connections);
      })
      .catch(() => setStages([]));
  }, [assessmentId]);
  useEffect(load, [load]);

  /* 에이전트 연결이 아직 없으면 생성 요청 — 한 번만 (있으면 저장분을 그대로 반환한다) */
  useEffect(() => {
    if (stages === null || stages.length === 0) return;
    if (connections !== null || linkRequested.current) return;
    linkRequested.current = true;
    setLinking(true);
    api<{ connections: Connection[] }>(
      `/api/assessments/${assessmentId}/workflow/connections`,
      { method: "POST" },
    )
      .then(({ connections }) => setConnections(connections))
      .catch(() => setConnections([]))
      .finally(() => setLinking(false));
  }, [stages, connections, assessmentId]);

  const acts = useMemo(() => toActs(stages ?? []), [stages]);
  const graph = useMemo(() => placeGraph(acts, connections ?? []), [acts, connections]);
  const flow = useMemo(
    () =>
      buildChart({
        acts,
        connections: connections ?? [],
        placed: graph,
        back: graph.back,
        editable,
        draggingId,
        showLinks: true,
      }),
    [acts, connections, graph, editable, draggingId],
  );
  const standardPlaced = useMemo(() => (compare ? placeStandard(acts) : null), [compare, acts]);
  const standardFlow = useMemo(() => {
    if (!compare || !standardPlaced) return null;
    return buildChart({
      acts,
      connections: [],
      placed: standardPlaced,
      back: new Set<string>(),
      editable: false,
      draggingId: null,
      showLinks: false,
    });
  }, [compare, acts, standardPlaced]);

  /* 드래그 종료 — 놓은 x좌표로 그 영역 안 업무 순서를 다시 정한다.
     흐름이 좌→우라 왼쪽으로 끌면 앞 순서, 오른쪽으로 끌면 뒤 순서가 된다.
     순서가 그대로면 흐트러진 좌표만 원위치로 되돌린다 */
  const onDragStop = useCallback(
    (_e: unknown, node: Node) => {
      setDraggingId(null);
      if (!editable || !stages) return;
      if (!node.id.startsWith("act:")) return;

      const actId = Number(node.id.slice("act:".length));
      const me = acts.find((a) => a.id === actId);
      const siblings = acts.filter((a) => a.stageCode === me?.stageCode);
      if (!me || siblings.length < 2) {
        load();
        return;
      }
      const others = siblings.filter((a) => a.id !== actId);
      const centers = others.map((a) => (graph.pos.get(a.id)?.x ?? 0) + NODE_W / 2);
      const to = centers.filter((cx) => cx < node.position.x + NODE_W / 2).length;
      const from = siblings.findIndex((a) => a.id === actId);
      if (to === from) {
        load();
        return;
      }
      const activityIds = others.map((a) => a.id);
      activityIds.splice(to, 0, actId);
      setSaving(true);
      api(`/api/assessments/${assessmentId}/workflow`, {
        method: "PUT",
        body: JSON.stringify({ taskOrder: { stageCode: me.stageCode, activityIds } }),
      })
        .then(load)
        .catch(load)
        .finally(() => setSaving(false));
    },
    [editable, stages, acts, graph, assessmentId, load],
  );

  /* 불러오는 중·AI가 연결을 만드는 중 — 섹션 안에서 그대로 알린다 (v7).
     종전엔 아무것도 그리지 않아 화면이 비어 있다가 갑자기 나타났다 */
  if (stages === null || (stages.length > 0 && connections === null))
    return (
      <div style={{ ...canvasBox, height: 520 }}>
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <Loader style={{ width: 26, height: 26 }} />
          <TextShimmer style={{ font: "var(--text-body3)" }}>
            {stages === null
              ? "업무 흐름을 불러오고 있어요"
              : "AI가 문서 흐름으로 업무 연결을 그리고 있어요"}
          </TextShimmer>
        </div>
      </div>
    );

  if (stages.length === 0) return null;

  /* 올라온 문서가 하나도 없으면 그리지 않는다 — 표준 흐름만 남아 이 기업의 워크플로우처럼 보인다.
     (자료 없이 진행한 진단에서 워크플로우가 뜨던 문제, 2026-08-06) */
  const ownedDocCount = acts.reduce((sum, a) => sum + a.docs.length, 0);
  if (ownedDocCount === 0)
    return (
      <p
        style={{
          margin: 0,
          padding: "20px 22px",
          borderRadius: "var(--radius-l)",
          background: "var(--bg-secondary)",
          font: "var(--text-body3)",
          color: "var(--fg-tertiary)",
        }}
      >
        올라온 문서가 없어 업무 흐름을 그릴 수 없어요. 자료를 올리면 실제 업무 순서와 문서 흐름이
        여기에 나타나요.
      </p>
    );

  return (
    <div>
      {/* 안내 + 비교하기 — 안내는 가운데, 버튼은 오른쪽 (v7) */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginBottom: 10,
          minHeight: 30,
        }}
      >
        <p
          style={{
            margin: 0,
            textAlign: "center",
            font: "var(--text-caption)",
            color: "var(--fg-tertiary)",
          }}
        >
          {editable
            ? "업무 상자를 좌우로 드래그해 우리 회사의 실제 순서로 바꿀 수 있어요"
            : "화살표가 업무 흐름의 방향이에요 — 파란 선은 AI가 문서 흐름으로 판단한 연결이에요"}
          {saving ? " · 저장 중…" : linking ? " · AI가 업무 연결을 분석하고 있어요…" : ""}
        </p>
        <button
          type="button"
          onClick={() => setCompare((v) => !v)}
          aria-expanded={compare}
          style={{
            position: "absolute",
            right: 0,
            padding: "5px 12px",
            borderRadius: "var(--radius-full)",
            border: `1px solid ${compare ? "var(--line-brand)" : "var(--line-default)"}`,
            background: compare ? "var(--bg-brand-weak)" : "var(--bg-elevated)",
            color: compare ? "var(--fg-brand)" : "var(--fg-secondary)",
            font: "var(--text-label-s)",
            fontFamily: "var(--font-sans)",
            cursor: "pointer",
            transition: "border-color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease)",
          }}
        >
          {compare ? "비교 닫기" : "비교하기"}
        </button>
      </div>

      <div style={{ ...canvasBox, height: canvasHeight(graph.rows) }}>
        <ReactFlow
          nodes={flow.nodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          onNodeDragStart={(_e, node) => setDraggingId(Number(node.id.slice("act:".length)))}
          onNodeDragStop={onDragStop}
          /* fitView는 다 넣으려고 배율을 0.4까지 떨어뜨려 글자를 못 읽게 만든다.
             읽을 수 있는 배율로 왼쪽 위(흐름의 시작)에서 열고, 전체는 좌하단 버튼으로 본다 */
          defaultViewport={{ x: 24, y: 16, zoom: START_ZOOM }}
          minZoom={0.25}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          deleteKeyCode={null}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <Legend stages={stages} bottlenecks={flow.bottlenecks.length} />

      {/* 표준 워크플로우 — 비교하기로 펼친다. ISO 절차서 기준 영역별 순서 그대로 */}
      {compare && standardFlow && (
        <div className="ax-step-enter" style={{ marginTop: 18 }}>
          <p
            style={{
              margin: "0 0 8px",
              textAlign: "center",
              font: "var(--text-caption)",
              color: "var(--fg-tertiary)",
            }}
          >
            표준 워크플로우 — ISO 9001 절차서 기준 8대 기능 영역별 업무 순서예요
          </p>
          <div
            style={{
              ...canvasBox,
              height: canvasHeight(standardPlaced?.rows ?? 6),
              background: "var(--bg-secondary)",
            }}
          >
            <ReactFlow
              nodes={standardFlow.nodes}
              edges={standardFlow.edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={FIT}
              minZoom={0.25}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              deleteKeyCode={null}
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </div>
      )}
    </div>
  );
}
