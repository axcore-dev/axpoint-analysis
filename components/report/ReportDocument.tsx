import type { CSSProperties, ReactNode } from "react";

/**
 * PDF용 상세 보고서 DOM — 실데이터 연동판
 *
 * report/page.tsx가 백엔드에서 받아 만든 요약(summary·roi)만으로 렌더한다.
 * 데모(@/data/scenario) 의존은 제거했고, 데이터가 없는 섹션(종합 소견·축별
 * 준비도·업무영역·과제 상세 등)은 표시하지 않는다 — 값이 생기면 그때 추가.
 *
 * 페이지 단위 렌더 — 각 페이지가 794×1123px(A4 @96dpi) 고정 컨테이너
 * (`data-report-page`)로 분리되고, lib/pdf.ts가 페이지별로 개별 캡처해
 * jsPDF에 삽입한다. 표·행이 페이지 경계에서 잘리지 않는다.
 *
 * 중요: html2canvas는 oklch 등 최신 CSS 색상 함수를 지원하지 않는다.
 * 이 파일은 Tailwind 색상 유틸리티를 쓰지 않고 인라인 hex 스타일만 사용한다.
 *
 * 페이지 구성: ① 표지 ② 진단 결과 요약(포지션·로드맵 요약) ③ 예상 효과
 * 산출 내역(ROI 있을 때만) — 한계 고지는 마지막 페이지 하단.
 */

/* ---- report/page.tsx와 공유하는 요약 타입 ---- */
export type ReportRoi = {
  items: { taskNo: number; label: string; annualSaving: number; assumption: string }[];
  totalAnnualSaving: number;
  totalSelfPay: number;
  paybackMonths: number | null;
};

export type ReportSummary = {
  level: number;
  levelName: string;
  totalScore: string;
  diagnosedAt: string | null; // YYYY-MM-DD
  industryAvg: number | null;
  taskCount: number;
  totalMonths: number;
  costMin: number;
  costMax: number;
  roi: ReportRoi | null;
};

/* ---- 색 상수 (전부 hex — 디자인 시스템 v2 토큰과 동일 값) ---- */
const INK = "#191F28";
const SECONDARY = "#4E5968";
const MUTED = "#8B95A1";
const BLUE = "#0A50FF";
const HAIRLINE = "#E5E8EB";
const MIST = "#F9FAFB";
const WASH = "#EEF3FF";
const WHITE = "#FFFFFF";
const TRACK = "#E5E8EB";

const SANS = "'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

const PAGE_W = 794; // A4 210mm @ 96dpi
const PAGE_H = 1123; // A4 297mm @ 96dpi
const PAGE_PAD = 56;

const fmt = (n: number) => n.toLocaleString("ko-KR");

/* ============ 페이지 골격 ============ */

