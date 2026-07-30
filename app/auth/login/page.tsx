"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/components/auth/AuthContext";

/**
 * 로그인 — 이메일 인증 링크의 착지 화면도 겸한다(`?verified=1`).
 * 인증 후에는 서버가 자동 로그인까지 처리하므로, 세션이 있으면 폼 대신 완료 안내를 보여준다.
 */
function LoginCard() {
  const router = useRouter();
  const verified = useSearchParams().get("verified") === "1";
  const { user, hydrated } = useAuth();

  if (verified && hydrated && user) {
    return (
      <Card style={{ width: 420, padding: 28, textAlign: "center" }}>
        <h1
          style={{
            margin: "0 0 10px",
            font: "var(--text-h3)",
            letterSpacing: "var(--track-heading)",
          }}
        >
          이메일 인증 완료
        </h1>
        <p style={{ margin: "0 0 20px", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
          {user.email}로 로그인됐어요.
        </p>
        <Button variant="primary" size="lg" full href="/">
          진단 시작하기
        </Button>
      </Card>
    );
  }

  return (
    <Card style={{ width: 420, padding: 28 }}>
      <h1
        style={{
          margin: "0 0 20px",
          font: "var(--text-h3)",
          letterSpacing: "var(--track-heading)",
        }}
      >
        로그인
      </h1>
      {verified && (
        <p style={{ margin: "-8px 0 16px", font: "var(--text-caption)", color: "var(--fg-brand)" }}>
          이메일 인증이 완료됐어요. 로그인해 주세요.
        </p>
      )}
      <AuthForm mode="login" onSuccess={() => router.push("/")} />
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-10) var(--gutter)",
        background: "var(--bg-secondary)",
      }}
    >
      <Suspense fallback={null}>
        <LoginCard />
      </Suspense>
    </div>
  );
}
