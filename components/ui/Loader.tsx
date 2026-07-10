import type { CSSProperties } from "react";

/** 3-dot 로더 — 스켈레톤 셔머 대신 사용하는 표준 로딩 표현 */
export function Loader({ style }: { style?: CSSProperties }) {
  return (
    <span className="ax-loader" style={style} role="status" aria-label="불러오는 중">
      <span />
      <span />
      <span />
    </span>
  );
}
