"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Icons } from "@/components/ui";
import { api } from "@/lib/api";
import { stageDocs, type WorkflowStage } from "@/components/flow/WorkflowStandard";

/**
 * 워크플로우 — 8대 영역 표준 워크플로우와 이 기업의 문서 보유 현황 (자료 정리 화면)
 *
 * GET /api/assessments/:id/workflow 실데이터를 스스로 조회한다 (WorkflowStandard와 같은 응답).
 * 영역 카드 3행: 영역명(+'{n}/{m} 보유' — 표준 대비 이 기업 보유 현황) / 업무 Task / 산출 문서 유형.
 * covered(보유) 문서는 채운 뱃지, 미보유는 옅은 뱃지. 표준 정의를 못 받으면 섹션을 숨긴다.
 */
export function WorkflowSection({
  companyName,
  assessmentId,
}: {
  companyName?: string;
  assessmentId: string;
}) {
  const [open, setOpen] = useState(true);
  const [stages, setStages] = useState<WorkflowStage[] | null>(null);

  useEffect(() => {
    api<{ stages: WorkflowStage[] }>(`/api/assessments/${assessmentId}/workflow`)
      .then(({ stages }) => setStages(stages ?? []))
      .catch(() => setStages([])); /* 표준 정의를 못 받으면 섹션을 숨긴다 */
  }, [assessmentId]);

  if (!stages || stages.length === 0) return null;

  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
      >
        <h3 className="ax-heading m-0 [font:var(--text-h4)] tracking-[var(--track-heading)] text-ink">
          워크플로우
        </h3>
        <span className="ml-auto flex items-center gap-1 [font:var(--text-caption)] text-ink-3">
          {open ? "접기" : "펼치기"}
          <span
            aria-hidden
            style={{
              display: "inline-flex",
              transition: "transform 150ms",
              transform: open ? "rotate(90deg)" : "none",
            }}
          >
            <Icons.chevronRight size={14} />
          </span>
        </span>
      </button>

      {open && (
        <div className="mt-4">
          {/* 표준 대비 이 기업 보유 문서 비교 — 카드의 '{n}/{m} 보유'가 기준 */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 [font:var(--text-caption)] text-ink-3">
            <span className="rounded-[var(--radius-s)] bg-[var(--bg-brand-weak)] px-2 py-1 text-[var(--fg-brand)]">
              {companyName || "이 기업"}
            </span>
            표준 대비 보유 문서
          </div>

          <div className="ax-scrollbar-none flex gap-3 overflow-x-auto pb-1">
            {stages.map((stage) => {
              const docs = stageDocs(stage);
              const covered = docs.filter((d) => d.covered).length;
              return (
                <Card
                  key={stage.code}
                  radius="l"
                  style={{
                    minWidth: 260,
                    flex: "0 0 auto",
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {/* 1행 — 영역명 + 보유 현황 */}
                  <div className="flex items-center justify-between gap-2">
                    <strong style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                      {stage.name}
                    </strong>
                    {docs.length > 0 && (
                      <span className="flex-none [font:var(--text-caption)] text-ink-3">
                        {covered}/{docs.length} 보유
                      </span>
                    )}
                  </div>

                  {/* 2행 — 업무 Task 목록 */}
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                    {stage.activities.map((a) => (
                      <li
                        key={a.name}
                        style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}
                      >
                        · {a.name}
                      </li>
                    ))}
                  </ul>

                  {/* 3행 — 산출 문서 유형: 보유는 채워진 뱃지, 미보유는 옅은 뱃지 */}
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
                        <Badge key={String(d.docTypeId)} tone={d.covered ? "accent" : "outline"}>
                          {d.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
