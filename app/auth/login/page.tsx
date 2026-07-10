"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  const router = useRouter();
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
        <AuthForm mode="login" onSuccess={() => router.push("/")} />
      </Card>
    </div>
  );
}
