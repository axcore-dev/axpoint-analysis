"use client";

import { useEffect, useState } from "react";
import { Card, Icons, type IconName } from "@/components/ui";
import { api } from "@/lib/api";

type Stats = {
  users: { total: number; guests: number };
  assessments: { total: number; byStatus: Record<string, number> };
  signupsByDay: { day: string; count: number }[];

};

const STATUS_LABEL: Record<string, string> = {
  completed: "완료",
  judging: "분석 중",
  draft: "진행 중",
  failed: "실패",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 최근 30일 날짜축 — 값 없는 날은 0으로 채워 그래프가 끊기지 않게.
 * 서버 집계가 KST 기준 날짜 문자열이므로 축도 KST 달력일로 만든다(UTC로 만들면 하루 밀린다).
 */
function fillDays(rows: { day: string; count: number }[]) {
  const byDay = new Map(rows.map((r) => [r.day, r.count]));
  const todayKst = Date.now() + KST_OFFSET_MS;
  const out: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const key = new Date(todayKst - i * DAY_MS).toISOString().slice(0, 10);
    out.push({ day: key, count: byDay.get(key) ?? 0 });
  }
  return out;
}

/** 가입자 추이 — 막대 하나가 하루. 값이 전부 0이면 안내 문구로 대체 */
function SignupChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0)
    return (
      <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-tertiary)" }}>
        최근 30일 가입이 없어요.
      </p>
    );

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
      {data.map((d) => (
        <div
          key={d.day}
          title={`${d.day} · ${d.count}명`}
          style={{
            flex: 1,
            minWidth: 4,
            height: `${Math.max((d.count / max) * 100, d.count > 0 ? 6 : 2)}%`,
            borderRadius: 3,
            background: d.count > 0 ? "var(--bg-brand)" : "var(--grey-200)",
          }}
        />
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>("/api/admin/stats")
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."));
  }, []);

  const cards: { label: string; icon: IconName; value: string }[] = [
    { label: "전체 진단", icon: "clipboard", value: fmt(stats?.assessments.total) },
    { label: "완료된 진단", icon: "check", value: fmt(stats?.assessments.byStatus.completed) },
    { label: "가입 사용자", icon: "user", value: fmt(stats?.users.total) },
    { label: "체험(게스트)", icon: "bolt", value: fmt(stats?.users.guests) },
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
        대시보드
      </h1>
      <p style={{ margin: "0 0 24px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        서비스 현황 요약
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {cards.map(({ label, icon, value }) => {
          const Icon = Icons[icon];
          return (
            <Card key={label} radius="xl">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span style={{ font: "var(--text-label-s)", color: "var(--fg-secondary)" }}>
                  {label}
                </span>
                <Icon size={17} style={{ color: "var(--fg-tertiary)" }} aria-hidden />
              </div>
              <div style={{ font: "var(--text-h3)", color: "var(--fg-primary)" }}>{value}</div>
            </Card>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <Card radius="xl">
          <div style={{ font: "var(--text-label-s)", color: "var(--fg-primary)", marginBottom: 4 }}>
            가입자 추이
          </div>
          <p style={{ margin: "0 0 16px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
            최근 30일 · 일별 (게스트 제외)
          </p>
          {stats ? <SignupChart data={fillDays(stats.signupsByDay)} /> : null}
        </Card>

        <Card radius="xl">
          <div style={{ font: "var(--text-label-s)", color: "var(--fg-primary)", marginBottom: 16 }}>
            진단 상태 분포
          </div>
          {stats && stats.assessments.total > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {Object.entries(stats.assessments.byStatus).map(([status, count]) => (
                <div key={status} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      width: 64,
                      flex: "none",
                      font: "var(--text-caption)",
                      color: "var(--fg-secondary)",
                    }}
                  >
                    {STATUS_LABEL[status] ?? status}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: "var(--radius-full)",
                      background: "var(--grey-100)",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        width: `${(count / stats.assessments.total) * 100}%`,
                        height: "100%",
                        background: "var(--bg-brand)",
                      }}
                    />
                  </span>
                  <span
                    style={{
                      width: 32,
                      flex: "none",
                      textAlign: "right",
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      color: "var(--fg-primary)",
                    }}
                  >
                    {count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-tertiary)" }}>
              아직 진단이 없어요.
            </p>
          )}
        </Card>
      </div>

      {error && (
        <p style={{ marginTop: 16, font: "var(--text-caption)", color: "var(--fg-danger)" }}>
          {error}
        </p>
      )}
    </section>
  );
}

function fmt(n: number | undefined): string {
  return n === undefined ? "—" : n.toLocaleString("ko-KR");
}
