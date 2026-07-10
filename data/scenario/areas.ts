import type { AreaAssessment, AreaCoverage } from "@/lib/types";

/**
 * 8영역 평가 (F-ANL-04, REQ-F-12)
 * - 0~100 숫자 점수 미노출 — 심각/보통/강점 3등급 + 판단 보류
 * - 낮은 등급 우선 정렬(priority)
 * - As-Is 한 줄은 개선 과제 카드에 상속된다 (F-TSK-05)
 * - 자료 부족 영역은 "판단 보류" + 업로드 유도 (빈 껍데기 금지)
 */
export const areaAssessments: AreaAssessment[] = [
  {
    areaId: "production",
    grade: "critical",
    priority: 1,
    asIs: "생산 기록이 수기·개인 엑셀로 4회 중복 입력되고 실시간 현황이 없음",
    evidence: [
      { kind: "upload", refId: "d01", label: "3월 생산일지", snippet: "종이 수기 기록 후 스캔" },
      { kind: "upload", refId: "d02", label: "작업일보 엑셀", snippet: "매일 저녁 엑셀에 재입력" },
      { kind: "upload", refId: "d08", label: "월생산집계", snippet: "값 직접 입력(수식 없음)" },
      { kind: "hitl", refId: "hitl-6", label: "설문: 현장 전달 방식", snippet: "단톡·사진" },
    ],
    taskIds: ["t03", "t06", "t10", "t21"],
  },
  {
    areaId: "logistics",
    grade: "critical",
    priority: 2,
    asIs: "재고는 주 1회 수동 갱신, 발주 기준 없음, 품목 표기가 문서마다 달라 대사 불가",
    evidence: [
      { kind: "upload", refId: "d05", label: "재고현황표", snippet: "안전재고·발주점 열 없음" },
      { kind: "upload", refId: "d03", label: "발주서 묶음", snippet: "품목 코드 표기 혼재 (매칭률 28%)" },
    ],
    taskIds: ["t01", "t04", "t18"],
  },
  {
    areaId: "quality",
    grade: "critical",
    priority: 3,
    asIs: "검사가 수기·사후 기록이고 불량 사유가 없어 원인 분석이 불가능",
    evidence: [
      { kind: "upload", refId: "d06", label: "검사성적서", snippet: "불량 수량은 있으나 사유·코드 없음" },
      { kind: "upload", refId: "d01", label: "3월 생산일지", snippet: "불량 수량만 기록" },
    ],
    taskIds: ["t05", "t09", "t13", "t14"],
  },
  {
    areaId: "equipment",
    grade: "normal",
    priority: 4,
    asIs: "점검표는 정기 운영되나 수기 작성이며 센서 데이터가 관리로 이어지지 않음",
    evidence: [
      { kind: "upload", refId: "d07", label: "설비점검표", snippet: "월 1회 수기 점검 (확인 응답)" },
      { kind: "hitl", refId: "hitl-3", label: "설문: 센서/PLC", snippet: "일부 설비만" },
    ],
    taskIds: ["t07", "t11", "t12"],
  },
  {
    areaId: "sales",
    grade: "normal",
    priority: 5,
    asIs: "견적·명세가 정형 문서로 관리되나 개인 문서 수준이고 생산·재고와 단절",
    evidence: [
      { kind: "upload", refId: "d11", label: "견적서 양식", snippet: "개인 PC 폴더에 파일명으로만 이력 구분" },
      { kind: "upload", refId: "d04", label: "거래명세서", snippet: "집계표와 수량 불일치 2건" },
    ],
    taskIds: ["t08", "t15"],
  },
  {
    areaId: "mgmt",
    grade: "strength",
    priority: 6,
    asIs: "회계는 더존 기반으로 체계적 — 시스템 사용 경험이 확산의 발판",
    evidence: [
      { kind: "upload", refId: "d09", label: "회계전표(더존 출력)", snippet: "시스템 출력물 확인" },
      { kind: "hitl", refId: "hitl-13", label: "설문: 클라우드", snippet: "네이버웍스 사용 중" },
    ],
    taskIds: ["t02", "t19"],
  },
  {
    areaId: "design",
    grade: "hold",
    priority: 7,
    asIs: "고객 도면 1건만 확인되어 설계 프로세스 판단 근거 부족",
    holdReason: "도면 관리 대장·설계 변경 이력 자료가 없어 판단 보류.",
    evidence: [{ kind: "upload", refId: "d12", label: "고객사 도면", snippet: "1건 확인 — 관리 체계 미확인" }],
    taskIds: ["t16"],
  },
  {
    areaId: "cs",
    grade: "hold",
    priority: 8,
    asIs: "고객 문의·클레임 처리 자료가 없어 판단 근거 부족",
    holdReason: "클레임 대장·고객 응대 기록이 없어 판단 보류.",
    evidence: [],
    taskIds: ["t17"],
  },
];

/**
 * 8영역 자료 커버리지 (F-COL-06) — 게이지·격자 통합 단일 시각화용.
 * ratio는 영역 진단에 필요한 문서 대비 보유율 (데모 값).
 */
export const areaCoverages: AreaCoverage[] = [
  { areaId: "mgmt", docCount: 1, ratio: 0.7, insufficient: false },
  {
    areaId: "design",
    docCount: 1,
    ratio: 0.25,
    insufficient: true,
    missingHint: "도면 관리 대장, 설계 변경 이력",
  },
  { areaId: "production", docCount: 4, ratio: 0.9, insufficient: false },
  { areaId: "equipment", docCount: 1, ratio: 0.5, insufficient: false },
  { areaId: "quality", docCount: 1, ratio: 0.6, insufficient: false },
  { areaId: "logistics", docCount: 2, ratio: 0.75, insufficient: false },
  { areaId: "sales", docCount: 2, ratio: 0.7, insufficient: false },
  {
    areaId: "cs",
    docCount: 0,
    ratio: 0,
    insufficient: true,
    missingHint: "클레임 대장, 고객 응대 기록",
  },
];
