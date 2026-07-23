import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthContext";
import { DiagnosisProvider } from "@/components/flow/DiagnosisContext";
import { StepBar } from "@/components/flow/StepBar";
import { SiteFooter } from "@/components/flow/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXCORE",
  description:
    "자료만 올리면 제조 기업의 AX 조사·분석·진단·설계까지",
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
