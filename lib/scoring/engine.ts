import type { AxisId, AxisScore, Judgment, LevelInfo, OverallResult } from "@/lib/types";
import { rubricQuestions } from "@/data/rubric/questions";
import {
  ANCHOR_SCORE,
  AXES,
  COVERAGE_THRESHOLD,
  INDUSTRY_AVG,
  LEVELS,
} from "@/data/rubric/meta";

/**
 * 6축 채점 엔진 (F-BCK-01, F-BCK-02)
 *
 * 채점기준서 v0.1 가이드의 집계 규칙을 결정론적으로 구현한다:
 * - 문항 점수 = 앵커 환산 (A0=0 … A4=100)
 * - 축 점수 = 판정된 문항의 평균 (균등 가중). 결측(보류) 문항은 분모에서
 *   제외 — 자료 미제출은 감점이 아니라 신뢰도 하락 (REQ-N-02)
 * - 커버리지 = 축 내 판정 가능 문항 비율. 50% 미만이면 "추정" 표기
 * - 종합 점수 = 6축 평균. 단계(Lv) 매핑은 별도 기준표(meta.LEVELS)
 *
 * 동일 입력 → 동일 출력 (REQ-N-01 재현성).
 */

export function anchorScore(j: Judgment): number | null {
  return j.anchor === null ? null : ANCHOR_SCORE[j.anchor];
}

/** 축별 점수 집계 */
export function scoreAxes(judgments: Judgment[]): AxisScore[] {
  const byId = new Map(judgments.map((j) => [j.questionId, j]));

  return AXES.map(({ id, name }) => {
    const questions = rubricQuestions.filter((q) => q.axis === id);
    const scores = questions
      .map((q) => byId.get(q.id))
      .filter((j): j is Judgment => j !== undefined && j.anchor !== null)
      .map((j) => ANCHOR_SCORE[j.anchor as NonNullable<typeof j.anchor>]);

    const judgedCount = scores.length;
    const totalCount = questions.length;
    const coverage = totalCount === 0 ? 0 : judgedCount / totalCount;
    const score =
      judgedCount === 0 ? null : scores.reduce((a, b) => a + b, 0) / judgedCount;

    return {
      axis: id,
      name,
      score,
      judgedCount,
      totalCount,
      coverage,
      estimated: coverage < COVERAGE_THRESHOLD,
      industryAvg: INDUSTRY_AVG[id],
    };
  });
}

/** 종합점수 구간 → 단계(Lv) */
export function mapLevel(score: number): LevelInfo {
  const rounded = Math.round(score);
  const found = LEVELS.find(({ range: [min, max] }) => rounded >= min && rounded <= max);
  return found ?? LEVELS[0];
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
}

/** 종합 결과 산출 — 판정 불가(null) 축은 종합 평균 분모에서도 제외 */
export function computeOverall(judgments: Judgment[]): OverallResult {
  const axes = scoreAxes(judgments);
  const scored = axes.filter(
    (a): a is AxisScore & { score: number } => a.score !== null,
  );

  const scoreRaw =
    scored.length === 0
      ? 0
      : scored.reduce((a, b) => a + b.score, 0) / scored.length;
  const score = Math.round(scoreRaw);

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const strengths = sorted.slice(0, 2).map((a) => a.axis);
  const bottlenecks = sorted
    .slice(-2)
    .map((a) => a.axis)
    .reverse();

  const max = sorted[0]?.score ?? 0;
  const min = sorted[sorted.length - 1]?.score ?? 0;
  const asymmetric = max - min >= 25;

  const sd = stdDev(scored.map((a) => a.score));
  const balanceLabel = sd < 10 ? "균형형" : sd < 20 ? "다소 편차" : "특정 영역 집중";

  const industryMean =
    scored.reduce((a, b) => a + b.industryAvg, 0) / Math.max(scored.length, 1);
  const industryDiff = scoreRaw - industryMean;

  return {
    score,
    scoreRaw,
    level: mapLevel(scoreRaw),
    axes,
    strengths,
    bottlenecks,
    asymmetric,
    balanceLabel,
    industryDiff,
  };
}

/** 축 우선 정렬 (병목 축 우선 — 진단 결과 우측 프로그레스바 정렬용) */
export function sortAxesByScore(axes: AxisScore[], asc = true): AxisScore[] {
  return [...axes].sort((a, b) => {
    const av = a.score ?? Number.POSITIVE_INFINITY;
    const bv = b.score ?? Number.POSITIVE_INFINITY;
    return asc ? av - bv : bv - av;
  });
}
