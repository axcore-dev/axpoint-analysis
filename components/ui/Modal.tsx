"use client";

import { useEffect, type ReactNode } from "react";
import { Icons } from "./icons";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  wide?: boolean;
  /** 스크림 클릭으로 닫기 허용 (기본 true) */
  dismissible?: boolean;
  children: ReactNode;
}

/**
 * 센터 모달 — radius 20, shadow-3, 스크림. ESC/스크림 클릭으로 닫기.
 */
export function Modal({ open, onClose, title, wide, dismissible = true, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return (
    <>
      <div className="ax-scrim" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div className={`ax-modal ${wide ? "ax-modal--wide" : ""}`} role="dialog" aria-modal="true">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: title ? 16 : 0,
          }}
        >
          {title ? (
            <h2
              style={{
                margin: 0,
                font: "var(--text-title1)",
                letterSpacing: "var(--track-heading)",
                color: "var(--fg-primary)",
              }}
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--grey-500)",
              padding: 4,
              margin: "-4px -4px 0 0",
              borderRadius: 8,
              display: "inline-flex",
            }}
          >
            <Icons.x size={20} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
