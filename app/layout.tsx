import type { Metadata } from "next";
import { DiagnosisProvider } from "@/components/flow/DiagnosisContext";
import { GlobalNav } from "@/components/flow/GlobalNav";
import { StepBar } from "@/components/flow/StepBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXpoint™ — 우리 공장에 맞는 AI는?",
  description:
    "자료만 올리면, 우리 공장의 AX 단계·개선 과제·로드맵·예상 효과까지 — 즉시, 무료로, 근거와 함께.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <DiagnosisProvider>
          <GlobalNav />
          <StepBar />
          <main style={{ minHeight: "calc(100vh - 96px)" }}>{children}</main>
          <footer
            style={{
              background: "var(--surface-mist)",
              borderTop: "1px solid var(--divider-soft)",
              padding: "32px 24px",
              textAlign: "center",
              color: "var(--slate-400)",
              fontSize: "var(--type-fine-size)",
              lineHeight: 2.1,
            }}
          >
            <div>AXCORE 에이엑스코어 · AXpoint™ 리뉴얼 데모 — 모든 데이터는 시연용 더미입니다</div>
            <div>
              <a
                href="https://axcore.ai.kr/#5.contact"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--slate-500)", textDecoration: "none" }}
              >
                구축 상담 문의
              </a>
            </div>
          </footer>
        </DiagnosisProvider>
      </body>
    </html>
  );
}
