import { StepBar } from "@/components/flow/StepBar";
import { SiteFooter } from "@/components/flow/SiteFooter";

/**
 * 사이트 레이아웃 — 진단 플로우·인증·내 정보 화면 공용 헤더·푸터.
 * 어드민(`/admin`)은 이 그룹 밖이라 전용 셸만 쓴다. URL은 그룹 이름에 영향받지 않는다.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StepBar />
      <main style={{ minHeight: "calc(100vh - 56px)" }}>{children}</main>
      {/* 첫 페이지(자료 올리기)·마지막 페이지(보고서)에만 노출 (수정요청v3) */}
      <SiteFooter />
    </>
  );
}
