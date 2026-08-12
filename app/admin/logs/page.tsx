"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { SortableTable, type Column } from "@/components/admin/SortableTable";
import { api } from "@/lib/api";

type LogRow = {
  id: string;
  source: string; // dart-corp / benchmark / classify / judge / collect ...
  level: "info" | "error";
  message: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

const PAGE = 50;

/** 소스 표기 — 목록에 없는 새 소스는 원문 그대로 보인다 */
const SOURCE_LABEL: Record<string, string> = {
  "dart-corp": "DART 색인",
  benchmark: "벤치마크",
  classify: "문서 분류",
  judge: "문항 판정",
  collect: "공개데이터",
};

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** 로그 기록 — 자동화 잡(DART 일일 갱신·벤치마크)과 워커 잡 실패의 시간순 목록 (GET /api/admin/logs) */
export default function AdminLogsPage() {
  const [items, setItems] = useState<LogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<string[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [level, setLevel] = useState<"info" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (source) params.set("source", source);
      if (level) params.set("level", level);
      return api<{ items: LogRow[]; total: number; sources: string[] }>(
        `/api/admin/logs?${params}`,
      );
    },
    [source, level],
  );

  /* 필터가 바뀌면 처음부터 다시 — 소스 버튼 목록은 응답의 distinct 값으로 유지 */
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    load(0)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
        setSources(r.sources);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const loadMore = async () => {
    if (!items) return;
    setLoadingMore(true);
    try {
      const r = await load(items.length);
      setItems([...items, ...r.items]);
      setTotal(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setLoadingMore(false);
    }
  };

  const columns: Column<LogRow>[] = [
    {
      key: "createdAt",
      label: "시간",
      sortValue: (r) => r.createdAt,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{fmtTime(r.createdAt)}</span>
      ),
    },
    {
      key: "source",
      label: "구분",
      sortValue: (r) => r.source,
      render: (r) => SOURCE_LABEL[r.source] ?? r.source,
    },
    {
      key: "level",
      label: "수준",
      sortValue: (r) => r.level,
      render: (r) =>
        r.level === "error" ? <Badge tone="danger">오류</Badge> : <Badge tone="neutral">정보</Badge>,
    },
    {
      key: "message",
      label: "내용",
      sortValue: (r) => r.message,
      render: (r) => (
        /* 부가 정보(jsonb)는 호버 툴팁으로 — 표를 어지럽히지 않는다 */
        <span title={r.detail ? JSON.stringify(r.detail, null, 2) : undefined}>{r.message}</span>
      ),
    },
  ];

  return (
    <section style={{ maxWidth: 1200 }}>
      <h1
        style={{
          margin: "0 0 6px",
          font: "var(--text-h4)",
          letterSpacing: "var(--track-heading)",
          color: "var(--fg-primary)",
        }}
      >
        로그 기록
      </h1>
      <p style={{ margin: "0 0 24px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        자동화 작업(DART 일일 갱신 · 벤치마크 집계) 결과와 작업 실패 기록
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Button
            variant={source === null ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSource(null)}
          >
            전체
          </Button>
          {sources.map((s) => (
            <Button
              key={s}
              variant={source === s ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSource(s)}
            >
              {SOURCE_LABEL[s] ?? s}
            </Button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          {(
            [
              [null, "정보+오류"],
              ["info", "정보"],
              ["error", "오류"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={label}
              variant={level === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setLevel(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <Card radius="xl" padded={false}>
        <SortableTable
          columns={columns}
          rows={items ?? []}
          rowKey={(r) => r.id}
          defaultSort={{ key: "createdAt", dir: "desc" }}
          empty={error ?? (items === null ? "불러오는 중…" : "기록 없음")}
          footer={
            items !== null && !error
              ? `총 ${total.toLocaleString("ko-KR")}건 중 ${items.length.toLocaleString("ko-KR")}건 표시`
              : undefined
          }
        />
      </Card>

      {items !== null && items.length < total && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <Button variant="ghost" size="sm" disabled={loadingMore} onClick={loadMore}>
            {loadingMore ? "불러오는 중" : "더 보기"}
          </Button>
        </div>
      )}
    </section>
  );
}
