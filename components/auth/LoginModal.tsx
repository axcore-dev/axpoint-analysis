"use client";

import { Modal } from "@/components/ui";
import { AuthForm } from "./AuthForm";

/**
 * 로그인 팝업 — '진단 결과 보기'를 누른 시점에 노출한다 (작업요청 v6-4).
 * 그때까지의 진단은 익명 세션에 담겨 있고, 로그인·가입에 성공하면 서버가 그 계정으로 옮긴다.
 * 화면 state도 부모에 남아 있어 그대로 이어진다.
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
