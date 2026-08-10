"use client";

import { useMemo } from "react";

/**
 * 지시문 줄 단위 비교 — 편집본이 코드 기본값(v0)에서 무엇이 달라졌는지 보여준다.
 *
 * 외부 diff 라이브러리 없이 줄 단위 LCS(최장 공통 부분열)를 직접 계산한다.
 * 지시문은 길어야 수백 줄이라 O(n×m) DP로 충분하고, 앞뒤 공통 줄을 먼저 걷어내
 * DP는 실제로 바뀐 구간에서만 돈다.
 */

export type DiffLine = { type: "same" | "add" | "del"; text: string };

/** base → draft 줄 단위 diff. 같은 줄·삭제 줄은 base 순서, 추가 줄은 draft 순서로 나온다. */
export function diffLines(base: string, draft: string): DiffLine[] {
  const a = base.split("\n");
  const b = draft.split("\n");

  // 앞뒤 공통 줄 걷어내기 — 편집은 보통 일부 구간이라 DP 대상이 크게 줄어든다
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  )
    tail += 1;

  const midA = a.slice(head, a.length - tail);
  const midB = b.slice(head, b.length - tail);
  const out: DiffLine[] = a.slice(0, head).map((text) => ({ type: "same", text }));

  if (midA.length * midB.length > 1_000_000) {
    // ponytail: 중간 구간이 백만 셀을 넘으면 LCS 대신 통삭제+통추가로 보여준다
    // (지시문 상한 2만 자에서는 올 일이 거의 없다 — 필요해지면 Myers diff로 교체)
    out.push(...midA.map((text) => ({ type: "del" as const, text })));
    out.push(...midB.map((text) => ({ type: "add" as const, text })));
  } else {
    // dp[i][j] = midA[i:]와 midB[j:]의 최장 공통 줄 수
    const dp: number[][] = Array.from({ length: midA.length + 1 }, () =>
      new Array<number>(midB.length + 1).fill(0),
    );
    for (let i = midA.length - 1; i >= 0; i -= 1)
      for (let j = midB.length - 1; j >= 0; j -= 1)
        dp[i][j] = midA[i] === midB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        out.push({ type: "same", text: midA[i] });
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        out.push({ type: "del", text: midA[i] });
        i += 1;
      } else {
        out.push({ type: "add", text: midB[j] });
        j += 1;
      }
    }
    for (; i < midA.length; i += 1) out.push({ type: "del", text: midA[i] });
    for (; j < midB.length; j += 1) out.push({ type: "add", text: midB[j] });
  }

  out.push(...a.slice(a.length - tail).map((text) => ({ type: "same" as const, text })));
  return out;
}

/** 추가·삭제 줄 수 — 저장 확인의 변경 요약에 쓴다 */
export function diffCounts(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === "add") added += 1;
    else if (l.type === "del") removed += 1;
  }
  return { added, removed };
}

/** diff 표시 블록 — 추가 줄 초록, 삭제 줄 붉은 배경 */
export function PromptDiff({
  base,
  draft,
  maxHeight = 280,
}: {
  base: string;
  draft: string;
  maxHeight?: number;
}) {
  const lines = useMemo(() => diffLines(base, draft), [base, draft]);
  if (!lines.some((l) => l.type !== "same"))
    return (
      <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        v0과 차이 없음
      </p>
    );
  return (
    <div
      style={{
        marginTop: 8,
        border: "1px solid var(--line-default)",
        borderRadius: "var(--radius-m)",
        maxHeight,
        overflowY: "auto",
      }}
    >
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 8,
            padding: "1px 10px",
            font: "12px/1.6 var(--font-mono)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            background:
              l.type === "add"
                ? "var(--bg-success-weak)"
                : l.type === "del"
                  ? "var(--bg-danger-weak)"
                  : "transparent",
            color:
              l.type === "add"
                ? "var(--fg-success)"
                : l.type === "del"
                  ? "var(--fg-danger)"
                  : "var(--fg-secondary)",
          }}
        >
          <span aria-hidden style={{ flex: "none", width: 10 }}>
            {l.type === "add" ? "+" : l.type === "del" ? "−" : ""}
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>{l.text || " "}</span>
        </div>
      ))}
    </div>
  );
}
