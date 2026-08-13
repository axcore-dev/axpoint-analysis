"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { SortableTable, type Column } from "@/components/admin/SortableTable";
import { api } from "@/lib/api";

/**
 * 통합 로그 (2026-08-13 개편) — 한 화면에서 두 갈래를 탭으로 본다.
 *  · 실행 로그: 진단 파이프라인 단계(node_run — 분류·수집·판정·서사·추천·검증)의
 *    기업 단위 실행 기록. 상태·소요·토큰·비용 추정까지 (GET /api/admin/agent-logs 재사용).
 *  · 시스템 로그: 자동화 잡(DART 일일 갱신·벤치마크)과 워커 잡 실패 (GET /api/admin/logs).
 * 종전에는 시스템 로그만 있었고 실행 기록은 멀티 에이전트 화면 안에 묻혀 있었다.
 */

const PAGE = 50;

const fmtTime = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/* ── 실행 로그 (파이프라인 node_run) ── */

type ExecRow = {
  id: string;
  assessmentId: string | null;
  companyName: string | null;
  nodeId: string;
  status: string; // running / succeeded / failed
  durationMs: number | null;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
  /** 에이전트 총평(검증·추천 output.summary) — 없는 노드는 null */
  summary: string | null;
  createdAt: string;
  finishedAt: string | null;
  estCostUsd: number | null;
};

/** 단계 표기 — 접두 일치. 목록에 없는 새 노드는 원문 그대로 보인다 */
const NODE_LABEL: [string, string][] = [
  ["code:classify", "문서 분류"],
  ["code:collect", "공개데이터 수집"],
  ["classify", "문서 분류(에이전트)"],
  ["collect", "수집(에이전트)"],
  ["judge", "문항 판정"],
  ["narrative", "종합 서사"],
  ["tasks", "과제 추천"],
  ["review", "검증"],
];
const nodeLabel = (id: string) => {
  const hit = NODE_LABEL.find(([prefix]) => id === prefix || id.startsWith(`${prefix}:`));
  return hit ? (id.includes(":") && !id.startsWith("code:") ? `${hit[1]} ${id.split(":")[1]}` : hit[1]) : id;
};

function ExecLogs() {
  const [items, setItems] = useState<ExecRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (offset: number) => {
      const params = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      return api<{ items: ExecRow[]; total: number }>(`/api/admin/agent-logs?${params}`);
    },
    [status, q],
  );

  /* 기업명 검색 디바운스 — 타이핑이 멎고 나서 한 번만 조회 */
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  /* 필터가 바뀌면 목록 리셋 — 렌더 중 상태 조정(react.dev 패턴), 이펙트는 조회만 한다 */
  const filterKey = `${status ?? ""}|${q}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setItems(null);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    load(0)
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
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

  const columns: Column<ExecRow>[] = [
    {
      key: "createdAt",
      label: "시간",
      sortValue: (r) => r.createdAt,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{fmtTime(r.createdAt)}</span>
      ),
    },
    {
      key: "companyName",
      label: "기업",
      sortValue: (r) => r.companyName ?? "",
      render: (r) => r.companyName ?? "—",
    },
    {
      key: "nodeId",
      label: "단계",
      sortValue: (r) => r.nodeId,
      render: (r) => nodeLabel(r.nodeId),
    },
    {
      key: "status",
      label: "상태",
      sortValue: (r) => r.status,
      render: (r) =>
        r.status === "failed" ? (
          <Badge tone="danger">실패</Badge>
        ) : r.status === "running" ? (
          <Badge tone="outline">실행 중</Badge>
        ) : (
          <Badge tone="neutral">성공</Badge>
        ),
    },
    {
      key: "durationMs",
      label: "소요",
      sortValue: (r) => r.durationMs ?? 0,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)" }}>
          {r.durationMs != null ? `${Math.round(r.durationMs / 100) / 10}s` : "—"}
        </span>
      ),
    },
    {
      key: "tokens",
      label: "토큰 (입력/출력)",
      sortValue: (r) => r.tokensIn + r.tokensOut,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
          {r.tokensIn.toLocaleString("ko-KR")} / {r.tokensOut.toLocaleString("ko-KR")}
        </span>
      ),
    },
    {
      key: "estCostUsd",
      label: "비용 추정",
      sortValue: (r) => r.estCostUsd ?? 0,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)" }}>
          {r.estCostUsd != null ? `$${r.estCostUsd.toFixed(4)}` : "—"}
        </span>
      ),
    },
    {
      key: "note",
      label: "오류·총평",
      sortValue: (r) => r.error ?? r.summary ?? "",
      /* 실패면 오류를, 성공이면 에이전트 총평(검증·추천의 output.summary)을 — 전문은 호버 툴팁 */
      render: (r) => {
        const text = r.error ?? r.summary;
        if (!text) return "—";
        return (
          <span
            title={text}
            style={{
              display: "inline-block",
              maxWidth: 260,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: r.error ? "var(--fg-danger)" : "var(--fg-secondary)",
            }}
          >
            {text}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(
            [
              [null, "전체"],
              ["succeeded", "성공"],
              ["failed", "실패"],
              ["running", "실행 중"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={label}
              variant={status === key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setStatus(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", width: 220 }}>
          <Input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="기업명 검색"
            aria-label="기업명 검색"
          />
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
    </>
  );
}

/* ── 시스템 로그 (자동화 잡·워커 실패) — 종전 화면 그대로 ── */

type LogRow = {
  id: string;
  source: string; // dart-corp / benchmark / classify / judge / collect ...
  level: "info" | "error";
  message: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

/** 소스 표기 — 목록에 없는 새 소스는 원문 그대로 보인다 */
const SOURCE_LABEL: Record<string, string> = {
  "dart-corp": "DART 색인",
  benchmark: "벤치마크",
  classify: "문서 분류",
  judge: "문항 판정",
  collect: "공개데이터",
};

function SystemLogs() {
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

  /* 필터가 바뀌면 목록 리셋(렌더 중 상태 조정) — 소스 버튼 목록은 응답의 distinct 값으로 유지 */
  const filterKey = `${source ?? ""}|${level ?? ""}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setItems(null);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
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
    <>
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
    </>
  );
}

/* ── 통합 로그 페이지 ── */

export default function AdminLogsPage() {
  const [tab, setTab] = useState<"exec" | "system">("exec");

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
        통합 로그
      </h1>
      <p style={{ margin: "0 0 20px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        진단 파이프라인 실행 기록(단계·상태·토큰·비용)과 자동화 작업·시스템 오류 기록
      </p>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          padding: 4,
          borderRadius: "var(--radius-m)",
          background: "var(--bg-secondary)",
          width: "fit-content",
        }}
      >
        {(
          [
            ["exec", "실행 로그"],
            ["system", "시스템 로그"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            style={{
              padding: "7px 16px",
              borderRadius: "var(--radius-s)",
              border: "none",
              background: tab === key ? "var(--bg-elevated)" : "transparent",
              boxShadow: tab === key ? "var(--shadow-1)" : "none",
              font: "var(--text-label-s)",
              fontFamily: "var(--font-sans)",
              color: tab === key ? "var(--fg-primary)" : "var(--fg-tertiary)",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "exec" ? <ExecLogs /> : <SystemLogs />}
    </section>
  );
}
