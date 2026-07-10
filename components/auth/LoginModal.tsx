"use client";

import { Modal } from "@/components/ui";
import { AuthForm } from "./AuthForm";

/**
 * 로그인 팝업 — 랜딩 검색창 입력 직후 노출 (수정요청v1).
 * 성공 시 검색 내역은 부모 컴포넌트 state로 유지되어 사라지지 않는다.
 */
export function LoginModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="시작하기 전에 로그인해 주세요">
      <AuthForm mode="login" onSuccess={onSuccess} />
    </Modal>
  );
}
