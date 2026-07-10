"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { ReportDocument } from "@/components/report/ReportDocument";
import { Button, Card, Eyebrow, Icons, Input, Modal } from "@/components/ui";
import { computeOverall } from "@/lib/scoring/engine";
import { computeRoi } from "@/lib/roi";
import { generateReportPdf } from "@/lib/pdf";
import { generateRoadmap } from "@/lib/roadmap";
import { judgments } from "@/data/scenario/judgments";
import { demoCompany } from "@/data/scenario/company";

/**
 * S5 보고서(전환) — F-RPT-01~06, REQ-F-18/19 (2026-07-09 수정요청v1)
 *
 * 요약 4칸(단계 / 업종 대비 포지션 / 연 효과 드릴다운 / 회수 드릴다운)
 * → CTA 버튼 2개(보고서 받기 모달 = 주 동선 / 문의하기 새 탭)
 * → 체험 티저(라이트 카드 + 미니 SVG 대시보드, axcore.it.kr 새 탭).
 * PDF는 화면 밖 ReportDocument(페이지 단위 794×1123 컨테이너)를
 * 페이지별 html2canvas 캡처로 즉시 다운로드한다.
 */

const DIAGNOSIS_DATE = "2026-07-09";
const CONTACT_URL = "https://axcore.ai.kr/#5.contact";
const WORKSPACE_URL = "https://axcore.it.kr";

const fmt = (n: number) => n.toLocaleString("ko-KR");
const mono = { fontFamily: "var(--font-mono)", letterSpacing: "0" } as const;

type Drill = "roi" | "payback" | null;
type PdfState = "idle" | "working" | "done" | "error";

