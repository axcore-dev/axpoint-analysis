"use client";

import { useState } from "react";
import { Badge, Button, Card, Icons, Input } from "@/components/ui";
import { ManagedModal } from "@/components/admin/ManagedModal";

const COLUMNS = ["기업명", "사용자", "상태", "현재 단계", "레벨", "생성일"];

/** 진단 이력 — 화면 골격. 데이터·동작은 API 연동 전까지 팝업 안내. */
export default function AdminAnalysesPage() {
  const [managed, setManaged] = useState(false);
  const open = () => setManaged(true);

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
          진단 이력
        </h1>
        <Badge tone="neutral">API 연동 예정</Badge>
      </div>
      <p style={{ margin: "0 0 24px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        기업별 진단 진행 현황 · 결과
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 280px", maxWidth: 420 }} onClick={open}>
          <Input placeholder="기업명 검색" readOnly aria-label="진단 검색" />
        </div>
        <Button variant="utility" size="md" onClick={open}>
          <Icons.chevronDown size={15} aria-hidden /> 상태
        </Button>
        <Button variant="utility" size="md" onClick={open}>
          <Icons.chevronDown size={15} aria-hidden /> 기간
        </Button>
      </div>

      <Card radius="xl" padded={false}>
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
                  }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={COLUMNS.length} style={{ padding: "48px 16px", textAlign: "center" }}>
                <p
                  style={{
                    margin: "0 0 14px",
                    font: "var(--text-body2)",
                    color: "var(--fg-secondary)",
                  }}
                >
                  진단 데이터는 현재 개별 관리되고 있어요.
                </p>
                <Button variant="secondary" size="sm" onClick={open}>
                  자세히
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      <ManagedModal open={managed} onClose={() => setManaged(false)} />
    </section>
  );
}
