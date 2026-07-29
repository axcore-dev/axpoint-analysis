"use client";

import { Modal } from "@/components/ui";

/** API 연동 전 기능 클릭 시 안내 팝업 — 어드민 공용 */
export function ManagedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="개별 관리 중">
      <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
        이 데이터는 현재 개별 관리되고 있어요.
        <br />
        API 연동 후 어드민에서 바로 관리할 수 있어요.
      </p>
    </Modal>
  );
}
