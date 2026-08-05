"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Background, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";
import { type WorkflowStage } from "@/components/flow/WorkflowStandard";

/**
 * 워크플로우 플로우차트 (작업 요청 v4-2) — (대)8대 기능 영역 → (중)업무 순서 → (소)산출 문서.
 * 전체가 잘리지 않게 fitView로 최대 너비에 맞춰 그린다.
 * - 표준 대비 다른 위치의 영역(deviates)은 붉은 테두리 + 붉은 연결선
 * - 미보유 문서는 붉은 톤 칩, 보유 문서는 파란 칩
 * - editable이면 영역(대) 노드를 드래그해 순서를 바꾼다 — 놓는 순간 서버에 저장(자료 정리 화면 전용)
 */
type ChartStage = WorkflowStage & { deviates?: boolean };

const COL_W = 250;
const COL_GAP = 26;
const HEAD_H = 56;

/** 활동 노드 높이 추정 — 이름 2줄 + 문서 칩 줄 수 (콘텐츠 기반 자동 배치용) */
function actHeight(docCount: number): number {
  return 58 + Math.ceil(docCount / 2) * 26;
}

function buildFlow(stages: ChartStage[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  stages.forEach((stage, col) => {
    const x = col * (COL_W + COL_GAP);
    const headId = `stage:${stage.code}`;
    const tone = stage.deviates ? "var(--fg-danger)" : "var(--blue-500)";
    nodes.push({
      id: headId,
      position: { x, y: 0 },
      data: {
        label: (
          <div style={{ textAlign: "left" }}>
            <strong style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
              {stage.name}
            </strong>
            <span style={{ display: "block", font: "var(--text-caption)", color: stage.deviates ? "var(--fg-danger)" : "var(--fg-tertiary)" }}>
              {stage.deviates ? "표준과 다른 순서" : `${col + 1}번째`}
              {stage.isSupport ? " · 지원" : ""}
            </span>
          </div>
        ),
      },
      style: {
        width: COL_W,
        borderRadius: 12,
        padding: "10px 14px",
        border: `1.5px solid ${tone}`,
        background: stage.deviates ? "rgba(220,38,38,0.06)" : "rgba(10,80,255,0.05)",
        cursor: "grab",
      },
    });
    if (col > 0) {
      const prev = stages[col - 1];
      const red = stage.deviates || prev.deviates;
      edges.push({
        id: `flow:${prev.code}-${stage.code}`,
        source: `stage:${prev.code}`,
        target: `stage:${stage.code}`,
        animated: true,
        style: red ? { stroke: "var(--fg-danger)", strokeWidth: 1.8 } : undefined,
      });
    }

    let y = HEAD_H + 24;
    stage.activities.forEach((act, i) => {
      const actId = `act:${stage.code}:${act.seq}`;
      nodes.push({
        id: actId,
        position: { x: x + 10, y },
        draggable: false,
        data: {
          label: (
            <div style={{ textAlign: "left" }}>
              <span style={{ display: "block", font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
                {act.name}
              </span>
              {act.outputDocs.length > 0 && (
                <span style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                  {act.outputDocs.map((d) => (
                    <span
                      key={String(d.docTypeId)}
                      style={{
                        font: "11px/1.3 var(--font-sans)",
                        padding: "2px 7px",
                        borderRadius: 999,
                        border: `1px solid ${d.covered ? "var(--blue-500)" : "var(--fg-danger)"}`,
                        color: d.covered ? "var(--fg-brand)" : "var(--fg-danger)",
                        background: d.covered ? "rgba(10,80,255,0.06)" : "rgba(220,38,38,0.05)",
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
        source: i === 0 ? `stage:${stage.code}` : `act:${stage.code}:${stage.activities[i - 1].seq}`,
        target: actId,
        style: { stroke: "var(--grey-300)" },
      });
      y += actHeight(act.outputDocs.length) + 14;
    });
  });
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
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<{ stages: ChartStage[] }>(`/api/assessments/${assessmentId}/workflow`)
      .then(({ stages }) => setStages(stages ?? []))
      .catch(() => setStages([]));
  }, [assessmentId]);
  useEffect(load, [load]);

  const { nodes, edges } = useMemo(() => buildFlow(stages ?? []), [stages]);

  /* 드래그 종료 — 놓인 x좌표로 새 컬럼 위치를 계산해 그 자리에 끼워 넣고 서버에 저장.
     순서가 그대로면 흐트러진 좌표만 원위치로 되돌린다 */
  const onDragStop = useCallback(
    (_e: unknown, node: Node) => {
      if (!editable || !stages || !node.id.startsWith("stage:")) return;
      const code = node.id.slice("stage:".length);
      const from = stages.findIndex((s) => s.code === code);
      const to = Math.max(
        0,
        Math.min(stages.length - 1, Math.round(node.position.x / (COL_W + COL_GAP))),
      );
      if (from < 0 || to === from) {
        load();
        return;
      }
      const order = stages.map((s) => s.code);
      order.splice(from, 1);
      order.splice(to, 0, code);
      setSaving(true);
      api(`/api/assessments/${assessmentId}/workflow`, {
        method: "PUT",
        body: JSON.stringify({ order }),
      })
        .then(load)
        .catch(load)
        .finally(() => setSaving(false));
    },
    [editable, stages, assessmentId, load],
  );

  if (!stages || stages.length === 0) return null;

  const height = Math.max(
    420,
    Math.max(
      ...stages.map(
        (s) =>
          HEAD_H + 24 + s.activities.reduce((a, act) => a + actHeight(act.outputDocs.length) + 14, 0),
      ),
    ) * 0.62, // fitView가 축소해 그리므로 실제 높이보다 낮게 잡아도 전체가 보인다
  );

  return (
    <div>
      {editable && (
        <p style={{ margin: "0 0 8px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
          영역 상자를 좌우로 드래그하면 우리 회사의 실제 업무 순서로 바꿀 수 있어요 — 표준과 다른
          위치는 붉게 표시돼요{saving ? " · 저장 중…" : ""}
        </p>
      )}
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
            draggable: editable && n.id.startsWith("stage:"),
          }))}
          edges={edges}
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
