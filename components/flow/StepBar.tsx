"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { Icons } from "@/components/ui/icons";
import { useAuth } from "@/components/auth/AuthContext";
import { ProfileMenu } from "@/components/auth/ProfileMenu";
import { useDiagnosis } from "./DiagnosisContext";
import { STEPS } from "./steps";
import logo from "@/public/assets/axcore-color.png";

/**
 * 상단 스텝 헤더 v2 — 기존 헤더바를 대체한다 (수정요청v1).
 * 플랫폼 작동 순서 1~6을 화살표(→)로 연결해 표시. 구분자 '/' 사용 금지.
 * 완료 = 체크, 현재 = 블루 강조, 미도달 = 회색.
 * 우측 상단: 로그인/회원가입 버튼 또는 프로필 드롭다운 (수정요청v6 — 공통).
 * 좌측: AXCORE 로고(홈 이동, 수정요청v7). 내 정보(/mypage)에서는 스텝 nav 미노출 (v7).
 */
export function StepBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { completedSteps } = useDiagnosis();
  const { user, hydrated } = useAuth();

  const currentIdx = STEPS.findIndex((s) =>
    s.path === "/" ? pathname === "/" : pathname.startsWith(s.path),
  );
  const firstIncomplete = STEPS.findIndex((s) => !completedSteps.includes(s.id));
  /* 내 정보 화면 — 진단 플로우 밖이므로 스텝 표시를 감춘다 (수정요청v7) */
  const hideSteps = pathname.startsWith("/mypage");

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
      {/* 좌측 로고 — 홈 이동 (수정요청v7) */}
      <Link
        href="/"
        aria-label="AXCORE 홈"
        style={{
          position: "absolute",
          left: "max(16px, 2vw)",
          top: 0,
          height: "100%",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Image src={logo} alt="AXCORE" style={{ height: 24, width: "auto" }} priority />
      </Link>

      {!hideSteps && (
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
                /* v7: 전체 +2px 확대에 맞춤 */
                fontSize: 17,
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
      )}

      {/* 우측 상단 인증 영역 — 가운데 스텝 nav 정렬에 영향 없도록 absolute (수정요청v6) */}
      <div
        style={{
          position: "absolute",
          right: "max(16px, 2vw)",
          top: 0,
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {/* hydrated 전에는 렌더하지 않아 로그인 상태 깜빡임 방지.
            SPA 이동 — <a> 전체 리로드는 진행 중 상태를 지우고 이탈 경고에 막힘 (v7) */}
        {hydrated &&
          (user ? (
            <ProfileMenu />
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.push("/auth/login")}>
                로그인
              </Button>
              <Button variant="primary" size="sm" onClick={() => router.push("/auth/signup")}>
                회원가입
              </Button>
            </>
          ))}
      </div>
    </header>
  );
}
