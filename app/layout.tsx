import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthContext";
import { DiagnosisProvider } from "@/components/flow/DiagnosisContext";
import { StepBar } from "@/components/flow/StepBar";
import { SiteFooter } from "@/components/flow/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXpoint™",
  description:
    "자료만 올리면 제조 기업의 AX 단계·개선 과제·로드맵·예상 효과까지 — 즉시, 무료로, 근거와 함께 확인할 수 있어요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <DiagnosisProvider>
            <StepBar />
            <main style={{ minHeight: "calc(100vh - 56px)" }}>{children}</main>
            {/* 첫 페이지(자료 올리기)·마지막 페이지(보고서)에만 노출 (수정요청v3) */}
            <SiteFooter />
          </DiagnosisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
