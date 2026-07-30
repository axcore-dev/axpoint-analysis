"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card, Input } from "@/components/ui";
import { SortableTable, type Column } from "@/components/admin/SortableTable";
import { api } from "@/lib/api";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  companyName: string | null;
  createdAt: string;
  providers: string[];
};

/** 로그인 방식 표기 — better-auth providerId 기준 */
function providerLabel(u: AdminUser): string {
  if (u.isAnonymous) return "게스트";
  const labels = u.providers.map((p) =>
    p === "credential" ? "이메일" : p === "google" ? "Google" : p,
  );
  return labels.length ? [...new Set(labels)].join(" · ") : "—";
}

/** 사용자 관리 — 가입 사용자 실목록 (GET /api/admin/users) */
export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api<{ items: AdminUser[] }>("/api/admin/users")
      .then(({ items }) => setItems(items))
      .catch((e) => setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items ?? [];
    return (items ?? []).filter(
      (u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q),
    );
  }, [items, search]);

  const columns: Column<AdminUser>[] = [
    {
      key: "email",
      label: "이메일",
      sortValue: (u) => u.email,
      render: (u) => (
        <span style={{ color: "var(--fg-primary)", fontWeight: 600 }}>{u.email}</span>
      ),
    },
    { key: "name", label: "이름", sortValue: (u) => u.name, render: (u) => u.name || "—" },
    {
      key: "company",
      label: "회사",
      sortValue: (u) => u.companyName,
      render: (u) => u.companyName ?? "—",
    },
    {
      key: "provider",
      label: "로그인 방식",
      sortValue: (u) => providerLabel(u),
      render: (u) => providerLabel(u),
    },
    {
      key: "role",
      label: "권한",
      /* 관리자가 먼저 보이도록 admin을 앞선 값으로 */
      sortValue: (u) => (u.role === "admin" ? "0관리자" : "1일반"),
      render: (u) =>
        u.role === "admin" ? <Badge tone="accent">관리자</Badge> : <Badge tone="neutral">일반</Badge>,
    },
    {
      key: "state",
      label: "상태",
      sortValue: (u) => (u.isAnonymous ? "체험" : u.emailVerified ? "인증됨" : "미인증"),
      render: (u) =>
        u.isAnonymous ? (
          <Badge tone="outline">체험</Badge>
        ) : u.emailVerified ? (
          <Badge tone="success">인증됨</Badge>
        ) : (
          <Badge tone="warning">미인증</Badge>
        ),
    },
    {
      key: "createdAt",
      label: "가입일",
      sortValue: (u) => u.createdAt,
      render: (u) => u.createdAt.slice(0, 10),
    },
  ];

  return (
    <section style={{ maxWidth: 1040 }}>
      <h1
        style={{
          margin: "0 0 6px",
          font: "var(--text-h4)",
          letterSpacing: "var(--track-heading)",
          color: "var(--fg-primary)",
        }}
      >
        사용자 관리
      </h1>
      <p style={{ margin: "0 0 24px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        가입 사용자 목록 · 권한 · 상태
      </p>

      <div style={{ maxWidth: 420, marginBottom: 16 }}>
        <Input
          placeholder="이메일 또는 이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="사용자 검색"
        />
      </div>

      <Card radius="xl" padded={false}>
        <SortableTable
          columns={columns}
          rows={filtered}
          rowKey={(u) => u.id}
          defaultSort={{ key: "createdAt", dir: "desc" }}
          empty={error ?? (items === null ? "불러오는 중…" : "조건에 맞는 사용자 없음")}
          footer={
            items !== null && !error ? `총 ${items.length.toLocaleString("ko-KR")}명` : undefined
          }
        />
      </Card>
    </section>
  );
}
