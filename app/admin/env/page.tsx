"use client";

import { useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import { ManagedModal } from "@/components/admin/ManagedModal";

/**
 * 환경 관리 — 서비스가 쓰는 환경 변수 키 목록 (키 이름만 표시, 값은 어디에도 노출하지 않음).
 * 값 변경·연동 동작은 API 연동 전까지 "개별 관리 중" 팝업.
 */
const KEY_GROUPS: { group: string; keys: { name: string; desc: string }[] }[] = [
  {
    group: "AI",
    keys: [{ name: "OPENAI_API_KEY", desc: "문서 분류·문항 판정·서사 생성·스캔 텍스트 추출" }],
  },
  {
    group: "인증·메일",
    keys: [
      { name: "BETTER_AUTH_SECRET", desc: "세션·토큰 서명 비밀키" },
      { name: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET", desc: "구글 소셜 로그인 OAuth" },
      { name: "RESEND_API_KEY", desc: "회원가입 인증 메일 발송" },
      { name: "AUTH_EMAIL_FROM", desc: "인증 메일 발신 주소" },
    ],
  },
  {
    group: "외부 데이터",
    keys: [
      { name: "BIZNO_API_KEY", desc: "기업명 검색 자동완성" },
      { name: "NTS_API_KEY", desc: "국세청 사업자 상태 조회" },
      { name: "DART_API_KEY", desc: "전자공시 프로필·재무 교차검증" },
      { name: "KIPRIS_API_KEY", desc: "특허정보 교차검증" },
      { name: "EMPLOYMENT_API_KEY", desc: "고용정보 교차검증 (도입 보류)" },
    ],
  },
  {
    group: "인프라",
    keys: [
      { name: "DATABASE_URL", desc: "PostgreSQL 접속" },
      { name: "REDIS_URL", desc: "작업 큐(BullMQ)" },
      { name: "MINIO_ACCESS_KEY / MINIO_SECRET_KEY", desc: "업로드 원본 저장소" },
      { name: "FRONT_ORIGIN", desc: "CORS·신뢰 출처 (콤마 목록)" },
    ],
  },
];

export default function AdminEnvPage() {
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
          환경 관리
        </h1>
        <Badge tone="neutral">API 연동 예정</Badge>
      </div>
      <p style={{ margin: "0 0 24px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        서비스 환경 변수 키 목록 — 값은 표시하지 않음
      </p>

      <div style={{ display: "grid", gap: 16 }}>
        {KEY_GROUPS.map(({ group, keys }) => (
          <Card key={group} radius="xl" padded={false}>
            <div
              style={{
                padding: "14px 20px",
                font: "var(--text-label-s)",
                color: "var(--fg-primary)",
                borderBottom: "1px solid var(--line-default)",
              }}
            >
              {group}
            </div>
            {keys.map(({ name, desc }, i) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "12px 20px",
                  borderTop: i > 0 ? "1px solid var(--line-subtle)" : "none",
                }}
              >
                <code
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    color: "var(--fg-primary)",
                    flex: "none",
                    minWidth: 280,
                  }}
                >
                  {name}
                </code>
                <span
                  style={{
                    font: "var(--text-caption)",
                    color: "var(--fg-tertiary)",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {desc}
                </span>
                <Button variant="utility" size="sm" onClick={() => setManaged(true)}>
                  관리
                </Button>
              </div>
            ))}
          </Card>
        ))}
      </div>

      <ManagedModal open={managed} onClose={() => setManaged(false)} />
    </section>
  );
}
