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
      <head>
        {/* 본문 서체는 CSS를 다 읽어야 요청이 나간다 — 2MB짜리라 그만큼 늦게 뜬다.
            문서와 함께 내려받도록 미리 알린다. crossOrigin은 폰트 요청이 CORS 방식이라 필수 */}
        <link
          rel="preload"
          href="/fonts/PretendardVariable.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <AuthProvider>
          <DiagnosisProvider>{children}</DiagnosisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
