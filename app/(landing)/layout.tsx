import { StepBar } from "@/components/flow/StepBar";
import { SiteFooter } from "@/components/flow/SiteFooter";

/**
 * 첫 화면 레이아웃 — 진단을 아직 시작하지 않은 화면이라 상단 진단 스텝을 노출하지 않는다 (수정요청v9).
 * 로고·계정 영역은 그대로 두고, 스텝 표시 여부만 레이아웃이 정한다.
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StepBar showSteps={false} />
      <main style={{ minHeight: "calc(100vh - 56px)" }}>{children}</main>
      <SiteFooter />
    </>
  );
}
