"use client";

import { useState } from "react";
import { Badge, Card, Icons } from "@/components/ui";

/**
 * 워크플로우 — 부서별 공정 흐름과 표준 순서 차이 (자료 정리 화면)
 *
 * 표준 워크플로우 정의와 문서유형→부서 매핑 시드가 아직 없어 **데모 데이터**로 보여준다.
 * 실데이터가 들어올 자리는 서버의 workflow_stage · workflow_activity · assessment_workflow.
 * 기본은 접힌 상태다 — 지금은 참고용이라 화면을 차지할 이유가 없다.
 */
type DemoStage = {
  name: string;
  activities: string[];
  docs: { name: string; level: string }[];
  deviates?: boolean;
};

const STANDARD = ["영업", "설계(R&D)", "구매·자재", "생산", "품질", "재고·출하", "고객지원"];

/* 회사 순서 — 표준과 달리 구매·자재가 설계보다 앞선 예시 */
const DEMO_ORDER = ["영업", "구매·자재", "설계(R&D)", "생산", "품질", "재고·출하", "고객지원"];

const DEMO_STAGES: DemoStage[] = [
  {
    name: "영업",
    activities: ["견적 작성·수주 접수", "납기 협의", "거래명세 발행"],
    docs: [
      { name: "견적서_양식.docx", level: "L2 개인문서" },
      { name: "거래명세서_6월.pdf", level: "L3 정형양식" },
    ],
  },
  {
    name: "구매·자재",
    activities: ["자재 발주", "입고 검수", "단가 관리"],
    docs: [{ name: "발주서 묶음 (5~6월)", level: "L3 정형양식" }],
    deviates: true,
  },
  {
    name: "설계(R&D)",
    activities: ["고객 도면 접수·검토", "공정·금형 설계"],
    docs: [{ name: "고객사 도면_B-10…", level: "L3 정형양식" }],
    deviates: true,
  },
  {
    name: "생산",
    activities: ["생산 계획", "작업 지시", "실적 집계"],
    docs: [{ name: "생산일보_6월.xlsx", level: "L2 개인문서" }],
  },
];

const SUPPORT: DemoStage = {
  name: "경영지원",
  activities: ["회계·정산", "인사·총무"],
  docs: [{ name: "회계전표_6월_더…", level: "L4 시스템출력" }],
};

function StageCard({ stage }: { stage: DemoStage }) {
  return (
    <Card
      radius="l"
      padded={false}
      style={{
        minWidth: 220,
        flex: "0 0 auto",
        borderColor: stage.deviates ? "var(--fg-brand)" : undefined,
      }}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="[font:var(--text-label-m)] text-ink">{stage.name}</span>
          {stage.deviates && (
            <span aria-label="표준과 순서가 다름" className="text-[var(--fg-brand)]">
              ●
            </span>
          )}
        </div>
        <ul className="mt-2 mb-0 flex list-none flex-col gap-1 p-0">
          {stage.activities.map((a) => (
            <li key={a} className="[font:var(--text-caption)] text-ink-3">
              · {a}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-col gap-1.5 border-t border-line-subtle pt-2">
          {stage.docs.map((d) => (
            <div key={d.name} className="flex items-center gap-2">
              <Icons.file size={13} />
              <span className="min-w-0 flex-1 truncate [font:var(--text-caption)] text-ink-2">
                {d.name}
              </span>
              <span className="flex-none rounded-[var(--radius-xs)] bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-ink-3">
                {d.level}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function WorkflowSection() {
  const [open, setOpen] = useState(false);

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
        <Badge tone="outline">데모 · 개발 중</Badge>
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
          <p className="mt-0 mb-4 [font:var(--text-body3)] text-ink-3">
            부서별 업무 흐름을 표준 공정과 비교해 보여줄 화면이에요. 표준 워크플로우를 정리하는
            중이라 지금은 <b>예시 데이터</b>로 보여드려요.
          </p>

          <div className="mb-3 flex flex-wrap items-center gap-1.5 [font:var(--text-caption)] text-ink-3">
            <span className="rounded-[var(--radius-s)] bg-surface-3 px-2 py-1 text-ink-2">
              제조 표준
            </span>
            {STANDARD.map((s, i) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="rounded-[var(--radius-full)] border border-line-subtle px-2 py-1">
                  {s}
                </span>
                {i < STANDARD.length - 1 && <Icons.chevronRight size={12} />}
              </span>
            ))}
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-1.5 [font:var(--text-caption)] text-ink-3">
            <span className="rounded-[var(--radius-s)] bg-[var(--bg-brand-weak)] px-2 py-1 text-[var(--fg-brand)]">
              이 기업
            </span>
            {DEMO_ORDER.map((s, i) => {
              const moved = STANDARD[i] !== s;
              return (
                <span key={s} className="flex items-center gap-1.5">
                  <span
                    className="rounded-[var(--radius-full)] border px-2 py-1"
                    style={{
                      borderColor: moved ? "var(--fg-brand)" : "var(--line-subtle)",
                      color: moved ? "var(--fg-brand)" : undefined,
                    }}
                  >
                    {moved && "● "}
                    {s}
                  </span>
                  {i < DEMO_ORDER.length - 1 && <Icons.chevronRight size={12} />}
                </span>
              );
            })}
          </div>

          <div className="ax-scrollbar-none flex gap-3 overflow-x-auto pb-1">
            {DEMO_STAGES.map((s) => (
              <StageCard key={s.name} stage={s} />
            ))}
          </div>

          <div className="mt-4 flex items-start gap-3">
            <span className="mt-3 flex-none rounded-[var(--radius-s)] bg-surface-3 px-2 py-1 [font:var(--text-caption)] text-ink-3">
              지원 부서
            </span>
            <StageCard stage={SUPPORT} />
          </div>
        </div>
      )}
    </section>
  );
}
