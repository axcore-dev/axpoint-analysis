"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, Input } from "@/components/ui";
import { SortableTable, type Column } from "@/components/admin/SortableTable";
import { useAuth } from "@/components/auth/AuthContext";
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

/* 권한 탭 — 게스트가 목록을 채우면 관리자·일반 계정이 묻힌다 */
const ROLE_TABS: { key: string; label: string; match: (u: AdminUser) => boolean }[] = [
  { key: "all", label: "전체", match: () => true },
  { key: "admin", label: "관리자", match: (u) => u.role === "admin" },
  { key: "user", label: "일반", match: (u) => u.role !== "admin" && !u.isAnonymous },
  { key: "guest", label: "체험", match: (u) => u.isAnonymous },
];

/**
 * 체험(익명) 계정 정리 — '체험' 탭에서만 보인다.
 *
 * 자료 분류까지는 로그인 없이 진행하므로(v6-4) 로그인하지 않고 이탈한 계정이 쌓인다.
 * 로그인·가입에 성공한 익명 계정은 그 자리에서 사라지므로, 여기 남는 것은 끝까지 로그인하지 않은 것뿐이다.
 * 자동으로 지우지 않는다 — 개수를 확인하고 관리자가 직접 누를 때만 지운다.
 */
function GuestCleanup({ onDone }: { onDone: () => void }) {
  const [info, setInfo] = useState<{ days: number; stale: number; total: number } | null>(null);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ days: number; stale: number; total: number }>("/api/admin/guests/stale")
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);
  useEffect(load, [load]);

  const purge = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { deleted } = await api<{ deleted: number }>("/api/admin/guests/stale", {
        method: "DELETE",
      });
      setMsg(`체험 계정 ${deleted.toLocaleString("ko-KR")}건과 딸린 진단을 지웠어요.`);
      load();
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "지우지 못했어요.");
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  if (!info) return null;
  return (
    <Card radius="xl" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
            체험 계정 정리
          </div>
          <p style={{ margin: "4px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
            전체 {info.total.toLocaleString("ko-KR")}건 중 {info.days}일이 지난{" "}
            {info.stale.toLocaleString("ko-KR")}건이 정리 대상이에요. 지우면 딸린 진단·판정 결과도
            함께 사라져요.
          </p>
          {msg && (
            <p style={{ margin: "6px 0 0", font: "var(--text-caption)", color: "var(--fg-secondary)" }}>
              {msg}
            </p>
          )}
        </div>
        <Button
          variant={armed ? "secondary" : "ghost"}
          size="sm"
          disabled={busy || info.stale === 0}
          onClick={() => (armed ? purge() : setArmed(true))}
        >
          {busy ? "지우는 중" : armed ? "한 번 더 눌러 확정" : `${info.stale}건 정리`}
        </Button>
      </div>
    </Card>
  );
}

/** 회원 관리 — 가입 사용자 실목록·권한 변경 (GET /api/admin/users) */
export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleTab, setRoleTab] = useState("all");
  /* 권한 변경 — 실수로 눌리면 안 되는 자리라 같은 버튼을 두 번 눌러야 적용된다 */
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { user: me } = useAuth();

  const load = useCallback(() => {
    api<{ items: AdminUser[] }>("/api/admin/users")
      .then(({ items }) => setItems(items))
      .catch((e) => setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."));
  }, []);
  useEffect(load, [load]);

  const changeRole = async (u: AdminUser, role: "admin" | "user") => {
    setBusyId(u.id);
    setError(null);
    try {
      await api(`/api/admin/users/${u.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "권한을 바꾸지 못했어요.");
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? [])
      .filter((u) => ROLE_TABS.find((t) => t.key === roleTab)?.match(u) ?? true)
      .filter((u) => !q || u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  }, [items, search, roleTab]);

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
    {
      key: "manage",
      label: "권한 변경",
      sortValue: () => "",
      render: (u) => {
        /* 체험 계정은 로그인 경로가 없어 승격 대상이 아니고, 자기 자신은 서버가 막는다 */
        if (u.isAnonymous || u.email === me?.email)
          return <span style={{ color: "var(--fg-tertiary)" }}>—</span>;
        const next = u.role === "admin" ? "user" : "admin";
        const armed = confirmId === u.id;
        return (
          <Button
            variant={armed ? "secondary" : "ghost"}
            size="sm"
            disabled={busyId === u.id}
            onClick={() => (armed ? changeRole(u, next) : setConfirmId(u.id))}
          >
            {busyId === u.id
              ? "적용 중"
              : armed
                ? "한 번 더 눌러 확정"
                : u.role === "admin"
                  ? "관리자 해제"
                  : "관리자 지정"}
          </Button>
        );
      },
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
        회원 관리
      </h1>
      <p style={{ margin: "0 0 24px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        가입 사용자 목록 · 권한 · 상태
      </p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {ROLE_TABS.map((t) => {
            const count = (items ?? []).filter(t.match).length;
            return (
              <Button
                key={t.key}
                variant={roleTab === t.key ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setRoleTab(t.key)}
              >
                {t.label} {count}
              </Button>
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
          <Input
            placeholder="이메일 또는 이름 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="사용자 검색"
          />
        </div>
      </div>

      {roleTab === "guest" && <GuestCleanup onDone={load} />}

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
