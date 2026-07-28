"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { RouteLoading } from "@/components/flow/RouteLoading";
import { api } from "@/lib/api";
import { Button, Card, Eyebrow, Icons, Input, Modal } from "@/components/ui";

/**
 * S5 보고서(전환) — 백엔드 실연동 + 원본 요약·티저 레이아웃 복원.
 * 요약 카드(단계·점수·과제·기간·자부담) → CTA(보고서 받기 리드 수집 / 문의하기)
 * → 체험 티저(라이트 카드 + 미니 SVG 대시보드, axcore.it.kr 새 탭).
 * 업종 대비 포지션·ROI 드릴다운은 벤치마크·산출 가정 확정 후,
 * PDF 다운로드는 보고서 구성 확정 후 재도입한다.
 */

const CONTACT_URL = "https://axcore.ai.kr/#5.contact";
const WORKSPACE_URL = "https://axcore.it.kr";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const mono = { fontFamily: "var(--font-mono)", letterSpacing: "0" } as const;

type Summary = {
  level: number;
  levelName: string;
  totalScore: string;
  taskCount: number;
  totalMonths: number;
  costMin: number;
  costMax: number;
};

/* ---- 요약 카드 공용 문법 (원본) ---- */
function SummaryLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ font: "var(--text-label-s)", color: "var(--fg-tertiary)" }}>{children}</div>
  );
}

function SummaryValue({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 10,
        fontSize: 25,
        fontWeight: 700,
        letterSpacing: "var(--track-heading)",
        lineHeight: 1.2,
        color: "var(--fg-primary)",
      }}
    >
      {children}
    </div>
  );
}

