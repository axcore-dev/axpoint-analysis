/**
 * AXpoint 리뉴얼 데모 — 도메인 타입 정의
 *
 * 근거 문서:
 * - docs/작업 지시/AXpoint_리뉴얼_PRD_기능명세서.xlsx (기능·요구사항)
 * - docs/참고자료/AXpoint_6축_채점기준서_v0.1.xlsx (채점 SSOT)
 *
 * 데모는 백엔드 없이 동작하며 모든 데이터는 data/ 폴더의 더미 데이터로 공급된다.
 * 추후 백엔드 확장 시 이 타입이 API 계약의 출발점이 된다.
 */

/* ============ 공통 분류 체계 ============ */

/** 6축 (채점기준서 v0.1) */
export type AxisId = "ICS" | "AOS" | "OCS" | "TAS" | "FRS" | "SCS";

/** 판정 앵커 (BARS). A0=0 / A1=25 / A2=50 / A3=75 / A4=100 */
export type Anchor = "A0" | "A1" | "A2" | "A3" | "A4";

/** 판정 방식 — 자동(규칙) / LLM(앵커 분류) / HITL(설문·원탭 확인) */
export type JudgeMethod = "auto" | "llm" | "hitl";

/** 근거 출처 3종 (F-CMN-03 출처 구분 표기) */
export type EvidenceKind = "upload" | "public" | "hitl";

/**
 * 8대 기능영역 (F-CMN-02) — 분류·분석·과제가 공유하는 단일 체계.
 * 경영지원/제품설계/생산관리/장비관리/품질검사/재고물류/영업관리/고객지원
 */
export type FunctionAreaId =
  | "mgmt"
  | "design"
  | "production"
  | "equipment"
  | "quality"
  | "logistics"
  | "sales"
  | "cs";

/** 디지털화수준 (3축 태깅): L1 수기 → L2 개인문서 → L3 정형양식 → L4 시스템출력 */
export type DigitalLevel = "L1" | "L2" | "L3" | "L4";

/* ============ 채점기준서 (SSOT) ============ */

export interface RubricQuestion {
  id: string; // 예: "ICS-01"
  axis: AxisId;
  /** 확인 질문 */
  question: string;
  /** 취지 */
  intent: string;
  /** 근거 소스 설명 */
  evidenceSource: string;
  methods: JudgeMethod[];
  /** 앵커별 상태 서술 (점수를 직접 매기지 않고 서술에 분류) */
  anchors: Record<Anchor, string>;
  /** 신뢰도 규칙 (판정 보류/추정 조건) */
  reliabilityRule: string;
  /** 최소 설문지(시트3) 연결 번호 */
  hitlQuestionNo?: number;
}

export interface SurveyQuestion {
  no: number;
  /** 연결 문항 ID */
  questionId: string;
  axis: AxisId;
  question: string;
  type: "single" | "multi" | "single_text";
  options: string[];
  /** 조건부 노출 설명 (예: 재무 미확인 시) */
  condition?: string;
  /** '기타' 선택지 허용 — 선택 시 자유 입력 (v2 설문 규칙) */
  allowOther?: boolean;
  /** 이 답을 고르면 사유/내용 입력란 노출 (예: "불가(사유)") */
  reasonOn?: string[];
  /** 모든 문항은 SKIP 가능 — 스킵 시 판정 보류 처리 (v2) */
  skippable?: boolean;
}

/* ============ 판정 · 근거 ============ */

/** 근거 참조 — 문항ID→근거→점수→문장 추적 체인(F-BCK-04)의 데모 구현 */
export interface EvidenceRef {
  kind: EvidenceKind;
  /** UploadedDoc.id | PublicSource.id | "hitl-<설문 no>" */
  refId: string;
  label: string;
  /** 원문 스니펫 (근거 탭 시 노출, REQ-F-03) */
  snippet?: string;
}

/** 문항 판정 결과. anchor=null 이면 판정 보류(결측 — 분모 제외, 감점 아님) */
export interface Judgment {
  questionId: string;
  anchor: Anchor | null;
  /** 보류 사유 (anchor=null일 때) */
  deferReason?: string;
  /** 판정 근거 문장 — 앵커 서술 인용 원칙 (REQ-F-11) */
  rationale: string;
  evidence: EvidenceRef[];
  /** 신뢰도 낮음 표기 (감점 아님, REQ-N-02) */
  lowConfidence?: boolean;
}

/* ============ 채점 결과 ============ */

export interface AxisScore {
  axis: AxisId;
  name: string;
  /** 판정 문항 평균(균등 가중). 판정 문항 0개면 null(판정 불가) */
  score: number | null;
  judgedCount: number;
  totalCount: number;
  /** 판정 가능 문항 비율 0~1 */
  coverage: number;
  /** 커버리지 50% 미만 → 추정(신뢰도 낮음) 표기 */
  estimated: boolean;
  /** 업종 평균 (데모 벤치마크 v0.1 — 6축 카드에 흡수, 별도 섹션 없음) */
  industryAvg: number;
}

