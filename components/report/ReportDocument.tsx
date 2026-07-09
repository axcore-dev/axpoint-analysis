import type { CSSProperties, ReactNode } from "react";
import type {
  AreaGrade,
  OverallResult,
  Roadmap,
  RoiBreakdown,
} from "@/lib/types";
import { getTask } from "@/data/catalog/tasks";
import { areaAssessments } from "@/data/scenario/areas";
import { overallOpinion, strategyType } from "@/data/scenario/narrative";
import { areaName } from "@/data/rubric/meta";

/**
 * PDF용 보고서 DOM (F-RPT-06 — 정부사업 신청 재활용 지향)
 *
 * html2canvas 캡처 전용으로 화면 밖(width 794px)에 렌더된다.
 * 중요: html2canvas는 oklch 등 최신 CSS 색상 함수를 지원하지 않는다.
 * 이 파일은 Tailwind 색상 유틸리티를 쓰지 않고 인라인 hex 스타일만 사용한다.
 *
 * 구성: 표지 / 1.종합 소견 / 2.6축 준비도 / 3.8영역 평가 / 4.선택 과제 /
 *       5.로드맵 단계 요약 / 6.ROI 산출 내역 / 푸터(데모 고지)
 */

/* ---- 색 상수 (전부 hex — 프로젝트 토큰과 동일 값) ---- */
const INK = "#1D1D1F";
const SECONDARY = "#54565B";
const MUTED = "#95969B";
const BLUE = "#0A50FF";
const HAIRLINE = "#E0E1E4";
const MIST = "#F5F6F8";
const WHITE = "#FFFFFF";
const TRACK = "#E8E9EB";

const SANS = "'Paperlogy', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

const A4_HEIGHT_PX = 1123; // 297mm @ 96dpi

const GRADE_STYLE: Record<AreaGrade, { label: string; color: string; bg: string }> = {
  critical: { label: "심각", color: "#B3261E", bg: "#FDECEA" },
  normal: { label: "보통", color: "#54565B", bg: "#E8E9EB" },
  strength: { label: "강점", color: "#1B7A3D", bg: "#E7F6EC" },
  hold: { label: "판단 보류", color: "#6F7075", bg: "#F3F4F6" },
};

const fmt = (n: number) => n.toLocaleString("ko-KR");

/* ---- 소형 조립 부품 ---- */

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
      <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.012em", color: INK }}>
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

export interface ReportDocumentProps {
  companyName: string;
  diagnosisDate: string; // 예: "2026-07-09"
  overall: OverallResult;
  roi: RoiBreakdown;
  roadmap: Roadmap;
  selectedTaskIds: string[];
}

