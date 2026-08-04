"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { RouteLoading } from "@/components/flow/RouteLoading";
import {
  ReportDocument,
  type ReportRoi,
  type ReportSummary,
} from "@/components/report/ReportDocument";
import { api } from "@/lib/api";
import { generateReportPdf, reportFileName } from "@/lib/pdf";
import { Button, Card, Eyebrow, Icons, Input, Loader, Modal } from "@/components/ui";

/**
 * S5 보고서(전환) — 백엔드 실연동 + 원본 요약·티저 레이아웃 복원.
 * 요약 4카드(현재 단계·포지션·예상 연 효과·투자 회수) + 산출 내역 드릴다운
 * → CTA(보고서 받기 / 문의하기) → 체험 티저(axcore.it.kr 새 탭).
 * 포지션은 벤치마크, 연 효과·회수는 과제 연 절감액(roi_assumption)이 있을 때만 값 표시.
 *
 * 보고서 받기: 숨김 렌더한 ReportDocument를 lib/pdf로 캡처해 PDF Blob 생성 →
 * ① 즉시 브라우저 다운로드 ② POST /api/leads/report(multipart)로 업로드해
 * 입력한 이메일로 첨부 발송. 발송 실패해도 다운로드는 이미 된 상태로 안내한다.
 */

const CONTACT_URL = "https://axcore.ai.kr/#5.contact";
const WORKSPACE_URL = "https://axcore.it.kr";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const mono = { fontFamily: "var(--font-mono)", letterSpacing: "0" } as const;

type Roi = ReportRoi;
type Summary = ReportSummary;

type Drill = "roi" | "payback" | null;

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

