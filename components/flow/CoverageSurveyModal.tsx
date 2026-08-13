"use client";

import { useEffect, useState } from "react";
import { Button, Icons, Loader, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { waitForJudge } from "@/lib/judgeWait";

/**
 * 진단 보완 질문 — 카드 모달 형식 (작업 요청 v5-3 · 사전/보완 설문 통합)
 * 서버가 사전 설문(kind=primary, 항상)과 보완 설문(kind=supplement, 결측·문서 부족 시)을 한 목록으로
 * 내려준다 — 보완할 게 없으면 사전 설문만 도는 셈이다. 보완 설문 문구는 AI 에이전트가 컨설턴트
 * 어체(조직 단위 질문)로 쓴다.
 * 한 문항씩 보여주고 선지를 고르면 자동으로 다음으로 넘어간다. 아직 답하지 않은 문항부터 시작한다.
 * 모든 문항은 건너뛸 수 있고, 건너뛴 문항은 종전처럼 분석 보류로 남는다(감점 아님).
 *
 * 두 시점에서 쓴다 (v7):
 *  · phase="pre"  — 분석을 시작하기 직전. 응답만 저장하고 곧바로 onApplied로 넘긴다(호출부가 분석을
 *    시작한다). 결과가 나온 뒤 다시 묻고 재분석하던 동선을 없앤 것이 이 모드의 목적이다.
 *    물을 문항이 하나도 없으면 모달을 띄운 채 세우지 않고 바로 onApplied로 통과시킨다.
 *  · phase="post" — 결과 화면에서 남은 결측을 보완할 때. 응답 저장 → 재분석까지 돌고 onApplied.
 */
type SurveyItem = {
  code: string;
  kind: string; // primary(사전 설문) / supplement(보완 설문)
  text: string;
  choices: { value: string; label: string }[];
  answer: { choiceValues: string[] } | null;
};

export function CoverageSurveyModal({
  assessmentId,
  open,
  onClose,
  onApplied,
  phase = "post",
}: {
  assessmentId: string;
  open: boolean;
  onClose: () => void;
  /** 응답 반영이 끝난 뒤 — pre면 호출부가 분석을 시작하고, post면 결과를 다시 불러온다 */
  onApplied: () => void;
  /** pre = 분석 시작 직전(재분석 없음) / post = 결과 화면 보완(재분석) */
  phase?: "pre" | "post";
}) {
  const pre = phase === "pre";
  const [items, setItems] = useState<SurveyItem[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIdx(0);
    setItems(null);
    api<{ items: SurveyItem[] }>(`/api/assessments/${assessmentId}/surveys`)
      .then(({ items }) => {
        /* 사전·보완 설문을 한 목록으로 받는다 — 아직 답하지 않은 문항을 앞으로 (sort는 stable) */
        const answeredOf = (i: SurveyItem) => (i.answer?.choiceValues?.[0] !== undefined ? 1 : 0);
        const list = [...items].sort((a, b) => answeredOf(a) - answeredOf(b));
        setItems(list);
        setPicked(
          Object.fromEntries(
            list
              .filter((i) => i.answer?.choiceValues?.[0] !== undefined)
              .map((i) => [i.code, i.answer!.choiceValues[0]]),
          ),
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "설문을 불러오지 못했어요."));
  }, [open, assessmentId]);

  const total = items?.length ?? 0;
  const answered = Object.keys(picked).length;
  const finished = items !== null && idx >= total;

  /* pre 모드에서 물을 게 없으면 세우지 않는다 — 빈 모달을 띄우고 '닫기'를 누르게 할 이유가 없다 */
  useEffect(() => {
    if (pre && open && items !== null && items.length === 0) onApplied();
  }, [pre, open, items, onApplied]);

  /** 선지 선택 — 잠깐 선택 상태를 보여준 뒤 자동으로 다음 문항으로 (v5-3) */
  const pick = (code: string, value: string) => {
    if (saving) return;
    setPicked((prev) => ({ ...prev, [code]: value }));
    setTimeout(() => setIdx((i) => i + 1), 220);
  };

  const submit = async () => {
    if (saving) return;
    if (answered === 0) {
      /* pre면 답이 없어도 분석은 시작해야 한다 — 건너뛴 문항은 종전대로 보류로 남는다 */
      if (pre) onApplied();
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(`/api/assessments/${assessmentId}/surveys`, {
        method: "PUT",
        body: JSON.stringify({
          answers: Object.entries(picked).map(([surveyCode, value]) => ({
            surveyCode,
            choiceValues: [value],
          })),
        }),
      });
      /* post는 이미 나온 결과를 갈아끼워야 하므로 재분석한다.
         pre는 이 응답을 안고 첫 분석이 도므로 여기서 돌리지 않는다 — 재분석이 사라지는 지점 */
      if (!pre) {
        await api(`/api/assessments/${assessmentId}/submit`, { method: "POST" });
        const outcome = await waitForJudge(assessmentId);
        if (outcome === "failed") throw new Error("재분석에 실패했어요.");
        if (outcome === "timeout")
          throw new Error("재분석이 오래 걸려요. 잠시 후 결과를 새로고침해 주세요.");
      }
      onApplied();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const current = items && idx < total ? items[idx] : null;

  return (
    <Modal open={open} onClose={onClose} title="컨설턴트 진단 질문" wide>
      {items === null ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Loader />
        </div>
      ) : total === 0 ? (
        <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
          지금 여쭤볼 내용이 없어요 — 자료로 충분히 분석됐어요.
        </p>
      ) : current ? (
        /* ── 문항 카드 — 한 번에 하나씩, 선택하면 자동으로 다음 ── */
        <div key={current.code} className="ax-step-enter">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 6,
            }}
          >
            <p style={{ margin: 0, font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
              자료로 확인하지 못한 부분을 확인합니다.
            </p>
            <span
              style={{
                flex: "none",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--fg-tertiary)",
              }}
            >
              {idx + 1}/{total}
            </span>
          </div>

          <div style={{ font: "var(--text-title2)", color: "var(--fg-primary)", margin: "10px 0 14px" }}>
            {current.text}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {current.choices.map((ch) => {
              const on = picked[current.code] === ch.value;
              return (
                <button
                  key={ch.value}
                  type="button"
                  onClick={() => pick(current.code, ch.value)}
                  style={{
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: "var(--radius-m)",
                    border: `1px solid ${on ? "var(--line-brand)" : "var(--line-default)"}`,
                    background: on ? "var(--bg-brand-weak)" : "var(--bg-elevated)",
                    color: on ? "var(--fg-brand)" : "var(--fg-secondary)",
                    font: "var(--text-body2)",
                    fontFamily: "var(--font-sans)",
                    cursor: "pointer",
                    transition:
                      "border-color var(--dur-fast) var(--ease), background-color var(--dur-fast) var(--ease)",
                  }}
                >
                  {ch.label}
                </button>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            {idx > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setIdx((i) => i - 1)}>
                이전
              </Button>
            ) : (
              <span />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                /* 건너뛰기 — 응답을 지우고 다음으로 (보류 유지) */
                setPicked((prev) => {
                  const next = { ...prev };
                  delete next[current.code];
                  return next;
                });
                setIdx((i) => i + 1);
              }}
            >
              건너뛰기
              <Icons.chevronRight size={14} />
            </Button>
          </div>
        </div>
      ) : finished ? (
        /* ── 마무리 — 응답 요약 + 반영 ── */
        <div className="ax-step-enter" style={{ textAlign: "center", padding: "8px 0" }}>
          <p style={{ margin: 0, font: "var(--text-title2)", color: "var(--fg-primary)" }}>
            {answered > 0 ? `${answered}문항을 답해주셨어요` : "답한 문항이 없어요"}
          </p>
          <p style={{ margin: "8px 0 18px", font: "var(--text-body3)", color: "var(--fg-tertiary)" }}>
            {answered === 0
              ? "건너뛴 문항은 분석 보류로 남고 감점되지 않아요."
              : pre
                ? "답변을 반영해서 바로 분석을 시작할게요."
                : "반영하면 다시 분석해서 점수와 결과가 새로 계산돼요."}
          </p>
          {error && (
            <p style={{ margin: "0 0 12px", font: "var(--text-caption)", color: "var(--fg-danger)" }}>
              {error}
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" full disabled={saving} onClick={() => setIdx(0)}>
              다시 보기
            </Button>
            <Button variant="primary" full disabled={saving} onClick={submit}>
              {saving
                ? "반영하고 있어요"
                : pre
                  ? answered > 0
                    ? `${answered}문항 반영하고 분석`
                    : "그대로 분석 시작"
                  : answered > 0
                    ? `${answered}문항 반영하기`
                    : "닫기"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
