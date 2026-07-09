"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { ReportDocument } from "@/components/report/ReportDocument";
import { Button, Card, Eyebrow, Icons, Input } from "@/components/ui";
import { computeOverall } from "@/lib/scoring/engine";
import { computeRoi } from "@/lib/roi";
import { generateReportPdf } from "@/lib/pdf";
import { generateRoadmap } from "@/lib/roadmap";
import { judgments } from "@/data/scenario/judgments";
import { demoCompany } from "@/data/scenario/company";
import { ADOPTION_FOOTNOTE } from "@/data/rubric/meta";

/**
 * S5 보고서(전환) — F-RPT-01~06, REQ-F-18/19
 * 요약 4칸(드릴다운) → CTA 2열(보고서 받기 = 주 동선 / 문의) → 체험 티저.
 * PDF는 화면 밖 ReportDocument를 html2canvas+jsPDF로 캡처해 즉시 다운로드.
 */

const DIAGNOSIS_DATE = "2026-07-09";
const CONTACT_URL = "https://axcore.ai.kr/#5.contact";

const fmt = (n: number) => n.toLocaleString("ko-KR");

type Drill = "roi" | "payback" | null;
type PdfState = "idle" | "working" | "done" | "error";

/* ---- 요약 카드 공용 문법 ---- */
function SummaryLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--slate-500)" }}>{children}</div>
  );
}

function SummaryValue({ mono = false, children }: { mono?: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 10,
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: "-0.015em",
        lineHeight: 1.15,
        color: "var(--text-strong)",
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
      }}
    >
      {children}
    </div>
  );
}

