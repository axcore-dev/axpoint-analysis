/**
 * 부서 단위 워크플로우 (수정요청v6)
 * 자료 분류 화면의 8대 영역 탭을 대체하는 표시 계층.
 * — 8대 영역 분류 자체는 백엔드(데이터 계층, documents.ts의 area 태깅)에서
 *   그대로 유지되며, 개선 과제 선택·로드맵이 계속 사용한다.
 * — 문서 배정(docIds)은 documents.ts의 업로드 12건을 부서 관점으로 재배열한 것.
 */
export interface WorkflowDept {
  id: string;
  /** 부서명 */
  name: string;
  /** 업무 리스트 */
  tasks: string[];
  /** 이 부서로 분류된 업로드 문서 (documents.ts id) */
  docIds: string[];
}

export const WORKFLOW_DEPTS: WorkflowDept[] = [
  {
    id: "sales",
    name: "영업",
    tasks: ["견적 작성·수주 접수", "납기 협의", "거래명세 발행"],
    docIds: ["d11", "d04"],
  },
  {
    id: "purchase",
    name: "구매·자재",
    tasks: ["자재 발주", "입고 검수", "단가 관리"],
    docIds: ["d03"],
  },
  {
    id: "design",
    name: "설계(R&D)",
    tasks: ["고객 도면 접수·검토", "공정·금형 설계"],
    docIds: ["d12"],
  },
  {
    id: "production",
    name: "생산",
    tasks: ["생산 계획 수립", "작업 지시", "실적 기록", "설비 점검"],
    docIds: ["d01", "d02", "d08", "d10", "d07"],
  },
  {
    id: "quality",
    name: "품질",
    tasks: ["공정·출하 검사", "성적서 발행", "불량 관리"],
    docIds: ["d06"],
  },
  {
    id: "shipping",
    name: "재고·출하",
    tasks: ["재고 실사", "출하 지시", "납품"],
    docIds: ["d05"],
  },
  {
    id: "cs",
    name: "고객지원",
    tasks: ["납품 후 클레임 대응", "AS 접수"],
    docIds: [],
  },
  {
    id: "mgmt",
    name: "경영지원",
    tasks: ["회계·정산", "인사·총무"],
    docIds: ["d09"],
  },
];

export function getDept(id: string): WorkflowDept {
  const dept = WORKFLOW_DEPTS.find((d) => d.id === id);
  if (!dept) throw new Error(`알 수 없는 부서 id: ${id}`);
  return dept;
}

/** 제조 표준 워크플로우 — 수주 제조(금속가공) 기준 흐름 */
export const STANDARD_FLOW: string[] = [
  "sales",
  "design",
  "purchase",
  "production",
  "quality",
  "shipping",
  "cs",
];

/**
 * 분석된 자사 워크플로우 — 표준과 일부 순서가 다름 (데모 시나리오).
 * 표준품 자재를 도면 확정 전에 선발주하는 관행 → 구매가 설계보다 앞.
 * 화면에서 드래그앤드롭으로 실제 흐름에 맞게 수정 가능.
 */
export const COMPANY_FLOW: string[] = [
  "sales",
  "purchase",
  "design",
  "production",
  "quality",
  "shipping",
  "cs",
];

/** 흐름(체인)에 넣지 않는 지원 부서 */
export const SUPPORT_DEPT_IDS: string[] = ["mgmt"];