/* ---- 요약 카드 공용 문법 ---- */
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
    <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5, color: "var(--fg-tertiary)" }}>
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
  const { companyInput, selectedTaskIds, completedSteps, completeStep } = useDiagnosis();

  /* sessionStorage 하이드레이션(Provider effect) 이후에만 가드 판정 */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [drill, setDrill] = useState<Drill>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pdfState, setPdfState] = useState<PdfState>("idle");
  const [sentTo, setSentTo] = useState("");
  const docRef = useRef<HTMLDivElement>(null);

  /* 데이터 — 전부 런타임 계산 (백엔드 없음) */
  const overall = useMemo(() => computeOverall(judgments), []);
  const roi = useMemo(() => computeRoi(selectedTaskIds), [selectedTaskIds]);
  const roadmap = useMemo(() => generateRoadmap(selectedTaskIds), [selectedTaskIds]);

  const companyName = companyInput.trim() || demoCompany.name;
  const emailValid = email.includes("@") && email.trim().length >= 3;
  const monthlySaving = roi.totalAnnualSaving > 0 ? Math.round(roi.totalAnnualSaving / 12) : 0;

  /* 업종 대비 포지션 — INDUSTRY_AVG 평균 대비 scoreRaw 차이 (소수 1자리) */
  const industryMean = overall.scoreRaw - overall.industryDiff;
  const diffAhead = overall.industryDiff >= 0;
  const diffLabel = `${diffAhead ? "+" : "-"}${Math.abs(overall.industryDiff).toFixed(1)}점`;

  const guardPassed = completedSteps.includes("roadmap");

  const onDownload = async () => {
    if (!emailValid || pdfState === "working") return;
    setPdfState("working");
    try {
      if (!docRef.current) throw new Error("보고서 DOM이 준비되지 않았어요");
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
      <section style={{ padding: "var(--space-20) var(--gutter)" }}>
        <Card style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", padding: "var(--space-8)" }}>
          <div style={{ color: "var(--fg-quaternary)", display: "flex", justifyContent: "center" }}>
            <Icons.info size={28} />
          </div>
          <h1
            style={{
              margin: "16px 0 0",
              font: "var(--text-h3)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            보고서는 로드맵 확인 후 열려요
          </h1>
          <p style={{ margin: "10px 0 0", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
            담으신 과제로 실행 로드맵을 먼저 확인하시면, 예상 효과와 투자 회수까지 담은
            보고서가 준비돼요.
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
    <div className="ax-step-enter">
      {/* ══ 요약 4칸 (F-RPT-01) — 흰 캔버스 단일 흐름 ══════════ */}
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
            진단일 <span style={mono}>{DIAGNOSIS_DATE}</span> · 담으신 과제{" "}
            <span style={mono}>{selectedTaskIds.length}</span>건 기준
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "var(--space-4)",
              marginTop: "var(--space-8)",
            }}
          >
            {/* ① 현재 단계 — Lv 라벨만 (서술 문구 제거, v3) */}
            <Card>
              <SummaryLabel>현재 단계</SummaryLabel>
              <SummaryValue>{overall.level.label}</SummaryValue>
            </Card>

            {/* ② 포지션 — 업종 평균 대비 (런타임 계산) */}
            <Card>
              <SummaryLabel>포지션</SummaryLabel>
              <SummaryValue>
                업종 평균보다 <span style={mono}>{diffLabel}</span>
              </SummaryValue>
              <SummaryCaption>
                중소 금속가공 표본 평균 <span style={mono}>{Math.round(industryMean)}</span>점
                대비
              </SummaryCaption>
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
                borderColor: drill === "roi" ? "var(--line-brand)" : "var(--line-default)",
              }}
            >
              <SummaryLabel>예상 연 효과</SummaryLabel>
              <SummaryValue>
                <span style={mono}>
                  {roi.totalAnnualSaving > 0 ? `${fmt(roi.totalAnnualSaving)}만원` : "—"}
                </span>
              </SummaryValue>
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  font: "var(--text-label-s)",
                  color: "var(--fg-brand)",
                }}
              >
                산출 내역 보기
                <span
                  style={{
                    display: "inline-flex",
                    transform: drill === "roi" ? "rotate(180deg)" : "none",
                    transition: "transform var(--dur-fast) var(--ease)",
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
                borderColor: drill === "payback" ? "var(--line-brand)" : "var(--line-default)",
              }}
            >
              <SummaryLabel>투자 회수</SummaryLabel>
              <SummaryValue>
                <span style={mono}>
                  {roi.totalAnnualSaving > 0 ? `약 ${roi.paybackMonths}개월` : "—"}
                </span>
              </SummaryValue>
              <div
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  font: "var(--text-label-s)",
                  color: "var(--fg-brand)",
                }}
              >
                산출 내역 보기
                <span
                  style={{
                    display: "inline-flex",
                    transform: drill === "payback" ? "rotate(180deg)" : "none",
                    transition: "transform var(--dur-fast) var(--ease)",
                  }}
                >
                  <Icons.chevronDown size={15} />
                </span>
              </div>
            </Card>
          </div>

          {/* ── ③ 드릴다운: 연 효과 산출 내역 (REQ-F-18) ── */}
          {drill === "roi" && (
            <Card style={{ marginTop: "var(--space-4)" }}>
              <div style={{ font: "var(--text-title2)", color: "var(--fg-primary)" }}>
                예상 연 효과 산출 내역
              </div>
              {roi.items.length === 0 ? (
                <p style={{ margin: "10px 0 0", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
                  정량 효과 산출 대상 과제가 없어요. 기반 과제는 정성 효과로 분류되어
                  합산에서 제외돼요.
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
                        <tr key={item.label}>
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
              <p style={{ margin: "12px 0 0", font: "var(--text-caption)", lineHeight: 1.6, color: "var(--fg-quaternary)" }}>
                {roi.disclaimer}
              </p>
            </Card>
          )}

          {/* ── ④ 드릴다운: 투자 회수 계산식 ── */}
          {drill === "payback" && (
            <Card style={{ marginTop: "var(--space-4)" }}>
              <div style={{ font: "var(--text-title2)", color: "var(--fg-primary)" }}>
                투자 회수 계산식
              </div>
              {roi.totalAnnualSaving > 0 ? (
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
                    총 자부담 {fmt(roi.totalSelfPay)}만원 ÷ 월 효과 {fmt(monthlySaving)}만원
                    (연 {fmt(roi.totalAnnualSaving)}만원 ÷ 12) ≈{" "}
                    <span style={{ fontWeight: 700 }}>약 {roi.paybackMonths}개월</span>
                  </div>
                  <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.55, color: "var(--fg-secondary)" }}>
                    총 자부담은 담으신 과제의 자부담 밴드 중간값 합산이며, 정부 지원사업
                    (스마트공장 등) 선정 기준의 추정치입니다. 회수 개월은 올림 처리합니다.
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
            {/* v3: 보고서 받기 ↔ 문의하기 컬러 교체 */}
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

      {/* ══ 체험 티저 (F-RPT-03) — 라이트 카드 + 미니 대시보드 ══ */}
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

      {/* ══ 보고서 받기 모달 (F-RPT-02·04) ═══════════════════ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="보고서 받기">
        {pdfState === "done" ? (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                background: "var(--bg-brand-weak)",
                borderRadius: "var(--radius-m)",
                padding: "14px 16px",
              }}
            >
              <span style={{ color: "var(--fg-brand)", display: "inline-flex", marginTop: 2 }}>
                <Icons.check size={17} />
              </span>
              <div>
                <div style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                  {sentTo}로 보냈어요
                </div>
                <div style={{ marginTop: 4, font: "var(--text-body3)", color: "var(--fg-tertiary)" }}>
                  데모라 실제 발송은 없고, PDF가 다운로드됐어요.
                </div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <Button
                variant="secondary"
                size="lg"
                full
                href={CONTACT_URL}
                target="_blank"
                rel="noreferrer"
              >
                전문가와 결과 리뷰하기
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
              이메일을 입력하시면 진단 결과 전체를 담은 상세 보고서 PDF를 받으실 수 있어요.
            </p>
            <div style={{ marginTop: 14 }}>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.co.kr"
                leadingIcon={<Icons.mail size={17} />}
                aria-label="보고서 받을 이메일"
                invalid={email.length > 0 && !emailValid}
              />
            </div>
            {email.length > 0 && !emailValid && (
              <p style={{ margin: "7px 0 0", font: "var(--text-caption)", color: "var(--fg-danger)" }}>
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
                {pdfState === "working" ? "보고서 만드는 중…" : "PDF 받기"}
              </Button>
            </div>
            {pdfState === "error" ? (
              <p style={{ margin: "10px 0 0", font: "var(--text-body3)", color: "var(--fg-danger)" }}>
                PDF 생성에 실패했어요. 잠시 후 다시 시도해 주세요.
              </p>
            ) : (
              <p style={{ margin: "10px 0 0", font: "var(--text-caption)", color: "var(--fg-quaternary)" }}>
                데모라 실제 발송은 없어요 — PDF가 바로 다운로드돼요.
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* ══ PDF 캡처용 화면 밖 보고서 DOM (페이지 컨테이너 배열) ══ */}
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
