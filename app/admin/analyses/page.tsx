"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card, Input } from "@/components/ui";
import { SortableTable, type Column } from "@/components/admin/SortableTable";
import { STEPS } from "@/components/flow/steps";
import { api } from "@/lib/api";
import type { StepId } from "@/lib/types";

type AdminAnalysis = {
  id: string;
  status: string;
  completedSteps: StepId[] | null;
  createdAt: string;
  completedAt: string | null;
  companyName: string | null;
  bizNo: string | null;
  userEmail: string;
  userName: string;
  totalScore: string | null;
  level: number | null;
  levelName: string | null;
};

/** 진행 단계 — 못 끝낸 첫 단계가 지금 하는 일 */
function stepLabel(a: AdminAnalysis): string {
  if (a.status === "completed") return "완료";
  const done = a.completedSteps ?? [];
  const idx = STEPS.findIndex((s) => !done.includes(s.id));
  return idx < 0 ? "완료 대기" : `${idx + 1}. ${STEPS[idx].label}`;
}

const STATUS_TONE: Record<string, "success" | "accent" | "danger" | "neutral"> = {
  completed: "success",
  judging: "accent",
  failed: "danger",
  draft: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  completed: "완료",
  judging: "분석 중",
  failed: "실패",
  draft: "진행 중",
};

/** 진단 이력 — 전체 사용자의 진단 목록 (GET /api/admin/analyses) */
export default function AdminAnalysesPage() {
  const [items, setItems] = useState<AdminAnalysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<{ items: AdminAnalysis[] }>("/api/admin/analyses")
      .then(({ items }) => setItems(items))
      .catch((e) => setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items ?? [];
    return (items ?? []).filter(
      (a) =>
        (a.companyName ?? "").toLowerCase().includes(q) ||
        a.userEmail.toLowerCase().includes(q),
    );
  }, [items, search]);

  const columns: Column<AdminAnalysis>[] = [
    {
      key: "company",
      label: "기업명",
      sortValue: (a) => a.companyName,
      render: (a) => (
        <span style={{ color: "var(--fg-primary)", fontWeight: 600 }}>{a.companyName ?? "—"}</span>
      ),
    },
    { key: "user", label: "사용자", sortValue: (a) => a.userEmail, render: (a) => a.userEmail },
    {
      key: "status",
      label: "상태",
      sortValue: (a) => a.status,
      render: (a) => (
        <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>
          {STATUS_LABEL[a.status] ?? a.status}
        </Badge>
      ),
    },
    { key: "step", label: "현재 단계", sortValue: (a) => stepLabel(a), render: (a) => stepLabel(a) },
    {
      key: "level",
      label: "레벨",
      sortValue: (a) => a.level,
      render: (a) => (a.level ? `Lv.${a.level} ${a.levelName ?? ""}`.trim() : "—"),
    },
    {
      key: "score",
      label: "종합",
      align: "right",
      sortValue: (a) => (a.totalScore === null ? null : Number(a.totalScore)),
      render: (a) =>
        a.totalScore === null ? (
          "—"
        ) : (
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {Math.round(Number(a.totalScore) * 10) / 10}
          </span>
        ),
    },
    {
      key: "createdAt",
      label: "생성일",
      sortValue: (a) => a.createdAt,
      render: (a) => a.createdAt.slice(0, 10),
    },
  ];

  return (
    <section style={{ maxWidth: 1440 }}>
      <h1
        style={{
          margin: "0 0 6px",
          font: "var(--text-h4)",
          letterSpacing: "var(--track-heading)",
          color: "var(--fg-primary)",
        }}
      >
        진단 이력
      </h1>
      <p style={{ margin: "0 0 24px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        기업별 진단 진행 현황 · 결과
      </p>

      <div style={{ maxWidth: 420, marginBottom: 16 }}>
        <Input
          placeholder="기업명 또는 사용자 이메일 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="진단 검색"
        />
      </div>

      <Card radius="xl" padded={false}>
        <SortableTable
          columns={columns}
          rows={filtered}
          rowKey={(a) => a.id}
          defaultSort={{ key: "createdAt", dir: "desc" }}
          empty={error ?? (items === null ? "불러오는 중…" : "조건에 맞는 진단 없음")}
          footer={
            items !== null && !error
              ? `총 ${items.length.toLocaleString("ko-KR")}건 · 완료 ${items.filter((a) => a.status === "completed").length}건`
              : undefined
          }
        />
      </Card>
    </section>
  );
}
