"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Icons, Modal } from "@/components/ui";
import { useAuth } from "@/components/auth/AuthContext";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { STEPS } from "@/components/flow/steps";

/**
 * 더미 데이터 — 분석 기록.
 * 실서비스에서는 분석 기록이 DB에 저장되지만, 데모는 백엔드가 없어 고정 더미값을 사용한다.
 */
const ANALYSIS_HISTORY = [
  {
    id: "h1",
    company: "(주)데모기업",
    date: "2026-07-23",
    level: "Lv.2 데이터화·표준화",
    status: "진단 완료",
  },
  {
    id: "h2",
    company: "씨엠텍",
    date: "2026-07-21",
    level: "Lv.2 데이터화·표준화",
    status: "진단 완료",
  },
  {
    id: "h3",
    company: "(주)승광",
    date: "2026-07-15",
    level: "Lv.1 경영문제 정의",
    status: "진단 완료",
  },
];

type HistoryEntry = (typeof ANALYSIS_HISTORY)[number];

/**
 * 내 정보 (마이페이지, 수정요청v6 — 공통 / v7 확장)
 * 계정 정보 + 분석 기록 구성. 비로그인 시 로그인 안내 가드.
 * v7: 회사명·직책·연락처 행, 내 정보 수정 이동, 분석 기록 재확인 팝업 추가.
 */
export default function MyPage() {
  const { user, hydrated, logout } = useAuth();
  const { completedSteps } = useDiagnosis();
  const router = useRouter();
  /* 재확인 팝업 대상 기록 (null이면 닫힘) */
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  /* 세션 복원 전 — 깜빡임 방지 */
  if (!hydrated) return null;

  /* 가드: 비로그인 */
  if (!user) {
    return (
      <section
        style={{
          padding: "var(--space-20) var(--gutter)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Card radius="2xl" style={{ maxWidth: 520, textAlign: "center" }}>
          <h2
            style={{
              margin: "0 0 10px",
              font: "var(--text-h4)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            내 정보
          </h2>
          <p style={{ margin: "0 0 20px", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
            내 정보는 로그인한 뒤에 확인할 수 있어요.
          </p>
          <Button variant="primary" href="/auth/login">
            로그인
          </Button>
        </Card>
      </section>
    );
  }

  /* 라벨-값 행 (계정 정보) */
  const infoRow = (label: string, value: string) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "10px 0" }}>
      <span
        style={{
          width: 72,
          flex: "none",
          font: "var(--text-label-s)",
          color: "var(--fg-tertiary)",
        }}
      >
        {label}
      </span>
      <span style={{ font: "var(--text-body2)", color: "var(--fg-primary)", wordBreak: "break-all" }}>
        {value}
      </span>
    </div>
  );

  /* 진단 완료 여부 — 로드맵까지 마쳤으면 보고서 열람 가능 */
  const reportReady = completedSteps.includes("roadmap");
  /* 미완료 시 이어서 진행할 첫 단계 경로 */
  const resumePath = STEPS.find((s) => !completedSteps.includes(s.id))?.path ?? "/";

  return (
    <section style={{ padding: "var(--space-16) var(--gutter)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2
          style={{
            margin: "0 0 24px",
            font: "var(--text-h4)",
            letterSpacing: "var(--track-heading)",
            color: "var(--fg-primary)",
          }}
        >
          내 정보
        </h2>

        {/* 계정 정보 */}
        <Card radius="xl" style={{ marginBottom: 16 }}>
          {infoRow("이름", user.name)}
          {infoRow("이메일", user.email)}
          {infoRow("회사명", user.company ?? "—")}
          {infoRow("직책", user.title ?? "—")}
          {infoRow("연락처", user.phone ?? "—")}
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            {/* SPA 이동 — <a> 전체 리로드는 진행 중 진단의 이탈 경고에 막힘 (v7) */}
            <Button variant="primary" size="sm" onClick={() => router.push("/mypage/edit")}>
              내 정보 수정하기
            </Button>
            <Button variant="secondary" size="sm" onClick={logout}>
              로그아웃
            </Button>
          </div>
        </Card>

        {/* 분석 기록 */}
        <Card radius="xl">
          <h3
            style={{
              margin: "0 0 8px",
              font: "var(--text-label-l)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            분석 기록
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {ANALYSIS_HISTORY.map((h, i) => (
              <li
                key={h.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "13px 0",
                  borderBottom:
                    i < ANALYSIS_HISTORY.length - 1 ? "1px solid var(--line-default)" : "none",
                }}
              >
                <span
                  style={{
                    font: "var(--text-label-m)",
                    color: "var(--fg-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.company}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    color: "var(--fg-tertiary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.date}
                </span>
                <span
                  style={{
                    font: "var(--text-caption)",
                    color: "var(--fg-secondary)",
                    marginLeft: "auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.level}
                </span>
                <span
                  style={{
                    font: "var(--text-caption)",
                    color: "var(--fg-success)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h.status}
                </span>
                {/* 기록 재확인 (v7) — 팝업으로 요약 표시 */}
                <button
                  type="button"
                  aria-label="기록 재확인"
                  onClick={() => setSelected(h)}
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--fg-tertiary)",
                    padding: 4,
                    margin: "-4px -4px -4px 0",
                    borderRadius: "var(--radius-s)",
                    display: "inline-flex",
                    flex: "none",
                  }}
                >
                  <Icons.chevronRight size={18} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* 기록 재확인 팝업 — 요약 + 완료 여부에 따른 이동 분기 */}
      <Modal open={selected !== null} onClose={() => setSelected(null)} title="분석 기록">
        {selected && (
          <div>
            {[
              { label: "기업명", value: selected.company },
              { label: "일시", value: selected.date, mono: true },
              { label: "레벨", value: selected.level },
              { label: "상태", value: selected.status, success: true },
            ].map((row) => (
              <div
                key={row.label}
                style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "8px 0" }}
              >
                <span
                  style={{
                    width: 56,
                    flex: "none",
                    font: "var(--text-label-s)",
                    color: "var(--fg-tertiary)",
                  }}
                >
                  {row.label}
                </span>
                <span
                  style={
                    row.mono
                      ? { fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-primary)" }
                      : {
                          font: "var(--text-body2)",
                          color: row.success ? "var(--fg-success)" : "var(--fg-primary)",
                        }
                  }
                >
                  {row.value}
                </span>
              </div>
            ))}

            <div style={{ marginTop: 18 }}>
              {reportReady ? (
                <Button variant="primary" full onClick={() => router.push("/report")}>
                  보고서 보기
                </Button>
              ) : (
                <>
                  {/* 안내 가드 — 완료 전 기록은 임시 저장된 진행 단계로 이동 */}
                  <p
                    style={{
                      margin: "0 0 10px",
                      font: "var(--text-caption)",
                      color: "var(--fg-secondary)",
                    }}
                  >
                    아직 완료되지 않은 진단이에요. 진행 중이던 단계로 이동해요.
                  </p>
                  <Button variant="primary" full onClick={() => router.push(resumePath)}>
                    이어서 진행하기
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
