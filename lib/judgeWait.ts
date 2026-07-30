import { api } from "@/lib/api";

/**
 * 판정 완료 대기 — 제출·재판정 뒤 공용.
 * 워커가 멈추면 상태가 영원히 judging에 머물 수 있어 **반드시 상한을 둔다**.
 * 화면을 떠났을 때 늦게 도착한 결과가 라우팅을 흔들지 않도록 취소 신호도 받는다.
 */
export async function waitForJudge(
  assessmentId: string,
  opts: { timeoutMs?: number; intervalMs?: number; isCancelled?: () => boolean } = {},
): Promise<"completed" | "failed" | "timeout" | "cancelled"> {
  const intervalMs = opts.intervalMs ?? 3000;
  const deadline = Date.now() + (opts.timeoutMs ?? 3 * 60 * 1000);

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    if (opts.isCancelled?.()) return "cancelled";
    try {
      const { assessment } = await api<{ assessment: { status: string } }>(
        `/api/assessments/${assessmentId}`,
      );
      if (assessment.status === "completed") return "completed";
      if (assessment.status === "failed") return "failed";
    } catch {
      /* 일시적 통신 오류는 다음 주기에 다시 확인한다 */
    }
  }
  return "timeout";
}
