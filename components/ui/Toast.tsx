"use client";

import { useEffect, type ReactNode } from "react";
import { Icons } from "./icons";

export interface ToastProps {
  open: boolean;
  onClose: () => void;
  /** 자동 닫힘 (ms, 0이면 유지) */
  duration?: number;
  tone?: "neutral" | "success";
  children: ReactNode;
}

/** 하단 중앙 토스트 — grey-800 서피스 + 화이트 라벨 */
export function Toast({ open, onClose, duration = 2600, tone = "neutral", children }: ToastProps) {
  useEffect(() => {
    if (!open || duration === 0) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  if (!open) return null;
  return (
    <div className="ax-toast" role="status">
      {tone === "success" && (
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "var(--green-500)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          <Icons.check size={12} />
        </span>
      )}
      {children}
    </div>
  );
}
