"use client";

import { useState } from "react";
import { Button, Input, PasswordInput } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useAuth } from "./AuthContext";

const PRIVACY_URL = "https://axcore.ai.kr/privacy-policy";

/** better-auth 오류 코드 → 한국어 안내 */
const ERROR_KO: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "이메일 또는 비밀번호가 올바르지 않아요.",
  USER_NOT_FOUND: "가입되지 않은 이메일이에요.",
  EMAIL_NOT_VERIFIED: "이메일 인증이 아직 완료되지 않았어요. 받은 메일함을 확인해 주세요.",
  USER_ALREADY_EXISTS: "이미 가입된 이메일이에요.",
  PASSWORD_TOO_SHORT: "비밀번호는 8자 이상이어야 해요.",
};

const toKorean = (e: unknown) => {
  if (e instanceof ApiError && e.code && ERROR_KO[e.code]) return ERROR_KO[e.code];
  if (e instanceof ApiError && /invalid email or password/i.test(e.message))
    return ERROR_KO.INVALID_EMAIL_OR_PASSWORD;
  return e instanceof Error && e.message ? e.message : "잠시 후 다시 시도해 주세요.";
};

/**
 * 로그인/회원가입 폼 — 모달과 /auth 페이지가 공유. 백엔드(better-auth) 연동.
 * 가입은 이메일 인증 완료 후 로그인 가능.
 *
 * 자료 분류까지는 로그인 없이 진행하고 결과 분석 시점에 이 폼을 띄운다.
 * 그때까지의 진단은 익명 세션에 담겨 있다가
 * 로그인·가입에 성공하면 그 계정으로 넘어온다 (AuthContext.claimGuestWork).
 */
export function AuthForm({
  mode: initialMode = "login",
  onSuccess,
}: {
  mode?: "login" | "signup";
  onSuccess?: () => void;
}) {
  const { login, signup, loginGoogle } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);

  const pwMismatch = mode === "signup" && password2.length > 0 && password !== password2;
  const canSubmit =
    email.includes("@") &&
    password.length >= 8 &&
    (mode === "login" || (name.length > 0 && agreed && password === password2));

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
        onSuccess?.();
      } else {
        await signup(email, password, name);
        setVerifySent(true); // 세션 없음 — 메일 인증 안내로 전환
      }
    } catch (e) {
      setError(toKorean(e));
    } finally {
      setBusy(false);
    }
  };

  const social = async (fn: () => Promise<void>, stayBusy = false) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (!stayBusy) onSuccess?.();
    } catch (e) {
      setError(toKorean(e));
      setBusy(false);
      return;
    }
    if (!stayBusy) setBusy(false);
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

  /* 가입 완료 — 인증 메일 안내 */
  if (verifySent) {
    return (
      <div style={{ textAlign: "center", padding: "12px 0" }}>
        <p style={{ font: "var(--text-body-m)", color: "var(--fg-primary)", margin: 0 }}>
          {email}로 인증 메일을 보냈어요.
        </p>
        <p
          style={{
            font: "var(--text-caption)",
            color: "var(--fg-tertiary)",
            margin: "8px 0 16px",
          }}
        >
          메일의 링크를 누르면 가입이 완료되고 바로 로그인돼요.
        </p>
        <Button
          size="lg"
          full
          variant="secondary"
          onClick={() => {
            setVerifySent(false);
            setMode("login");
          }}
        >
          로그인으로 돌아가기
        </Button>
      </div>
    );
  }

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
            onClick={() => {
              setMode(m);
              setError(null);
            }}
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
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (8자 이상)"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />,
      )}
      {mode === "signup" &&
        field(
          "비밀번호 확인",
          <>
            <PasswordInput
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="비밀번호를 한 번 더 입력"
              autoComplete="new-password"
            />
            {pwMismatch && (
              <p
                style={{
                  margin: "6px 0 0",
                  font: "var(--text-caption)",
                  color: "var(--fg-danger, #d4380d)",
                }}
              >
                비밀번호가 일치하지 않아요.
              </p>
            )}
          </>,
        )}

      {mode === "signup" && (
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            margin: "2px 0 12px",
            font: "var(--text-caption)",
            color: "var(--fg-tertiary)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            이용약관과{" "}
            <a
              href={PRIVACY_URL}
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--fg-secondary)", textDecoration: "underline" }}
            >
              개인정보처리방침
            </a>
            에 동의합니다. (필수)
          </span>
        </label>
      )}

      {error && (
        <p
          style={{
            margin: "0 0 10px",
            font: "var(--text-caption)",
            color: "var(--fg-danger, #d4380d)",
          }}
        >
          {error}
        </p>
      )}

      <Button size="lg" full disabled={!canSubmit || busy} onClick={submit} style={{ marginTop: 6 }}>
        {busy ? "확인하고 있어요" : mode === "login" ? "로그인" : "가입하고 시작하기"}
      </Button>

      <Button
        size="lg"
        full
        variant="secondary"
        disabled={busy}
        onClick={() => social(loginGoogle, true)}
        style={{ marginTop: 8 }}
      >
        Google로 계속하기
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