function SummaryCaption({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 8, font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
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
  const [drill, setDrill] = useState<Drill>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  // 제출 결과 — ok: 메일 발송까지 성공 / !ok: 다운로드는 됐지만 발송 실패
  const [sent, setSent] = useState<{ email: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!assessmentId) return;
    Promise.all([
      api<{
        result: {
          level: number;
          levelName: string;
          totalScore: string;
          createdAt?: string;
        } | null;
        benchmarks?: { axisCode: string | null; avgScore: string }[];
      }>(`/api/assessments/${assessmentId}/result`),
      api<{
        stages: { taskNos: number[] }[];
        totalMonths: number;
        costMin: number;
        costMax: number;
        roi?: Roi;
      }>(`/api/assessments/${assessmentId}/roadmap`),
    ])
      .then(([r, rm]) => {
        if (!r.result) throw new Error("진단 결과가 아직 없어요.");
        const overallAvg = r.benchmarks?.find((b) => b.axisCode === null);
        setSummary({
          level: r.result.level,
          levelName: r.result.levelName,
          totalScore: r.result.totalScore,
          diagnosedAt: r.result.createdAt?.slice(0, 10) ?? null,
          industryAvg: overallAvg ? Number(overallAvg.avgScore) : null,
          taskCount: rm.stages.reduce((s, st) => s + st.taskNos.length, 0),
          totalMonths: rm.totalMonths,
          costMin: rm.costMin,
          costMax: rm.costMax,
          roi: rm.roi ?? null,
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

  /* 업종 대비 포지션 — 벤치마크 종합 평균 대비 차이 (소수 1자리) */
  const scoreNum = Number(summary.totalScore);
  const industryDiff = summary.industryAvg !== null ? scoreNum - summary.industryAvg : null;
  const diffLabel =
    industryDiff !== null
      ? `${industryDiff >= 0 ? "+" : "-"}${Math.abs(industryDiff).toFixed(1)}점`
      : null;

  const roi = summary.roi;
  const monthlySaving =
    roi && roi.totalAnnualSaving > 0 ? Math.round(roi.totalAnnualSaving / 12) : 0;

  /* 보고서 제출 — PDF 생성 → 즉시 다운로드 → 서버 업로드(이메일 첨부 발송) */
  const submitReport = async () => {
    if (!canSend || sending || !reportRef.current) return;
    setSending(true);
    setEmailError(null);

    let blob: Blob;
    const fileName = reportFileName(companyName || "보고서");
    try {
      blob = await generateReportPdf(reportRef.current);
      // 생성 즉시 브라우저 다운로드 — 발송이 실패해도 파일은 남는다
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setEmailError("보고서 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setSending(false);
      return;
    }

    try {
      const form = new FormData();
      form.append("email", email.trim());
      if (assessmentId) form.append("assessmentId", assessmentId);
      form.append("pdf", blob, fileName);
      await api("/api/leads/report", { method: "POST", body: form });
      setSent({ email: email.trim(), ok: true });
    } catch {
      setSent({ email: email.trim(), ok: false });
    } finally {
      completeStep("report");
      setSending(false);
    }
  };

  return (
    <div className="ax-step-enter">
      {/* 드릴다운 카드 호버 시 '산출 내역 보기' 브랜드 컬러 */}
      <style>{`
        .axp-drill:hover .axp-drill-link { color: var(--fg-brand); }
        .axp-drill-link { transition: color var(--dur-fast) var(--ease); }
      `}</style>
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
            {summary.diagnosedAt && (
              <>
                진단일 <span style={mono}>{summary.diagnosedAt}</span> ·{" "}
              </>
            )}
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
            {/* ① 현재 단계 — Lv 라벨만, 브랜드 컬러 */}
            <Card>
              <SummaryLabel>현재 단계</SummaryLabel>
              <SummaryValue>
                <span style={{ color: "var(--fg-brand)" }}>{`Lv.${summary.level} ${summary.levelName}`}</span>
              </SummaryValue>
            </Card>

            {/* ② 포지션 — 업종 평균 대비 (벤치마크 없으면 종합 점수로 대체) */}
            {diffLabel !== null && summary.industryAvg !== null ? (
              <Card>
                <SummaryLabel>포지션</SummaryLabel>
                <SummaryValue>
                  <span style={{ ...mono, color: "var(--fg-brand)" }}>{diffLabel}</span>{" "}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-tertiary)" }}>
                    (업종 평균보다)
                  </span>
                </SummaryValue>
                <SummaryCaption>
                  업종 표본 평균 <span style={mono}>{Math.round(summary.industryAvg)}</span>점 대비
                </SummaryCaption>
              </Card>
            ) : (
              <Card>
                <SummaryLabel>종합 점수</SummaryLabel>
                <SummaryValue>
                  <span style={{ ...mono, color: "var(--fg-brand)" }}>{summary.totalScore}점</span>
                </SummaryValue>
              </Card>
            )}

            {/* ③ 예상 연 효과 — 클릭 드릴다운 */}
            {roi && (
              <Card
                className="axp-drill"
                interactive
                role="button"
                tabIndex={0}
                aria-expanded={drill === "roi"}
                onClick={() => setDrill((d) => (d === "roi" ? null : "roi"))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDrill((d) => (d === "roi" ? null : "roi"));
                  }
                }}
                style={{
                  cursor: "pointer",
                  borderColor: drill === "roi" ? "var(--line-brand)" : "var(--line-default)",
                }}
              >
                <SummaryLabel>예상 연 효과</SummaryLabel>
                <SummaryValue>
                  <span style={{ ...mono, color: "var(--fg-brand)" }}>
                    {roi.totalAnnualSaving > 0 ? `${fmt(roi.totalAnnualSaving)}만원` : "—"}
                  </span>
                </SummaryValue>
                <div
                  className="axp-drill-link"
                  style={{
                    marginTop: 10,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    font: "var(--text-label-s)",
                    color: "var(--fg-tertiary)",
                  }}
                >
                  산출 내역 보기
                  <span style={{ display: "inline-flex" }}>
                    <Icons.arrow size={14} />
                  </span>
                </div>
              </Card>
            )}

            {/* ④ 투자 회수 — 클릭 드릴다운 */}
            {roi && (
              <Card
                className="axp-drill"
                interactive
                role="button"
                tabIndex={0}
                aria-expanded={drill === "payback"}
                onClick={() => setDrill((d) => (d === "payback" ? null : "payback"))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDrill((d) => (d === "payback" ? null : "payback"));
                  }
                }}
                style={{
                  cursor: "pointer",
                  borderColor: drill === "payback" ? "var(--line-brand)" : "var(--line-default)",
                }}
              >
                <SummaryLabel>투자 회수</SummaryLabel>
                <SummaryValue>
                  <span style={{ ...mono, color: "var(--fg-brand)" }}>
                    {roi.totalAnnualSaving > 0 && roi.paybackMonths !== null
                      ? `약 ${roi.paybackMonths}개월`
                      : "—"}
                  </span>
                </SummaryValue>
                <div
                  className="axp-drill-link"
                  style={{
                    marginTop: 10,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    font: "var(--text-label-s)",
                    color: "var(--fg-tertiary)",
                  }}
                >
                  산출 내역 보기
                  <span style={{ display: "inline-flex" }}>
                    <Icons.arrow size={14} />
                  </span>
                </div>
              </Card>
            )}
          </div>

          {/* ── ③ 드릴다운: 연 효과 산출 내역 ── */}
          {roi && drill === "roi" && (
            <Card style={{ marginTop: "var(--space-4)" }}>
              <div style={{ font: "var(--text-title2)", color: "var(--fg-primary)" }}>
                예상 연 효과 산출 내역
              </div>
              {roi.items.length === 0 ? (
                <p style={{ margin: "10px 0 0", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
                  정량 효과 산출 대상 과제가 없어요. 기반 과제는 정성 효과로 분류되어 합산에서
                  제외돼요.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
                    <thead>
                      <tr>
                        {["항목", "산출 가정 (기준 단가·시간)", "연 절감액"].map((h, i) => (
                          <th
                            key={h}
                            style={{
                              textAlign: i === 2 ? "right" : "left",
                              font: "var(--text-caption)",
                              color: "var(--fg-tertiary)",
                              padding: "8px 10px",
                              borderBottom: "1px solid var(--line-default)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {roi.items.map((item) => (
                        <tr key={item.taskNo}>
                          <td
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "var(--fg-primary)",
                              padding: "10px",
                              borderBottom: "1px solid var(--line-subtle)",
                              minWidth: 180,
                            }}
                          >
                            {item.label}
                          </td>
                          <td
                            style={{
                              fontSize: 13,
                              lineHeight: 1.5,
                              color: "var(--fg-secondary)",
                              padding: "10px",
                              borderBottom: "1px solid var(--line-subtle)",
                            }}
                          >
                            {item.assumption}
                          </td>
                          <td
                            style={{
                              ...mono,
                              fontSize: 14,
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              color: "var(--fg-primary)",
                              padding: "10px",
                              borderBottom: "1px solid var(--line-subtle)",
                            }}
                          >
                            {fmt(item.annualSaving)}만원
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td
                          colSpan={2}
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--fg-primary)",
                            padding: "12px 10px",
                          }}
                        >
                          합산
                        </td>
                        <td
                          style={{
                            ...mono,
                            fontSize: 15,
                            fontWeight: 700,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            color: "var(--fg-primary)",
                            padding: "12px 10px",
                          }}
                        >
                          {fmt(roi.totalAnnualSaving)}만원
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              <p
                style={{
                  margin: "12px 0 0",
                  font: "var(--text-caption)",
                  lineHeight: 1.6,
                  color: "var(--fg-quaternary)",
                }}
              >
                귀사 업로드 자료의 공수·재고 신호와 기준 단가로 산출한 추정 밴드입니다. 기반
                과제(코드 표준화 등)의 효과는 정성 효과로 분류되어 합산에서 제외됩니다.
              </p>
            </Card>
          )}

          {/* ── ④ 드릴다운: 투자 회수 계산식 ── */}
          {roi && drill === "payback" && (
            <Card style={{ marginTop: "var(--space-4)" }}>
              <div style={{ font: "var(--text-title2)", color: "var(--fg-primary)" }}>
                투자 회수 계산식
              </div>
              {roi.totalAnnualSaving > 0 && roi.paybackMonths !== null ? (
                <>
                  <div
                    style={{
                      marginTop: 12,
                      background: "var(--bg-secondary)",
                      borderRadius: "var(--radius-m)",
                      padding: "16px 18px",
                      ...mono,
                      fontSize: 15,
                      lineHeight: 1.7,
                      color: "var(--fg-primary)",
                      overflowX: "auto",
                      whiteSpace: "nowrap",
                    }}
                  >
                    총 자부담 {fmt(roi.totalSelfPay)}만원 ÷ 월 효과 {fmt(monthlySaving)}만원 (연{" "}
                    {fmt(roi.totalAnnualSaving)}만원 ÷ 12) ≈{" "}
                    <span style={{ fontWeight: 700 }}>약 {roi.paybackMonths}개월</span>
                  </div>
                  <p
                    style={{
                      margin: "12px 0 0",
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "var(--fg-secondary)",
                    }}
                  >
                    총 자부담은 담으신 과제의 자부담 밴드 중간값 합산이며, 정부 지원사업 (스마트공장
                    등) 선정 기준의 추정치입니다. 회수 개월은 올림 처리합니다.
                  </p>
                </>
              ) : (
                <p style={{ margin: "10px 0 0", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
                  정량 효과가 산출된 과제가 없어 회수 기간을 계산할 수 없어요.
                </p>
              )}
            </Card>
          )}

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

      {/* ══ 보고서 받기 모달 — PDF 생성 → 다운로드 + 이메일 발송 ══ */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSent(null);
        }}
        title="보고서 받기"
      >
        {sent ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <p style={{ margin: 0, font: "var(--text-body-m, var(--text-body2))", color: "var(--fg-primary)" }}>
              {sent.ok ? "이메일로 발송했어요." : "발송에 실패했어요. 파일은 다운로드됐어요."}
            </p>
            <p style={{ margin: "8px 0 18px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
              {sent.ok
                ? `${sent.email}의 받은편지함을 확인해 주세요. 파일도 함께 다운로드됐어요.`
                : "잠시 후 다시 시도하시거나, 다운로드된 파일을 이용해 주세요."}
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
              <Button variant="primary" full disabled={!canSend || sending} onClick={submitReport}>
                {sending ? <Loader /> : "받기"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* PDF 캡처용 숨김 렌더 — 화면 밖 고정 배치 (display:none은 html2canvas 캡처 불가) */}
      <div
        ref={reportRef}
        aria-hidden
        style={{ position: "fixed", left: -10000, top: 0, width: 794, pointerEvents: "none" }}
      >
        <ReportDocument companyName={companyName || "귀사"} summary={summary} />
      </div>
    </div>
  );
}
