"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Background, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";
import { type WorkflowStage } from "@/components/flow/WorkflowStandard";

/**
 * 워크플로우 플로우차트 — (대)8대 기능 영역 → (중)업무 순서 → (소)산출 문서.
 * - 문서 칩은 이 기업이 업로드한 문서만 표시한다 (미보유 문서 제거)
 * - 모든 연결선에 화살표로 흐름 방향을 표시한다
 * - **드래그는 업무(task) 단위로만** 한다 — 영역(8대 기능)은 표준 순서 고정이라 옮기지 않는다(2026-08-06).
 *   업무를 위아래로 끌면 영역 안 순서가 바뀌고, 놓는 순간 저장된다
 * - 업무 간 연결선은 에이전트가 연결성(산출→입력 문서 흐름)을 판단해 그린다
 */
type ChartStage = WorkflowStage & { deviates?: boolean };
type Connection = { from: number; to: number; reason: string };

const COL_W = 250;
const COL_GAP = 26;
const HEAD_H = 56;
const ACT_GAP = 14;

/** 활동 노드 높이 추정 — 이름 2줄 + 문서 칩 줄 수 (콘텐츠 기반 자동 배치용) */
function actHeight(docCount: number): number {
  return 58 + Math.ceil(docCount / 2) * 26;
}

/** 이 기업이 보유한 산출 문서만 — 미보유 칩은 그리지 않는다 (v5) */
const coveredDocs = (act: ChartStage["activities"][number]) =>
  act.outputDocs.filter((d) => d.covered);

const ARROW = { type: MarkerType.ArrowClosed, width: 16, height: 16 } as const;