export interface LevelInfo {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** 단계 서술 */
  description: string;
  /** 점수 구간 [min, max] */
  range: [number, number];
}

export interface OverallResult {
  /** 종합 = 6축 평균(반올림) */
  score: number;
  scoreRaw: number;
  level: LevelInfo;
  axes: AxisScore[];
  /** 강점 상위 축 (2개) */
  strengths: AxisId[];
  /** 병목 하위 축 (2개) */
  bottlenecks: AxisId[];
  /** (최고점-최저점) >= 25 → 비대칭 구조 */
  asymmetric: boolean;
  /** 축 점수 표준편차 기반 균형 라벨 */
  balanceLabel: string;
  /** 업종 평균 대비 차이 (자사 평균 - 업종 평균) */
  industryDiff: number;
}

/* ============ 8영역 평가 (F-ANL-04: 점수 미노출, 3등급 + 판단 보류) ============ */

export type AreaGrade = "critical" | "normal" | "strength" | "hold";

export interface AreaAssessment {
  areaId: FunctionAreaId;
  grade: AreaGrade;
  /** 우선순위 서열 (낮은 등급 우선 정렬) */
  priority: number;
  /** As-Is 한 줄 (과제 카드에 상속, F-TSK-05) */
  asIs: string;
  evidence: EvidenceRef[];
  /** 판단 보류 사유 + 업로드 유도 (grade="hold") */
  holdReason?: string;
  /** 이 영역 개선과제 링크 (F-ANL-08) */
  taskIds: string[];
}

/* ============ 자료 (S1 수집·정리) ============ */

export interface UploadedDoc {
  id: string;
  fileName: string;
  fileType: "image" | "pdf" | "xlsx" | "docx" | "hwp";
  /** 3축 태깅 결과 */
  area: FunctionAreaId;
  level: DigitalLevel;
  /** 문서유형 (제조 문서 사전 ~30종 중) */
  docType: string;
  /** 분류 신뢰도 0~1 */
  confidence: number;
  /** 신뢰도 임계(0.7) 미만 → HITL 원탭 확인 대상 */
  needsHitl: boolean;
  hitlPrompt?: { question: string; options: string[] };
  /** 카드 티저 — 추출 요약 1줄 (F-COL-05) */
  summaryTeaser: string;
  /** 판독 상세(드릴다운) — OCR/파서 추출 노트 */
  extractedDetail: string;
  /** 개인정보 마스킹 적용 여부 (F-COL-07) */
  masked: boolean;
}

export type SourceStatus = "done" | "partial" | "failed";

export interface PublicSource {
  id: string;
  /** 데이터 종류 (예: "특허·실용신안") */
  name: string;
  /** 수집처 출처 (예: "KIPRISPlus(특허청) API") — v2: 종류+출처+건수만 표기 */
  sourceApi: string;
  status: SourceStatus;
  /** 수집 건수 */
  count: number;
  /** 8대 영역 자료 분류에서의 대분류 배치 */
  area: FunctionAreaId;
  /** 공개 수집 자료의 디지털화 수준 (v2: 8대 영역 분류에 표기) */
  digitalLevel: DigitalLevel;
  /** 요약 항목 (상세용) */
  items: string[];
  note?: string;
}

/** HITL 설문 응답 */
export interface HitlResponse {
  questionNo: number;
  questionId: string;
  answer: string;
  /** 자유 서술 보충 */
  answerDetail?: string;
}

/** 8영역 자료 커버리지 (F-COL-06) */
export interface AreaCoverage {
  areaId: FunctionAreaId;
  /** 보유 자료 수 (업로드+공개) */
  docCount: number;
  /** 0~1 — 진단에 필요한 자료 대비 보유율 */
  ratio: number;
  /** 부족 영역 표시 + 업로드 유도 */
  insufficient: boolean;
  missingHint?: string;
}

/* ============ 가치사슬 교차 분석 (F-ANL-07, REQ-F-13) ============ */

export interface ValueChainSignal {
  id: string;
  title: string;
  finding: string;
  /** 교차에 사용된 문서 */
  sourceDocIds: string[];
  severity: "warning" | "info";
}

export interface ValueChainAnalysis {
  /** 필요 문서(발주서·생산기록·재고표) 2종 이상 → 생성 */
  available: boolean;
  usedDocTypes: string[];
  signals: ValueChainSignal[];
}

/* ============ 개선 과제 (S3) ============ */

