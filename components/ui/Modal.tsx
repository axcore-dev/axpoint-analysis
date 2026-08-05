"use client";

import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Icons } from "./icons";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  wide?: boolean;
  /** 풀스크린에 가까운 대형 — 칸반 보드처럼 가로로 넓은 콘텐츠용 */
  full?: boolean;
  /** 스크림 클릭으로 닫기 허용 (기본 true) */
  dismissible?: boolean;
  children: ReactNode;
}

/**
 * 센터 모달 — Radix Dialog 기반 (포커스 트랩·스크롤 잠금·ESC 처리 내장).
 * 시각은 기존 .ax-scrim / .ax-modal 문법 그대로 유지한다.
 */
export function Modal({ open, onClose, title, wide, full, dismissible = true, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="ax-scrim" />
        <Dialog.Content
          className={`ax-modal ${wide ? "ax-modal--wide" : ""} ${full ? "ax-modal--full" : ""}`}
          aria-describedby={undefined}
          onEscapeKeyDown={dismissible ? undefined : (e) => e.preventDefault()}
          onPointerDownOutside={dismissible ? undefined : (e) => e.preventDefault()}
          onInteractOutside={dismissible ? undefined : (e) => e.preventDefault()}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: title ? 16 : 0,
            }}
          >
            <Dialog.Title
              style={
                title
                  ? {
                      margin: 0,
                      font: "var(--text-title1)",
                      letterSpacing: "var(--track-heading)",
                      color: "var(--fg-primary)",
                    }
                  : { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }
              }
            >
              {title ?? "팝업"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
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
                  marginLeft: "auto",
                }}
              >
                <Icons.x size={20} />
              </button>
            </Dialog.Close>
          </div>
          {/* 본문 스크롤은 이 안에서만 — 제목·닫기 버튼이 밀려 올라가지 않는다 (작업 요청 v5-2-1) */}
          <div className="ax-modal-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
