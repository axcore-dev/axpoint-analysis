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
export const INDUSTRY_AVG: Record<AxisId, number> = {
  ICS: 52,
  AOS: 48,
  OCS: 55,
  TAS: 50,
  FRS: 60,
  SCS: 65,
};

/**
 * 단계(Lv) 기준표 — 대표 지표 단일화 (REQ-F-10: 첫 화면 대형 지표 1개)
 * KSMS(스마트공장 수준확인) 계열 5단계와 정합되는 데모 기준.
 */
export const LEVELS: LevelInfo[] = [
  {
    level: 1,
    label: "Lv.1 미도입",
    description: "ICT 미적용 — 수기 중심 관리, 데이터가 종이에 머무는 단계",
    range: [0, 20],
  },
  {
    level: 2,
    label: "Lv.2 기초",
    description: "부분 전산화 — 개인 문서로 관리되나 데이터가 산재된 단계",
    range: [21, 40],
  },
  {
    level: 3,
    label: "Lv.3 부분 적용",
    description: "정형화·부분 시스템 — 양식과 도구는 갖췄으나 연동이 끊겨 있는 단계",
    range: [41, 60],
  },
  {
    level: 4,
    label: "Lv.4 통합",
    description: "시스템 연동 — 데이터가 흐르고 관리가 시스템 기반인 단계",
    range: [61, 80],
  },
  {
    level: 5,
    label: "Lv.5 고도화",
    description: "자동화·지능화 — 축적 데이터로 AI 적용이 가능한 단계",
    range: [81, 100],
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
