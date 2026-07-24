/**
 * 검색 기업 디렉터리 (수정요청v7) — 더미 데이터.
 * 랜딩 자동완성·기업 확인 카드, 자료 분류의 "{업종} 제조 표준" 라벨,
 * 내 정보 수정의 소속 회사 검색(사업자번호/상호명)이 공유하는 단일 원본.
 */
export interface CompanyDirectoryEntry {
  /** 대표 상호명 */
  name: string;
  /** 사업자등록번호 (데모 더미) */
  bizNo: string;
  /** 업종 표기 */
  industry: string;
  /** 업종 축약 — "{업종} 제조 표준" 라벨 등에 사용 */
  industryShort: string;
  /** 소재지 축약 */
  region: string;
  /** 검색 입력과 추가로 매칭할 별칭 (자동완성 표기 우선) */
  aliases: string[];
}

export const COMPANY_DIRECTORY: CompanyDirectoryEntry[] = [
  {
    name: "(주)데모기업",
    bizNo: "123-45-67890",
    industry: "금속가공제품 제조업",
    industryShort: "금속가공",
    region: "광주",
    aliases: ["데모기업"],
  },
  {
    name: "AXCRE",
    bizNo: "234-56-78901",
    industry: "소프트웨어 개발",
    industryShort: "소프트웨어",
    region: "광명",
    aliases: [],
  },
  {
    name: "씨엠텍",
    bizNo: "345-67-89012",
    industry: "정밀가공 제조업",
    industryShort: "정밀가공",
    region: "인천",
    aliases: [],
  },
  {
    /* v7: 금형업체, 광주 평동 소재 제조기업으로 확정 */
    name: "(주)승광",
    bizNo: "456-78-90123",
    industry: "금형 제조업",
    industryShort: "금형",
    region: "광주 평동",
    aliases: ["승광"],
  },
];

/** "업종 · 지역" 한 줄 표기 */
export function companyDesc(c: CompanyDirectoryEntry): string {
  return `${c.industry} · ${c.region}`;
}

/** 상호명·별칭·사업자번호(하이픈 무시)로 조회 */
export function findCompany(input: string): CompanyDirectoryEntry | undefined {
  const q = input.trim();
  if (!q) return undefined;
  const qNo = q.replace(/-/g, "");
  return COMPANY_DIRECTORY.find(
    (c) =>
      c.name === q ||
      c.aliases.includes(q) ||
      c.bizNo === q ||
      c.bizNo.replace(/-/g, "") === qNo,
  );
}
