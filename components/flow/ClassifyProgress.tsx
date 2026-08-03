"use client";

import { useEffect, useRef } from "react";
import { Icons, Loader } from "@/components/ui";

/**
 * 분류 진행 로그 — AI가 파일을 하나씩 분류해 가는 과정을 텍스트 리스트로 보여준다 (자료 정리 2단계).
 *
 * collect가 폴링 중인 files를 그대로 받아 완료 → 진행 중 → 대기 순으로 쌓는다.
 * 완료 행이 늘면 진행 중인 행이 보이게 프로그램 스크롤만 한다 — 휠 스크롤은
 * overflow: hidden으로 막고, 위쪽 페이드 마스크로 로그가 흘러가는 연출을 만든다.
 */

type ClassifyFile = {
  id: string;
  name: string;
  status: string | null; // pending / processing / done / failed / unclassified / split
  docTypeName: string | null;
  digitalLevel: number | null;
};

/** done 외 종결 상태 표기 — 파일 그리드(STATUS_LABEL)와 같은 문구를 쓴다 */
const TERMINAL_LABEL: Record<string, string> = {
  failed: "분류 실패",
  unclassified: "미분류",
  split: "양식집 · 페이지별 분류",
};

const isTerminal = (f: ClassifyFile) =>
  f.status !== null && f.status !== "pending" && f.status !== "processing";

export function ClassifyProgress({ files }: { files: ClassifyFile[] }) {
  const boxRef = useRef<HTMLDivElement>(null);

  /* 완료 → 진행 중 → 대기 순으로 정렬 (그룹 내 원래 순서 유지) — 로그처럼 완료 행이 위로 쌓인다 */
  const rank = (f: ClassifyFile) => (isTerminal(f) ? 0 : f.status === "processing" ? 1 : 2);
  const rows = [...files].sort((a, b) => rank(a) - rank(b));

  const terminalCount = rows.filter(isTerminal).length;
  const processingIdx = rows.findIndex((f) => f.status === "processing");
  /* 스크롤 기준 행 — 진행 중인 행, 없으면 마지막 완료 행 */
  const anchorIdx = processingIdx >= 0 ? processingIdx : Math.max(terminalCount - 1, 0);

  /* 완료 행이 늘 때마다 기준 행이 하단에 보이게 스크롤 — 사용자 스크롤은 없다 */
  useEffect(() => {
    const box = boxRef.current;
    const anchor = box?.children[anchorIdx] as HTMLElement | undefined;
    if (!box || !anchor) return;
    box.scrollTo({
      top: anchor.offsetTop + anchor.offsetHeight - box.clientHeight + 12,
      behavior: "smooth",
    });
  }, [anchorIdx, terminalCount]);

  return (
    <div
      ref={boxRef}
      style={{
        position: "relative" /* 자식 offsetTop 기준을 이 컨테이너로 */,
        maxHeight: 180,
        overflow: "hidden" /* 휠 스크롤 차단 — 스크롤은 위 effect만 수행한다 */,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        maskImage: "linear-gradient(to bottom, transparent 0, #000 36px)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 36px)",
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
}
