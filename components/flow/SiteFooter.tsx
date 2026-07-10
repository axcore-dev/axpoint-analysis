"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import logo from "@/public/assets/axcore-mono-white.png";

/**
 * 사이트 푸터 — 첫 페이지(자료 올리기 "/")와 마지막 페이지(보고서 "/report")에만 노출.
 * 레이아웃 참고: docs/참고자료/footer레이아웃만 참고.png
 * (로고 블록 + 4컬럼 정보 + 하단 카피라이트 행 — 컬러는 디자인 시스템 grey-900 사용)
 */

const COLUMNS: { title: string; lines: string[] }[] = [
  { title: "(주)에이엑스코어", lines: ["대표 석윤정", "사업자 등록번호 329-86-03751"] },
  {
    title: "Head Office",
    lines: ["전남광주통합특별시 북구 첨단연신로 45", "첨단비즈타워 B동 1504호"],
  },
  { title: "R&D Center", lines: ["경기도 광명시 양지로 21 유플래닛 T타워동 14층"] },
  { title: "E-mail", lines: ["admin@axcore.ai.kr"] },
];

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname !== "/" && pathname !== "/report") return null;

  return (
    <footer style={{ background: "var(--grey-900)", color: "var(--white)" }}>
      <div
        style={{
          maxWidth: "var(--container-wide)",
          margin: "0 auto",
          padding: "48px var(--gutter) 0",
        }}
      >
        {/* 로고 블록 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Image src={logo} alt="AXCORE" height={30} style={{ width: "auto", height: 30 }} />
          <span style={{ font: "var(--text-label-m)", letterSpacing: "0.35em" }}>
            (주)에이엑스코어
          </span>
        </div>

        {/* 4컬럼 정보 */}
        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "24px 32px",
          }}
        >
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <div style={{ font: "var(--text-label-s)", color: "var(--white)" }}>{col.title}</div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                {col.lines.map((line) =>
                  col.title === "E-mail" ? (
                    <a
                      key={line}
                      href={`mailto:${line}`}
                      style={{
                        font: "var(--text-body3)",
                        color: "var(--grey-300)",
                        textDecoration: "none",
                      }}
                    >
                      {line}
                    </a>
                  ) : (
                    <span key={line} style={{ font: "var(--text-body3)", color: "var(--grey-300)" }}>
                      {line}
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 하단 행 */}
        <div
          style={{
            marginTop: 40,
            padding: "18px 0 24px",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>
            © 2026 AXCORE. All rights reserved.
          </span>
          <span style={{ font: "var(--text-caption)", color: "var(--grey-500)" }}>
            개인정보처리방침
          </span>
        </div>
      </div>
    </footer>
  );
}