export function ReportDocument({
  companyName,
  diagnosisDate,
  overall,
  roi,
  roadmap,
  selectedTaskIds,
}: ReportDocumentProps) {
  const selectedTasks = selectedTaskIds.map(getTask);

  return (
    <div
      style={{
        width: 794,
        boxSizing: "border-box",
        background: WHITE,
        color: INK,
        fontFamily: SANS,
        letterSpacing: "-0.01em",
      }}
    >
      {/* ============ 표지 (1페이지) ============ */}
      <div
        style={{
          boxSizing: "border-box",
          height: A4_HEIGHT_PX,
          padding: "56px 60px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/axcore-color.png"
            alt="AXCORE"
            style={{ height: 22, width: "auto", display: "block" }}
          />
        </div>

        <div style={{ marginTop: 150 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: BLUE,
            }}
          >
            AXpoint AX 진단 보고서
          </div>
          <div
            style={{
              marginTop: 18,
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              color: INK,
            }}
          >
            {companyName}
          </div>
          <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 13, color: SECONDARY }}>
            진단일 {diagnosisDate}
          </div>
        </div>

        <div
          style={{
            marginTop: 56,
            paddingTop: 36,
            borderTop: `1px solid ${HAIRLINE}`,
          }}
        >
          <div style={{ fontSize: 13, color: SECONDARY }}>현재 단계</div>
          <div
            style={{
              marginTop: 8,
              fontSize: 52,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: INK,
            }}
          >
            {overall.level.label}
          </div>
          <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 16, color: BLUE }}>
            AX 준비도 {overall.score}/100
          </div>
          <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5, color: SECONDARY, maxWidth: 520 }}>
            {overall.level.description}
          </div>
          <div style={{ marginTop: 16, display: "inline-block" }}>
            <span
              style={{
                display: "inline-block",
                fontSize: 12,
                fontWeight: 600,
                color: BLUE,
                background: "#EEF3FF",
                borderRadius: 9999,
                padding: "5px 12px",
              }}
            >
              전략 유형 — {strategyType.label}
            </span>
          </div>
        </div>

        <div style={{ marginTop: "auto", fontSize: 11, lineHeight: 1.7, color: MUTED }}>
          <div style={{ fontWeight: 600, color: SECONDARY }}>
            AXCORE 에이엑스코어 · AXpoint™
          </div>
          <div>본 보고서는 시연용 더미 데이터 기반입니다.</div>
        </div>
      </div>

      {/* ============ 본문 ============ */}
      <div style={{ padding: "48px 60px 0" }}>
        {/* ---- 1. 종합 소견 (3단) ---- */}
        <SectionTitle no="1">종합 소견</SectionTitle>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.012em",
            lineHeight: 1.4,
            color: INK,
          }}
        >
          &ldquo;{overallOpinion.oneLiner}&rdquo;
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 14 }}>
          <tbody>
            <tr>
              <td style={{ ...td, width: 92, fontWeight: 600, color: BLUE, whiteSpace: "nowrap" }}>
                그래서
              </td>
              <td style={td}>{overallOpinion.soWhat}</td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 600, color: BLUE, whiteSpace: "nowrap" }}>권고</td>
              <td style={td}>{overallOpinion.recommendation}</td>
            </tr>
            <tr>
              <td style={{ ...td, fontWeight: 600, color: BLUE, whiteSpace: "nowrap" }}>
                전략 유형
              </td>
              <td style={td}>
                <span style={{ fontWeight: 600 }}>{strategyType.label}</span> —{" "}
                {strategyType.description}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---- 2. 6축 준비도 ---- */}
      <div style={{ padding: "44px 60px 0" }}>
        <SectionTitle no="2">6축 준비도</SectionTitle>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 168 }}>축</th>
              <th style={{ ...th, width: 74, textAlign: "right" }}>점수</th>
              <th style={th}>수준</th>
              <th style={{ ...th, width: 82, textAlign: "right" }}>업종 평균</th>
              <th style={{ ...th, width: 96 }}>판정</th>
            </tr>
          </thead>
          <tbody>
            {overall.axes.map((axis) => (
              <tr key={axis.axis}>
                <td style={td}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{axis.axis}</span>{" "}
                  <span style={{ fontWeight: 600 }}>{axis.name}</span>
                </td>
                <td style={{ ...tdMono, textAlign: "right" }}>
                  {axis.score === null ? (
                    <span style={{ color: MUTED }}>보류</span>
                  ) : (
                    axis.score.toFixed(1)
                  )}
                </td>
                <td style={{ ...td, minWidth: 180 }}>
                  {/* 수평 바 + 업종 평균 마커 */}
                  <div
                    style={{
                      position: "relative",
                      height: 7,
                      background: TRACK,
                      borderRadius: 4,
                      marginTop: 5,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        height: 7,
                        width: `${axis.score ?? 0}%`,
                        background: BLUE,
                        borderRadius: 4,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: `${axis.industryAvg}%`,
                        top: -2,
                        width: 2,
                        height: 11,
                        background: MUTED,
                      }}
                    />
                  </div>
                </td>
                <td style={{ ...tdMono, textAlign: "right", color: SECONDARY }}>
                  {axis.industryAvg}
                </td>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: SECONDARY }}>
                    {axis.judgedCount}/{axis.totalCount}
                  </span>
                  {axis.judgedCount < axis.totalCount && (
                    <span style={{ fontSize: 11, color: MUTED }}>
                      {" "}
                      · 보류 {axis.totalCount - axis.judgedCount}건
                    </span>
                  )}
                  {axis.estimated && (
                    <span style={{ fontSize: 11, color: "#9A6A12" }}> · 추정</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.6, color: MUTED }}>
          자료 미제출 문항은 감점이 아닌 판정 보류로 처리되어 분모에서 제외됩니다. 세로 회색
          선은 업종 평균(중소 금속가공 데모 벤치마크) 위치입니다.
        </div>
      </div>

      {/* ---- 3. 8영역 평가 ---- */}
      <div style={{ padding: "44px 60px 0" }}>
        <SectionTitle no="3">8영역 평가</SectionTitle>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 96 }}>영역</th>
              <th style={{ ...th, width: 88 }}>등급</th>
              <th style={th}>현황 (As-Is)</th>
            </tr>
          </thead>
          <tbody>
            {areaAssessments.map((area) => {
              const g = GRADE_STYLE[area.grade];
              return (
                <tr key={area.areaId}>
                  <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {areaName(area.areaId)}
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 11,
                        fontWeight: 600,
                        color: g.color,
                        background: g.bg,
                        borderRadius: 9999,
                        padding: "3px 10px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {g.label}
                    </span>
                  </td>
                  <td style={td}>
                    {area.asIs}
                    {area.grade === "hold" && area.holdReason && (
                      <span style={{ color: MUTED }}> — {area.holdReason}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 10, fontSize: 11, color: MUTED }}>
          8영역은 숫자 점수 없이 3등급(심각·보통·강점)과 판단 보류로만 평가합니다.
        </div>
      </div>

      {/* ---- 4. 선택 과제 ---- */}
      <div style={{ padding: "44px 60px 0" }}>
        <SectionTitle no="4">
          선택 과제 <span style={{ fontFamily: MONO }}>{selectedTasks.length}</span>건
        </SectionTitle>
        {selectedTasks.length === 0 ? (
          <div style={{ fontSize: 13, color: MUTED }}>선택된 과제가 없습니다.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>과제</th>
                <th style={th}>기대효과</th>
                <th style={{ ...th, width: 120, textAlign: "right" }}>자부담 (만원)</th>
              </tr>
            </thead>
            <tbody>
              {selectedTasks.map((task) => (
                <tr key={task.id}>
                  <td style={{ ...td, width: 220 }}>
                    <span style={{ fontWeight: 600 }}>{task.title}</span>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {areaName(task.areaId)} · 난이도 {task.difficulty} ·{" "}
                      <span style={{ fontFamily: MONO }}>
                        {task.durationMonths[0]}~{task.durationMonths[1]}
                      </span>
                      개월
                      {task.isFoundation && " · 기반과제"}
                    </div>
                  </td>
                  <td style={td}>
                    {task.effect.summary}
                    {task.effect.annualSavingRange && (
                      <div style={{ fontFamily: MONO, fontSize: 11.5, color: BLUE, marginTop: 2 }}>
                        연 {fmt(task.effect.annualSavingRange[0])}~
                        {fmt(task.effect.annualSavingRange[1])}만원
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdMono, textAlign: "right" }}>
                    {fmt(task.costBand.selfPay[0])}~{fmt(task.costBand.selfPay[1])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ---- 5. 로드맵 단계 요약 ---- */}
      <div style={{ padding: "44px 60px 0" }}>
        <SectionTitle no="5">로드맵 단계 요약</SectionTitle>
        <div style={{ fontSize: 13, lineHeight: 1.55, color: SECONDARY, marginBottom: 14 }}>
          {roadmap.goalLine} (총{" "}
          <span style={{ fontFamily: MONO, color: INK }}>{roadmap.totalMonths}</span>개월)
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 140 }}>단계</th>
              <th style={{ ...th, width: 130 }}>기간</th>
              <th style={th}>과제</th>
              <th style={th}>go/no-go 게이트</th>
            </tr>
          </thead>
          <tbody>
            {roadmap.stages.map((stage) => (
              <tr key={stage.order}>
                <td style={{ ...td, whiteSpace: "nowrap" }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: BLUE }}>
                    {stage.order}단계
                  </span>{" "}
                  <span style={{ fontWeight: 600 }}>{stage.title}</span>
                </td>
                <td style={tdMono}>
                  {stage.startMonth + 1}~{stage.startMonth + stage.durationMonths}개월차
                </td>
                <td style={td}>
                  {stage.taskIds.map((id) => getTask(id).title).join(" · ")}
                  {stage.autoInserted.length > 0 && (
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      자동 추가: {stage.autoInserted.map((a) => getTask(a.taskId).title).join(", ")}
                    </div>
                  )}
                </td>
                <td style={{ ...td, fontSize: 11.5, color: SECONDARY }}>
                  {stage.gate ? (
                    <>
                      {stage.gate.threshold}
                      <div style={{ color: MUTED, marginTop: 2 }}>{stage.gate.onFail}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- 6. ROI 산출 내역 ---- */}
      <div style={{ padding: "44px 60px 0" }}>
        <SectionTitle no="6">ROI 산출 내역</SectionTitle>
        {roi.items.length === 0 ? (
          <div style={{ fontSize: 13, color: MUTED }}>
            정량 효과 산출 대상 과제가 없습니다 (기반 과제는 정성 효과로 분류).
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>항목</th>
                <th style={th}>산출 가정</th>
                <th style={{ ...th, width: 130, textAlign: "right" }}>연 절감액 (만원)</th>
              </tr>
            </thead>
            <tbody>
              {roi.items.map((item) => (
                <tr key={item.label}>
                  <td style={{ ...td, width: 190, fontWeight: 600 }}>{item.label}</td>
                  <td style={{ ...td, fontSize: 11.5, color: SECONDARY }}>{item.assumption}</td>
                  <td style={{ ...tdMono, textAlign: "right" }}>{fmt(item.annualSaving)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 600, borderBottom: "none" }} colSpan={2}>
                  합산 연 효과 / 총 자부담 / 투자 회수
                </td>
                <td style={{ ...tdMono, textAlign: "right", borderBottom: "none", fontWeight: 600 }}>
                  {fmt(roi.totalAnnualSaving)}만원 · {fmt(roi.totalSelfPay)}만원 · 약{" "}
                  {roi.paybackMonths}개월
                </td>
              </tr>
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.6, color: MUTED }}>
          {roi.disclaimer}
        </div>
      </div>

      {/* ---- 푸터 ---- */}
      <div style={{ padding: "40px 60px 56px" }}>
        <div
          style={{
            borderTop: `1px solid ${HAIRLINE}`,
            paddingTop: 16,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            fontSize: 11,
            lineHeight: 1.6,
            color: MUTED,
          }}
        >
          <div>
            본 보고서는 시연용 더미 데이터 기반입니다. 정부 지원사업(스마트공장 등) 신청
            기초자료로 재활용할 수 있습니다.
          </div>
          <div style={{ whiteSpace: "nowrap" }}>
            문의 <span style={{ fontFamily: MONO }}>https://axcore.ai.kr/#5.contact</span>
          </div>
        </div>
      </div>
    </div>
  );
}
