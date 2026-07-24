import type { CompanyProfile, CompanyStat } from "@/lib/types";

/**
 * (주)데모기업 — 대표 데모 시나리오 (2026-07-09 확정: 단일 시나리오)
 *
 * 어떤 기업명을 입력해도 이 시나리오로 진행된다 (백엔드 없음).
 * 프로필: 광주 소재 중소 금속가공(자동차 부품 협력사), 45인, 오너 의사결정.
 * PRD 타겟 페르소나(수도권·호남권 10~100인, 스마트공장 미도입~기초)에 부합.
 */
export const demoCompany: CompanyProfile = {
  name: "(주)데모기업",
  bizNo: "123-45-67890",
  ceo: "김대호",
  established: "2008-03-12",
  employees: 45,
  revenue: 82,
  industry: "금속가공제품 제조업 (자동차 차체 부품)",
  industryCode: "C259",
  address: "광주광역시 광산구 하남산단로 00",
  infoSource: "기업 정보 기준: DART 전자공시 (데모 데이터)",
};

/**
 * 기업 개요 통계 칩 (진단 결과 섹션 1 · 2026-07-09 수정요청v1)
 * 가로 스크롤 + 클릭 시 팝업 상세. sourceId는 공개 데이터(publicData.ts)와 연결.
 * 수치는 publicSources·judgments와 반드시 정합할 것.
 */
export const companyStats: CompanyStat[] = [
  {
    id: "stat-revenue",
    label: "연 매출",
    value: "82억원",
    basis: "2025년",
    detail: [
      "최근 3개년 매출은 78억 → 82억원으로 완만한 성장세예요. (+5.1%)",
      "영업이익은 3.2억원으로 3년 연속 흑자를 유지하고 있어요.",
    ],
    sourceId: "pub-dart",
  },
  {
    /* v7: '정부 R&D 과제' 칩 대체 — 스마트공장 사업 수혜 여부 판단, 2번째 위치 */
    id: "stat-smart",
    label: "스마트공장 사업",
    value: "수혜 이력 없음",
    detail: [
      "정부 스마트공장 보급·확산 사업 참여 이력이 확인되지 않았어요.",
      "미참여 기업으로, 기초 단계 신규 신청 대상이에요.",
    ],
  },
  {
    id: "stat-patent",
    label: "특허",
    value: "등록 3건",
    detail: [
      "최근 3년 내 출원 1건(2025)이 있어요.",
      "IPC 분류는 B23(공작기계) 중심으로, 가공 기술 특허예요.",
    ],
    sourceId: "pub-kipo",
  },
  {
    id: "stat-news",
    label: "최근 보도",
    value: "2건",
    detail: [
      "지역 뿌리기업 자동화 설비 투자 협약을 체결했어요. (2023-11)",
      "대표가 지역 상공회의소 디지털 전환 교육 과정을 수료했어요. (2025-09)",
    ],
    sourceId: "pub-news",
  },
  {
    id: "stat-emp",
    label: "고용",
    value: "45명",
    detail: [
      "최근 1년 사이 3명이 늘었어요. (완만한 증가)",
      "직무 분포는 생산직 중심이고, IT 직무 채용 이력은 0건이에요.",
    ],
    sourceId: "pub-emp",
  },
  {
    id: "stat-pps",
    label: "조달 실적",
    value: "2건 · 4.1억원",
    detail: ["공공 조달 낙찰 2건(2023, 2025), 누적 4.1억원이에요.", "낙찰 품목은 금속 구조물 부품이에요."],
    sourceId: "pub-pps",
  },
  {
    id: "stat-cert",
    label: "인증",
    value: "벤처(만료)",
    detail: [
      "벤처기업 인증을 2012년에 취득했고 2018년에 만료됐어요.",
      "이노비즈·메인비즈 인증 이력은 없어요.",
    ],
    sourceId: "pub-venture",
  },
];
