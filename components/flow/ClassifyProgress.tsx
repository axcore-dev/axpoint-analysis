"use client";

import { useEffect, useRef, useState } from "react";
import { Icons, Loader } from "@/components/ui";

/**
 * 분류 진행 로그 — AI가 파일을 하나씩 분류해 가는 과정을 텍스트 리스트로 보여준다 (자료 정리 2단계).
 *
 * collect가 폴링 중인 files를 그대로 받아 완료 → 진행 중 → 대기 순으로 쌓는다.
 * 진행 중: 완료 행이 늘면 진행 중인 행이 보이게 프로그램 스크롤만 한다 — 휠 스크롤은
 * overflow: hidden으로 막고, 항목이 2개 이상일 때만 위쪽 페이드 마스크로 흘러가는 연출을 만든다.
 * 완료(done): 우측 정렬 접힌 아코디언('분류 과정 보기')으로 최종 로그를 보존한다 —
 * 펼치면 휠 스크롤을 허용하고 자동 스크롤·마스크는 끈다.
 */

type ClassifyFile = {
  id: string;
  name: string;
  status: string | null; // pending / processing / done / failed / unclassified / split
  docTypeName: string | null;
  digitalLevel: number | null;
  hitlStatus?: string | null; // 'needed' = 저신뢰·미분류 — '확인 요청' 표기
  supersededBy?: string | null; // 상위 레벨 원본에 대체된 사본
};

/** done 외 종결 상태 표기 — 파일 그리드(STATUS_LABEL)와 같은 문구를 쓴다 */
const TERMINAL_LABEL: Record<string, string> = {
  failed: "분류 실패",
  unclassified: "미분류",
  split: "양식집 · 페이지별 분류",
};

const isTerminal = (f: ClassifyFile) =>
  f.status !== null && f.status !== "pending" && f.status !== "processing";

export function ClassifyProgress({ files, done = false }: { files: ClassifyFile[]; done?: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  /* 완료 후 아코디언 펼침 여부 — 기본은 접힘 */
  const [open, setOpen] = useState(false);

  /* 완료 → 진행 중 → 대기 순으로 정렬 (그룹 내 원래 순서 유지) — 로그처럼 완료 행이 위로 쌓인다 */
  const rank = (f: ClassifyFile) => (isTerminal(f) ? 0 : f.status === "processing" ? 1 : 2);
  const rows = [...files].sort((a, b) => rank(a) - rank(b));

  const terminalCount = rows.filter(isTerminal).length;
  const processingIdx = rows.findIndex((f) => f.status === "processing");
  /* 스크롤 기준 행 — 진행 중인 행, 없으면 마지막 완료 행 */
  const anchorIdx = processingIdx >= 0 ? processingIdx : Math.max(terminalCount - 1, 0);

  /* 완료 행이 늘 때마다 기준 행이 세로 가운데로 오게 스크롤 — 진행 중에만, 사용자 스크롤은 없다 */
  useEffect(() => {
    if (done) return;
    const box = boxRef.current;
    const anchor = box?.children[anchorIdx] as HTMLElement | undefined;
    if (!box || !anchor) return;
    box.scrollTo({
      top: anchor.offsetTop - (box.clientHeight - anchor.offsetHeight) / 2,
      behavior: "smooth",
    });
  }, [anchorIdx, terminalCount, done]);

  /* 슬롯머신 연출 — 진행 중이면서 항목이 2개 이상일 때만 (1개면 또렷하게).
     위아래 대칭 페이드 + 상하 여백(첫 행·마지막 행도 가운데까지 올라올 스크롤 여유)으로
     기준 행이 항상 창 한가운데에 놓인다 */
  const focus = !done && rows.length >= 2;

  const log = (
    <div
      ref={boxRef}
      style={{
        position: "relative" /* 자식 offsetTop 기준을 이 컨테이너로 */,
        maxHeight: 180,
        /* 진행 중엔 휠 스크롤 차단(스크롤은 위 effect만), 완료 펼침 상태에선 휠 스크롤 허용 */
        overflowY: done ? "auto" : "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        ...(focus
          ? {
              height: 180 /* 창 크기 고정 — 행이 늘어도 카드가 흔들리지 않는다 */,
              paddingBlock: 78,
              maskImage:
                "linear-gradient(to bottom, transparent 0, #000 42%, #000 58%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, transparent 0, #000 42%, #000 58%, transparent 100%)",
            }
          : {}),
      }}
    >
      {rows.map((f) => {
        if (f.status === "done") {
          return (
            <div
              key={f.id}
              className="flex flex-none items-center gap-2 [font:var(--text-caption)] text-ink-2"
            >
              <span className="flex-none">
                <Icons.check size={13} />
              </span>
              <span className="min-w-0 truncate">
                {f.name} — {f.docTypeName}
                {f.digitalLevel != null && ` · L${f.digitalLevel}`}
              </span>
              {f.hitlStatus === "needed" && (
                <span className="flex-none rounded-[var(--radius-xs)] bg-[var(--bg-warning-weak)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--fg-warning)]">
                  확인 요청
                </span>
              )}
              {f.supersededBy != null && (
                <span className="flex-none rounded-[var(--radius-xs)] bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-ink-4">
                  대체됨
                </span>
              )}
            </div>
          );
        }
        if (isTerminal(f)) {
          return (
            <div
              key={f.id}
              className="flex flex-none items-center gap-2 [font:var(--text-caption)] text-ink-3"
            >
              <span className="min-w-0 truncate">
                {f.name} — {TERMINAL_LABEL[f.status ?? ""] ?? f.status}
              </span>
            </div>
          );
        }
        if (f.status === "processing") {
          return (
            <div
              key={f.id}
              className="flex flex-none items-center gap-2 [font:var(--text-caption)] text-ink-2"
            >
              <Loader style={{ width: 14, height: 14, flex: "none" }} />
              <span className="min-w-0 truncate">{f.name} 분류 중</span>
            </div>
          );
        }
        return (
          <div
            key={f.id}
            className="flex flex-none items-center gap-2 [font:var(--text-caption)] text-ink-4"
          >
            <span className="min-w-0 truncate">{f.name} 대기</span>
          </div>
        );
      })}
    </div>
  );

  if (!done) return log;

  /* 완료 요약 — 몇 건이 들어와 어떻게 정리됐는지 상시 노출 (0건 항목은 생략) */
  const doneCount = rows.filter((f) => f.status === "done").length;
  const unclassified = rows.filter((f) => f.status === "unclassified" || f.status === "failed").length;
  const needed = rows.filter((f) => f.status === "done" && f.hitlStatus === "needed").length;
  const summary = [
    `자료 ${rows.length}건`,
    `분류 완료 ${doneCount}건`,
    ...(unclassified > 0 ? [`미분류 ${unclassified}건`] : []),
    ...(needed > 0 ? [`확인 요청 ${needed}건`] : []),
  ].join(" · ");

  /* 분류 완료 — 좌측 요약 + 우측 접힌 아코디언으로 최종 로그 보존 */
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate [font:var(--text-caption)] text-ink-3">{summary}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 [font:var(--text-caption)] text-ink-3"
        >
          분류 과정 보기
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
        </button>
      </div>
      {open && <div className="mt-2">{log}</div>}
    </div>
  );
}
