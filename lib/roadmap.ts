import type { ImprovementTask, Roadmap, RoadmapStage } from "@/lib/types";
import { getTask } from "@/data/catalog/tasks";

/**
 * 과제 기반 로드맵 자동 생성 (F-RMP-02, REQ-F-16)
 *
 * 담은 과제 → 선행 기반과제 자동 삽입(배지+사유) → 구축 우선순위(buildOrder)
 * 반영 3단계 구성. 결정론적: 같은 담기 → 같은 로드맵.
 * - 1단계 기반 다지기: 기반과제(isFoundation)
 * - 2단계 파일럿 적용: 즉시 착수(feasibility) 과제 — go/no-go 게이트 (F-RMP-03)
 * - 3단계 확산·고도화: 나머지
 * 빈 단계는 제거 후 재번호. 비용 밴드는 단계 내 자부담 합산 (F-RMP-04).
 */
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

  /* 2) 단계 분배 */
  const foundation = tasks.filter((t) => t.isFoundation);
  const pilot = tasks.filter((t) => !t.isFoundation && t.feasibility);
  const expansion = tasks.filter((t) => !t.isFoundation && !t.feasibility);

  const stageDefs: {
    title: string;
    tasks: ImprovementTask[];
    gate?: RoadmapStage["gate"];
    roles: RoadmapStage["roles"];
  }[] = [
    {
      title: "기반 다지기",
      tasks: foundation,
      roles: {
        company: ["현행 품목 목록·폴더 구조 공유", "코드 확정 의사결정 (대표+담당자)"],
        axpoint: ["코드 체계 설계·정리 실무 대행", "공유 체계 구축 — 전산화는 직접 안 하셔도 됩니다"],
      },
    },
    {
      title: "파일럿 적용",
      tasks: pilot,
      gate: {
        criteria: [
          "현장 전자 입력률 80% 이상 2주 연속",
          "재고·발주 알림 오탐 주 2건 이하",
          "현장 작업자 불편 신고 누적 5건 이하",
        ],
        threshold: "3개 기준 모두 충족 시 다음 단계 진행 (go)",
        onFail: "미달 시 4주 보완 기간 후 재판정 (no-go 분기)",
      },
      roles: {
        company: ["파일럿 라인 지정·현장 사용", "주 1회 피드백 (담당자 주 1일 투입)"],
        axpoint: ["솔루션 셋업·현장 교육", "정부 지원사업 신청 서류 지원"],
      },
    },
    {
      title: "확산·고도화",
      tasks: expansion,
      roles: {
        company: ["전 라인 확대 적용", "축적 데이터 검토 회의 (월 1회)"],
        axpoint: ["단계별 구축 관리", "차기 과제(AI 적용) 준비도 재진단"],
      },
    },
  ];

  /* 3) 기간·비용 산출 — 단계 내 병렬 진행 가정, 기간 = 단계 내 최장 과제 */
  let cursor = 0;
  const stages: RoadmapStage[] = [];
  for (const def of stageDefs) {
    if (def.tasks.length === 0) continue;
    const duration = Math.max(...def.tasks.map((t) => t.durationMonths[1]));
    const selfMin = def.tasks.reduce((a, t) => a + t.costBand.selfPay[0], 0);
    const selfMax = def.tasks.reduce((a, t) => a + t.costBand.selfPay[1], 0);
    stages.push({
      order: stages.length + 1,
      title: def.tasks.length > 0 ? def.title : def.title,
      taskIds: def.tasks.map((t) => t.id),
      autoInserted: def.tasks
        .filter((t) => autoInsertedIds.has(t.id))
        .map((t) => ({
          taskId: t.id,
          reason: `'${autoInsertedIds.get(t.id)}' 과제의 선행 기반으로 자동 추가`,
        })),
      startMonth: cursor,
      durationMonths: duration,
      gate: def.gate,
      costBand: {
        selfPay: [selfMin, selfMax],
        note: "정부 지원사업(스마트공장 등) 기준 자부담 추정 — 사업 선정 결과에 따라 달라질 수 있습니다",
      },
      roles: def.roles,
    });
    cursor += duration;
  }

  return {
    stages,
    totalMonths: cursor,
    goalLine:
      "6개월 뒤, 데이터가 한 번만 입력되고 스스로 흐르는 현장 — 전국 중소 제조 상위 20% 진입이 목표예요",
  };
}
