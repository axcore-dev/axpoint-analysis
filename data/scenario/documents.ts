import type { UploadedDoc } from "@/lib/types";

/**
 * 업로드 자료 12건 — 3축 태깅(업무영역 × 디지털화수준 × 문서유형) 결과
 * (F-COL-02). 신뢰도 0.7 미만 2건은 HITL 원탭 확인 대상 (F-COL-03).
 * 개인정보는 판독 직후 마스킹 처리 (F-COL-07).
 *
 * 이 문서 구성이 채점 판정(judgments.ts)의 근거가 되므로, 수정 시
 * 판정 근거와의 정합성을 반드시 함께 확인할 것.
 * 디지털화수준 분포: L1 3건 / L2 5건 / L3 3건 / L4 1건 → AOS-02 판정 근거.
 */
export const uploadedDocs: UploadedDoc[] = [
  {
    id: "d01",
    fileName: "3월 생산일지 (스캔).pdf",
    fileType: "pdf",
    area: "production",
    level: "L1",
    docType: "생산일지",
    confidence: 0.93,
    needsHitl: false,
    summaryTeaser: "일자별 품목·수량·작업자 수기 기록, 총 22일분",
    extractedDetail:
      "종이 양식에 볼펜 수기 작성 후 스캔. 일자·품목명·생산수량·불량수량·작업자(마스킹) 열 구조. 품목명 표기가 일자별로 상이(예: '브라켓(소)' ↔ 'B-102'). 불량은 수량만 기록되고 사유 없음.",
    masked: true,
  },
  {
    id: "d02",
    fileName: "작업일보_양식_2026.xlsx",
    fileType: "xlsx",
    area: "production",
    level: "L2",
    docType: "작업일보",
    confidence: 0.9,
    needsHitl: false,
    summaryTeaser: "생산팀장 개인 PC에서 관리하는 엑셀 일보, 수식 없음",
    extractedDetail:
      "생산일지 내용을 매일 저녁 엑셀에 다시 입력. 시트가 월별 복사본으로 증식(3월분 기준 시트 14개). 집계 수식 없이 값 직접 입력. 파일 속성상 단일 사용자 편집.",
    masked: false,
  },
  {
    id: "d03",
    fileName: "발주서 묶음 (5~6월).pdf",
    fileType: "pdf",
    area: "logistics",
    level: "L3",
    docType: "발주서",
    confidence: 0.88,
    needsHitl: false,
    summaryTeaser: "정형 양식 발주서 8건, 품목 코드 표기 혼재",
    extractedDetail:
      "거래처별 반복 포맷으로 축적. 동일 품목이 발주서마다 'BRK-102', '브라켓 B-102', '브라켓(소)' 등으로 혼용 표기. 발주일·납기·수량 필드는 일관.",
    masked: true,
  },
  {
    id: "d04",
    fileName: "거래명세서_6월.pdf",
    fileType: "pdf",
    area: "sales",
    level: "L3",
    docType: "거래명세서",
    confidence: 0.91,
    needsHitl: false,
    summaryTeaser: "월 출하분 거래명세 12건, 정형 양식",
    extractedDetail:
      "출하 품목·수량·단가 기재. 6월 명세 수량과 월 생산 집계표 수량이 2개 품목에서 불일치(수기 이관 과정 오류로 추정).",
    masked: true,
  },
  {
    id: "d05",
    fileName: "재고현황_202606.xlsx",
    fileType: "xlsx",
    area: "logistics",
    level: "L2",
    docType: "재고표",
    confidence: 0.86,
    needsHitl: false,
    summaryTeaser: "주 1회 수동 갱신하는 재고 엑셀, 발주 기준 없음",
    extractedDetail:
      "품목별 현재고 수량만 관리. 안전재고·발주점 열 없음. 갱신 일자가 주 단위로 비어 있는 구간 존재. 품목명이 발주서 표기와 상이.",
    masked: false,
  },
  {
    id: "d06",
    fileName: "검사성적서_5월 (스캔).pdf",
    fileType: "pdf",
    area: "quality",
    level: "L1",
    docType: "검사성적서",
    confidence: 0.89,
    needsHitl: false,
    summaryTeaser: "수기 검사성적서 6건, 불량 사유 미기록",
    extractedDetail:
      "치수 측정값 수기 기입 후 스캔. 합/불 판정과 불량 수량은 있으나 불량 사유·코드 없음. 검사자 서명(마스킹).",
    masked: true,
  },
  {
    id: "d07",
    fileName: "설비점검표_1분기 (스캔).pdf",
    fileType: "pdf",
    area: "equipment",
    level: "L1",
    docType: "설비점검표",
    confidence: 0.64,
    needsHitl: true,
    hitlPrompt: {
      question: "이 점검표는 어떻게 작성되나요?",
      options: ["현장에서 종이에 수기 작성", "시스템에서 출력한 양식", "외주 업체가 작성"],
    },
    summaryTeaser: "CNC·프레스 정기 점검 기록, 작성 방식 확인 필요",
    extractedDetail:
      "월 1회 정기 점검 항목 체크 기록. 스캔 화질로 작성 주체·출력 시스템 판별이 불확실하여 확인 요청. (응답: 현장에서 종이에 수기 작성)",
    masked: true,
  },
  {
    id: "d08",
    fileName: "월생산집계_2026상반기.xlsx",
    fileType: "xlsx",
    area: "production",
    level: "L2",
    docType: "집계표",
    confidence: 0.61,
    needsHitl: true,
    hitlPrompt: {
      question: "이 집계표는 누가 어떻게 만드나요?",
      options: [
        "일보를 보고 사무실에서 다시 입력",
        "시스템이 자동 집계",
        "외부(회계사무소 등)에서 작성",
      ],
    },
    summaryTeaser: "월별 품목 생산 합계, 작성 방식 확인 필요",
    extractedDetail:
      "월별 생산 합계를 값으로 직접 입력(수식 없음). 작업일보와 동일 수치가 재입력된 흔적. 작성 경로가 불확실하여 확인 요청. (응답: 일보를 보고 사무실에서 다시 입력)",
    masked: false,
  },
  {
    id: "d09",
    fileName: "회계전표_6월_더존출력.pdf",
    fileType: "pdf",
    area: "mgmt",
    level: "L4",
    docType: "회계전표",
    confidence: 0.95,
    needsHitl: false,
    summaryTeaser: "회계 SW(더존) 시스템 출력물 — 경영지원은 시스템 기반",
    extractedDetail:
      "더존 회계모듈 출력 포맷 확인(시스템 출력물). 매출·매입 전표 처리 체계적. 단, 생산·재고 데이터와의 연동 없이 수기 대사로 이관.",
    masked: true,
  },
  {
    id: "d10",
    fileName: "작업표준서_프레스공정.hwp",
    fileType: "hwp",
    area: "production",
    level: "L2",
    docType: "작업표준서",
    confidence: 0.84,
    needsHitl: false,
    summaryTeaser: "주요 공정 표준서, 2019년 이후 갱신 이력 없음",
    extractedDetail:
      "프레스·용접 공정 작업 순서와 조건 문서화. 최종 수정일 2019-11. 신규 설비(2023 CNC 증설분) 반영 안 됨.",
    masked: false,
  },
  {
    id: "d11",
    fileName: "견적서_양식.docx",
    fileType: "docx",
    area: "sales",
    level: "L2",
    docType: "견적서",
    confidence: 0.87,
    needsHitl: false,
    summaryTeaser: "영업 담당 개인 문서로 관리되는 견적 양식",
    extractedDetail:
      "워드 양식에 단가·수량 수동 기입. 과거 견적 이력은 개인 PC 폴더에 파일명으로만 구분.",
    masked: true,
  },
  {
    id: "d12",
    fileName: "고객사 도면_B-102 (반출제한).pdf",
    fileType: "pdf",
    area: "design",
    level: "L3",
    docType: "도면",
    confidence: 0.92,
    needsHitl: false,
    summaryTeaser: "고객사 제공 도면 — 반출 제한 표기 확인",
    extractedDetail:
      "고객사 표제란에 '외부 반출 금지' 문구 확인. 도면 관리 대장이나 버전 관리 흔적은 미확인.",
    masked: true,
  },
];

/** 분류 신뢰도 임계 미만 → HITL 확인 대상 문서 */
export const hitlDocs = uploadedDocs.filter((d) => d.needsHitl);
