"use client";

import { useState, type ReactNode } from "react";

/**
 * 용어 툴팁 — 전문 용어에 마우스 호버 시 쉬운 풀이 제공 (라이팅 규칙 4.1).
 * 밑줄 점선으로 용어임을 표시하고, grey-800 서피스 말풍선을 띄운다.
 */
export function TermTooltip({ term, children }: { term: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        tabIndex={0}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          textDecoration: "underline dotted var(--grey-400) 1.5px",
          textUnderlineOffset: 3,
          cursor: "help",
        }}
      >
        {term}
      </span>
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "calc(100% + 8px)",
            transform: "translateX(-50%)",
            zIndex: 60,
            width: "max-content",
            maxWidth: 280,
            background: "var(--grey-800)",
            color: "var(--fg-inverse)",
            borderRadius: "var(--radius-m)",
            boxShadow: "var(--shadow-2)",
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: "var(--track-body)",
            textAlign: "left",
            whiteSpace: "normal",
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
