"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * 데이터셋 이상 경고 (v9 A4) — 분류가 끝난 자료 구성에서 발견된 이상 신호를 보여준다.
 * 백엔드가 분류 현황(files)·진단 결과(result) 응답에 datasetFlags로 실어 준다.
 * 필드가 아예 없거나(배포 전 응답) flags가 비어 있으면(이상 없음) 아무것도 렌더하지 않는다.
 * 어디까지나 안내다 — 진단 진행·결과 보기를 막지 않는다.
 */
export type DatasetFlag = {
  code: string; // single_level / unclassified_ratio / hitl_pending_ratio / catalog_coverage
  metric: number;
  detail?: { level?: string };
};
export type DatasetFlags = {
  computedAt: string;
  totalDocs: number;
  flags: DatasetFlag[];
};

/* ponytail: metric 단위(0~1 비율인지 0~100 퍼센트인지)가 계약에 안 적혀 있어 1 이하면
   비율로 간주해 100을 곱한다 — 백엔드 확정 후 이 분기를 제거한다 */
const pct = (m: number) => Math.round(m <= 1 ? m * 100 : m);

/** 코드별 문구 — 본문은 명사형, 행동 유도(hint)는 single_level에만. 모르는 코드는 그리지 않는다 */
function flagCopy(f: DatasetFlag): { text: string; hint?: string } | null {
  switch (f.code) {
    case "single_level":
      return {
        text: `업로드 문서 전체가 같은 수준${f.detail?.level ? `(${f.detail.level})` : ""}으로 분류됨`,
        hint: "특정 유형에 치우친 업로드일 수 있어요. 다른 업무 영역 자료를 추가하면 진단이 정확해져요.",
      };
    case "unclassified_ratio":
      return { text: `분류하지 못한 문서 비율 ${pct(f.metric)}%` };
    case "hitl_pending_ratio":
      return { text: `확인 대기 문서 비율 ${pct(f.metric)}%` };
    case "catalog_coverage":
      return { text: `필수 서류 커버리지 ${pct(f.metric)}%` };
    default:
      return null;
  }
}

/** 결과 화면 칩 — 경고 박스 안의 명사형 요약 한 조각 */
const chipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: "var(--radius-full)",
  border: "1px solid var(--line-default)",
  background: "var(--bg-elevated)",
  font: "var(--text-caption)",
  color: "var(--fg-secondary)",
};

export function DatasetFlagsNotice({
  data,
  compact = false,
  action,
  style,
}: {
  data?: DatasetFlags | null;
  /** 결과 화면용 — 코드별 문구를 칩으로 간결하게 (hint 생략) */
  compact?: boolean;
  /** 하단 행동 영역 — 결과 화면의 '보완 설문으로 보정' 버튼·안내가 들어온다 */
  action?: ReactNode;
  style?: CSSProperties;
}) {
  const rows = (data?.flags ?? [])
    .map(flagCopy)
    .filter((r): r is { text: string; hint?: string } => r !== null);
  if (rows.length === 0) return null;
  return (
    <div
      role="status"
      style={{
        padding: "14px 16px",
        borderRadius: "var(--radius-l)",
        background: "var(--bg-warning-weak)",
        ...style,
      }}
    >
      <div style={{ font: "var(--text-label-s)", color: "var(--fg-warning)", marginBottom: 8 }}>
        자료 구성 경고
      </div>
      {compact ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {rows.map((r) => (
            <span key={r.text} style={chipStyle}>
              {r.text}
            </span>
          ))}
        </div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
          {rows.map((r) => (
            <li key={r.text} style={{ font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
              {r.text}
              {r.hint && (
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    font: "var(--text-caption)",
                    color: "var(--fg-tertiary)",
                  }}
                >
                  {r.hint}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {action && <div style={{ marginTop: 10 }}>{action}</div>}
    </div>
  );
}
