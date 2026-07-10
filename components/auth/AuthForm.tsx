"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { DEMO_CREDENTIALS, useAuth } from "./AuthContext";

/**
 * 로그인/회원가입 폼 — 모달과 /auth 페이지가 공유.
 * 가짜 인증: 기본값이 미리 채워져 있고 어떤 값이든 통과한다.
 */
export function AuthForm({
  mode: initialMode = "login",
  onSuccess,
}: {
  mode?: "login" | "signup";
  onSuccess?: () => void;
}) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState(DEMO_CREDENTIALS.email);
  const [password, setPassword] = useState(DEMO_CREDENTIALS.password);
  const [name, setName] = useState(DEMO_CREDENTIALS.name);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.includes("@") && password.length >= 4 && (mode === "login" || name.length > 0);

  const submit = () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    /* 가벼운 지연으로 인증 흐름감만 재현 */
    setTimeout(() => {
      if (mode === "login") login(email);
      else signup(email, name);
      setBusy(false);
      onSuccess?.();
    }, 600);
  };

  const field = (label: string, node: React.ReactNode) => (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          font: "var(--text-label-s)",
          color: "var(--fg-secondary)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {node}
    </div>
  );

  return (
    <div>
      {/* 로그인 / 회원가입 전환 */}
      <div
        style={{
          display: "flex",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius-m)",
          padding: 4,
          marginBottom: 20,
        }}
      >
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{
              flex: 1,
              height: 36,
              border: "none",
              cursor: "pointer",
              borderRadius: 9,
              font: "var(--text-label-m)",
              fontFamily: "var(--font-sans)",
              background: mode === m ? "var(--bg-base)" : "transparent",
              color: mode === m ? "var(--fg-primary)" : "var(--fg-tertiary)",
              boxShadow: mode === m ? "var(--shadow-1)" : "none",
              transition: "all var(--dur-base) var(--ease)",
            }}
          >
            {m === "login" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      {mode === "signup" &&
        field(
          "이름",
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />,
        )}
      {field(
        "이메일",
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일 주소"
          autoComplete="email"
        />,
      )}
      {field(
        "비밀번호",
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />,
      )}

      <Button size="lg" full disabled={!canSubmit || busy} onClick={submit} style={{ marginTop: 6 }}>
        {busy ? "확인하고 있어요" : mode === "login" ? "로그인" : "가입하고 시작하기"}
      </Button>

      <p
        style={{
          margin: "12px 0 0",
          font: "var(--text-caption)",
          color: "var(--fg-quaternary)",
          textAlign: "center",
        }}
      >
        진단 결과를 저장하고 보고서를 받으려면 계정이 필요해요.
      </p>
    </div>
  );
}
