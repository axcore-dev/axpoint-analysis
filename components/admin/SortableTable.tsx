"use client";

import { useMemo, useState, type ReactNode } from "react";

/**
 * 어드민 공용 정렬 테이블 (수정요청v9)
 * 컬럼마다 값 추출기를 받아 문자열은 한국어 로케일, 숫자·날짜는 크기로 정렬한다.
 * 값이 없는 행은 방향과 무관하게 항상 뒤로 보낸다 — 빈 값이 상단을 차지하지 않게.
 */
export type Column<T> = {
  key: string;
  label: string;
  /** 정렬 기준값. 없으면 정렬 불가 컬럼 */
  sortValue?: (row: T) => string | number | null | undefined;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
};

export function SortableTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  defaultSort,
  footer,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty: ReactNode;
  /** 초기 정렬 컬럼 key와 방향 */
  defaultSort?: { key: string; dir: "asc" | "desc" };
  footer?: ReactNode;
}) {
  const [sort, setSort] = useState(defaultSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const aEmpty = av === null || av === undefined || av === "";
      const bEmpty = bv === null || bv === undefined || bv === "";
      if (aEmpty || bEmpty) return aEmpty && bEmpty ? 0 : aEmpty ? 1 : -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ko") * dir;
    });
  }, [rows, sort, columns]);

  const toggle = (key: string) =>
    setSort((prev) =>
      prev?.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );

  const cell = {
    padding: "12px 16px",
    font: "var(--text-caption)",
    color: "var(--fg-secondary)",
    borderBottom: "1px solid var(--line-subtle)",
    whiteSpace: "nowrap" as const,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                  style={{
                    textAlign: c.align ?? "left",
                    padding: 0,
                    borderBottom: "1px solid var(--line-default)",
                  }}
                >
                  {c.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      style={{
                        width: "100%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: c.align === "right" ? "flex-end" : "flex-start",
                        gap: 4,
                        padding: "12px 16px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        font: "var(--text-caption)",
                        fontFamily: "var(--font-sans)",
                        color: active ? "var(--fg-brand)" : "var(--fg-tertiary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.label}
                      <span aria-hidden style={{ fontSize: 10 }}>
                        {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  ) : (
                    <span
                      style={{
                        display: "block",
                        padding: "12px 16px",
                        font: "var(--text-caption)",
                        color: "var(--fg-tertiary)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.label}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ ...cell, textAlign: "center", padding: "40px 16px" }}
              >
                {empty}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} style={{ ...cell, textAlign: c.align ?? "left" }}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {footer && (
        <div
          style={{
            padding: "10px 16px",
            font: "var(--text-caption)",
            color: "var(--fg-tertiary)",
            borderTop: "1px solid var(--line-subtle)",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