function Page({
  no,
  total,
  companyName,
  children,
}: {
  no: number;
  total: number;
  companyName: string;
  children: ReactNode;
}) {
  return (
    <div
      data-report-page=""
      style={{
        width: PAGE_W,
        height: PAGE_H,
        boxSizing: "border-box",
        background: WHITE,
        color: INK,
        fontFamily: SANS,
        letterSpacing: "-0.01em",
        padding: `${PAGE_PAD}px ${PAGE_PAD}px 0`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>{children}</div>
      {/* 페이지 하단 — AXpoint 표기 + 페이지 번호 */}
      <div
        style={{
          flex: "none",
          height: PAGE_PAD,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${HAIRLINE}`,
          fontSize: 10.5,
          color: MUTED,
        }}
      >
        <span>
          <span style={{ fontWeight: 700, color: BLUE }}>AXpoint</span>
          <span> · {companyName} AX 진단 상세 보고서</span>
        </span>
        <span style={{ fontFamily: MONO }}>
          {no} / {total}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ no, children }: { no: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        paddingBottom: 10,
        borderBottom: `1px solid ${HAIRLINE}`,
        marginBottom: 18,
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: BLUE }}>{no}</span>
      <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.012em", color: INK }}>
        {children}
      </span>
    </div>
  );
}

const th: CSSProperties = {
  textAlign: "left",
  fontSize: 11.5,
  fontWeight: 600,
  color: SECONDARY,
  padding: "7px 10px",
  borderBottom: `1px solid ${HAIRLINE}`,
  background: MIST,
  whiteSpace: "nowrap",
};

const td: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.5,
  color: INK,
  padding: "8px 10px",
  borderBottom: `1px solid ${HAIRLINE}`,
  verticalAlign: "top",
};

const tdMono: CSSProperties = { ...td, fontFamily: MONO, whiteSpace: "nowrap" };

const note: CSSProperties = { marginTop: 10, fontSize: 11, lineHeight: 1.6, color: MUTED };

/* 요약 스탯 타일 — 화면의 요약 카드와 같은 구성 */
function Stat({ label, value, caption }: { label: string; value: ReactNode; caption?: string }) {
  return (
    <div
      style={{
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 12,
        padding: "14px 16px",
        flex: "1 1 0",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: INK, lineHeight: 1.2 }}>
        {value}
      </div>
      {caption && <div style={{ marginTop: 6, fontSize: 10.5, color: MUTED }}>{caption}</div>}
    </div>
  );
}

/* ============ 본문 ============ */

export interface ReportDocumentProps {
  companyName: string;
  summary: ReportSummary;
}

export function ReportDocument({ companyName, summary }: ReportDocumentProps) {
  const roi = summary.roi;
  const scoreNum = Number(summary.totalScore);

  /* 업종 대비 포지션 — 화면과 동일 계산 */
  const industryDiff = summary.industryAvg !== null ? scoreNum - summary.industryAvg : null;
  const diffAhead = industryDiff !== null && industryDiff >= 0;
  const diffLabel =
    industryDiff !== null
      ? `${industryDiff >= 0 ? "+" : "-"}${Math.abs(industryDiff).toFixed(1)}점`
      : null;

  const hasPayback = roi !== null && roi.totalAnnualSaving > 0 && roi.paybackMonths !== null;
  const monthlySaving =
    roi && roi.totalAnnualSaving > 0 ? Math.round(roi.totalAnnualSaving / 12) : 0;

  /* 섹션 번호 — 조건부 섹션이 있어 순차 발급 */
  let sec = 0;
  const nextNo = () => String(++sec);

  /* 한계 고지 — 마지막 페이지 하단 고정 블록 */
  const limitNotice = (
    <div
      style={{
        marginTop: 36,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 12,
        padding: "16px 20px",
        fontSize: 11.5,
        lineHeight: 1.6,
        color: MUTED,
      }}
    >
      한계 고지 — 이 결과는 공개 자료·제출 자료 범위 내 추정이며, 자료를 더 주시면
      정확도가 올라가요. 문의: https://axcore.ai.kr
    </div>
  );

  const bodies: ReactNode[] = [];

  /* ── ① 표지 — 화이트 표지 + 블루 포인트 ── */
  bodies.push(
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* AXpoint 로고 텍스트 */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: BLUE }}>
          AXpoint
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>by 주식회사 에이엑스코어</span>
      </div>

      <div style={{ marginTop: 130 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: BLUE,
          }}
        >
          AX 진단 상세 보고서
        </div>
        <div
          style={{
            marginTop: 16,
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            color: INK,
          }}
        >
          {companyName}
        </div>
        {summary.diagnosedAt && (
          <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 13, color: SECONDARY }}>
            진단일 {summary.diagnosedAt}
          </div>
        )}
      </div>

      <div style={{ marginTop: 60, paddingTop: 36, borderTop: `1px solid ${HAIRLINE}` }}>
        <div style={{ fontSize: 13, color: SECONDARY }}>현재 단계</div>
        <div
          style={{
            marginTop: 8,
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: INK,
          }}
        >
          {`Lv.${summary.level} ${summary.levelName}`}
        </div>
        <div style={{ marginTop: 18 }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 12,
              fontWeight: 600,
              color: BLUE,
              background: WASH,
              borderRadius: 9999,
              padding: "6px 14px",
              fontFamily: MONO,
            }}
          >
            종합 점수 {summary.totalScore}점
          </span>
        </div>
      </div>
    </div>,
  );

  /* ── ② 진단 결과 요약 + 업종 대비 포지션 + 로드맵 요약 ── */
  bodies.push(
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div>
        <SectionTitle no={nextNo()}>진단 결과 요약</SectionTitle>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
          {summary.diagnosedAt && (
            <>
              진단일 <span style={{ fontFamily: MONO }}>{summary.diagnosedAt}</span> ·{" "}
            </>
          )}
          담으신 과제 <span style={{ fontFamily: MONO }}>{summary.taskCount}</span>건 기준
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <Stat label="현재 단계" value={`Lv.${summary.level} ${summary.levelName}`} />
          {diffLabel !== null && summary.industryAvg !== null ? (
            <Stat
              label="포지션"
              value={
                <span style={{ fontFamily: MONO, color: BLUE }}>{diffLabel}</span>
              }
              caption={`업종 표본 평균 ${Math.round(summary.industryAvg)}점 대비`}
            />
          ) : (
            <Stat
              label="종합 점수"
              value={<span style={{ fontFamily: MONO, color: BLUE }}>{summary.totalScore}점</span>}
            />
          )}
          <Stat
            label="예상 연 효과"
            value={
              <span style={{ fontFamily: MONO }}>
                {roi && roi.totalAnnualSaving > 0 ? `${fmt(roi.totalAnnualSaving)}만원` : "—"}
              </span>
            }
          />
          <Stat
            label="투자 회수"
            value={
              <span style={{ fontFamily: MONO }}>
                {hasPayback ? `약 ${roi.paybackMonths}개월` : "—"}
              </span>
            }
          />
        </div>

        {industryDiff !== null && summary.industryAvg !== null && (
          <div style={{ marginTop: 36 }}>
            <SectionTitle no={nextNo()}>업종 대비 포지션</SectionTitle>
            <div style={{ fontSize: 15, color: SECONDARY }}>
              귀사의 AX 준비 수준은{" "}
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 26,
                  fontWeight: 700,
                  color: diffAhead ? BLUE : INK,
                  verticalAlign: "-2px",
                }}
              >
                업종 평균보다 {diffLabel}
              </span>{" "}
              {diffAhead ? "앞서 있어요." : "뒤에 있어요."}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>
              업종 표본 평균 {Math.round(summary.industryAvg)}점 대비
            </div>

            {/* 자사 vs 업종 평균 비교 바 */}
            <div style={{ marginTop: 20, maxWidth: 560 }}>
              {[
                { label: "귀사", value: scoreNum, color: BLUE },
                { label: "업종 평균", value: summary.industryAvg, color: "#B0B8C1" },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}
                >
                  <span
                    style={{ flex: "none", width: 64, fontSize: 12, fontWeight: 600, color: SECONDARY }}
                  >
                    {row.label}
                  </span>
                  <div
                    style={{
                      flex: "1 1 auto",
                      position: "relative",
                      height: 8,
                      background: TRACK,
                      borderRadius: 4,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: 8,
                        width: `${Math.min(Math.max(row.value, 0), 100)}%`,
                        background: row.color,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      flex: "none",
                      width: 44,
                      textAlign: "right",
                      fontFamily: MONO,
                      fontSize: 12.5,
                      color: INK,
                    }}
                  >
                    {row.value.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 36 }}>
          <SectionTitle no={nextNo()}>AX 로드맵 요약</SectionTitle>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {(
                [
                  ["담은 과제", `${summary.taskCount}건`],
                  ["총 기간", `약 ${summary.totalMonths}개월`],
                  ["자부담 밴드", `${fmt(summary.costMin)}~${fmt(summary.costMax)}만원`],
                ] as const
              ).map(([label, value]) => (
                <tr key={label}>
                  <td style={{ ...td, width: 140, fontWeight: 600, color: SECONDARY }}>{label}</td>
                  <td style={tdMono}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={note}>
            자부담은 정부 지원사업(스마트공장 등) 선정 기준의 추정 밴드예요. 사업 선정
            결과에 따라 달라질 수 있어요.
          </div>
        </div>
      </div>
      {!roi && <div style={{ marginTop: "auto", paddingBottom: 24 }}>{limitNotice}</div>}
    </div>,
  );

  /* ── ③ 예상 효과 산출 내역 (ROI 있을 때만) ── */
  if (roi) {
    bodies.push(
      <div>
        <SectionTitle no={nextNo()}>예상 효과 산출 내역</SectionTitle>
        {roi.items.length === 0 ? (
          <div style={{ fontSize: 13, color: MUTED }}>
            정량 효과 산출 대상 과제가 없어요 (기반 과제는 정성 효과로 분류돼요).
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>항목</th>
                <th style={th}>산출 가정 (기준 단가·시간)</th>
                <th style={{ ...th, width: 120, textAlign: "right" }}>연 절감액 (만원)</th>
              </tr>
            </thead>
            <tbody>
              {roi.items.map((item) => (
                <tr key={item.taskNo}>
                  <td style={{ ...td, width: 190, fontWeight: 600 }}>{item.label}</td>
                  <td style={{ ...td, fontSize: 11.5, color: SECONDARY }}>{item.assumption}</td>
                  <td style={{ ...tdMono, textAlign: "right" }}>{fmt(item.annualSaving)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 600 }} colSpan={2}>
                  합산 연 효과 · 총 자부담 · 투자 회수
                </td>
                <td style={{ ...tdMono, textAlign: "right", fontWeight: 600, color: BLUE }}>
                  {fmt(roi.totalAnnualSaving)}만원 · {fmt(roi.totalSelfPay)}만원 ·{" "}
                  {hasPayback ? `약 ${roi.paybackMonths}개월` : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {hasPayback && (
          <div
            style={{
              marginTop: 18,
              background: MIST,
              borderRadius: 10,
              padding: "14px 16px",
              fontFamily: MONO,
              fontSize: 13,
              lineHeight: 1.7,
              color: INK,
            }}
          >
            총 자부담 {fmt(roi.totalSelfPay)}만원 ÷ 월 효과 {fmt(monthlySaving)}만원 (연{" "}
            {fmt(roi.totalAnnualSaving)}만원 ÷ 12) ≈{" "}
            <span style={{ fontWeight: 700 }}>약 {roi.paybackMonths}개월</span>
          </div>
        )}

        <div style={note}>
          귀사 업로드 자료의 공수·재고 신호와 기준 단가로 산출한 추정 밴드입니다. 기반
          과제(코드 표준화 등)의 효과는 정성 효과로 분류되어 합산에서 제외됩니다.
        </div>

        {limitNotice}
      </div>,
    );
  }

  return (
    <div>
      {bodies.map((body, i) => (
        <Page key={i} no={i + 1} total={bodies.length} companyName={companyName}>
          {body}
        </Page>
      ))}
    </div>
  );
}
