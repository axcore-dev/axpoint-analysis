import { api } from "@/lib/api";

/**
 * 판정 완료 대기 — 제출·재판정 뒤 공용.
 * 워커가 멈추면 상태가 영원히 judging에 머물 수 있어 **반드시 상한을 둔다**.
 * 화면을 떠났을 때 늦게 도착한 결과가 라우팅을 흔들지 않도록 취소 신호도 받는다.
 */
/** 문항 판정 진행 수 — status가 judging일 때만 서버가 내려준다.
    stage='reading'이면 판정 에이전트가 근거 문서를 읽는 중이라 문항 수가 아직 늘지 않는다 */
export type JudgeProgress = { judged: number; total: number; stage?: "reading" };

export async function waitForJudge(
  assessmentId: string,
  opts: {
    timeoutMs?: number;
    intervalMs?: number;
    isCancelled?: () => boolean;
    /** 폴링마다 judgeProgress가 오면 알려준다 — 프로그레스바 표시용 */
    onProgress?: (p: JudgeProgress) => void;
  } = {},
): Promise<"completed" | "failed" | "timeout" | "cancelled"> {
  const intervalMs = opts.intervalMs ?? 3000;
  /* 판정 에이전트가 근거 문서를 직접 읽고 판정하면서 소요가 늘었다 — 상한 6분 (2026-08-05) */
  const deadline = Date.now() + (opts.timeoutMs ?? 6 * 60 * 1000);

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    if (opts.isCancelled?.()) return "cancelled";
    try {
      const { assessment, judgeProgress } = await api<{
        assessment: { status: string };
        judgeProgress?: JudgeProgress | null;
      }>(`/api/assessments/${assessmentId}`);
      if (judgeProgress && judgeProgress.total > 0) opts.onProgress?.(judgeProgress);
      if (assessment.status === "completed") return "completed";
      if (assessment.status === "failed") return "failed";
    } catch {
      /* 일시적 통신 오류는 다음 주기에 다시 확인한다 */
    }
  }
  return "timeout";
}
