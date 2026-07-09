import type { PublicSource } from "@/lib/types";

/**
 * 공개 데이터 수집 결과 6종 (F-COL-01, REQ-F-06)
 * 국세청·조달청·특허청·DART(재무)·뉴스·고용/SNS. 출처 표기 필수.
 * 특허는 건수 나열 대신 요약지표화 (F-COL-08).
 */
export const publicSources: PublicSource[] = [
  {
    id: "pub-nts",
    name: "국세청 사업자 정보",
    status: "done",
    count: 1,
    items: ["사업자 상태: 계속사업자 (정상)", "업종: 금속가공제품 제조업 (C259)", "설립: 2008-03"],
  },
  {
    id: "pub-dart",
    name: "재무정보 (DART 기준)",
    status: "done",
    count: 3,
    items: [
      "매출액: 82억원 (전년 78억원, +5.1%)",
      "영업이익: 3.2억원 — 3년 연속 흑자",
      "직원 수: 45명",
    ],
    note: "기업 기본정보는 DART 기준으로 표기",
  },
  {
    id: "pub-kipo",
    name: "특허·실용신안 (특허청)",
    status: "done",
    count: 4,
    items: [
      "등록 3건 · 최근 3년 출원 1건 (2025)",
      "IPC 분포: B23(공작기계) 3건, B21(소성가공) 1건",
      "최근 출원: 프레스 금형 관련 (2025-04)",
    ],
    note: "건수 나열 대신 요약 지표로 표시",
  },
  {
    id: "pub-pps",
    name: "조달 낙찰 이력 (조달청)",
    status: "done",
    count: 2,
    items: ["낙찰 2건 (2023, 2025) · 누적 4.1억원", "품목: 금속 구조물 부품"],
  },
  {
    id: "pub-emp",
    name: "고용정보 (고용보험)",
    status: "done",
    count: 5,
    items: [
      "피보험자 45명 · 최근 1년 +3명 (완만한 증가)",
      "직무 분포: 생산·기능직 중심",
      "IT·전산 직무 채용 이력: 0건",
    ],
  },
  {
    id: "pub-news",
    name: "뉴스·SNS",
    status: "partial",
    count: 2,
    items: [
      "지역 뿌리기업 자동화 설비 투자 협약 체결 (2023-11)",
      "대표, 지역 상공회의소 디지털 전환 교육 과정 수료 (2025-09)",
    ],
    note: "SNS·커뮤니티 언급 5건 미만 — 단독 판정 근거로 사용하지 않음",
  },
];
