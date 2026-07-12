import type { ImprovementTask, Roadmap, RoadmapStage } from "@/lib/types";
import { getTask } from "@/data/catalog/tasks";
import { METHOD_STEPS, type MethodStepNo } from "@/data/catalog/method";

/**
 * 과제 기반 로드맵 자동 생성 (F-RMP-02, REQ-F-16 · 2026-07-12 수정요청v4)
 *
 * 단계 축 = AX 7단계 방법론 (docs/참고자료/중소 제조기업 AX 7단계 방법론.xlsx)
 * - 로드맵은 담은 과제로만 구성 (v4: '경영문제 정의 완료' 단계 제거 — 진단 결과 영역의 몫)
 * - 2~7단계: 담은 과제(+선행 기반과제 자동 삽입)를 methodStep으로 배치,
 *   과제가 없는 단계는 제거. 단계 순서 = 우선순위. 결정론적: 같은 담기 → 같은 로드맵.
 * - 기간은 단계 내 병렬 진행 가정(단계 내 최장 과제), 비용은 자부담 합산 (F-RMP-04)
 */

/** 방법론 단계별 할 일 (귀사/AXpoint 통합 리스트, F-RMP-05) */
const STEP_TODOS: Record<MethodStepNo, RoadmapStage["todos"]> = {
  1: [],
  2: [
    { owner: "귀사", text: "현행 품목 목록·양식 공유, 코드 확정 의사결정" },
    { owner: "AXpoint", text: "코드 체계 설계와 정리 실무, 공유 체계 구축 대행" },
  ],
  3: [
    { owner: "귀사", text: "파일럿 라인 지정, 현장 사용·주 1회 피드백" },
    { owner: "AXpoint", text: "대시보드 셋업·현장 교육, 지원사업 신청 서류 지원" },
  ],
  4: [
    { owner: "귀사", text: "불량 판정 기준 확정, 현장 입력 정착" },
    { owner: "AXpoint", text: "불량 코드 사전 설계, 검사 전자화 셋업" },
  ],
  5: [
    { owner: "귀사", text: "실물 재고 실사 협조, 발주 기준 확정" },
    { owner: "AXpoint", text: "발주점 기준 설계, 재고-생산 연동 구축" },
  ],
  6: [
    { owner: "귀사", text: "설비 목록·수리 이력 공유" },
    { owner: "AXpoint", text: "가동 데이터 수집 체계 구축, 예방정비 기준 수립" },
  ],
  7: [
    { owner: "귀사", text: "확산 라인 선정, 월 1회 데이터 검토 회의" },
    { owner: "AXpoint", text: "공정조건 분석·표준조건 제안, 확산 로드맵 관리" },
  ],
};

export function generateRoadmap(selectedIds: string[]): Roadmap {
  /* 1) 선행 기반과제 자동 삽입 (의존성 폐포) */
  const included = new Map<string, ImprovementTask>();
  const autoInsertedIds = new Map<string, string>(); // taskId → 사유(요구한 과제명)

  const visit = (id: string, requiredBy?: string) => {
    if (!included.has(id)) {
      included.set(id, getTask(id));
      if (requiredBy && !selectedIds.includes(id)) {
        autoInsertedIds.set(id, requiredBy);
      }
    }
    for (const dep of getTask(id).dependsOn ?? []) visit(dep, getTask(id).title);
  };
  selectedIds.forEach((id) => visit(id));

  const tasks = [...included.values()].sort((a, b) => a.buildOrder - b.buildOrder);

  /* 2) 단계 배치 — 담은 과제를 methodStep(2~7) 그룹으로, 순서가 곧 우선순위 */
  const stages: RoadmapStage[] = [];

  let cursor = 0;
  for (const step of METHOD_STEPS) {
    if (step.no === 1) continue;
    const stepTasks = tasks.filter((t) => t.methodStep === step.no);
    if (stepTasks.length === 0) continue;

    const duration = Math.max(...stepTasks.map((t) => t.durationMonths[1]));
    const selfMin = stepTasks.reduce((a, t) => a + t.costBand.selfPay[0], 0);
    const selfMax = stepTasks.reduce((a, t) => a + t.costBand.selfPay[1], 0);
    stages.push({
      order: stages.length + 1,
      methodStepNo: step.no,
      title: step.title,
      purpose: step.purpose,
      taskIds: stepTasks.map((t) => t.id),
      autoInserted: stepTasks
        .filter((t) => autoInsertedIds.has(t.id))
        .map((t) => ({
          taskId: t.id,
          reason: `'${autoInsertedIds.get(t.id)}' 과제의 선행 기반으로 자동 추가`,
        })),
      startMonth: cursor,
      durationMonths: duration,
      costBand: {
        selfPay: [selfMin, selfMax],
        note: "정부 지원사업 기준 자부담 추정",
      },
      todos: STEP_TODOS[step.no],
    });
    cursor += duration;
  }

  return {
    stages,
    totalMonths: cursor,
    goalLine: `${cursor}개월 뒤, 한 번 입력한 데이터가 스스로 흐르는 현장`,
  };
}
