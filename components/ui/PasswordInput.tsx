"use client";

import { useId, useState } from "react";
import { Input, type InputProps } from "./Input";

/**
 * 비밀번호 입력 — 오른쪽 눈 아이콘으로 보기/끄기를 전환한다 (작업요청 v6-5).
 * 토글은 필드 안쪽 슬롯에 들어가 테두리·포커스 링을 그대로 쓴다.
 */
export function PasswordInput({ ...rest }: Omit<InputProps, "type" | "trailingIcon">) {
  const [shown, setShown] = useState(false);
  const id = useId();
  return (
    <Input
      {...rest}
      type={shown ? "text" : "password"}
      aria-describedby={id}
      trailingIcon={
        <button
          type="button"
          id={id}
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "비밀번호 가리기" : "비밀번호 보기"}
          aria-pressed={shown}
          /* 폼 안에서 엔터를 눌렀을 때 이 버튼이 눌리면 안 된다 — type="button"으로 막았다 */
          style={{
            display: "inline-flex",
            alignItems: "center",
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            cursor: "pointer",
            color: "inherit",
          }}
        >
          <EyeIcon off={shown} />
        </button>
      }
    />
  );
}

/** 눈 아이콘 — off=true면 사선이 그어진 '가리기' 상태를 보여준다 */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.6" />
      {off && <path d="m4 20 16-16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  );
}
