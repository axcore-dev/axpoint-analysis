import type { Anchor, AxisId, FunctionAreaId, LevelInfo } from "@/lib/types";

/**
 * 채점 체계 메타 — 앵커 환산표, 축 정의, 단계(Lv) 기준표, 8영역 정의
 *
 * ─ 앵커 환산·집계 규칙: 채점기준서 v0.1 시트 0 "가이드" 그대로
 * ─ 단계(Lv) 기준표: 가이드의 "단계 매핑은 별도 기준표에서 관리"에 따른
 *   데모 확정본. KSMS 계열 5단계 (F-ANL-02: 성숙도 기준 1개로 통일,
 *   F-BCK-05 매핑 테이블의 데모 버전)
 */

/** 앵커 환산: A0=0 / A1=25 / A2=50 / A3=75 / A4=100 (중간 판정 불허) */
export const ANCHOR_SCORE: Record<Anchor, number> = {
  A0: 0,
  A1: 25,
  A2: 50,
  A3: 75,
  A4: 100,
};

/** 축 커버리지 임계 — 미만이면 "추정(신뢰도 낮음)" 표기 */
export const COVERAGE_THRESHOLD = 0.5;

/** 분류 신뢰도 임계 — 미만이면 HITL 원탭 확인 (REQ-F-08) */
export const CLASSIFY_CONFIDENCE_THRESHOLD = 0.7;

export const AXES: { id: AxisId; name: string; short: string; description: string }[] = [
  {
    id: "ICS",
    name: "인프라·연동 성숙도",
    short: "인프라·연동",
    description: "실적 기록 방식, 코드 표준화, 시스템 보유·연동, 데이터 보관, 설비 데이터 수집",
  },
  {
    id: "AOS",
    name: "업무 자동화 기회",
    short: "자동화 기회",
    description: "중복 입력, 디지털 처리 비율, 집계·보고 자동화, 품질 기록 코드화, 데이터 기반 발주",
  },
  {
    id: "OCS",
    name: "조직 준비도", // PRD 오픈 이슈 O2 → "조직 준비도"로 확정 (2026-07-09)
    short: "조직 준비도",
    description: "의사결정 구조, IT 인력, 현장-사무 정보 흐름, 업무 지식 문서화, 실행 여력",
  },
  {
    id: "TAS",
    name: "기술 수용성",
    short: "기술 수용성",
    description: "현장 디지털 도구 사용, 도입 경험, 경영진 관심, 직원 변화 수용도",
  },
  {
    id: "FRS",
    name: "투자 여력·ROI",
    short: "투자 여력",
    description: "재무 상태, 정부지원 요건, 단기 회수 과제, 선행 투자 이력",
  },
  {
    id: "SCS",
    name: "보안·배포 여건",
    short: "보안·배포",
    description: "규제 산업 여부, 고객 보안 요구, 클라우드 가능 여건, 개인정보 관리 부담",
  },
];

export function axisName(id: AxisId): string {
  return AXES.find((a) => a.id === id)?.name ?? id;
}

/**
 * 업종 평균 (데모 벤치마크 v0.1)
 * 중소 제조업(금속가공) 표본 기준의 더미 값 — 6축 카드에 흡수 표기 (F-ANL-05).
 * 실서비스에서는 진단 사례 축적 데이터로 대체한다.
 */
/**
 * 업종 평균 (중소 금속가공 데모 벤치마크) — 수정요청v5+: 현실화.
 * 국내 중소 제조 대부분이 데이터화·표준화 이전 단계(Lv.1~2)라는 전제로 하향.
 * 평균 48.7 → Lv.2 데이터화·표준화 구간. narrative.ts의 축별 평균 언급과 정합 유지할 것.
 */
export const INDUSTRY_AVG: Record<AxisId, number> = {
  ICS: 50,
  AOS: 46,
  OCS: 45,
  TAS: 44,
  FRS: 55,
  SCS: 52,
};

/**
 * 단계(Lv) 기준표 — 대표 지표 단일화 (REQ-F-10: 첫 화면 대형 지표 1개)
 * 수정요청v5: AX 7단계 방법론을 5단계로 재편한 실행 단계 축.
 * 1·2·3단계 선행 → 4단계(품질/재고·물류/설비 — 기업 맞춤 선택) → 5단계 최종.
 * 점수 구간(v5+ 현실화): 국내 중소 제조 대부분이 Lv.1~2에 분포하는 전제 —
 * 데모기업 57점 → Lv.2 데이터화·표준화 (수기 4회 재입력·코드 불일치 시나리오와 정합).
 */
export const LEVELS: LevelInfo[] = [
  {
    level: 1,
    label: "Lv.1 경영문제 정의",
    description: "AI가 아니라 어떤 손실을 먼저 줄일지 정하는 출발 단계",
    range: [0, 30],
  },
  {
    level: 2,
    label: "Lv.2 데이터화·표준화",
    description: "종이·엑셀·머릿속 정보를 AI가 쓸 수 있는 데이터로 바꾸는 단계",
    range: [31, 60],
  },
  {
    level: 3,
    label: "Lv.3 생산 모니터링",
    description: "지금 공장이 어떻게 돌아가는지 보이게 만드는 단계",
    range: [61, 75],
  },
  {
    level: 4,
    label: "Lv.4 운영 안정화",
    description: "재고·물류/품질/설비 중 기업에 맞는 영역부터 선택해 안정화하는 단계",
    range: [76, 88],
  },
  {
    level: 5,
    label: "Lv.5 공정 최적화·확산",
    description: "모은 데이터로 공정을 최적화하고 다른 라인으로 확산하는 단계",
    range: [89, 100],
  },
];

/**
 * 8대 기능영역 (F-CMN-02) — 분류·분석·과제 필터가 공유하는 단일 체계.
 * 명칭·순서를 세 화면에서 완전히 일치시킬 것 (REQ-F-02 수용 기준 ①).
 */
export const FUNCTION_AREAS: { id: FunctionAreaId; name: string }[] = [
  { id: "mgmt", name: "경영지원" },
  { id: "design", name: "제품설계" },
  { id: "production", name: "생산관리" },
  { id: "equipment", name: "장비관리" },
  { id: "quality", name: "품질검사" },
  { id: "logistics", name: "재고물류" },
  { id: "sales", name: "영업관리" },
  { id: "cs", name: "고객지원" },
];

export function areaName(id: FunctionAreaId): string {
  return FUNCTION_AREAS.find((a) => a.id === id)?.name ?? id;
}

/** 디지털화수준 라벨 (3축 태깅) */
export const DIGITAL_LEVELS: Record<string, string> = {
  L1: "L1 수기",
  L2: "L2 개인문서",
  L3: "L3 정형양식",
  L4: "L4 시스템출력",
};

/** 도입률 통계 각주 (F-ANL-01 "지금 시작하면 ~% 앞서갑니다" 근거) */
export const ADOPTION_FOOTNOTE =
  "전국 중소 제조기업의 약 80%가 스마트공장 미도입 상태입니다. (기초 단계 포함 시 상위 20% 진입 기준, 데모 통계)";
