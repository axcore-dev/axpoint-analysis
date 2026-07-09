import type { ValueChainAnalysis } from "@/lib/types";

/**
 * 가치사슬 흐름 교차 분석 (F-ANL-07, REQ-F-13)
 * 발주서 × 생산기록 × 재고표 2종 이상 존재 시에만 생성 — 본 시나리오는
 * 3종 모두 보유. "귀사 자료로만 산출" 명시(공개 데이터 미사용).
 * 필요 문서 부족 시 이 섹션은 미노출된다 (빈 껍데기 금지).
 */
export const valueChainAnalysis: ValueChainAnalysis = {
  available: true,
  usedDocTypes: ["발주서", "생산일지·작업일보", "재고표", "거래명세서"],
  signals: [
    {
      id: "vc1",
      title: "품목 표기 불일치로 흐름 추적 단절",
      finding:
        "발주서·재고표·생산일지의 품목 표기 매칭률이 28%에 그칩니다. 동일 품목(B-102 브라켓)이 문서마다 'BRK-102' · '브라켓 B-102' · '브라켓(소)'로 달라, 발주→생산→재고로 이어지는 흐름을 사람이 기억으로 잇고 있습니다.",
      sourceDocIds: ["d03", "d05", "d01"],
      severity: "warning",
    },
    {
      id: "vc2",
      title: "주력 품목 과잉 재고 신호",
      finding:
        "브라켓류(B-102 계열)는 재고 회전이 약 12일인데 발주 주기는 약 30일 — 평균 2.5주치 재고가 상시 잠겨 있는 것으로 추정됩니다. 발주 기준(발주점) 부재가 원인으로 보입니다.",
      sourceDocIds: ["d03", "d05"],
      severity: "warning",
    },
    {
      id: "vc3",
      title: "생산 집계와 출하 수량 불일치",
      finding:
        "6월 월 생산 집계와 거래명세서 수량이 2개 품목에서 불일치합니다. 수기 재입력 과정의 이관 오류로 추정되며, 원천 1회 입력 체계로 전환 시 사라지는 유형의 오차입니다.",
      sourceDocIds: ["d08", "d04"],
      severity: "info",
    },
  ],
};
