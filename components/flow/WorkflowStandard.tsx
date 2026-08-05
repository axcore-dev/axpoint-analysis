"use client";

import { type CSSProperties } from "react";
import { Badge } from "@/components/ui";
import { WorkflowChart } from "@/components/flow/WorkflowChart";

/**
 * 표준 워크플로우 (진단 결과 화면) — 8대 기능 영역 카드.
 * GET /api/assessments/:id/workflow의 표준 정의에 이 진단의 문서 보유 여부(covered)를 얹어,
 * 영역별 업무 Task와 산출 문서 유형(ISO)을 보여준다. covered=true는 채워진 뱃지, false는 옅은 뱃지.
 */

export type OutputDoc = { docTypeId: number | string; name: string; covered: boolean };

export type WorkflowStage = {
  code: string;
  name: string;
  seq: number;
  isSupport: boolean;
  activities: {
    id: number; // workflow_activity.id — task 드래그·에이전트 연결선 기준 (v5)
    name: string;
    seq: number;
    description: string | null;
    inputDocs: string[] | null;
    outputDocs: OutputDoc[];
  }[];
};

/** 긴 텍스트 2줄 말줄임 — 카드 안 Task명·문서명이 잘리지 않게 (WorkflowSection 공용) */
export const clamp2: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

/** 산출 문서 뱃지 — 긴 문서명은 한 줄 잘림 대신 2줄까지 표시 (WorkflowSection 공용) */
export function DocBadge({ doc }: { doc: OutputDoc }) {
  return (
    <Badge
      tone={doc.covered ? "accent" : "outline"}
      style={{ height: "auto", minHeight: 22, padding: "3px 8px", whiteSpace: "normal", lineHeight: 1.3 }}
    >
      <span style={clamp2}>{doc.name}</span>
    </Badge>
  );
}

/** 활동들의 산출 문서를 문서유형 단위로 합친다 — 하나라도 covered면 보유로 본다 */
export function stageDocs(stage: WorkflowStage): OutputDoc[] {
  const byId = new Map<string, OutputDoc>();
  for (const act of stage.activities) {
    for (const doc of act.outputDocs ?? []) {
      const key = String(doc.docTypeId);
      const prev = byId.get(key);
      if (!prev) byId.set(key, doc);
      else if (doc.covered && !prev.covered) byId.set(key, doc);
    }
  }
  return [...byId.values()];
}

/**
 * 진단 결과의 워크플로우 섹션 — 자료 정리에서 편집한 순서를 그대로 보여준다(v4: 편집은 자료 정리에서만).
 * 카드 나열은 v4-2에서 플로우차트(WorkflowChart)로 교체됐다.
 */
export function WorkflowStandard({ assessmentId }: { assessmentId: string }) {
  return (
    <section style={{ padding: "56px 0" }}>
      {/* v5 — 워크플로우 섹션만 화면 전체 너비 사용 (차트가 작아 안 보이는 문제) */}
      <div style={{ margin: "0 auto", padding: "0 24px" }}>
        <header style={{ marginBottom: 24 }}>
          <h3
            style={{
              margin: 0,
              font: "var(--text-h3)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            워크플로우
          </h3>
        </header>
        <WorkflowChart assessmentId={assessmentId} />
      </div>
    </section>
  );
}
