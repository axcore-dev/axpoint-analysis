"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { useDiagnosis } from "./DiagnosisContext";
import { STEPS } from "./steps";

/**
 * 상단 스텝 헤더 v2 — 기존 헤더바를 대체한다 (수정요청v1).
 * 플랫폼 작동 순서 1~6을 화살표(→)로 연결해 표시. 구분자 '/' 사용 금지.
 * 완료 = 체크, 현재 = 블루 강조, 미도달 = 회색.
 */
export function StepBar() {
  const pathname = usePathname();
  const { completedSteps } = useDiagnosis();

  const currentIdx = STEPS.findIndex((s) =>
    s.path === "/" ? pathname === "/" : pathname.startsWith(s.path),
  );
  const firstIncomplete = STEPS.findIndex((s) => !completedSteps.includes(s.id));

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        background: "rgba(255,255,255,0.86)",
        backdropFilter: "saturate(180%) blur(16px)",
        WebkitBackdropFilter: "saturate(180%) blur(16px)",
        borderBottom: "1px solid var(--line-default)",
      }}
    >
      <nav aria-label="진단 진행 단계" style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {STEPS.map((step, i) => {
          const done = completedSteps.includes(step.id);
          const current = i === currentIdx;
          const reachable = done || (firstIncomplete !== -1 && i <= firstIncomplete);
          const inner = (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 12px",
                borderRadius: "var(--radius-full)",
                fontSize: 15,
                fontWeight: current ? 700 : 500,
                letterSpacing: "var(--track-body)",
                color: current
                  ? "var(--fg-brand)"
                  : done
                    ? "var(--fg-secondary)"
                    : "var(--fg-quaternary)",
                /* 선택 단계 배경 컬러 없음 (수정요청v2) — 강조는 텍스트·번호 배지로만 */
                background: "transparent",
                whiteSpace: "nowrap",
                transition: "color var(--dur-base) var(--ease)",
              }}
            >
              <span
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                  fontSize: 12.5,
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                  background: current
                    ? "var(--bg-brand)"
                    : done
                      ? "var(--bg-success-weak)"
                      : "var(--bg-tertiary)",
                  color: current
                    ? "var(--fg-inverse)"
                    : done
                      ? "var(--fg-success)"
                      : "var(--fg-quaternary)",
                }}
              >
                {done && !current ? <Icons.check size={11} /> : i + 1}
              </span>
              {step.label}
            </span>
          );
          return (
            <span key={step.id} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              {i > 0 && (
                <span
                  aria-hidden
                  style={{
                    color: i <= currentIdx ? "var(--grey-400)" : "var(--grey-300)",
                    display: "inline-flex",
                  }}
                >
                  <Icons.chevronRight size={13} />
                </span>
              )}
              {reachable ? (
                <Link
                  href={step.path}
                  style={{ textDecoration: "none" }}
                  aria-current={current ? "step" : undefined}
                >
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </span>
          );
        })}
      </nav>
    </header>
  );
}