function buildFlow(
  stages: ChartStage[],
  connections: Connection[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  stages.forEach((stage, col) => {
    const x = col * (COL_W + COL_GAP);
    const headId = `stage:${stage.code}`;
    nodes.push({
      id: headId,
      position: { x, y: 0 },
      data: {
        label: (
          <div style={{ textAlign: "left" }}>
            <strong style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
              {stage.name}
            </strong>
            <span style={{ display: "block", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
              {col + 1}번째{stage.isSupport ? " · 지원" : ""}
            </span>
          </div>
        ),
      },
      style: {
        width: COL_W,
        borderRadius: 12,
        padding: "10px 14px",
        border: "1.5px solid var(--blue-500)",
        background: "rgba(10,80,255,0.05)",
      },
    });
    if (col > 0) {
      const prev = stages[col - 1];
      edges.push({
        id: `flow:${prev.code}-${stage.code}`,
        source: `stage:${prev.code}`,
        target: `stage:${stage.code}`,
        animated: true,
        markerEnd: { ...ARROW, color: "var(--blue-500)" },
        style: { stroke: "var(--blue-500)", strokeWidth: 1.5 },
      });
    }

    let y = HEAD_H + 24;
    stage.activities.forEach((act, i) => {
      const actId = `act:${act.id}`;
      const docs = coveredDocs(act);
      nodes.push({
        id: actId,
        position: { x: x + 10, y },
        data: {
          label: (
            <div style={{ textAlign: "left" }}>
              <span style={{ display: "block", font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
                {act.name}
              </span>
              {docs.length > 0 && (
                <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {docs.map((d) => (
                    <span
                      key={String(d.docTypeId)}
                      style={{
                        font: "11px/1.3 var(--font-sans)",
                        padding: "2px 7px",
                        borderRadius: 999,
                        border: "1px solid var(--blue-500)",
                        color: "var(--fg-brand)",
                        background: "rgba(10,80,255,0.06)",
                      }}
                    >
                      {d.name}
                    </span>
                  ))}
                </span>
              )}
            </div>
          ),
        },
        style: {
          width: COL_W - 20,
          borderRadius: 10,
          padding: "8px 12px",
          border: "1px solid var(--line-default)",
          background: "var(--bg-elevated)",
        },
      });
      edges.push({
        id: `chain:${stage.code}:${i}`,
        source: i === 0 ? `stage:${stage.code}` : `act:${stage.activities[i - 1].id}`,
        target: actId,
        markerEnd: { ...ARROW, color: "var(--grey-400)" },
        style: { stroke: "var(--grey-300)" },
      });
      y += actHeight(docs.length) + ACT_GAP;
    });
  });

  // 에이전트가 판단한 업무 간 연결 — 영역을 가로지르는 흐름 (v5)
  const actIds = new Set(nodes.map((n) => n.id));
  for (const cn of connections) {
    const source = `act:${cn.from}`;
    const target = `act:${cn.to}`;
    if (!actIds.has(source) || !actIds.has(target)) continue;
    edges.push({
      id: `link:${cn.from}-${cn.to}`,
      source,
      target,
      animated: true,
      markerEnd: { ...ARROW, color: "var(--blue-500)" },
      style: { stroke: "var(--blue-500)", strokeWidth: 1.5, opacity: 0.65 },
    });
  }
  return { nodes, edges };
}

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
  /* 드래그 중에는 정렬 애니메이션을 끈다 — 드래그 이동까지 transition이 걸리면 손에 안 붙는다 */
  const [dragging, setDragging] = useState(false);
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

  const { nodes, edges } = useMemo(
    () => buildFlow(stages ?? [], connections ?? []),
    [stages, connections],
  );

  /* 드래그 종료 — 업무(act) 노드를 놓은 y좌표로 영역 안 순서를 정한다.
     순서가 그대로면 흐트러진 좌표만 원위치로 되돌린다(transition이 부드럽게 복귀시킨다) */
  const onDragStop = useCallback(
    (_e: unknown, node: Node) => {
      setDragging(false);
      if (!editable || !stages) return;

      if (node.id.startsWith("act:")) {
        const actId = Number(node.id.slice("act:".length));
        const stage = stages.find((s) => s.activities.some((a) => a.id === actId));
        if (!stage || stage.activities.length < 2) {
          load();
          return;
        }
        /* 드롭한 y좌표가 몇 번째 자리인지 — 나머지 업무들의 세로 중심을 기준으로 센다 */
        const others = stage.activities.filter((a) => a.id !== actId);
        let y = HEAD_H + 24;
        const centers = others.map((a) => {
          const h = actHeight(coveredDocs(a).length);
          const center = y + h / 2;
          y += h + ACT_GAP;
          return center;
        });
        const to = centers.filter((c) => c < node.position.y).length;
        const from = stage.activities.findIndex((a) => a.id === actId);
        if (to === from) {
          load();
          return;
        }
        const activityIds = others.map((a) => a.id);
        activityIds.splice(to, 0, actId);
        setSaving(true);
        api(`/api/assessments/${assessmentId}/workflow`, {
          method: "PUT",
          body: JSON.stringify({ taskOrder: { stageCode: stage.code, activityIds } }),
        })
          .then(load)
          .catch(load)
          .finally(() => setSaving(false));
      }
    },
    [editable, stages, assessmentId, load],
  );

  if (!stages || stages.length === 0) return null;
  /* 올라온 문서가 하나도 없으면 그리지 않는다 — 표준 흐름만 남아 이 기업의 워크플로우처럼 보인다.
     (자료 없이 진행한 진단에서 워크플로우가 뜨던 문제, 2026-08-06) */
  const ownedDocCount = stages.reduce(
    (sum, s) => sum + s.activities.reduce((n, act) => n + coveredDocs(act).length, 0),
    0,
  );
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

  const height = Math.max(
    480,
    Math.max(
      ...stages.map(
        (s) =>
          HEAD_H +
          24 +
          s.activities.reduce((a, act) => a + actHeight(coveredDocs(act).length) + ACT_GAP, 0),
      ),
    ) * 0.8, // fitView가 축소해 그리므로 실제 높이보다 낮게 잡아도 전체가 보인다
  );

  return (
    <div>
      <p style={{ margin: "0 0 8px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        {editable
          ? "업무 상자를 위아래로 드래그해 우리 회사의 실제 순서로 바꿀 수 있어요"
          : "화살표가 업무 흐름의 방향이에요 — 영역을 가로지르는 파란 선은 AI가 문서 흐름으로 판단한 연결이에요"}
        {saving ? " · 저장 중…" : linking ? " · AI가 업무 연결을 분석하고 있어요…" : ""}
      </p>
      <div
        style={{
          width: "100%",
          height,
          border: "1px solid var(--line-default)",
          borderRadius: "var(--radius-l)",
          overflow: "hidden",
          background: "var(--bg-primary)",
        }}
      >
        <ReactFlow
          nodes={nodes.map((n) => ({
            ...n,
            // 드래그는 업무 단위로만 — 영역(8대 기능)은 표준 순서 고정
            draggable: editable && n.id.startsWith("act:"),
            style: {
              ...n.style,
              cursor: editable && n.id.startsWith("act:") ? "grab" : "default",
              /* 놓는 순간 제자리로 미끄러지는 정렬 애니메이션 (v5) — 드래그 중에는 끈다 */
              transition: dragging ? undefined : "transform 240ms var(--ease, ease)",
            },
          }))}
          edges={edges}
          onNodeDragStart={() => setDragging(true)}
          onNodeDragStop={(e, node) => onDragStop(e, node)}
          fitView
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          deleteKeyCode={null}
        >
          <Background gap={22} />
        </ReactFlow>
      </div>
    </div>
  );
}
