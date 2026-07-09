import type { RoiBreakdown, RoiItem } from "@/lib/types";
import { getTask } from "@/data/catalog/tasks";
import { roiAssumptions } from "@/data/scenario/roi";

/**
 * ROI 산출 (F-RPT-01, REQ-F-18) — 담은 과제 기준 결정론적 계산.
 * 예상 연 효과 = 과제별 절감 밴드 중간값 합산 (정량 효과 보유 과제만)
 * 투자 회수 = 총 자부담(중간값) ÷ (연 효과 ÷ 12), 올림
 * 산출 가정은 항목별로 명시 — 드릴다운에서 노출.
 */
export function computeRoi(selectedTaskIds: string[]): RoiBreakdown {
  const tasks = selectedTaskIds.map(getTask);

  const items: RoiItem[] = tasks
    .filter((t) => t.effect.annualSavingRange)
    .map((t) => {
      const [min, max] = t.effect.annualSavingRange as [number, number];
      return {
        label: t.title,
        annualSaving: Math.round((min + max) / 2 / 10) * 10,
        assumption: roiAssumptions[t.id] ?? "산출 가정 협의 필요",
        relatedTaskId: t.id,
      };
    });

  const totalAnnualSaving = items.reduce((a, i) => a + i.annualSaving, 0);
  const totalSelfPay = tasks.reduce(
    (a, t) => a + Math.round((t.costBand.selfPay[0] + t.costBand.selfPay[1]) / 2),
    0,
  );
  const paybackMonths =
    totalAnnualSaving > 0 ? Math.ceil(totalSelfPay / (totalAnnualSaving / 12)) : 0;

  return {
    items,
    totalAnnualSaving,
    totalSelfPay,
    paybackMonths,
    disclaimer:
      "귀사 업로드 자료의 공수·재고 신호와 데모 기준 단가로 산출한 추정 밴드입니다. 기반 과제(코드 표준화 등)의 효과는 정성 효과로 분류되어 합산에서 제외됩니다.",
  };
}