/* ---- 체험 티저용 미니 SVG 대시보드 (라이트 톤 — 다크 타일 금지) ---- */
function WorkspaceMockup() {
  const bars = [34, 52, 41, 66, 58, 74, 62];
  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--line-default)",
        borderRadius: "var(--radius-xl)",
        padding: 16,
      }}
    >
      <svg
        width="100%"
        viewBox="0 0 360 210"
        role="img"
        aria-label="AXpoint 워크스페이스 현황판 미리보기"
        style={{ display: "block", maxWidth: 400, margin: "0 auto" }}
      >
        {/* 상단 스탯 타일 3개 — 흰 카드 + 헤어라인 */}
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${i * 122}, 0)`}>
            <rect width="116" height="56" rx="10" fill="#FFFFFF" stroke="#E5E8EB" />
            <rect x="12" y="12" width="42" height="6" rx="3" fill="#E5E8EB" />
            <rect x="12" y="30" width={64 - i * 10} height="12" rx="4" fill="#0A50FF" opacity={1 - i * 0.28} />
          </g>
        ))}
        {/* 좌측 바 차트 패널 */}
        <g transform="translate(0, 68)">
          <rect width="238" height="142" rx="10" fill="#FFFFFF" stroke="#E5E8EB" />
          <rect x="14" y="14" width="72" height="6" rx="3" fill="#E5E8EB" />
          {bars.map((h, i) => (
            <rect
              key={i}
              x={16 + i * 31}
              y={124 - h}
              width="18"
              height={h}
              rx="3"
              fill={i === 5 ? "#0A50FF" : "#D1D6DB"}
            />
          ))}
        </g>
        {/* 우측 게이지 패널 */}
        <g transform="translate(244, 68)">
          <rect width="116" height="142" rx="10" fill="#FFFFFF" stroke="#E5E8EB" />
          <rect x="14" y="14" width="52" height="6" rx="3" fill="#E5E8EB" />
          <path
            d="M 24 100 A 34 34 0 1 1 92 100"
            fill="none"
            stroke="#E5E8EB"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M 24 100 A 34 34 0 0 1 58 66"
            fill="none"
            stroke="#0A50FF"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <rect x="44" y="112" width="28" height="10" rx="3" fill="#D1D6DB" />
        </g>
      </svg>
    </div>
  );
}

export default function ReportPage() {
  const router = useRouter();
  const { companyInput, assessmentId, completedSteps, completeStep } = useDiagnosis();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!assessmentId) return;
    Promise.all([
      api<{ result: { level: number; levelName: string; totalScore: string } | null }>(
        `/api/assessments/${assessmentId}/result`,
      ),
      api<{ stages: { taskNos: number[] }[]; totalMonths: number; costMin: number; costMax: number }>(
        `/api/assessments/${assessmentId}/roadmap`,
      ),
    ])
      .then(([r, rm]) => {
        if (!r.result) throw new Error("진단 결과가 아직 없어요.");
        setSummary({
          level: r.result.level,
          levelName: r.result.levelName,
          totalScore: r.result.totalScore,
          taskCount: rm.stages.reduce((s, st) => s + st.taskNos.length, 0),
          totalMonths: rm.totalMonths,
          costMin: rm.costMin,
          costMax: rm.costMax,
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요."));
  }, [assessmentId]);

  /* 진입 가드 — 로드맵 미완료 (기존 정책 유지) */
  if (!assessmentId || !completedSteps.includes("roadmap")) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-[var(--gutter)]">
        <Card radius="2xl" style={{ maxWidth: 480, width: "100%", padding: 36, textAlign: "center" }}>
          <p style={{ font: "var(--text-h3)", color: "var(--fg-primary)", margin: 0 }}>
            로드맵을 먼저 확인해 주세요
          </p>
          <div style={{ marginTop: 22 }}>
            <Button variant="primary" size="lg" full onClick={() => router.push("/roadmap")}>
              로드맵으로 가기
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  if (error)
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-[var(--gutter)]">
        <p style={{ font: "var(--text-body1)", color: "var(--fg-tertiary)" }}>{error}</p>
      </div>
    );
  if (!summary) return <RouteLoading messages={["보고서를 준비하고 있어요"]} />;

  const companyName = companyInput.trim();
  const canSend = email.includes("@") && email.trim().length >= 3;

  const submitLead = async () => {
    if (!canSend || sending) return;
    setSending(true);
    setEmailError(null);
    try {
      await api("/api/leads", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), context: "pdf", assessmentId }),
      });
      setSentTo(email.trim());
      completeStep("report");
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="ax-step-enter">
      {/* ══ 요약 — 흰 캔버스 단일 흐름 (원본 레이아웃, 서버 응답 기준) ══ */}
      <section style={{ padding: "var(--space-16) var(--gutter) 0" }}>
        <div style={{ maxWidth: "var(--container-content)", margin: "0 auto" }}>
          <Eyebrow>STEP 6 · 보고서</Eyebrow>
          <h1
            style={{
              margin: "14px 0 0",
              font: "var(--text-h1)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            {companyName} 진단 결과 요약
          </h1>
          <p style={{ margin: "10px 0 0", font: "var(--text-body2)", color: "var(--fg-tertiary)" }}>
            담으신 과제 <span style={mono}>{summary.taskCount}</span>건 기준
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "var(--space-4)",
              marginTop: "var(--space-8)",
            }}
          >
            {/* 현재 단계 — Lv 라벨만, 브랜드 컬러 */}
            <Card>
              <SummaryLabel>현재 단계</SummaryLabel>
              <SummaryValue>
                <span style={{ color: "var(--fg-brand)" }}>{`Lv.${summary.level} ${summary.levelName}`}</span>
              </SummaryValue>
            </Card>

            <Card>
              <SummaryLabel>종합 점수</SummaryLabel>
              <SummaryValue>
                <span style={mono}>{summary.totalScore}</span>점
              </SummaryValue>
            </Card>

            <Card>
              <SummaryLabel>담은 과제</SummaryLabel>
              <SummaryValue>
                <span style={mono}>{summary.taskCount}</span>개
              </SummaryValue>
            </Card>

            <Card>
              <SummaryLabel>총 기간</SummaryLabel>
              <SummaryValue>
                약 <span style={mono}>{summary.totalMonths}</span>개월
              </SummaryValue>
            </Card>

            <Card>
              <SummaryLabel>자부담</SummaryLabel>
              <SummaryValue>
                <span style={mono}>
                  {fmt(summary.costMin)}~{fmt(summary.costMax)}
                </span>
                만원
              </SummaryValue>
            </Card>
          </div>

          {/* ══ CTA — 버튼 2개만 (카드·설명문 없음) ══════════════ */}
          <div
            style={{
              marginTop: "var(--space-12)",
              display: "flex",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <Button variant="secondary" size="xl" onClick={() => setModalOpen(true)}>
              보고서 받기
              <Icons.arrow size={18} />
            </Button>
            <Button variant="primary" size="xl" href={CONTACT_URL} target="_blank" rel="noreferrer">
              문의하기
              <Icons.arrow size={18} />
            </Button>
          </div>
        </div>
      </section>

      {/* ══ 체험 티저 — 라이트 카드 + 미니 대시보드 ══ */}
      <section style={{ padding: "var(--space-16) var(--gutter) var(--space-20)" }}>
        <Card radius="2xl" style={{ maxWidth: "var(--container-content)", margin: "0 auto", padding: "var(--space-8)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "var(--space-8)",
              alignItems: "center",
            }}
          >
            <div>
              <Eyebrow>AI기반 통합 워크스페이스</Eyebrow>
              <h2
                style={{
                  margin: "14px 0 0",
                  font: "var(--text-h2)",
                  letterSpacing: "var(--track-heading)",
                  color: "var(--fg-primary)",
                }}
              >
                생산·재고·품질 데이터를 한 곳에서
              </h2>
              <p style={{ margin: "10px 0 0", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
                분절된 제조 데이터를 하나로 연결하고, .<br></br> AI가 실시간으로 판단·최적화하는 지능형 자율제조 통합운영 솔루션

              </p>
              <div style={{ marginTop: 20 }}>
                <Button variant="secondary" size="lg" href={WORKSPACE_URL} target="_blank" rel="noreferrer">
                  체험하기
                  <Icons.arrow size={17} />
                </Button>
              </div>
            </div>
            <WorkspaceMockup />
          </div>
        </Card>
      </section>

      {/* ══ 보고서 받기 모달 — 이메일 수집(리드) ══ */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSentTo(null);
        }}
        title="보고서 받기"
      >
        {sentTo ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <p style={{ margin: 0, font: "var(--text-body-m, var(--text-body2))", color: "var(--fg-primary)" }}>
              신청이 접수됐어요.
            </p>
            <p style={{ margin: "8px 0 18px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
              보고서가 준비되면 {sentTo}로 보내드려요.
            </p>
            <Button variant="secondary" full onClick={() => window.open(CONTACT_URL, "_blank")}>
              전문가와 결과 리뷰하기
            </Button>
          </div>
        ) : (
          <div>
            <p style={{ margin: "0 0 12px", font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
              보고서를 받을 이메일을 입력해 주세요.
            </p>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소"
              aria-label="보고서 받을 이메일"
            />
            {emailError && (
              <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-danger, #d4380d)" }}>
                {emailError}
              </p>
            )}
            {!canSend && email.length > 0 && (
              <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-quaternary)" }}>
                이메일 형식을 확인해 주세요
              </p>
            )}
            <div style={{ marginTop: 16 }}>
              <Button variant="primary" full disabled={!canSend || sending} onClick={submitLead}>
                {sending ? "접수하고 있어요" : "받기"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
