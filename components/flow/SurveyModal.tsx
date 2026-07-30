"use client";

import { useEffect, useState } from "react";
import { Button, Loader, Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { waitForJudge } from "@/lib/judgeWait";

/**
 * 결측 보완 설문 (수정요청v9)
 * 판정을 보류한 문항에만 발행된다. 선지의 value가 곧 채점 앵커라 응답이 그대로 점수가 된다.
 * 모든 문항은 건너뛸 수 있고, 건너뛴 문항은 종전처럼 보류로 남는다(감점 아님).
 */
type SurveyItem = {
  code: string;
  text: string;
  choices: { value: string; label: string }[];
  answer: { choiceValues: string[] } | null;
};

export function SurveyModal({
  assessmentId,
  open,
  onClose,
  onApplied,
}: {
  assessmentId: string;
  open: boolean;
  onClose: () => void;
  /** 재판정까지 끝난 뒤 — 호출부가 결과를 다시 불러온다 */
  onApplied: () => void;
}) {
  const [items, setItems] = useState<SurveyItem[] | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    api<{ items: SurveyItem[] }>(`/api/assessments/${assessmentId}/surveys`)
      .then(({ items }) => {
        setItems(items);
        setPicked(
          Object.fromEntries(
            items
              .filter((i) => i.answer?.choiceValues?.[0] !== undefined)
              .map((i) => [i.code, i.answer!.choiceValues[0]]),
          ),
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "설문을 불러오지 못했어요."));
  }, [open, assessmentId]);

  const submit = async () => {
    if (saving) return;
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
      /* 응답을 반영하려면 다시 판정해야 한다 */
      await api(`/api/assessments/${assessmentId}/submit`, { method: "POST" });
      const outcome = await waitForJudge(assessmentId);
      if (outcome === "failed") throw new Error("재판정에 실패했어요.");
      if (outcome === "timeout")
        throw new Error("재판정이 오래 걸려요. 잠시 후 결과를 새로고침해 주세요.");
      onApplied();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const answered = Object.keys(picked).length;

  return (
    <Modal open={open} onClose={onClose} title="설문으로 보완하기" wide>
      {items === null ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
          <Loader />
        </div>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
          지금 보완할 문항이 없어요.
        </p>
      ) : (
        <div>
          <p style={{ margin: "0 0 4px", font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
            자료로 판정하지 못한 {items.length}문항이에요. 답한 문항만 점수에 반영돼요.
          </p>
          <p style={{ margin: 0, font: "var(--text-caption)", color: "var(--grey-500)" }}>
            모르는 문항은 건너뛰어도 돼요 — 건너뛰면 판정 보류로 남고 감점되지 않아요.
          </p>

          <div
            className="ax-scrollbar-none"
            style={{ marginTop: 14, maxHeight: "46vh", overflowY: "auto" }}
          >
            {items.map((q) => (
              <div
                key={q.code}
                style={{ borderTop: "1px solid var(--line-subtle)", padding: "14px 0" }}
              >
                <div style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                  {q.text}
                </div>
                <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                  {q.choices.map((ch) => {
                    const on = picked[q.code] === ch.value;
                    return (
                      <button
                        key={ch.value}
                        type="button"
                        onClick={() =>
                          setPicked((prev) => {
                            /* 같은 선지를 다시 누르면 건너뛰기(응답 취소) */
                            const next = { ...prev };
                            if (next[q.code] === ch.value) delete next[q.code];
                            else next[q.code] = ch.value;
                            return next;
                          })
                        }
                        style={{
                          textAlign: "left",
                          padding: "9px 12px",
                          borderRadius: "var(--radius-m)",
                          border: `1px solid ${on ? "var(--line-brand)" : "var(--line-default)"}`,
                          background: on ? "var(--bg-brand-weak)" : "var(--bg-elevated)",
                          color: on ? "var(--fg-brand)" : "var(--fg-secondary)",
                          font: "var(--text-body3)",
                          fontFamily: "var(--font-sans)",
                          cursor: "pointer",
                        }}
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <p style={{ margin: "12px 0 0", font: "var(--text-caption)", color: "var(--fg-danger)" }}>
              {error}
            </p>
          )}

          <div style={{ marginTop: 16 }}>
            <Button variant="primary" full disabled={answered === 0 || saving} onClick={submit}>
              {saving ? "반영하고 있어요" : `${answered}문항 반영하기`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