export interface ImprovementTask {
  id: string;
  title: string;
  /** Before → After 정량 한 줄 (예: "검사 3시간 → 10분") */
  beforeAfter?: string;
  summary: string;
  areaId: FunctionAreaId;
  /**
   * AX 7단계 방법론 배치 (2~7단계 — 1단계 '경영문제 정의'는 진단이 수행)
   * 근거: docs/참고자료/중소 제조기업 AX 7단계 방법론.xlsx
   */
  methodStep: 2 | 3 | 4 | 5 | 6 | 7;
  /** 이 시스템을 이미 사용 중이면 과제가 이미 갖춰진 것 — 선택 불가 처리 */
  coveredBySystems?: string[];
  /** 기반과제 여부 (시각 구분 + 자동 삽입 대상, F-TSK-04/F-RMP-02) */
  isFoundation: boolean;
  /** 분석 기준 추천 여부 — 기본 뷰 노출 (F-TSK-02) */
  recommended: boolean;
  /** 추천/미추천 사유 */
  reason: string;
  /** 진단 근거 상속 — 해당 영역 As-Is 한 줄 (F-TSK-05) */
  inheritedAsIs: string;
  /** 즉시 착수 배지 (업로드 자료 기반 feasibility, F-TSK-06) */
  feasibility?: { badge: string; basisDocIds: string[] };
  /** 기대효과 */
  effect: {
    summary: string;
    /** 연 절감 밴드 [min, max] (만원) */
    annualSavingRange?: [number, number];
  };
  dataRequirements: string[];
  difficulty: "하" | "중" | "상";
  /** 구축 기간 밴드 (개월) */
  durationMonths: [number, number];
  /** 매칭 솔루션 수만 노출 — 벤더 상세는 로드맵·보고서로 이월 (F-TSK-01) */
  solutionCount: number;
  /** 선행 기반과제 (담기 시 연관 제안 트리거, F-TSK-04) */
  dependsOn?: string[];
  /** 구축 우선순위 (로드맵 단계 생성용, 낮을수록 먼저) */
  buildOrder: number;
  /** 예상 비용 밴드 (만원) — 정부 지원 기준 자부담 */
  costBand: { total: [number, number]; selfPay: [number, number]; note: string };
}

/* ============ 로드맵 (S4) ============ */

export interface RoadmapStage {
  order: number;
  /** 방법론 단계 번호 (1~7) */
  methodStepNo: number;
  title: string;
  /** 단계 목적 한 줄 (방법론 xlsx) */
  purpose: string;
  /** 이미 완료된 단계 (1단계 경영문제 정의 = 이번 진단으로 완료) */
  done?: boolean;
  /** 단계에 배치된 과제 */
  taskIds: string[];
  /** 자동 삽입된 기반과제 (배지+사유, REQ-F-16) */
  autoInserted: { taskId: string; reason: string }[];
  /** 기간 (개월, 시작 오프셋 포함 — 간트형 병렬 표시는 P2 제외) */
  startMonth: number;
  durationMonths: number;
  /** 비용 밴드 (F-RMP-04) */
  costBand: { selfPay: [number, number]; note: string };
  /** 할 일 리스트 — 귀사/AXpoint 통합 (F-RMP-05) */
  todos: { owner: "귀사" | "AXpoint"; text: string }[];
}

export interface Roadmap {
  stages: RoadmapStage[];
  totalMonths: number;
  /** 목표 가치 한 줄 — 상단 배너 (F-RMP-01) */
  goalLine: string;
}

/* ============ 보고서 (S5) ============ */

export interface RoiItem {
  label: string;
  /** 연 절감액 (만원) */
  annualSaving: number;
  /** 산출 가정 (기준 단가·시간 명시, REQ-F-18) */
  assumption: string;
  relatedTaskId?: string;
}

export interface RoiBreakdown {
  items: RoiItem[];
  /** 합계 (만원) */
  totalAnnualSaving: number;
  /** 총 자부담 추정 (만원) */
  totalSelfPay: number;
  /** 투자 회수 개월 = 자부담 / (연 효과/12) */
  paybackMonths: number;
  disclaimer: string;
}

/* ============ 기업 · 시나리오 ============ */

export interface CompanyProfile {
  name: string;
  bizNo: string;
  ceo: string;
  established: string;
  employees: number;
  /** 연 매출 (억원) */
  revenue: number;
  industry: string;
  industryCode: string;
  address: string;
  /** 기업 정보 기준 출처 표기 (REQ-F-06: DART 기준) */
  infoSource: string;
}

/** 기업 개요 통계 칩 (진단 결과 섹션 1 — 가로 스크롤, 클릭 시 팝업 상세) */
export interface CompanyStat {
  id: string;
  label: string;
  /** 대표 값 (예: "82억원") */
  value: string;
  /** 값의 기준/연도 (예: "2025년") */
  basis?: string;
  /** 팝업 상세 내용 */
  detail: string[];
  /** 연결 공개 데이터 소스 id */
  sourceId?: string;
}

/** 용어 사전 — 전문 용어 호버 툴팁 (라이팅 규칙 4.1) */
export interface GlossaryEntry {
  term: string;
  /** 쉬운 말 풀이 (해요체 한 문장) */
  easy: string;
}

/** 진행 단계 (6단계 단일 흐름, F-CMN-01) */
export type StepId = "landing" | "collect" | "result" | "tasks" | "roadmap" | "report";
