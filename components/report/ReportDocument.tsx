import type { CSSProperties, ReactNode } from "react";
import type {
  AreaGrade,
  ImprovementTask,
  OverallResult,
  Roadmap,
  RoiBreakdown,
} from "@/lib/types";
import { getTask } from "@/data/catalog/tasks";
import { rubricQuestions } from "@/data/rubric/questions";
import { areaName } from "@/data/rubric/meta";
import {
  areaAssessments,
  comprehensiveAnalysis,
  hitlResponses,
  keyPoint,
  publicSources,
  strategyType,
  uploadedDocs,
} from "@/data/scenario";

/**
 * PDF용 상세 보고서 DOM (F-RPT-06 · 2026-07-09 수정요청v1)
 *
 * 페이지 단위 렌더 — 각 페이지가 794×1123px(A4 @96dpi) 고정 컨테이너
 * (`data-report-page`)로 분리되고, lib/pdf.ts가 페이지별로 개별 캡처해
 * jsPDF에 삽입한다. 표·행이 페이지 경계에서 잘리지 않는다.
 *
 * 디자인 v2: 라이트 배경 · 잉크 #191F28(순수 블랙 금지) · 블루 #0A50FF
 * 액센트 · Paperlogy. 화이트 표지에 블루 포인트 (다크 표지 금지).
 * Lv 중심 표기 — "AX 준비도 N/100"은 쓰지 않고, 축별 점수 표(준비도
 * 페이지)만 상세 보고서 성격상 유지.
 *
 * 중요: html2canvas는 oklch 등 최신 CSS 색상 함수를 지원하지 않는다.
 * 이 파일은 Tailwind 색상 유틸리티를 쓰지 않고 인라인 hex 스타일만 사용한다.
 *
 * 페이지 구성 (6~7p, 담은 과제 수에 따라 가변):
 *   ① 표지  ② 종합 소견 + 업종 대비 포지션  ③ 카테고리별 준비도(6축)
 *   ④ 기능영역 8곳 등급  ⑤ 담은 과제(6건 초과 시 분할)
 *   ⑥ AX 로드맵  ⑦ 예상 효과 산출 + 진단 방법·한계 고지
 */

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

const SANS = "'Paperlogy', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";

const PAGE_W = 794; // A4 210mm @ 96dpi
const PAGE_H = 1123; // A4 297mm @ 96dpi
const PAGE_PAD = 56;

/** 낙인 어휘 금지 — "심각" 대신 "관리 대상" (라이팅 규칙) */
const GRADE_STYLE: Record<AreaGrade, { label: string; color: string; bg: string }> = {
  critical: { label: "관리 대상", color: "#B45608", bg: "#FDF2E5" },
  normal: { label: "보통", color: "#4E5968", bg: "#F2F4F6" },
  strength: { label: "강점", color: "#0F9D58", bg: "#E8F6EE" },
  hold: { label: "판단 보류", color: "#8B95A1", bg: "#F9FAFB" },
};

const fmt = (n: number) => n.toLocaleString("ko-KR");

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

