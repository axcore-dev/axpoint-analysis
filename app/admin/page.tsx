"use client";

import { useState } from "react";
import { Badge, Card, Icons, type IconName } from "@/components/ui";
import { ManagedModal } from "@/components/admin/ManagedModal";

/** 대시보드 지표 — API 연동 전이라 값은 자리표시 */
const STATS: { label: string; icon: IconName }[] = [
  { label: "전체 진단", icon: "clipboard" },
  { label: "완료된 진단", icon: "check" },
  { label: "진행 중 진단", icon: "bolt" },
  { label: "가입 사용자", icon: "user" },
];

export default function AdminDashboardPage() {
  const [managed, setManaged] = useState(false);

  return (
    <section style={{ maxWidth: 1040 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <h1
          style={{
            margin: 0,
            font: "var(--text-h4)",
            letterSpacing: "var(--track-heading)",
            color: "var(--fg-primary)",
          }}
        >
          대시보드
        </h1>
        <Badge tone="neutral">API 연동 예정</Badge>
      </div>
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
        {STATS.map(({ label, icon }) => {
          const Icon = Icons[icon];
          return (
            <Card
              key={label}
              interactive
              radius="xl"
              onClick={() => setManaged(true)}
              style={{ cursor: "pointer" }}
            >
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
              <div style={{ font: "var(--text-h3)", color: "var(--fg-primary)" }}>—</div>
            </Card>
          );
        })}
      </div>

      <Card radius="xl">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Icons.info size={17} style={{ color: "var(--fg-brand)" }} aria-hidden />
          <span style={{ font: "var(--text-label-s)", color: "var(--fg-primary)" }}>안내</span>
        </div>
        <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
          지표·목록 데이터는 현재 개별 관리되고 있어요. API 연동이 완료되면 이 화면에서 실시간
          현황을 확인할 수 있어요.
        </p>
      </Card>

      <ManagedModal open={managed} onClose={() => setManaged(false)} />
    </section>
  );
}
