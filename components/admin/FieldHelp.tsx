"use client";

import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui";

/**
 * 물음표 도움말 — 라벨 옆에 붙여 누르면 설명·예시 팝업을 연다 (작업요청 v6-1).
 * 어드민 설정 화면의 용어는 처음 보면 뜻을 알기 어려운 것이 많아, 화면을 떠나지 않고 확인하게 한다.
 */
export function FieldHelp({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${title} 설명 보기`}
        style={{
          width: 16,
          height: 16,
          marginLeft: 6,
          padding: 0,
          borderRadius: 999,
          border: "1px solid var(--line-default)",
          background: "transparent",
          color: "var(--fg-tertiary)",
          font: "600 10px/1 var(--font-sans)",
          cursor: "pointer",
          verticalAlign: "middle",
        }}
      >
        ?
      </button>
      {/* 예시 블록에 코드가 들어가 기본 폭(440)에서는 줄바꿈이 심하다 */}
      <Modal open={open} onClose={() => setOpen(false)} title={title} wide>
        <div style={{ font: "var(--text-body3)", color: "var(--fg-secondary)", lineHeight: 1.7 }}>
          {children}
        </div>
      </Modal>
    </>
  );
}

/** 도움말 안의 예시 블록 — 코드·JSON을 그대로 보여준다 */
export function HelpExample({ children }: { children: ReactNode }) {
  return (
    <pre
      style={{
        margin: "10px 0 0",
        padding: "10px 12px",
        borderRadius: "var(--radius-m)",
        background: "var(--bg-secondary)",
        font: "12px/1.6 var(--font-mono)",
        color: "var(--fg-primary)",
        overflowX: "auto",
        whiteSpace: "pre",
      }}
    >
      {children}
    </pre>
  );
}
