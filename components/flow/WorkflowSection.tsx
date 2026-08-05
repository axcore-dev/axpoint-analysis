"use client";

import { useState } from "react";
import { Icons } from "@/components/ui";
import { WorkflowChart } from "@/components/flow/WorkflowChart";

/**
 * 워크플로우 — 자료 정리 화면 (작업 요청 v4-2 전면 개편)
 * (대)8대 기능 영역 → (중)업무 순서 → (소)산출 문서의 플로우차트.
 * 여기서만 드래그앤드롭으로 우리 회사 실제 순서를 편집한다(진단 결과 화면은 보기 전용).
 * 표준과 다른 위치는 붉게, 미보유 문서도 붉은 칩으로 표시된다.
 */
export function WorkflowSection({
  companyName,
  assessmentId,
}: {
  companyName?: string;
  assessmentId: string;
}) {
  const [open, setOpen] = useState(true);

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
          <div className="mb-3 flex flex-wrap items-center gap-1.5 [font:var(--text-caption)] text-ink-3">
            <span className="rounded-[var(--radius-s)] bg-[var(--bg-brand-weak)] px-2 py-1 text-[var(--fg-brand)]">
              {companyName || "이 기업"}
            </span>
            표준 대비 업무 순서·보유 문서
          </div>
          <WorkflowChart assessmentId={assessmentId} editable />
        </div>
      )}
    </section>
  );
}
