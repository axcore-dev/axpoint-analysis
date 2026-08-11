"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyNodeChanges,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
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

/* v9 A5 — 문서 도출 합성 그래프. 표준 업무 목록 없이 이 기업의 문서(소분류·레벨·식별자·업무
   힌트)만으로 백엔드가 합성한 업무 노드·흐름이다. 이 값이 있으면 회사 워크플로우는 표준
   activity 대신 이것을 그린다 — 과거 진단(합성 이전)은 종전 connections 렌더를 유지한다. */
type SynthNode = {
  id: string;
  activity_name: string;
  function_area: string;
  source_documents: string[]; // 문서 ref — 이름은 documents 맵에서 찾는다
  level_distribution?: { l1: number; l2: number; l3: number; l4: number };
  confidence: number;
};
type SynthEdge = {
  from: string;
  to: string;
  basis: "shared_identifier" | "document_reference" | "text_sequence";
  evidence: string[];
  confidence: number;
  inferred: boolean; // 근거 약함 — 점선 + '추정' 라벨
};
type Synthesized = {
  nodes: SynthNode[];
  edges: SynthEdge[];
  documents: { ref: string; fileId: string; docTypeName: string; level: number | null }[];
};

/* v9 A6 — 표준 대비 갭. missing=표준에 있는데 합성에 없음(기록 끊김 후보),
   docGaps=매칭된 업무의 표준 요구 기록 미보유(해당 합성 노드에 기록 끊김 표시) */
type WorkflowGaps = {
  missing: { activityId: number; name: string; stageCode: string }[];
  docGaps: {
    activityId: number;
    activityName: string;
    stageCode: string;
    nodeId: string;
    missingDocs: string[];
  }[];
};

/* 분석 레이어 — 합성 노드별 기록 끊김·DX 지점·AX 지점 (백엔드 산수 결과).
   결과 화면(읽기 모드)이 붉은 상자·배지·범례 칩을 이걸로 그린다 */
type NodeLayerFlags = { broken: boolean; dx: boolean; ax: boolean };

const NODE_W = 196;
const LAYER_X = 268; // 층 간격 (노드 폭 + 여백)
const ROW_H = 104; // 같은 층 안 세로 간격
/** 캔버스 높이 — 층 안 줄 수에 맞춘다. 고정 높이는 위아래로 빈 띠만 남겼다 (v7) */
const canvasHeight = (rows: number) => Math.max(420, Math.min(760, rows * ROW_H + 110));

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
  /** 영역 이름 — 화면에는 쓰지 않고 스크린리더·툴팁에만 (색과 범례가 이미 알려 준다) */
  stageName: string;
  tone: string;
  docs: string[];
  /** 화면에 못 담은 나머지 문서 수 */
  moreDocs: number;
  bottleneck: boolean;
  /** 분석 레이어 배지 (결과 화면) — 카드에는 우선순위 하나만, 나머지는 툴팁 */
  dx: boolean;
  ax: boolean;
  /** 범례에서 다른 영역을 고른 상태 — 색을 빼고 흐리게 물러난다 (v7-1) */
  dimmed: boolean;
};

/** 레이어 배지 색 — DX는 파랑, AX는 보라 (STAGE_TONE.design과 같은 계열) */
const DX_COLOR = "var(--blue-500)";
const AX_COLOR = "#7A5AF8";

/**
 * 업무 상자 — 영역 구분은 **테두리 색**만 맡는다 (v7-1).
 * 왼쪽 색 띠와 상자 안 영역 이름은 뺐다: 띠는 군더더기였고, 영역 이름은 하단 범례와 겹쳤다.
 * 글자 색은 전부 기본색으로 통일해 읽는 흐름을 끊지 않는다.
 */
