"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card, Input } from "@/components/ui";
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

const COLUMNS = ["이메일", "이름", "회사", "로그인 방식", "권한", "상태", "가입일"];

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

  const cell = {
    padding: "12px 16px",
    font: "var(--text-caption)",
    color: "var(--fg-secondary)",
    borderBottom: "1px solid var(--line-subtle)",
    whiteSpace: "nowrap" as const,
  };

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
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c}
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      font: "var(--text-caption)",
                      color: "var(--fg-tertiary)",
                      borderBottom: "1px solid var(--line-default)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={COLUMNS.length} style={{ ...cell, textAlign: "center", padding: "40px 16px" }}>
                    {error}
                  </td>
                </tr>
              )}
              {!error && items === null && (
                <tr>
                  <td colSpan={COLUMNS.length} style={{ ...cell, textAlign: "center", padding: "40px 16px" }}>
                    불러오는 중…
                  </td>
                </tr>
              )}
              {!error && items !== null && filtered.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} style={{ ...cell, textAlign: "center", padding: "40px 16px" }}>
                    조건에 맞는 사용자 없음
                  </td>
                </tr>
              )}
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td style={{ ...cell, color: "var(--fg-primary)", fontWeight: 600 }}>{u.email}</td>
                  <td style={cell}>{u.name || "—"}</td>
                  <td style={cell}>{u.companyName ?? "—"}</td>
                  <td style={cell}>{providerLabel(u)}</td>
                  <td style={cell}>
                    {u.role === "admin" ? <Badge tone="accent">관리자</Badge> : <Badge tone="neutral">일반</Badge>}
                  </td>
                  <td style={cell}>
                    {u.isAnonymous ? (
                      <Badge tone="outline">체험</Badge>
                    ) : u.emailVerified ? (
                      <Badge tone="success">인증됨</Badge>
                    ) : (
                      <Badge tone="warning">미인증</Badge>
                    )}
                  </td>
                  <td style={cell}>{u.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items !== null && !error && (
          <div
            style={{
              padding: "10px 16px",
              font: "var(--text-caption)",
              color: "var(--fg-tertiary)",
              borderTop: "1px solid var(--line-subtle)",
            }}
          >
            총 {items.length.toLocaleString("ko-KR")}명
          </div>
        )}
      </Card>
    </section>
  );
}
