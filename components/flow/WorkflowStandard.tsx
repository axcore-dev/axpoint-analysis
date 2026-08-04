"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Badge, Card } from "@/components/ui";
import { api } from "@/lib/api";

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

export function WorkflowStandard({ assessmentId }: { assessmentId: string }) {
  const [stages, setStages] = useState<WorkflowStage[] | null>(null);

  useEffect(() => {
    api<{ stages: WorkflowStage[] }>(`/api/assessments/${assessmentId}/workflow`)
      .then(({ stages }) => setStages(stages ?? []))
      .catch(() => setStages([])); /* 표준 정의를 못 받으면 섹션을 숨긴다 */
  }, [assessmentId]);

  if (!stages || stages.length === 0) return null;

  return (
    <section style={{ padding: "56px 0" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>
        <header style={{ marginBottom: 24 }}>
          <h3
            style={{
              margin: 0,
              font: "var(--text-h3)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            표준 워크플로우
          </h3>
        </header>

        <div
          className="ax-scrollbar-none"
          style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}
        >
          {stages.map((stage) => {
            const docs = stageDocs(stage);
            return (
              <Card
                key={stage.code}
                radius="l"
                style={{
                  minWidth: 300,
                  maxWidth: 340,
                  flex: "0 0 auto",
                  padding: "18px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* 1행 — 영역명 */}
                <strong style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                  {stage.name}
                </strong>

                {/* 2행 — 업무 Task 목록 */}
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                  {stage.activities.map((a) => (
                    <li
                      key={a.name}
                      style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)", ...clamp2 }}
                    >
                      · {a.name}
                    </li>
                  ))}
                </ul>

                {/* 3행 — 산출 문서 유형(ISO): 보유는 채워진 뱃지, 미보유는 옅은 뱃지 */}
                {docs.length > 0 && (
                  <div
                    style={{
                      marginTop: "auto",
                      paddingTop: 10,
                      borderTop: "1px solid var(--line-subtle)",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                    }}
                  >
                    {docs.map((d) => (
                      <DocBadge key={String(d.docTypeId)} doc={d} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
