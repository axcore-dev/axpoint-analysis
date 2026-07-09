"use client";

import { useState } from "react";
import type { EvidenceKind, EvidenceRef } from "@/lib/types";
import { Icons } from "@/components/ui/icons";

/**
 * 근거 칩 — 출처 구분 표기 (F-CMN-03, REQ-F-03)
 * 업로드 자료 / 공개 데이터 / HITL 응답을 아이콘으로 구분하고,
 * 탭 시 원문 스니펫을 노출한다 (원문 추적).
 */
const KIND_META: Record<EvidenceKind, { label: string; icon: keyof typeof Icons }> = {
  upload: { label: "업로드 자료", icon: "upload" },
  public: { label: "공개 데이터", icon: "globe" },
  hitl: { label: "확인 응답", icon: "check" },
};

export function SourceChip({ evidence }: { evidence: EvidenceRef }) {
  const [open, setOpen] = useState(false);
  const meta = KIND_META[evidence.kind];
  const Icon = Icons[meta.icon];

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`${meta.label} · ${evidence.label}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 10px",
          borderRadius: "var(--radius-pill)",
          border: "1px solid var(--hairline)",
          background: open ? "var(--surface-selected)" : "var(--surface-ghost)",
          color: open ? "var(--ax-blue)" : "var(--slate-600)",
          fontSize: 12,
          letterSpacing: "-0.004em",
          lineHeight: 1,
          cursor: evidence.snippet ? "pointer" : "default",
          fontFamily: "var(--font-sans)",
          transition: "background-color .15s ease, color .15s ease",
        }}
      >
        <Icon size={11} />
        {evidence.label}
      </button>
      {open && evidence.snippet && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 30,
            minWidth: 220,
            maxWidth: 320,
            padding: "10px 12px",
            borderRadius: "var(--radius-md)",
            background: "var(--tile-dark-1)",
            color: "var(--on-dark)",
            fontSize: 12,
            lineHeight: 1.5,
            boxShadow: "var(--shadow-pop)",
          }}
        >
          <span
            style={{
              display: "block",
              color: "var(--on-dark-muted)",
              fontSize: 11,
              marginBottom: 4,
            }}
          >
            {meta.label} · 원문 발췌
          </span>
          &ldquo;{evidence.snippet}&rdquo;
        </span>
      )}
    </span>
  );
}

export function SourceChips({ items }: { items: EvidenceRef[] }) {
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((e, i) => (
        <SourceChip key={`${e.refId}-${i}`} evidence={e} />
      ))}
    </span>
  );
}
