/**
 * 워크플로우 응답 타입 — GET /api/assessments/:id/workflow의 표준 정의에 이 진단의
 * 문서 보유 여부(covered)를 얹은 형태. WorkflowChart가 이 타입으로 차트를 그린다.
 *
 * 이 파일은 타입 정의만 담는다 — 렌더 컴포넌트는 없다.
 */

export type OutputDoc = { docTypeId: number | string; name: string; covered: boolean };

export type WorkflowStage = {
  code: string;
  name: string;
  seq: number;
  isSupport: boolean;
  activities: {
    id: number; // workflow_activity.id — task 드래그·에이전트 연결선 기준 (v5)
    name: string;
    seq: number;
    description: string | null;
    inputDocs: string[] | null;
    outputDocs: OutputDoc[];
  }[];
};