/* ============ 본문 ============ */

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
  /* 과제 6건 초과 시 페이지 분할 (표 행이 경계에서 잘리지 않도록) */
  const taskChunks: ImprovementTask[][] =
    selectedTasks.length > 0 ? chunk(selectedTasks, 6) : [[]];

  /* 업종 대비 포지션 — 전부 런타임 계산 (engine.computeOverall 정합) */
  const industryMean = overall.scoreRaw - overall.industryDiff;
  const diffAbs = Math.abs(overall.industryDiff).toFixed(1);
  const diffAhead = overall.industryDiff >= 0;

  /* ---- 페이지 본문 목록 ---- */
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
        <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 13, color: SECONDARY }}>
          진단일 {diagnosisDate}
        </div>
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
          {overall.level.label}
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
            }}
          >
            전략 유형 — {strategyType.label}
          </span>
        </div>
        {/* Key Point — 진단 결과 화면과 동일 (v5) */}
        <div style={{ marginTop: 14, fontSize: 14, fontWeight: 600, color: INK }}>
          지금 당장은 — {keyPoint}
        </div>
      </div>

      <div style={{ marginTop: "auto", paddingBottom: 24, fontSize: 11, lineHeight: 1.7, color: MUTED }}>
        이 보고서는 시연용 데모 데이터로 만들었어요. 정부 지원사업(스마트공장 등) 신청
        기초자료 양식을 따릅니다.
      </div>
    </div>,
  );

  /* ── ② 종합 소견(3단) + 업종 대비 포지션 ── */
  bodies.push(
    <div>
      <SectionTitle no="1">종합 분석 결과</SectionTitle>
      {/* 진단 결과 화면과 동일한 내용 (v5) — 결론 + 강점/보완/AX 전략 제안 불릿 */}
      <div
        style={{
          fontSize: 19,
          fontWeight: 600,
          letterSpacing: "-0.012em",
          lineHeight: 1.4,
          color: INK,
        }}
      >
        {comprehensiveAnalysis.conclusion}
      </div>
      <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
        {(
          [
            { label: "강점", color: "#0F9D58", items: comprehensiveAnalysis.strengths },
            { label: "보완", color: "#B45608", items: comprehensiveAnalysis.improvements },
            {
              label: "AX 전략 제안",
              color: BLUE,
              items: [
                { title: strategyType.label, body: comprehensiveAnalysis.strategyDirection },
              ],
            },
          ] as const
        ).map((group) => (
          <div key={group.label}>
            <div style={{ fontSize: 12, fontWeight: 700, color: group.color, marginBottom: 6 }}>
              {group.label}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {group.items.map((it) => (
                <div key={it.title} style={{ display: "flex", gap: 8 }}>
                  <span
                    style={{
                      flex: "none",
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: group.color,
                      marginTop: 7,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>{it.title}</div>
                    <div style={{ marginTop: 2, fontSize: 11.5, lineHeight: 1.55, color: SECONDARY }}>
                      {it.body}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40 }}>
        <SectionTitle no="2">업종 대비 포지션</SectionTitle>
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
            업종 평균보다 {diffAhead ? "+" : "-"}
            {diffAbs}점
          </span>{" "}
          {diffAhead ? "앞서 있어요." : "뒤에 있어요."}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>
          중소 금속가공 표본 평균 {Math.round(industryMean)}점 대비 · 판정 가능 축 평균 기준
          (데모 벤치마크)
        </div>

        {/* 자사 vs 업종 평균 비교 바 */}
        <div style={{ marginTop: 20, maxWidth: 560 }}>
          {[
            { label: "귀사", value: overall.scoreRaw, color: BLUE },
            { label: "업종 평균", value: industryMean, color: "#B0B8C1" },
          ].map((row) => (
            <div
              key={row.label}
              style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}
            >
              <span style={{ flex: "none", width: 64, fontSize: 12, fontWeight: 600, color: SECONDARY }}>
                {row.label}
              </span>
              <div style={{ flex: "1 1 auto", position: "relative", height: 8, background: TRACK, borderRadius: 4 }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: 8,
                    width: `${Math.min(row.value, 100)}%`,
                    background: row.color,
                    borderRadius: 4,
                  }}
                />
              </div>
              <span style={{ flex: "none", width: 44, textAlign: "right", fontFamily: MONO, fontSize: 12.5, color: INK }}>
                {row.value.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
        <div style={note}>
          성숙도 기준: AX 실행 5단계(경영문제 정의 → 데이터화·표준화 → 생산 모니터링 →
          운영 안정화 → 공정 최적화·확산). 국내 중소 제조 대부분이 Lv.1~2 구간에
          분포합니다. 업종 평균은 중소 금속가공 표본의 데모 벤치마크 값으로, 실서비스에서는
          진단 사례 축적 데이터로 대체됩니다.
        </div>
      </div>
    </div>,
  );

  /* ── ③ 카테고리별 준비도 (6축 — 상세 보고서 성격상 축별 점수 유지) ── */
  bodies.push(
    <div>
      <SectionTitle no="3">카테고리별 준비도</SectionTitle>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 168 }}>축</th>
            <th style={{ ...th, width: 64, textAlign: "right" }}>점수</th>
            <th style={th}>수준</th>
            <th style={{ ...th, width: 78, textAlign: "right" }}>업종 평균</th>
            <th style={{ ...th, width: 150 }}>자료 충분도</th>
          </tr>
        </thead>
        <tbody>
          {overall.axes.map((axis) => {
            const deferred = axis.totalCount - axis.judgedCount;
            return (
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
                <td style={{ ...td, minWidth: 170 }}>
                  {/* 수평 점수 바 + 업종 평균 마커 */}
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
                    {axis.judgedCount}/{axis.totalCount} 판정 · {Math.round(axis.coverage * 100)}%
                  </span>
                  {deferred > 0 && (
                    <span style={{ fontSize: 11, color: MUTED }}> · 보류 {deferred}건</span>
                  )}
                  {axis.estimated && (
                    <span style={{ fontSize: 11, color: "#B45608" }}> · 추정</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={note}>
        자료 미제출 문항은 감점이 아닌 판정 보류로 처리해 분모에서 제외합니다. 세로 회색
        선은 업종 평균(중소 금속가공 데모 벤치마크) 위치입니다. 자료 충분도 50% 미만인
        축은 &ldquo;추정&rdquo;으로 표기합니다.
      </div>
    </div>,
  );

  /* ── ④ 기능영역 8곳 등급 ── */
  bodies.push(
    <div>
      <SectionTitle no="4">기능영역 8곳 진단</SectionTitle>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 92 }}>영역</th>
            <th style={{ ...th, width: 92 }}>등급</th>
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
                      border: area.grade === "hold" ? `1px solid ${HAIRLINE}` : "none",
                      borderRadius: 9999,
                      padding: "3px 10px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {g.label}
                  </span>
                </td>
                <td style={{ ...td, fontSize: 12 }}>
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
      <div style={note}>
        기능영역은 숫자 점수 없이 관리 대상·보통·강점 3등급과 판단 보류로만 평가합니다.
        낮은 등급이 개선 과제 추천의 우선 대상입니다.
      </div>

    </div>,
  );

  /* ── ⑤ 담은 과제 (6건 초과 시 페이지 분할) ── */
  taskChunks.forEach((tasks, chunkIdx) => {
    bodies.push(
      <div>
        <SectionTitle no="5">
          담은 과제 <span style={{ fontFamily: MONO }}>{selectedTasks.length}</span>건
          {taskChunks.length > 1 && (
            <span style={{ fontSize: 13, fontWeight: 400, color: MUTED }}>
              {" "}
              ({chunkIdx + 1}/{taskChunks.length})
            </span>
          )}
        </SectionTitle>
        {tasks.length === 0 ? (
          <div style={{ fontSize: 13, color: MUTED }}>담은 과제가 없어요.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>과제</th>
                <th style={th}>Before → After</th>
                <th style={{ ...th, width: 76, textAlign: "right" }}>기간</th>
                <th style={{ ...th, width: 110, textAlign: "right" }}>자부담 (만원)</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td style={{ ...td, width: 230 }}>
                    <span style={{ fontWeight: 600 }}>{task.title}</span>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {areaName(task.areaId)} · 난이도 {task.difficulty}
                    </div>
                  </td>
                  <td style={{ ...td, fontSize: 12 }}>
                    {task.beforeAfter ?? task.effect.summary}
                    {task.effect.annualSavingRange && (
                      <div style={{ fontFamily: MONO, fontSize: 11.5, color: BLUE, marginTop: 2 }}>
                        연 {fmt(task.effect.annualSavingRange[0])}~
                        {fmt(task.effect.annualSavingRange[1])}만원 절감 추정
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdMono, textAlign: "right" }}>
                    {task.durationMonths[0]}~{task.durationMonths[1]}개월
                  </td>
                  <td style={{ ...tdMono, textAlign: "right" }}>
                    {fmt(task.costBand.selfPay[0])}~{fmt(task.costBand.selfPay[1])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {chunkIdx === taskChunks.length - 1 && tasks.length > 0 && (
          <div style={note}>
            자부담은 정부 지원사업(스마트공장 등) 선정 기준의 추정 밴드예요. 사업 선정
            결과에 따라 달라질 수 있어요.
          </div>
        )}
      </div>,
    );
  });

  /* ── ⑥ AX 로드맵 (기간·게이트·역할) ── */
  bodies.push(
    <div>
      <SectionTitle no="6">
        AX 로드맵 — 총 <span style={{ fontFamily: MONO }}>{roadmap.totalMonths}</span>개월
      </SectionTitle>
      {roadmap.stages.length === 0 ? (
        <div style={{ fontSize: 13, color: MUTED }}>담은 과제가 없어 로드맵이 비어 있어요.</div>
      ) : (
        roadmap.stages.map((stage) => (
          <div
            key={stage.order}
            style={{
              border: `1px solid ${HAIRLINE}`,
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: BLUE }}>
                  STEP {stage.order}
                </span>{" "}
                {stage.title}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: SECONDARY, whiteSpace: "nowrap" }}>
                {stage.done
                  ? "완료 — 이번 진단"
                  : `약 ${stage.durationMonths}개월 · 금액 ${fmt(stage.costBand.selfPay[0])}~${fmt(
                      stage.costBand.selfPay[1],
                    )}만원`}
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.55, color: MUTED }}>
              {stage.purpose}
            </div>
            {stage.taskIds.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.55, color: INK }}>
                {stage.taskIds.map((id) => getTask(id).title).join(" · ")}
              </div>
            )}
            {stage.autoInserted.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: MUTED }}>
                자동 추가:{" "}
                {stage.autoInserted.map((a) => getTask(a.taskId).title).join(", ")} (선행 기반
                과제)
              </div>
            )}
            {stage.todos.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: SECONDARY, marginBottom: 3 }}>
                  할 일
                </div>
                <div style={{ fontSize: 11.5, lineHeight: 1.55, color: SECONDARY }}>
                  {stage.todos.map((t) => `[${t.owner}] ${t.text}`).join(" · ")}
                </div>
              </div>
            )}
          </div>
        ))
      )}
      <div style={note}>
        단계 내 과제는 병렬 진행을 가정하고, 기간은 단계 내 최장 과제 기준이에요. 자부담
        밴드는 정부 지원사업 선정 기준의 추정치예요.
      </div>
    </div>,
  );

  /* ── ⑦ 예상 효과 산출 + 진단 방법·한계 고지 (말미 고정 블록) ── */
  bodies.push(
    <div>
      <SectionTitle no="7">예상 효과 산출 내역</SectionTitle>
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
              <tr key={item.label}>
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
                {fmt(roi.totalAnnualSaving)}만원 · {fmt(roi.totalSelfPay)}만원 · 약{" "}
                {roi.paybackMonths}개월
              </td>
            </tr>
          </tbody>
        </table>
      )}
      <div style={note}>{roi.disclaimer}</div>

      {/* 말미 고정 블록 — 이 진단이 본 자료·방법 */}
      <div
        style={{
          marginTop: 36,
          border: `1px solid ${HAIRLINE}`,
          borderRadius: 12,
          padding: "18px 20px",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>이 진단이 본 자료·방법</div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
          <tbody>
            {(
              [
                [
                  "본 자료",
                  `업로드 자료 ${uploadedDocs.length}건 · 공개 데이터 ${publicSources.length}종 · 확인 응답 ${hitlResponses.length}건`,
                ],
                ["진단 모델", `6축 ${rubricQuestions.length}문항 판정 (판정 기준서 v0.1)`],
                ["기준일", diagnosisDate],
              ] as const
            ).map(([label, value]) => (
              <tr key={label}>
                <td
                  style={{
                    width: 84,
                    padding: "4px 0",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: SECONDARY,
                    whiteSpace: "nowrap",
                    verticalAlign: "top",
                  }}
                >
                  {label}
                </td>
                <td style={{ padding: "4px 0", fontSize: 12, lineHeight: 1.55, color: INK }}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${HAIRLINE}`,
            fontSize: 11.5,
            lineHeight: 1.6,
            color: MUTED,
          }}
        >
          한계 고지 — 이 결과는 공개 자료·제출 자료 범위 내 추정이며, 자료를 더 주시면
          정확도가 올라가요. 문의: https://axcore.ai.kr
        </div>
      </div>
    </div>,
  );

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
