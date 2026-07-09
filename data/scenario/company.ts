import type { CompanyProfile } from "@/lib/types";

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
  infoSource: "기업 정보 기준: DART·국세청 (데모 데이터)",
};
