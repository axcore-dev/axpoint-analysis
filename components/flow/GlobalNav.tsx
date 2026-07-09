import Image from "next/image";
import Link from "next/link";

/** 글로벌 네브 — 블랙 44px 바 (디자인 시스템 레이아웃 규칙) */
export function GlobalNav() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 44,
        background: "var(--surface-nav)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
      }}
    >
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <Image
          src="/assets/axcore-mono-white.png"
          alt="AXCORE"
          width={92}
          height={18}
          style={{ height: 18, width: "auto" }}
          priority
        />
        <span
          style={{
            color: "var(--on-dark-muted)",
            fontSize: "var(--type-nav-size)",
            letterSpacing: "-0.004em",
          }}
        >
          AXpoint™ · 중소 제조 AX 진단
        </span>
      </Link>
      <a
        href="https://axcore.ai.kr/#5.contact"
        target="_blank"
        rel="noreferrer"
        style={{
          color: "var(--on-dark-muted)",
          fontSize: "var(--type-nav-size)",
          textDecoration: "none",
        }}
      >
        문의하기
      </a>
    </header>
  );
}
