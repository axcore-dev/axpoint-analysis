import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthContext";
import { DiagnosisProvider } from "@/components/flow/DiagnosisContext";
import { StepBar } from "@/components/flow/StepBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXpoint™ — 우리 회사에 맞는 AI, 자료만 올리면 바로 나와요",
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
            <footer
              style={{
                background: "var(--bg-secondary)",
                borderTop: "1px solid var(--line-default)",
                padding: "28px 24px",
                textAlign: "center",
                color: "var(--grey-500)",
                fontSize: 12,
                lineHeight: 2,
              }}
            >
              <div>AXCORE 에이엑스코어 · AXpoint™</div>
              <div>
                <a
                  href="https://axcore.ai.kr/#5.contact"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--grey-600)", textDecoration: "none" }}
                >
                  문의하기
                </a>
              </div>
            </footer>
          </DiagnosisProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