function TaskNode({ data }: NodeProps) {
  const d = data as unknown as TaskData;
  /* 물러난 상자는 영역 색도 병목 색도 쓰지 않는다 — 고른 영역만 두각을 나타내야 한다 */
  const border = d.dimmed
    ? "var(--line-default)"
    : d.bottleneck
      ? "var(--fg-danger)"
      : d.tone;
  /* 배지는 우선순위 하나만 카드에 — broken > dx > ax. 겹친 나머지는 툴팁으로 */
  const badge = d.bottleneck
    ? { label: "기록 끊김", color: "var(--fg-danger)" }
    : d.dx
      ? { label: "DX 지점", color: DX_COLOR }
      : d.ax
        ? { label: "AX 지점", color: AX_COLOR }
        : null;
  const hiddenLayers = [
    d.bottleneck && d.dx ? "DX 지점" : null,
    (d.bottleneck || d.dx) && d.ax ? "AX 지점" : null,
  ].filter(Boolean) as string[];
  return (
    <div
      className="ax-wf-node"
      title={[d.stageName, ...hiddenLayers].join(" · ")}
      style={{
        /* 모양(테두리·그림자·집힘 효과)은 globals.css가 맡는다 — 인라인 스타일은 규칙보다 세서
           .dragging 규칙이 먹히지 않는다. 여기서는 값만 변수로 넘긴다 */
        ["--wf-tone" as string]: d.tone,
        ["--wf-border" as string]: border,
        ["--wf-bg" as string]:
          d.bottleneck && !d.dimmed ? "var(--bg-danger-weak)" : "var(--bg-elevated)",
        width: NODE_W,
        opacity: d.dimmed ? 0.34 : 1,
        filter: d.dimmed ? "grayscale(1)" : undefined,
      }}
    >
      {/* 좌·우는 영역을 가로지르는 연결, 상·하는 같은 영역 안 순서 연결에 쓴다.
          세로로 쌓인 상자를 좌·우 핸들로 이으면 선이 옆으로 크게 돌아 나간다 */}
      <Handle id="l" type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle id="r" type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle id="t" type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle id="b" type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            minWidth: 0,
            flex: 1,
            font: "var(--text-label-s)",
            lineHeight: 1.35,
            color: "var(--fg-primary)",
          }}
        >
          {d.name}
        </span>
        {badge && !d.dimmed && (
          <span
            style={{
              flex: "none",
              font: "var(--text-caption)",
              fontWeight: 600,
              color: badge.color,
            }}
          >
            {badge.label}
          </span>
        )}
      </span>

      {d.docs.length > 0 && (
        <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
          {d.docs.map((name) => (
            <span
              key={name}
              style={{
                font: "10.5px/1.3 var(--font-sans)",
                padding: "2px 6px",
                borderRadius: 999,
                border: "1px solid var(--line-default)",
                color: "var(--fg-tertiary)",
                background: "var(--bg-secondary)",
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

/* 레인 배경 띠·영역명 라벨은 그리지 않는다 — 영역 구분은 테두리 색과 하단 범례가 이미 한다.
   레인은 배치 계산(placeLanes)에만 남아 세로 자리를 잡는다 */
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
  /** 표준상 나와야 하는 산출 문서명 — 표준 패널은 이것만 그린다(보유 여부 무관) */
  standardDocNames: string[];
  /** 좌표 저장 키 — 표준 업무는 숫자 id 그대로, 합성 노드는 "syn:" 접두로 구분 (v9) */
  posKey: string;
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
      standardDocNames: act.outputDocs.map((d) => d.name),
      posKey: String(act.id),
    })),
  );
}

/**
 * 합성 노드 → 차트 Act 어댑터 (v9) — 노드가 곧 업무 상자다.
 * 레인은 function_area로 배치하고(표준 8대 영역과 같은 이름), 어느 영역도 아니면 '기타' 레인.
 * docs 칩은 근거 문서 소분류명 — 같은 소분류가 여러 건이면 ×N으로 근거 문서 수를 보인다.
 */
function synthToActs(synth: Synthesized, stages: ChartStage[]): Act[] {
  const stageByName = new Map(stages.map((s, i) => [s.name, { code: s.code, idx: i }]));
  const nameByRef = new Map(synth.documents.map((d) => [d.ref, d.docTypeName]));
  return synth.nodes.map((n, i) => {
    const at = stageByName.get(n.function_area) ?? { code: "etc", idx: stages.length };
    const counts = new Map<string, number>();
    for (const r of n.source_documents) {
      const nm = nameByRef.get(r) ?? r;
      counts.set(nm, (counts.get(nm) ?? 0) + 1);
    }
    return {
      id: i, // 화면 내부 id — 저장에는 posKey(syn:노드id)만 쓴다
      name: n.activity_name,
      stageCode: at.code,
      stageName: n.function_area,
      stageIdx: at.idx,
      seq: i,
      docs: [...counts].map(([nm, c]) => (c > 1 ? `${nm} ×${c}` : nm)),
      standardDocNames: [],
      posKey: `syn:${n.id}`,
    };
  });
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

type Lane = { code: string; name: string; tone: string; y: number; height: number };

type Placed = {
  pos: Map<number, { x: number; y: number }>;
  width: number;
  height: number;
  /** 가장 붐비는 층의 줄 수 — 캔버스 높이를 여기에 맞춘다 */
  rows: number;
  lanes?: Lane[];
};

/** 레인 안 여백 — 상자가 레인 경계선에 붙지 않게 */
const LANE_PAD = 14;
const LANE_GAP = 10;

/**
 * 스임레인 배치 (v8) — 기능 영역이 가로 레인, 업무 순서는 좌→우 단일 방향.
 *
 * v7의 순수 계층 배치는 이어진 것끼리는 모였지만 같은 영역 업무가 캔버스 곳곳에 흩어졌다.
 * 이제 세로 자리는 영역 레인이 정하고, 가로 자리만 흐름(위상 층)이 정한다 —
 * "어느 영역의 일인가"와 "언제 하는 일인가"를 축 두 개가 나눠 맡는다.
 * 같은 레인·같은 층에 두 업무가 겹치면 레인 안에서 아래로 쌓고 레인 높이를 늘린다.
 *
 * 사용자가 옮겨 둔 상자(saved)는 그 자리를 그대로 쓴다 — 자동 배치는 아직 안 옮긴 상자만 맡는다.
 */
function placeLanes(
  acts: Act[],
  edges: { from: number; to: number; cross: boolean }[],
  saved: Record<string, { x: number; y: number }> = {},
): Placed & { back: Set<string> } {
  const back = findBackEdges(acts, edges);
  const forward = edges.filter((e) => !back.has(`${e.from}->${e.to}`));
  const layer = assignLayers(acts, forward);

  /* 레인 = 업무가 있는 영역, 표준 영역 순서대로. 레인 안에서 (층)이 겹치는 업무 수만큼 높이를 준다 */
  const stageOrder = [...new Map(acts.map((a) => [a.stageCode, a])).values()].sort(
    (x, y) => x.stageIdx - y.stageIdx,
  );
  const slot = new Map<number, number>(); // act → 레인 안 줄 번호
  const laneRows = new Map<string, number>(); // 레인 → 필요한 줄 수
  for (const s of stageOrder) {
    const mine = acts
      .filter((a) => a.stageCode === s.stageCode)
      .sort((x, y) => (layer.get(x.id) ?? 0) - (layer.get(y.id) ?? 0) || x.seq - y.seq);
    const used = new Map<number, number>(); // 층 → 이미 쓴 줄 수
    let rows = 1;
    for (const a of mine) {
      const l = layer.get(a.id) ?? 0;
      const k = used.get(l) ?? 0;
      used.set(l, k + 1);
      slot.set(a.id, k);
      rows = Math.max(rows, k + 1);
    }
    laneRows.set(s.stageCode, rows);
  }

  const lanes: Lane[] = [];
  let yCursor = 0;
  for (const s of stageOrder) {
    const height = (laneRows.get(s.stageCode) ?? 1) * ROW_H + LANE_PAD;
    lanes.push({ code: s.stageCode, name: s.stageName, tone: toneOf(s.stageCode), y: yCursor, height });
    yCursor += height + LANE_GAP;
  }
  const laneOf = new Map(lanes.map((l) => [l.code, l]));

  const pos = new Map<number, { x: number; y: number }>();
  const maxLayer = Math.max(0, ...acts.map((a) => layer.get(a.id) ?? 0));
  for (const a of acts) {
    const lane = laneOf.get(a.stageCode)!;
    pos.set(a.id, {
      x: (layer.get(a.id) ?? 0) * LAYER_X,
      y: lane.y + LANE_PAD / 2 + (slot.get(a.id) ?? 0) * ROW_H,
    });
  }

  /* 옮겨 둔 자리로 덮어쓴다. 캔버스 크기는 그 자리까지 담도록 넓힌다 */
  let maxX = (maxLayer + 1) * LAYER_X;
  let maxY = yCursor;
  for (const a of acts) {
    const p = saved[a.posKey];
    if (!p) continue;
    pos.set(a.id, p);
    maxX = Math.max(maxX, p.x + LAYER_X);
    maxY = Math.max(maxY, p.y + ROW_H);
  }
  return { pos, back, width: maxX, height: maxY, rows: Math.ceil(maxY / ROW_H), lanes };
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
  edgeList,
  placed,
  back,
  editable,
  focus,
  template = false,
  bottleneckOverride,
  inferredKeys,
  dxSet,
  axSet,
}: {
  acts: Act[];
  /** 그릴 연결 — 표준 기반은 allEdges() 산출, 합성 모드는 합성 엣지를 넘긴다 (v9) */
  edgeList: { from: number; to: number; cross: boolean }[];
  placed: Placed;
  back: Set<string>;
  editable: boolean;
  /** 범례에서 고른 영역 코드, 또는 BOTTLENECK. null이면 전부 그대로 (v7-1) */
  focus: string | null;
  /**
   * 표준 템플릿 모드 (v8 이슈①) — 회사 데이터와 완전히 분리한다.
   * 칩은 표준 요구 기록명, 보유 여부·기록 끊김 판정은 하지 않는다.
   * 진단 결과는 회사 워크플로우에만 나타나야 한다.
   */
  template?: boolean;
  /** 합성 모드의 기록 끊김 (v9 A6) — 갭 계산 결과가 주면 내부 휴리스틱 대신 이것을 쓴다 */
  bottleneckOverride?: Set<number>;
  /** 합성 엣지 중 '추정'(inferred) — 점선 + 라벨로 구분한다 (v9 A5) */
  inferredKeys?: Set<string>;
  /** 분석 레이어 (결과 화면) — DX·AX 지점 노드의 화면 idx. 읽기 모드에서만 넘어온다 */
  dxSet?: Set<number>;
  axSet?: Set<number>;
}): { nodes: Node[]; edges: Edge[]; bottlenecks: number[] } {
  const hasIn = new Set(edgeList.map((e) => e.to));
  const hasOut = new Set(edgeList.map((e) => e.from));
  /* 병목 — 표준상 산출 문서가 나와야 하는데 한 건도 없고, 흐름은 앞뒤로 이어지는 자리.
     합성 모드는 표준 대비 갭(A6)이 이미 계산돼 오므로 그 결과를 그대로 쓴다 */
  const bottleneck = template
    ? new Set<number>()
    : bottleneckOverride ??
      new Set(
        acts
          .filter(
            (a) =>
              a.standardDocNames.length > 0 &&
              a.docs.length === 0 &&
              hasIn.has(a.id) &&
              hasOut.has(a.id),
          )
          .map((a) => a.id),
      );

  /** 고른 영역(또는 기록 끊김·DX·AX 레이어)에 드는 업무만 두각을 나타낸다 */
  const inFocus = (a: Act) =>
    focus === null ||
    (focus === BOTTLENECK
      ? bottleneck.has(a.id)
      : focus === DX_FOCUS
        ? (dxSet?.has(a.id) ?? false)
        : focus === AX_FOCUS
          ? (axSet?.has(a.id) ?? false)
          : a.stageCode === focus);
  const focused = new Set(acts.filter(inFocus).map((a) => a.id));

  const nodes: Node[] = [];
  for (const a of acts) {
    const chips = template ? a.standardDocNames : a.docs;
    nodes.push({
      id: `act:${a.id}`,
      type: "task",
      position: placed.pos.get(a.id) ?? { x: 0, y: 0 },
      draggable: editable,
      data: {
        name: a.name,
        stageName: a.stageName,
        tone: toneOf(a.stageCode),
        docs: chips.slice(0, 2),
        moreDocs: Math.max(0, chips.length - 2),
        bottleneck: bottleneck.has(a.id),
        dx: dxSet?.has(a.id) ?? false,
        ax: axSet?.has(a.id) ?? false,
        dimmed: focus !== null && !focused.has(a.id),
      } satisfies TaskData as unknown as Record<string, unknown>,
    });
  }

  const toneById = new Map(acts.map((a) => [a.id, toneOf(a.stageCode)]));
  const stageById = new Map(acts.map((a) => [a.id, a.stageCode]));
  const edges: Edge[] = edgeList.map((e) => {
    const isBack = back.has(`${e.from}->${e.to}`);
    /* 추정 연결 (v9 A5) — 근거가 약해 코드가 inferred로 강제한 엣지. 점선 + '추정' 라벨 */
    const isInferred = inferredKeys?.has(`${e.from}->${e.to}`) ?? false;
    /* 병목에서 나가는 선은 붉게 — 그 자리에서 기록이 끊긴 채 다음으로 넘어간다는 뜻 */
    const broken = bottleneck.has(e.from);
    /* 고른 영역에 한쪽이라도 닿는 선만 색을 남긴다 — 나머지는 회색으로 물러난다 */
    const near = focus === null || focused.has(e.from) || focused.has(e.to);
    const color = !near
      ? "var(--grey-300)"
      : broken
        ? "var(--fg-danger)"
        : e.cross
          ? "var(--blue-500)"
          : (toneById.get(e.from) ?? "var(--grey-400)");
    /* 선 모양은 하나로 통일한다 — 같은 영역 안은 상·하 핸들로 곧게, 영역을 건너는 선은
       좌·우 핸들 + 직교로 꺾는다(v8 이슈②). 예전엔 같은 영역 안만 베지어라 한 화면에
       곡선과 직각이 섞여 보였다.
       표준 패널은 순서 나열이 전부라 직선으로 둔다 — 꺾을 구간 자체가 없다 */
    const crossLane = stageById.get(e.from) !== stageById.get(e.to);
    return {
      id: `e:${e.from}-${e.to}`,
      source: `act:${e.from}`,
      target: `act:${e.to}`,
      sourceHandle: crossLane ? "r" : "b",
      targetHandle: crossLane ? "l" : "t",
      type: template ? "straight" : "smoothstep",
      markerEnd: { ...ARROW, color },
      ...(isInferred && near
        ? {
            label: "추정",
            labelStyle: { fontSize: 10, fill: "var(--fg-tertiary)" },
            /* bg-elevated — SVG rect의 fill이라 정의 안 된 변수면 검은 상자가 된다 */
            labelBgStyle: { fill: "var(--bg-elevated)", fillOpacity: 0.85 },
            labelBgPadding: [4, 2] as [number, number],
          }
        : {}),
      style: {
        stroke: color,
        strokeWidth: e.cross ? 1.6 : 1.3,
        strokeDasharray: isBack || isInferred ? "5 4" : undefined,
        opacity: !near ? 0.18 : broken ? 0.85 : e.cross ? 0.7 : 0.5,
      },
    };
  });

  return { nodes, edges, bottlenecks: [...bottleneck] };
}

/* ── 범례 ──────────────────────────────────────────────────────────── */

/** 범례에서 '기록 끊김'을 고른 상태를 가리키는 값 — 영역 코드와 섞이지 않게 따로 둔다 */
const BOTTLENECK = "__bottleneck";
/** 분석 레이어 포커스 키 (결과 화면) — DX 지점·AX 지점 칩 */
const DX_FOCUS = "__dx";
const AX_FOCUS = "__ax";

/**
 * 범례 — 표시가 아니라 **버튼**이다 (v7-1).
 * 누르면 그 영역만 색을 남기고 나머지는 회색으로 물러난다. 다시 누르면 전부 돌아온다.
 */
function Legend({
  stages,
  bottlenecks,
  dxCount = 0,
  axCount = 0,
  focus,
  onFocus,
}: {
  /** 범례 칩 목록 — 합성 모드에서는 노드가 실제로 있는 영역만 온다 (v9) */
  stages: { code: string; name: string }[];
  bottlenecks: number;
  /** 분석 레이어 칩 (결과 화면) — 0이면 그리지 않는다 */
  dxCount?: number;
  axCount?: number;
  focus: string | null;
  onFocus: (next: string | null) => void;
}) {
  const chip = (key: string, tone: string, label: string, danger = false) => {
    const on = focus === key;
    const off = focus !== null && !on;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onFocus(on ? null : key)}
        aria-pressed={on}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: "var(--radius-full)",
          border: `1px solid ${on ? tone : "transparent"}`,
          background: on ? `${tone}14` : "transparent",
          font: "var(--text-caption)",
          fontFamily: "var(--font-sans)",
          color: danger ? "var(--fg-danger)" : "var(--fg-tertiary)",
          opacity: off ? 0.45 : 1,
          cursor: "pointer",
          transition:
            "opacity var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 12,
            height: 9,
            borderRadius: 3,
            border: `1.5px solid ${tone}`,
            background: danger ? "var(--bg-danger-weak)" : "transparent",
            flex: "none",
          }}
        />
        {label}
      </button>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px 4px",
        marginTop: 8,
      }}
    >
      {/* 표시는 상자와 같은 문법 — 테두리 색이 영역이다 (v7-1) */}
      {stages.map((s) => chip(s.code, toneOf(s.code), s.name))}
      {bottlenecks > 0 &&
        chip(BOTTLENECK, "var(--fg-danger)", `기록 끊김 ${bottlenecks}곳`, true)}
      {dxCount > 0 && chip(DX_FOCUS, DX_COLOR, `DX 지점 ${dxCount}곳`)}
      {axCount > 0 && chip(AX_FOCUS, AX_COLOR, `AX 지점 ${axCount}곳`)}
      {focus !== null && (
        <button
          type="button"
          onClick={() => onFocus(null)}
          style={{
            marginLeft: 4,
            padding: "4px 10px",
            borderRadius: "var(--radius-full)",
            border: "1px solid var(--line-default)",
            background: "var(--bg-elevated)",
            font: "var(--text-caption)",
            fontFamily: "var(--font-sans)",
            color: "var(--fg-secondary)",
            cursor: "pointer",
          }}
        >
          전체 보기
        </button>
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
  onBottlenecks,
}: {
  assessmentId: string;
  editable?: boolean;
  /** 기록 끊김(병목) 수가 계산되면 부모에 알린다 — 결과 화면의 여정 요약이 이 수치를 쓴다 */
  onBottlenecks?: (count: number) => void;
}) {
  const [stages, setStages] = useState<ChartStage[] | null>(null);
  const [connections, setConnections] = useState<Connection[] | null>(null);
  /** v9 — 문서 도출 합성 그래프. 있으면 이것이 회사 워크플로우다 (과거 진단은 null 유지) */
  const [synthesized, setSynthesized] = useState<Synthesized | null>(null);
  /** v9 A6 — 표준 대비 갭. 합성 노드의 기록 끊김 표시와 미확인 업무 안내에 쓴다 */
  const [gaps, setGaps] = useState<WorkflowGaps | null>(null);
  /** 분석 레이어 — 합성 노드별 기록 끊김·DX·AX 지점. 결과 화면 배지·범례 칩 재료 */
  const [layers, setLayers] = useState<Record<string, NodeLayerFlags> | null>(null);
  /** 사용자가 옮겨 둔 상자 좌표 — 옮긴 것만 담긴다. 나머지는 자동 배치 (v7-1) */
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [saving, setSaving] = useState(false);
  const [linking, setLinking] = useState(false);
  /** 표준 워크플로우 비교 — 아래에 표준 배치를 함께 편다 (v7) */
  const [compare, setCompare] = useState(false);
  /** 범례에서 고른 영역 — 그 영역만 색을 남기고 나머지는 회색으로 물러난다 (v7-1) */
  const [focus, setFocus] = useState<string | null>(null);
  const linkRequested = useRef(false);
  /* 옮긴 좌표는 모아 뒀다 한 번에 보낸다 — 상자를 여러 개 재배치할 때 드롭마다 요청이 나가지 않게 */
  const pendingPos = useRef<Record<string, { x: number; y: number }>>({});
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    api<{
      stages: ChartStage[];
      connections: Connection[] | null;
      positions?: Record<string, { x: number; y: number }>;
      synthesized?: Synthesized | null;
      gaps?: WorkflowGaps | null;
      layers?: Record<string, NodeLayerFlags> | null;
    }>(`/api/assessments/${assessmentId}/workflow`)
      .then(({ stages, connections, positions, synthesized, gaps, layers }) => {
        setStages(stages ?? []);
        setConnections(connections);
        setSynthesized(synthesized ?? null);
        setGaps(gaps ?? null);
        setLayers(layers ?? null);
        setPositions(positions ?? {});
      })
      .catch(() => setStages([]));
  }, [assessmentId]);
  useEffect(load, [load]);

  /* 합성이 아직 없으면 생성 요청 — 한 번만 (있으면 저장분을 그대로 반환한다).
     과거 진단은 connections가 이미 있어 요청하지 않고 종전 표준 기반 렌더를 유지한다 (v9) */
  useEffect(() => {
    if (stages === null || stages.length === 0) return;
    if (synthesized !== null || connections !== null || linkRequested.current) return;
    linkRequested.current = true;
    setLinking(true);
    api<{ synthesized: Synthesized }>(
      `/api/assessments/${assessmentId}/workflow/connections`,
      { method: "POST" },
    )
      .then(({ synthesized }) => {
        setSynthesized(synthesized);
        /* 갭(A6)은 GET이 합성과 함께 계산한다 — 방금 만든 합성의 갭을 받으러 한 번 더 읽는다 */
        load();
      })
      .catch(() => setConnections([]))
      .finally(() => setLinking(false));
  }, [stages, connections, synthesized, assessmentId, load]);

  /* 합성 모드(v9) — 합성 그래프가 있고 노드가 있으면 그것이 회사 워크플로우다 */
  const synthMode = synthesized !== null && synthesized.nodes.length > 0;

  /** 표준 정의 기반 Act — 종전(legacy) 회사 차트와 비교 패널(표준 템플릿)이 쓴다 */
  const acts = useMemo(() => toActs(stages ?? []), [stages]);
  /** 회사 차트에 실제로 그릴 Act — 합성 모드면 합성 노드, 아니면 표준 기반 */
  const companyActs = useMemo(
    () => (synthMode && synthesized ? synthToActs(synthesized, stages ?? []) : acts),
    [synthMode, synthesized, stages, acts],
  );
  /** 회사 차트의 연결선 — 합성 모드는 합성 엣지(노드 id → 화면 idx 변환), 아니면 종전 계산 */
  const companyEdges = useMemo(() => {
    if (!synthMode || !synthesized) {
      return { list: allEdges(companyActs, connections ?? []), inferred: new Set<string>() };
    }
    const idxById = new Map(synthesized.nodes.map((n, i) => [n.id, i]));
    const list: { from: number; to: number; cross: boolean }[] = [];
    const inferred = new Set<string>();
    const seen = new Set<string>();
    for (const e of synthesized.edges) {
      const from = idxById.get(e.from);
      const to = idxById.get(e.to);
      if (from === undefined || to === undefined || from === to) continue;
      const key = `${from}->${to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({ from, to, cross: true });
      if (e.inferred) inferred.add(key);
    }
    return { list, inferred };
  }, [synthMode, synthesized, companyActs, connections]);
  /** 합성 노드의 기록 끊김 (v9 A6) — 표준 요구 기록이 비는 업무의 화면 idx */
  const synthBottlenecks = useMemo(() => {
    if (!synthMode || !synthesized || !gaps) return undefined;
    const idxById = new Map(synthesized.nodes.map((n, i) => [n.id, i]));
    return new Set(
      gaps.docGaps
        .map((g) => idxById.get(g.nodeId))
        .filter((i): i is number => i !== undefined),
    );
  }, [synthMode, synthesized, gaps]);

  /* 분석 레이어 → 화면 idx 집합. broken은 gaps보다 우선한다(같은 산수의 최종 결과라
     결과 화면에서 기록 끊김이 빠지던 문제를 여기서 함께 잡는다). DX·AX는 읽기 모드 전용 */
  const layerSets = useMemo(() => {
    if (!synthMode || !synthesized || !layers) return null;
    const broken = new Set<number>();
    const dx = new Set<number>();
    const ax = new Set<number>();
    synthesized.nodes.forEach((n, i) => {
      const l = layers[n.id];
      if (!l) return;
      if (l.broken) broken.add(i);
      if (l.dx) dx.add(i);
      if (l.ax) ax.add(i);
    });
    return { broken, dx, ax };
  }, [synthMode, synthesized, layers]);

  const graph = useMemo(
    () => placeLanes(companyActs, companyEdges.list, positions),
    [companyActs, companyEdges, positions],
  );
  const flow = useMemo(
    () =>
      buildChart({
        acts: companyActs,
        edgeList: companyEdges.list,
        placed: graph,
        back: graph.back,
        editable,
        focus,
        bottleneckOverride: layerSets?.broken ?? synthBottlenecks,
        inferredKeys: companyEdges.inferred,
        /* DX·AX 배지는 결과 화면(읽기 모드)에만 — 자료 정리 단계는 아직 분석 전이다 */
        dxSet: !editable ? layerSets?.dx : undefined,
        axSet: !editable ? layerSets?.ax : undefined,
      }),
    [companyActs, companyEdges, graph, editable, focus, synthBottlenecks, layerSets],
  );

  /* 기록 끊김 수 통지 — 문서가 한 건도 없으면 차트를 그리지 않으므로(아래 ownedDocCount 가드)
     그때는 0으로 알려 부모가 없는 수치를 문장에 쓰지 않게 한다 */
  useEffect(() => {
    if (!onBottlenecks) return;
    const owned = companyActs.reduce((sum, a) => sum + a.docs.length, 0);
    onBottlenecks(synthMode || owned > 0 ? flow.bottlenecks.length : 0);
  }, [companyActs, synthMode, flow.bottlenecks.length, onBottlenecks]);

  /* 드래그 중 상자가 커서를 따라오게 (v8 이슈③) — 노드를 상태로 들고 위치 변경을 실시간 반영한다.
     완전 제어형(useMemo 결과를 그대로 넘김)이면 React Flow가 중간 위치를 그릴 곳이 없어
     놓는 순간에만 이동한 것처럼 보였다 */
  const [liveNodes, setLiveNodes] = useState<Node[]>(flow.nodes);
  /* 배치가 다시 계산되면 렌더 중에 맞춘다(react.dev의 '렌더 중 상태 조정' 패턴) —
     이펙트로 미루면 한 프레임 옛 배치가 비친다 */
  const [prevFlowNodes, setPrevFlowNodes] = useState(flow.nodes);
  if (prevFlowNodes !== flow.nodes) {
    setPrevFlowNodes(flow.nodes);
    setLiveNodes(flow.nodes);
  }
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setLiveNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  /* ── 카드 교체 드래그 (v10 #1) — 카드 A를 카드 B 위에 놓으면 두 자리가 서로 바뀐다 ── */
  /** 회사 차트 캔버스 — 커서 아래 카드 판정은 이 안의 노드 DOM 사각형으로 한다(줌 반영) */
  const wrapRef = useRef<HTMLDivElement>(null);
  /* onDragStop 콜백에서 최신 렌더 위치를 읽기 위한 ref — 상태를 deps로 걸면 드래그마다 재생성된다 */
  const liveNodesRef = useRef(liveNodes);
  useEffect(() => {
    liveNodesRef.current = liveNodes;
  }, [liveNodes]);
  /** 집은 카드의 드래그 시작 자리 — 교체 시 상대 카드가 이 자리로 간다 */
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  /** 커서가 올라가 있는 카드와 올라간 시각 — 잠깐 스치는 카드에 모션이 나가지 않게 */
  const hoverRef = useRef<{ id: string | null; since: number }>({ id: null, since: 0 });
  /* 커서가 카드 위에 도착한 뒤 멈춰 있으면 mousemove가 더 안 온다 — 타이머로 승격한다 */
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTargetRef = useRef<string | null>(null);
  /** 교체 직후 한 프레임 — 두 카드의 이동을 transition으로 부드럽게 (드래그 중에는 끈다) */
  const [swapAnim, setSwapAnim] = useState(false);
  const swapAnimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSwapTarget = useCallback((id: string | null) => {
    if (swapTargetRef.current === id) return;
    swapTargetRef.current = id;
    /* 하이라이트는 liveNodes의 className으로만 — flow.nodes를 다시 만들면
       드래그 중인 카드 위치가 초기화되므로 절대 배치를 재계산하지 않는다 */
    setLiveNodes((nds) =>
      nds.map((n) => ({ ...n, className: n.id === id ? "ax-wf-swap-target" : undefined })),
    );
  }, []);

  const onDragStart = useCallback((_e: unknown, node: Node) => {
    dragStartPos.current = { x: node.position.x, y: node.position.y };
    hoverRef.current = { id: null, since: 0 };
  }, []);

  /** 드래그 중 — 커서가 든 카드 중 중심이 커서에 가장 가까운 1개만 교체 대상으로.
      120ms 이상 머무를 때만 모션을 켠다 (통과 중 난사 방지) */
  const onDrag = useCallback(
    (e: MouseEvent | TouchEvent, node: Node) => {
      if (!editable || !wrapRef.current) return;
      const pt = "clientX" in e ? e : e.touches[0];
      if (!pt) return;
      let best: { id: string; d: number } | null = null;
      for (const el of wrapRef.current.querySelectorAll<HTMLElement>(".react-flow__node")) {
        const id = el.getAttribute("data-id");
        if (!id || id === node.id) continue; // 자기 자신은 대상이 아니다
        const r = el.getBoundingClientRect();
        if (pt.clientX < r.left || pt.clientX > r.right || pt.clientY < r.top || pt.clientY > r.bottom)
          continue;
        const d = Math.hypot(
          pt.clientX - (r.left + r.width / 2),
          pt.clientY - (r.top + r.height / 2),
        );
        if (!best || d < best.d) best = { id, d };
      }
      const now = Date.now();
      if ((best?.id ?? null) !== hoverRef.current.id) {
        hoverRef.current = { id: best?.id ?? null, since: now };
        setSwapTarget(null);
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        if (best) {
          /* 도착 후 커서가 멈추면 mousemove가 더 안 온다 — 120ms 뒤에도 같은 카드 위면 승격 */
          const candidate = best.id;
          hoverTimer.current = setTimeout(() => {
            if (hoverRef.current.id === candidate) setSwapTarget(candidate);
          }, 120);
        }
      } else if (best && now - hoverRef.current.since >= 120) {
        setSwapTarget(best.id);
      }
    },
    [editable, setSwapTarget],
  );

  const standardPlaced = useMemo(() => (compare ? placeStandard(acts) : null), [compare, acts]);
  const standardFlow = useMemo(() => {
    if (!compare || !standardPlaced) return null;
    /* 표준 패널은 정적 템플릿 (v8 이슈①) — 업무명 + 표준 요구 기록명만.
       보유 문서 칩·기록 끊김 배지는 회사 워크플로우의 진단 결과라 여기 실리면 안 된다.
       합성 모드(v9)에서도 이 패널은 표준 activity 그대로다 — 비교 대상이 표준이므로 */
    return buildChart({
      acts,
      edgeList: allEdges(acts, []),
      placed: standardPlaced,
      back: new Set<string>(),
      editable: false,
      focus,
      template: true,
    });
  }, [compare, acts, standardPlaced, focus]);

  /** 모아 둔 좌표를 한 번에 보낸다 — 상자 여러 개를 재배치해도 요청은 한 번 */
  const flushPositions = useCallback(() => {
    const batch = pendingPos.current;
    pendingPos.current = {};
    if (Object.keys(batch).length === 0) return;
    setSaving(true);
    api(`/api/assessments/${assessmentId}/workflow`, {
      method: "PUT",
      body: JSON.stringify({ positions: batch }),
    })
      .catch(() => {
        /* 저장 실패해도 화면의 자리는 유지한다 — 다시 옮기면 그때 함께 올라간다 */
      })
      .finally(() => setSaving(false));
  }, [assessmentId]);

  /* 드래그 종료 — 놓은 자리를 그대로 저장한다 (v7-1).
     종전에는 영역 안 순서만 바꾸고 상자는 정해진 칸으로 되돌아갔는데, 옮겨 놓고 제자리로 튕기는
     느낌이 갇혀 보였다. 이제 놓은 곳에 남고, 그 좌표가 이 진단에 저장된다.
     저장은 드롭 순간이 아니라 손을 멈춘 뒤 한 번 — 정리하는 동안 요청이 줄줄이 나가지 않게 */
  /* 저장 키 조회 — 화면 노드 id(act:내부번호) → 좌표 저장 키. 표준 업무는 숫자 id,
     합성 노드는 syn:노드id (v9) — 표준 id 키와 절대 겹치지 않아 과거 좌표와 섞이지 않는다 */
  const posKeyByNodeId = useMemo(
    () => new Map(companyActs.map((a) => [`act:${a.id}`, a.posKey])),
    [companyActs],
  );

  const onDragStop = useCallback(
    (_e: unknown, node: Node) => {
      const target = swapTargetRef.current;
      setSwapTarget(null);
      hoverRef.current = { id: null, since: 0 };
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      if (!editable) return;
      const posKey = posKeyByNodeId.get(node.id);
      if (!posKey) return;

      /* 교체 드롭 — 두 카드의 '현재 렌더 위치'를 서로 저장한다. A(집은 카드)는 B의 지금
         자리로, B는 A가 출발한 자리로. 저장 좌표가 없던(자동 배치) 카드도 렌더 위치는
         있으므로 한쪽만 저장돼 있어도 동작한다. 저장은 기존 배치 저장(pendingPos) 재사용 */
      if (target && target !== node.id && dragStartPos.current) {
        const targetKey = posKeyByNodeId.get(target);
        const targetNode = liveNodesRef.current.find((n) => n.id === target);
        if (targetKey && targetNode) {
          const aTo = {
            x: Math.round(targetNode.position.x),
            y: Math.round(targetNode.position.y),
          };
          const bTo = {
            x: Math.round(dragStartPos.current.x),
            y: Math.round(dragStartPos.current.y),
          };
          setSwapAnim(true);
          if (swapAnimTimer.current) clearTimeout(swapAnimTimer.current);
          swapAnimTimer.current = setTimeout(() => setSwapAnim(false), 360);
          setPositions((prev) => ({ ...prev, [posKey]: aTo, [targetKey]: bTo }));
          pendingPos.current = { ...pendingPos.current, [posKey]: aTo, [targetKey]: bTo };
          if (flushTimer.current) clearTimeout(flushTimer.current);
          flushTimer.current = setTimeout(flushPositions, 800);
          return;
        }
      }

      const at = { x: Math.round(node.position.x), y: Math.round(node.position.y) };
      const before = positions[posKey];
      if (before && before.x === at.x && before.y === at.y) return; // 제자리 — 보낼 것 없다
      setPositions((prev) => ({ ...prev, [posKey]: at }));
      pendingPos.current = { ...pendingPos.current, [posKey]: at };
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flushPositions, 800);
    },
    [editable, positions, flushPositions, posKeyByNodeId, setSwapTarget],
  );

  /* 화면을 떠날 때 아직 못 보낸 좌표가 있으면 그때 보낸다 */
  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      if (swapAnimTimer.current) clearTimeout(swapAnimTimer.current);
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      flushPositions();
    },
    [flushPositions],
  );

  /* 불러오는 중·AI가 합성을 만드는 중 — 섹션 안에서 그대로 알린다 (v7).
     종전엔 아무것도 그리지 않아 화면이 비어 있다가 갑자기 나타났다.
     합성(synthesized)이나 종전 연결(connections) 어느 쪽이든 생기면 그린다 (v9) */
  if (stages === null || (stages.length > 0 && synthesized === null && connections === null))
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
     (자료 없이 진행한 진단에서 워크플로우가 뜨던 문제, 2026-08-06)
     합성 모드에서는 노드가 0개일 때가 같은 상황이다 — 문서 근거 없는 노드는 만들지 않으므로 (v9) */
  const ownedDocCount = companyActs.reduce((sum, a) => sum + a.docs.length, 0);
  if (synthesized !== null ? synthesized.nodes.length === 0 : ownedDocCount === 0)
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
      {/* 안내 + 비교하기 — 자료 정리(편집) 단계에만. 결과 화면(읽기 모드)은 캡션 없이
          차트가 바로 온다 — 배지·범례가 이미 읽는 법을 알려 준다 (v10 #4) */}
      {editable && (
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
          업무 상자를 드래그해 우리 회사의 실제 흐름대로 놓을 수 있어요
          {saving ? " · 저장 중…" : linking ? " · AI가 업무 연결을 분석하고 있어요…" : ""}
        </p>
        {/* 비교하기는 자료 정리(도출·확인) 단계에만 — 결과 화면은 분석 결과를 보는 자리라
            표준 대비 비교가 목적이 아니다 (v8 이슈 3-1) */}
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
      )}

      <div
        ref={wrapRef}
        className={swapAnim ? "ax-wf-swapping" : undefined}
        style={{ ...canvasBox, height: canvasHeight(graph.rows) }}
      >
        <ReactFlow
          nodes={liveNodes}
          edges={flow.edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onNodeDragStart={onDragStart}
          onNodeDrag={onDrag}
          onNodeDragStop={onDragStop}
          /* 초기 로드에 전체가 한 화면에 들어온다 (v8 이슈②) — 스임레인이 세로로 정돈되어
             fitView를 걸어도 읽을 수 있는 배율이 나온다 */
          fitView
          fitViewOptions={{ padding: 0.06, minZoom: 0.4, maxZoom: 1 }}
          minZoom={0.25}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          deleteKeyCode={null}
        >
          {/* 점 격자 배경은 뺐다 (v8 이슈⑥) — 페이지의 다른 섹션과 톤을 맞춘다 */}
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <Legend
        stages={
          /* 합성 모드 — 노드가 실제로 있는 영역만 (표준 8개를 다 그리면 빈 영역 칩이 남는다) */
          synthMode
            ? [
                ...new Map(
                  [...companyActs]
                    .sort((x, y) => x.stageIdx - y.stageIdx)
                    .map((a) => [a.stageCode, { code: a.stageCode, name: a.stageName }] as const),
                ).values(),
              ]
            : stages
        }
        bottlenecks={flow.bottlenecks.length}
        dxCount={!editable ? (layerSets?.dx.size ?? 0) : 0}
        axCount={!editable ? (layerSets?.ax.size ?? 0) : 0}
        focus={focus}
        onFocus={setFocus}
      />

      {/* v9 A6 — 표준에 있는데 문서 근거가 하나도 없는 업무(기록 끊김 후보) 안내 */}
      {synthMode && (gaps?.missing.length ?? 0) > 0 && (
        <p
          style={{
            margin: "8px 0 0",
            textAlign: "center",
            font: "var(--text-caption)",
            color: "var(--fg-tertiary)",
          }}
        >
          표준 대비 기록 미확인 업무 {gaps!.missing.length}건
          {" — "}
          {gaps!.missing
            .slice(0, 6)
            .map((m) => m.name)
            .join(" · ")}
          {gaps!.missing.length > 6 ? ` 외 ${gaps!.missing.length - 6}건` : ""}
        </p>
      )}

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
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </div>
      )}
    </div>
  );
}
