import type { PublicSource } from "@/lib/types";

/**
 * 공개 데이터 수집 결과 11종 (F-COL-01, REQ-F-06 — 2026-07-09 수정요청v1)
 * v2: 화면에는 종류(name) + 출처(sourceApi) + 수집 건수(count)만 표기.
 * items는 클릭 상세용(해요체 2~3줄). area/digitalLevel은 8대 영역 자료
 * 분류 화면에서의 배치·수준 태깅용.
 *
 * 시나리오 일관성 (judgments.ts와 정합):
 * - 벤처기업인증: 2012 취득 → 2018 만료 (과거 이력만)
 * - 이노비즈·메인비즈: 이력 없음 (0건도 확인 완료 = done)
 * - R&D 1건(2024 지역 뿌리기업 공정개선) → TAS-03 "능동 신호" 근거
 * - 커뮤니티/SNS 3건(5건 미만) → 단독 판정 근거 아님 (TAS-04 보조 근거)
 * - 설문 12건 = 13문항 중 10번(매출) 조건부 미노출 제외 응답 수
 */
export const publicSources: PublicSource[] = [
  {
    id: "pub-disclosure",
    name: "전자공시(DART)",
    sourceApi: "DART API",
    status: "done",
    count: 3,
    area: "mgmt",
    digitalLevel: "L4",
    items: [
      "업종은 금속가공제품 제조업(C259)으로, 정부 지원 우대 대상인 뿌리산업에 해당해요.",
      "2008년 3월 설립, 소재지는 광주광역시 광산구예요.",
      "사업 상태는 계속사업자(정상)로 확인돼요.",
    ],
  },
  {
    id: "pub-dart",
    name: "재무정보",
    sourceApi: "DART API",
    status: "done",
    count: 3,
    area: "mgmt",
    digitalLevel: "L4",
    items: [
      "매출액은 82억원으로 전년 78억원 대비 +5.1% 성장했어요. (2025년 기준)",
      "영업이익 3.2억원 — 3년 연속 흑자를 유지하고 있어요.",
      "재무제표 기준 직원 수는 45명이에요.",
    ],
    note: "기업 기본정보는 DART 공시 기준으로 표기해요.",
  },
  {
    id: "pub-kipo",
    name: "특허·실용신안",
    sourceApi: "KIPRISPlus(특허청) API",
    status: "done",
    count: 4,
    area: "design",
    digitalLevel: "L4",
    items: [
      "등록 특허 3건, 최근 3년 내 출원 1건(2025)이 확인돼요.",
      "IPC 분류는 B23(공작기계) 3건, B21(소성가공) 1건으로 가공 기술 중심이에요.",
      "가장 최근 출원은 프레스 금형 관련이에요. (2025-04)",
    ],
    note: "건수 나열 대신 요약 지표로 표시해요.",
  },
  {
    id: "pub-pps",
    name: "조달 낙찰 이력",
    sourceApi: "공공데이터포탈(조달청) API",
    status: "done",
    count: 2,
    area: "sales",
    digitalLevel: "L4",
    items: [
      "공공 조달 낙찰 2건(2023, 2025), 누적 4.1억원이에요.",
      "낙찰 품목은 금속 구조물 부품이에요.",
    ],
  },
  {
    id: "pub-venture",
    name: "벤처기업인증",
    sourceApi: "공공데이터포탈 API",
    status: "done",
    count: 1,
    area: "mgmt",
    digitalLevel: "L4",
    items: [
      "2012년 벤처기업 인증을 취득한 이력이 있어요.",
      "2018년에 만료된 뒤 갱신 이력은 없어요 — 현재 유효한 인증은 아니에요.",
    ],
  },
  {
    id: "pub-innobiz",
    name: "이노비즈·메인비즈 인증",
    sourceApi: "공공데이터포탈 API",
    status: "done",
    count: 0,
    area: "mgmt",
    digitalLevel: "L4",
    items: ["이노비즈·메인비즈 인증 이력이 없어요."],
    note: "수집 0건도 조회를 마친 확인 결과예요.",
  },
  {
    id: "pub-emp",
    name: "고용정보",
    sourceApi: "Tavily API",
    status: "done",
    count: 5,
    area: "mgmt",
    digitalLevel: "L4",
    items: [
      "피보험자 45명으로, 최근 1년 사이 3명이 늘었어요. (완만한 증가)",
      "직무 분포는 생산·기능직 중심이에요.",
      "IT·전산 직무 채용 이력은 0건이에요.",
    ],
  },
  {
    id: "pub-sns",
    name: "커뮤니티/SNS",
    sourceApi: "Tavily API",
    status: "partial",
    count: 3,
    area: "cs",
    digitalLevel: "L3",
    items: [
      "지역 커뮤니티·SNS에서 회사 언급 3건이 확인돼요.",
      "채용·근무 환경 관련 짧은 언급 위주로, 판정에 쓸 만한 내용은 제한적이에요.",
    ],
    note: "언급이 5건 미만이라 단독 판정 근거로는 쓰지 않고 보조 근거로만 활용해요.",
  },
  {
    id: "pub-news",
    name: "뉴스",
    sourceApi: "NaverNews API",
    status: "done",
    count: 2,
    area: "mgmt",
    digitalLevel: "L3",
    items: [
      "지역 뿌리기업 자동화 설비 투자 협약을 체결했어요. (2023-11)",
      "대표가 지역 상공회의소 디지털 전환 교육 과정을 수료했어요. (2025-09)",
    ],
  },
  {
    id: "pub-rnd",
    name: "R&D 프로젝트",
    sourceApi: "NTIS API",
    status: "done",
    count: 1,
    area: "design",
    digitalLevel: "L4",
    items: [
      "2024년 지역 뿌리기업 공정개선 R&D 과제에 참여한 이력이 확인돼요.",
      "정부 R&D 참여 경험은 기술 도입에 대한 능동 신호로 봐요.",
    ],
  },
  {
    id: "pub-survey",
    name: "설문",
    sourceApi: "AXpoint 확인 응답",
    status: "done",
    count: 12,
    area: "mgmt",
    digitalLevel: "L4",
    items: [
      "13문항 중 12문항에 응답해 주셨어요.",
      "매출 구간 문항은 재무정보가 이미 확인되어 묻지 않았어요.",
      "응답은 해당 문항 판정 근거와 시스템 현황 데이터로 함께 쓰여요.",
    ],
  },
];
