"use client";

import { Badge, Card } from "@/components/ui";

/**
 * 환경 관리 — 서비스가 쓰는 환경 변수 키 목록 (키 이름만 표시, 값은 어디에도 노출하지 않음).
 * 외부 API 키는 여기 없다 — 어드민 '외부 연동'에서 등록·교체한다.
 */
const KEY_GROUPS: { group: string; keys: { name: string; desc: string }[] }[] = [
  {
    group: "인증·메일",
    keys: [
      { name: "BETTER_AUTH_SECRET", desc: "세션·토큰 서명 비밀키" },
      { name: "BETTER_AUTH_URL", desc: "인증 콜백 기준 URL" },
      { name: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET", desc: "구글 소셜 로그인 OAuth (기동 시 조립 — 런타임 교체 불가)" },
      { name: "AUTH_EMAIL_FROM", desc: "인증 메일 발신 주소" },
    ],
  },
  {
    group: "외부 연동 키 저장소",
    keys: [
      {
        name: "ADMIN_ENCRYPTION_KEY",
        desc: "외부 연동에 등록한 API 키의 암호화 키 (AES-256-GCM) — 없으면 키 저장이 막힌다",
      },
    ],
  },
  {
    group: "AI 호출 옵션",
    keys: [
      { name: "OPENAI_MODEL", desc: "사용 모델 (기본 gpt-4o-mini)" },
      { name: "OPENAI_TIMEOUT_MS", desc: "응답 대기 상한 (기본 90000)" },
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
              </div>
            ))}
          </Card>
        ))}
      </div>
    </section>
  );
}
