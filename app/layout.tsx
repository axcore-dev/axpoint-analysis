import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthContext";
import { DiagnosisProvider } from "@/components/flow/DiagnosisContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXCORE",
  description:
    "자료만 올리면 제조 기업의 AX 조사·분석·진단·설계까지",
};

/**
 * 루트 레이아웃 — 문서 골격과 전역 컨텍스트만 담는다.
 * 사이트 공용 헤더·푸터는 `(site)` 그룹 레이아웃에 있어서 어드민(`/admin`)은 상속하지 않는다.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <DiagnosisProvider>{children}</DiagnosisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
