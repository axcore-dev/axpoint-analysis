/**
 * 중소 제조기업 AX 7단계 방법론 (SSOT)
 * 근거: docs/참고자료/중소 제조기업 AX 7단계 방법론.xlsx
 *
 * - 1단계(경영문제 정의)는 AXpoint 진단 자체가 수행 — 과제 카탈로그에는 배치하지 않는다.
 * - 2~7단계가 개선 과제(methodStep)와 로드맵 단계의 기준 축.
 */

export type MethodStepNo = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface MethodStep {
  no: MethodStepNo;
  title: string;
  /** 필터 칩 등 좁은 자리용 축약 라벨 */
  shortLabel: string;
  /** 단계 목적 한 줄 (xlsx '목적' 요약) */
  purpose: string;
}

export const METHOD_STEPS: MethodStep[] = [
  {
    no: 1,
    title: "경영문제 정의",
    shortLabel: "문제 정의",
    purpose: "AI가 아니라 어떤 손실을 먼저 줄일지 정합니다",
  },
  {
    no: 2,
    title: "데이터화·표준화",
    shortLabel: "데이터화·표준화",
    purpose: "종이·엑셀·머릿속 정보를 AI가 쓸 수 있는 데이터로 바꿉니다",
  },
  {
    no: 3,
    title: "생산 모니터링 체계 구축",
    shortLabel: "생산 모니터링",
    purpose: "지금 공장이 어떻게 돌아가는지 보이게 만듭니다",
  },
  {
    no: 4,
    title: "품질 안정화",
    shortLabel: "품질 안정화",
    purpose: "가장 빨리 성과가 보이는 불량 문제부터 잡습니다",
  },
  {
    no: 5,
    title: "재고·물류 운영 안정화",
    shortLabel: "재고·물류",
    purpose: "재고 손실·자재 흐름 비효율·납기 차질을 줄입니다",
  },
  {
    no: 6,
    title: "설비 운영 안정화",
    shortLabel: "설비 안정화",
    purpose: "갑작스러운 설비 정지를 줄이고 예방 중심 운영으로 바꿉니다",
  },
  {
    no: 7,
    title: "공정 최적화·확산",
    shortLabel: "공정 최적화",
    purpose: "모은 데이터로 공정을 최적화하고 다른 라인으로 확산합니다",
  },
];

export function getMethodStep(no: MethodStepNo): MethodStep {
  const s = METHOD_STEPS.find((s) => s.no === no);
  if (!s) throw new Error(`방법론에 없는 단계: ${no}`);
  return s;
}

/*
 * (v5) 7단계 → 5단계 재편은 진단 결과 Lv 체계에 적용됨 — data/rubric/meta.ts LEVELS 참조.
 * 로드맵은 이 파일의 METHOD_STEPS(2~7단계)를 그대로 사용한다.
 */
