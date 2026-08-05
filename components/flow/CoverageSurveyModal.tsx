"use client";

import { useEffect, useState } from "react";
import { Button, Icons, Loader, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { waitForJudge } from "@/lib/judgeWait";

/**
 * 보완 설문 — 카드 모달 형식 (작업 요청 v5-3)
 * 판정에서 자료로 분석하지 못한 문항을 AI 에이전트가 컨설턴트 어체(조직 단위 질문)로
 * 재작성해 내려준다(kind=supplement). 한 문항씩 보여주고, 선지를 고르면 자동으로 다음으로 넘어간다.
 * 모든 문항은 건너뛸 수 있고, 건너뛴 문항은 종전처럼 분석 보류로 남는다(감점 아님).
 * 마지막에 '반영하기'를 누르면 응답 저장 → 재분석까지 돌고 onApplied로 알린다.
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
}: {
  assessmentId: string;
  open: boolean;
  onClose: () => void;
  /** 재분석까지 끝난 뒤 — 호출부가 결과를 다시 불러온다 */
  onApplied: () => void;
}) {
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
        const list = items.filter((i) => i.kind === "supplement");
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

  /** 선지 선택 — 잠깐 선택 상태를 보여준 뒤 자동으로 다음 문항으로 (v5-3) */
  const pick = (code: string, value: string) => {
    if (saving) return;
    setPicked((prev) => ({ ...prev, [code]: value }));
    setTimeout(() => setIdx((i) => i + 1), 220);
  };

  const submit = async () => {
    if (saving) return;
    if (answered === 0) {
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
      /* 응답을 반영하려면 다시 분석해야 한다 */
      await api(`/api/assessments/${assessmentId}/submit`, { method: "POST" });
      const outcome = await waitForJudge(assessmentId);
      if (outcome === "failed") throw new Error("재분석에 실패했어요.");
      if (outcome === "timeout")
        throw new Error("재분석이 오래 걸려요. 잠시 후 결과를 새로고침해 주세요.");
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
    <Modal open={open} onClose={onClose} title="컨설턴트 보완 질문" wide>
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
              자료로 확인하지 못한 부분을 여쭤볼게요 — 모르시면 건너뛰어도 돼요.
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
            {answered > 0
              ? "반영하면 다시 분석해서 점수와 결과가 새로 계산돼요."
              : "건너뛴 문항은 분석 보류로 남고 감점되지 않아요."}
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
              {saving ? "반영하고 있어요" : answered > 0 ? `${answered}문항 반영하기` : "닫기"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