/* ---- 체험 티저용 CSS/SVG 미니 대시보드 목업 (외부 이미지 없음) ---- */
function WorkspaceMockup() {
  const bars = [34, 52, 41, 66, 58, 74, 62];
  return (
    <svg
      width="100%"
      viewBox="0 0 360 210"
      role="img"
      aria-label="AXpoint 워크스페이스 현황판 미리보기"
      style={{ display: "block", maxWidth: 380 }}
    >
      {/* 상단 스탯 타일 3개 */}
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${i * 122}, 0)`}>
          <rect width="116" height="56" rx="8" fill="#1F2024" stroke="rgba(255,255,255,0.1)" />
          <rect x="12" y="12" width="42" height="6" rx="3" fill="#54565B" />
          <rect x="12" y="30" width={64 - i * 10} height="12" rx="4" fill="#4D85FF" />
        </g>
      ))}
      {/* 좌측 바 차트 패널 */}
      <g transform="translate(0, 68)">
        <rect width="238" height="142" rx="8" fill="#1F2024" stroke="rgba(255,255,255,0.1)" />
        <rect x="14" y="14" width="72" height="6" rx="3" fill="#54565B" />
        {bars.map((h, i) => (
          <rect
            key={i}
            x={16 + i * 31}
            y={124 - h}
            width="18"
            height={h}
            rx="3"
            fill={i === 5 ? "#4D85FF" : "#3A3B3F"}
          />
        ))}
      </g>
      {/* 우측 게이지 패널 */}
      <g transform="translate(244, 68)">
        <rect width="116" height="142" rx="8" fill="#1F2024" stroke="rgba(255,255,255,0.1)" />
        <rect x="14" y="14" width="52" height="6" rx="3" fill="#54565B" />
        <path
          d="M 24 100 A 34 34 0 1 1 92 100"
          fill="none"
          stroke="#3A3B3F"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M 24 100 A 34 34 0 0 1 58 66"
          fill="none"
          stroke="#4D85FF"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <rect x="44" y="112" width="28" height="10" rx="3" fill="#54565B" />
      </g>
    </svg>
  );
}

export default function ReportPage() {
  const { companyInput, selectedTaskIds, completedSteps, completeStep } = useDiagnosis();

  /* sessionStorage 하이드레이션(Provider effect) 이후에만 가드 판정 */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [drill, setDrill] = useState<Drill>(null);
  const [email, setEmail] = useState("");
  const [pdfState, setPdfState] = useState<PdfState>("idle");
  const [sentTo, setSentTo] = useState("");
  const [teaserNotice, setTeaserNotice] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  /* 데이터 — 전부 런타임 계산 (백엔드 없음) */
  const overall = useMemo(() => computeOverall(judgments), []);
  const roi = useMemo(() => computeRoi(selectedTaskIds), [selectedTaskIds]);
  const roadmap = useMemo(() => generateRoadmap(selectedTaskIds), [selectedTaskIds]);

  const companyName = companyInput.trim() || demoCompany.name;
  const emailValid = email.includes("@") && email.trim().length >= 3;
  const monthlySaving = roi.totalAnnualSaving > 0 ? Math.round(roi.totalAnnualSaving / 12) : 0;

  const guardPassed = completedSteps.includes("roadmap");

  const onDownload = async () => {
    if (!emailValid || pdfState === "working") return;
    setPdfState("working");
    try {
      if (!docRef.current) throw new Error("보고서 DOM이 준비되지 않았습니다");
      await generateReportPdf(docRef.current, companyName);
      setSentTo(email.trim());
      completeStep("report");
      setPdfState("done");
    } catch (err) {
      console.error("PDF 보고서 생성 실패:", err);
      setPdfState("error");
    }
  };

  if (!ready) return null;

  /* ── 가드: 로드맵 미완료 (진입 조건, F-CMN-01) ─────────── */
  if (!guardPassed) {
    return (
      <section style={{ background: "var(--canvas)", padding: "var(--space-section) var(--gutter)" }}>
        <Card style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", padding: "var(--space-xl)" }}>
          <div style={{ color: "var(--slate-400)", display: "flex", justifyContent: "center" }}>
            <Icons.info size={28} />
          </div>
          <h1
            style={{
              margin: "16px 0 0",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.012em",
              color: "var(--text-strong)",
            }}
          >
            보고서는 로드맵 확인 후 열립니다
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--text-secondary)" }}>
            선택하신 과제로 실행 로드맵을 먼저 확인하시면, 예상 효과와 투자 회수까지 담은
            보고서가 준비됩니다.
          </p>
          <div style={{ marginTop: 22 }}>
            <Button variant="primary" href="/roadmap">
              로드맵으로 이동
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <div>
      {/* ══ 섹션 1 — 요약 4칸 (F-RPT-01, white) ══════════════ */}
      <section style={{ background: "var(--canvas)", padding: "var(--space-section) var(--gutter)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Eyebrow>STEP 6 · 보고서</Eyebrow>
          <h1
            style={{
              margin: "16px 0 0",
              fontSize: "var(--type-section-size)",
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: "-0.014em",
              color: "var(--text-strong)",
            }}
          >
            {companyName} 진단 결과 요약
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 15, color: "var(--text-secondary)" }}>
            진단일 <span style={{ fontFamily: "var(--font-mono)" }}>{DIAGNOSIS_DATE}</span> — 아래
            수치는 담으신 과제 <span style={{ fontFamily: "var(--font-mono)" }}>{selectedTaskIds.length}</span>
            건 기준으로 계산되었습니다.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "var(--space-md)",
              marginTop: "var(--space-xl)",
            }}
          >
            {/* ① 현재 단계 */}
            <Card>
              <SummaryLabel>현재 단계</SummaryLabel>
              <SummaryValue>{overall.level.label}</SummaryValue>
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                AX 준비도{" "}
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ax-blue)", fontWeight: 600 }}>
                  {overall.score}/100
                </span>
              </div>
            </Card>

            {/* ② 포지션 */}
            <Card>
              <SummaryLabel>포지션</SummaryLabel>
              <SummaryValue>
                상위 <span style={{ fontFamily: "var(--font-mono)" }}>20%</span> 진입 목표
              </SummaryValue>
              <div
                style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: "var(--slate-400)" }}
                title={ADOPTION_FOOTNOTE}
              >
                전국 중소 제조 <span style={{ fontFamily: "var(--font-mono)" }}>80%</span> 미도입
                (데모 통계)
              </div>
            </Card>

            {/* ③ 예상 연 효과 — 클릭 드릴다운 */}
            <Card
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
                borderColor: drill === "roi" ? "var(--ax-blue)" : "var(--hairline)",
              }}
            >
              <SummaryLabel>예상 연 효과</SummaryLabel>
              <SummaryValue mono>
                {roi.totalAnnualSaving > 0 ? `${fmt(roi.totalAnnualSaving)}만원` : "—"}
              </SummaryValue>
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ax-blue)",
                }}
              >
                산출 내역 보기
                <span
                  style={{
                    display: "inline-flex",
                    transform: drill === "roi" ? "rotate(180deg)" : "none",
                    transition: "transform .15s ease",
                  }}
                >
                  <Icons.chevronDown size={15} />
                </span>
              </div>
            </Card>

            {/* ④ 투자 회수 — 클릭 드릴다운 */}
            <Card
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
                borderColor: drill === "payback" ? "var(--ax-blue)" : "var(--hairline)",
              }}
            >
              <SummaryLabel>투자 회수</SummaryLabel>
              <SummaryValue mono>
                {roi.totalAnnualSaving > 0 ? `약 ${roi.paybackMonths}개월` : "—"}
              </SummaryValue>
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ax-blue)",
                }}
              >
                산출 내역 보기
                <span
                  style={{
                    display: "inline-flex",
                    transform: drill === "payback" ? "rotate(180deg)" : "none",
                    transition: "transform .15s ease",
                  }}
                >
                  <Icons.chevronDown size={15} />
                </span>
              </div>
            </Card>
          </div>

          {/* ── ③ 드릴다운: ROI 산출 내역 (REQ-F-18) ── */}
          {drill === "roi" && (
            <Card style={{ marginTop: "var(--space-md)" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>
                예상 연 효과 산출 내역
              </div>
              {roi.items.length === 0 ? (
                <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>
                  정량 효과 산출 대상 과제가 없습니다. 기반 과제는 정성 효과로 분류되어 합산에서
                  제외됩니다.
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
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--slate-500)",
                              padding: "8px 10px",
                              borderBottom: "1px solid var(--hairline)",
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
                        <tr key={item.label}>
                          <td
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "var(--text-strong)",
                              padding: "10px",
                              borderBottom: "1px solid var(--divider-soft)",
                              minWidth: 180,
                            }}
                          >
                            {item.label}
                          </td>
                          <td
                            style={{
                              fontSize: 13,
                              lineHeight: 1.5,
                              color: "var(--text-secondary)",
                              padding: "10px",
                              borderBottom: "1px solid var(--divider-soft)",
                            }}
                          >
                            {item.assumption}
                          </td>
                          <td
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 14,
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              color: "var(--text-strong)",
                              padding: "10px",
                              borderBottom: "1px solid var(--divider-soft)",
                            }}
                          >
                            {fmt(item.annualSaving)}만원
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td
                          colSpan={2}
                          style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", padding: "12px 10px" }}
                        >
                          합산
                        </td>
                        <td
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 15,
                            fontWeight: 600,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            color: "var(--ax-blue)",
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
              <p style={{ margin: "12px 0 0", fontSize: "var(--type-fine-size)", lineHeight: 1.6, color: "var(--slate-400)" }}>
                {roi.disclaimer}
              </p>
            </Card>
          )}

          {/* ── ④ 드릴다운: 투자 회수 계산식 ── */}
          {drill === "payback" && (
            <Card style={{ marginTop: "var(--space-md)" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>
                투자 회수 계산식
              </div>
              {roi.totalAnnualSaving > 0 ? (
                <>
                  <div
                    style={{
                      marginTop: 12,
                      background: "var(--surface-mist)",
                      borderRadius: "var(--radius-md)",
                      padding: "16px 18px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 15,
                      lineHeight: 1.7,
                      color: "var(--text-strong)",
                      overflowX: "auto",
                      whiteSpace: "nowrap",
                    }}
                  >
                    총 자부담 {fmt(roi.totalSelfPay)}만원 ÷ 월 효과 {fmt(monthlySaving)}만원
                    (연 {fmt(roi.totalAnnualSaving)}만원 ÷ 12) ≈{" "}
                    <span style={{ color: "var(--ax-blue)", fontWeight: 600 }}>
                      약 {roi.paybackMonths}개월
                    </span>
                  </div>
                  <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--text-secondary)" }}>
                    총 자부담은 담으신 과제의 자부담 밴드 중간값 합산이며, 정부 지원사업
                    (스마트공장 등) 선정 기준의 추정치입니다. 회수 개월은 올림 처리합니다.
                  </p>
                </>
              ) : (
                <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>
                  정량 효과가 산출된 과제가 없어 회수 기간을 계산할 수 없습니다.
                </p>
              )}
            </Card>
          )}
        </div>
      </section>

      {/* ══ 섹션 2 — CTA 2열 (F-RPT-02·04, mist) ═════════════ */}
      <section style={{ background: "var(--surface-mist)", padding: "var(--space-section) var(--gutter)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Eyebrow>다음 행동</Eyebrow>
          <h2
            style={{
              margin: "16px 0 0",
              fontSize: "var(--type-section-size)",
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: "-0.014em",
              color: "var(--text-strong)",
            }}
          >
            이 결과를 가져가세요
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "var(--space-lg)",
              marginTop: "var(--space-xl)",
              alignItems: "start",
            }}
          >
            {/* ── 좌: 보고서 받기 (주 동선) ── */}
            <Card style={{ padding: "var(--space-xl)" }}>
              <h3 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-strong)" }}>
                보고서 받기
              </h3>
              <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--text-secondary)" }}>
                진단 결과 전체를 PDF 보고서로 정리해 드립니다. 정부 지원사업 신청 기초자료로
                그대로 활용할 수 있습니다.
              </p>

              {pdfState === "done" ? (
                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      background: "var(--ax-blue-wash)",
                      border: "1px solid var(--ax-blue-hairline)",
                      borderRadius: "var(--radius-md)",
                      padding: "14px 16px",
                    }}
                  >
                    <span style={{ color: "var(--ax-blue)", display: "inline-flex", marginTop: 2 }}>
                      <Icons.check size={17} />
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-strong)" }}>
                        {sentTo}로 보고서를 발송했습니다
                      </div>
                      <div style={{ marginTop: 3, fontSize: "var(--type-fine-size)", color: "var(--slate-500)" }}>
                        데모: 실제 발송 없음, PDF가 다운로드되었습니다
                      </div>
                    </div>
                  </div>

                  {/* 후속 제안 (F-RPT-04) */}
                  <div
                    style={{
                      marginTop: 20,
                      paddingTop: 20,
                      borderTop: "1px solid var(--divider-soft)",
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)" }}>
                      전문가와 결과 리뷰하기
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                      진단 결과를 30분 무료 리뷰 — 보고서를 같이 보며 다음 단계를 정리해
                      드립니다.
                    </p>
                    <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <Button variant="secondary" href={CONTACT_URL} target="_blank" rel="noreferrer">
                        30분 무료 리뷰 신청
                      </Button>
                      <Button variant="ghost" onClick={onDownload}>
                        <Icons.download size={15} />
                        PDF 다시 받기
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 20 }}>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.co.kr"
                    leadingIcon={<Icons.mail size={17} />}
                    aria-label="보고서 받을 이메일"
                    invalid={email.length > 0 && !emailValid}
                  />
                  {email.length > 0 && !emailValid && (
                    <p style={{ margin: "7px 0 0", fontSize: "var(--type-fine-size)", color: "#d4351c" }}>
                      이메일 형식을 확인해 주세요 (@ 포함)
                    </p>
                  )}
                  <div style={{ marginTop: 14 }}>
                    <Button
                      variant="primary"
                      size="lg"
                      full
                      disabled={!emailValid || pdfState === "working"}
                      onClick={onDownload}
                    >
                      {pdfState === "working" ? "보고서 생성 중…" : "PDF 보고서 받기"}
                    </Button>
                  </div>
                  {pdfState === "error" && (
                    <p style={{ margin: "10px 0 0", fontSize: 13, color: "#d4351c" }}>
                      PDF 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.
                    </p>
                  )}
                  {!emailValid && pdfState !== "error" && (
                    <p style={{ margin: "10px 0 0", fontSize: "var(--type-fine-size)", color: "var(--slate-400)", textAlign: "center" }}>
                      이메일을 입력하면 PDF 보고서를 받을 수 있습니다 (데모: 실제 발송 없음)
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* ── 우: 문의하기 ── */}
            <Card style={{ padding: "var(--space-xl)" }}>
              <h3 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--text-strong)" }}>
                문의하기
              </h3>
              <p style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--text-secondary)" }}>
                로드맵 실행이 바로 필요하시면 구축 상담으로 연결해 드립니다. 지원사업 신청
                일정과 자부담 계획까지 함께 잡아 드립니다.
              </p>
              <div style={{ marginTop: 20 }}>
                <Button variant="secondary" size="lg" href={CONTACT_URL} target="_blank" rel="noreferrer">
                  구축 상담 연결
                </Button>
              </div>
              <p style={{ margin: "14px 0 0", fontSize: "var(--type-fine-size)", color: "var(--slate-400)" }}>
                axcore.ai.kr 문의 페이지가 새 탭으로 열립니다.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* ══ 섹션 3 — 체험 랜딩 티저 (F-RPT-03, white) ════════ */}
      <section style={{ background: "var(--canvas)", padding: "var(--space-section) var(--gutter)" }}>
        <Card
          tone="dark"
          style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-xl)" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "var(--space-xl)",
              alignItems: "center",
            }}
          >
            <div>
              <Eyebrow tone="on-dark">AXPOINT 워크스페이스</Eyebrow>
              <h2
                style={{
                  margin: "14px 0 0",
                  fontSize: 26,
                  fontWeight: 600,
                  lineHeight: 1.25,
                  letterSpacing: "-0.012em",
                  color: "var(--on-dark)",
                }}
              >
                도입 후에는 이런 현황판을 보게 됩니다
              </h2>
              <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--on-dark-muted)" }}>
                생산·재고·품질 데이터가 한 번만 입력되고, 대표님 화면에는 실시간 현황판이
                올라옵니다.
              </p>
              <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => setTeaserNotice(true)}>
                  체험하기
                </Button>
                {teaserNotice && (
                  <span style={{ fontSize: 13, color: "var(--ax-blue-on-dark)" }}>
                    정식 오픈 예정 — 데모에서는 미리보기만 제공됩니다
                  </span>
                )}
              </div>
            </div>
            <WorkspaceMockup />
          </div>
        </Card>
      </section>

      {/* ══ PDF 캡처용 화면 밖 보고서 DOM ═══════════════════ */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -9999,
          top: 0,
          width: 794,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <div ref={docRef}>
          <ReportDocument
            companyName={companyName}
            diagnosisDate={DIAGNOSIS_DATE}
            overall={overall}
            roi={roi}
            roadmap={roadmap}
            selectedTaskIds={selectedTaskIds}
          />
        </div>
      </div>
    </div>
  );
}
