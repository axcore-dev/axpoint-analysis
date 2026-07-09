"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { useDiagnosis } from "./DiagnosisContext";
import { STEPS } from "./steps";

/**
 * 진행 스텝바 (F-CMN-04) — 6단계 현 위치·완료 체크.
 * 프로스트 서브네브 문법(52px, mist 82% + blur) — 디자인 시스템 레이아웃 규칙.
 * 완료했거나 인접 도달 가능한 단계만 링크 활성.
 */
export function StepBar() {
  const pathname = usePathname();
  const { completedSteps } = useDiagnosis();

  const currentIdx = STEPS.findIndex((s) =>
    s.path === "/" ? pathname === "/" : pathname.startsWith(s.path),
  );

  return (
    <nav
      aria-label="진단 진행 단계"
      style={{
        position: "sticky",
        top: 44,
        zIndex: 40,
        height: 52,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        background: "rgba(245,246,248,0.82)",
        backdropFilter: "var(--blur-frost)",
        WebkitBackdropFilter: "var(--blur-frost)",
        borderBottom: "1px solid var(--divider-soft)",
      }}
    >
      {STEPS.map((step, i) => {
        const done = completedSteps.includes(step.id);
        const current = i === currentIdx;
        const reachable = done || i <= STEPS.findIndex((s) => !completedSteps.includes(s.id));
        const inner = (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              borderRadius: "var(--radius-pill)",
              fontSize: 13,
              fontWeight: current ? 600 : 400,
              letterSpacing: "-0.004em",
              color: current
                ? "var(--ax-blue)"
                : done
                  ? "var(--slate-700)"
                  : "var(--slate-400)",
              background: current ? "var(--ax-blue-wash)" : "transparent",
              whiteSpace: "nowrap",
            }}
          >
            {done && !current ? (
              <Icons.check size={13} />
            ) : (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  opacity: 0.8,
                }}
              >
                {i + 1}
              </span>
            )}
            {step.label}
          </span>
        );
        return (
          <span key={step.id} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && (
              <span aria-hidden style={{ color: "var(--slate-300)", margin: "0 2px", fontSize: 11 }}>
                /
              </span>
            )}
            {reachable ? (
              <Link href={step.path} style={{ textDecoration: "none" }} aria-current={current ? "step" : undefined}>
                {inner}
              </Link>
            ) : (
              inner
            )}
          </span>
        );
      })}
    </nav>
  );
}
