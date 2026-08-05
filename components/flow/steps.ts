import type { StepId } from "@/lib/types";

/** 6단계 단일 흐름 정의 (F-CMN-01) — 경로·명칭의 단일 원본 */
export const STEPS: { id: StepId; path: string; label: string; role: string }[] = [
  { id: "landing", path: "/", label: "파일 업로드", role: "진입·진단 시작" }, // v5-1 명칭 변경
  { id: "collect", path: "/collect", label: "자료 정리", role: "수집·분류·확인" },
  { id: "result", path: "/result", label: "진단 결과", role: "해석·근거 제시" },
  { id: "tasks", path: "/tasks", label: "개선 과제", role: "과제 선택" },
  { id: "roadmap", path: "/roadmap", label: "로드맵", role: "실행 계획" },
  { id: "report", path: "/report", label: "보고서", role: "요약·리드 확보" },
];

export function stepIndex(id: StepId): number {
  return STEPS.findIndex((s) => s.id === id);
}
