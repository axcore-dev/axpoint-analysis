"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { hitlDocs, uploadedDocs } from "@/data/scenario/documents";
import { publicSources } from "@/data/scenario/publicData";
import { surveyQuestions } from "@/data/rubric/survey";
import { hitlResponses } from "@/data/scenario/hitl";
import { areaCoverages } from "@/data/scenario/areas";
import { DIGITAL_LEVELS, FUNCTION_AREAS } from "@/data/rubric/meta";
import type { FunctionAreaId, SurveyQuestion } from "@/lib/types";
import { Badge, Button, Card, Icons, Input, Loader, Tag } from "@/components/ui";

/**
 * S1 자료 정리 — 정리된 자료를 보여주는 공간 (수정요청v1).
 * 수집·분류·확인만 담당한다. 점수·등급·인사이트 등 해석은 노출하지 않는다.
 */

/* ── 정적 데이터 ── */

/** 10번(매출 구간)은 재무정보가 확인되어 묻지 않는다 → 12문항 */
const visibleSurvey = surveyQuestions.filter((q) => q.no !== 10);

/** 기본 응답 (전 문항 채우기용) */
const defaultAnswers: Record<number, string[]> = Object.fromEntries(
  hitlResponses.map((r) => [r.questionNo, [r.answer]]),
);

/** 재방문 시 문서 확인 선택 복원값 (시나리오 응답) */
const DOC_DEFAULT_CHOICE: Record<string, string> = {
  d07: "현장에서 종이에 수기 작성",
  d08: "일보를 보고 사무실에서 다시 입력",
};

const LOADING_MESSAGES = [
  "공개 데이터를 모으고 있어요",
  "올려주신 자료를 읽고 있어요",
  "8대 영역으로 나누고 있어요",
  "개인 정보를 가리고 있어요",
];

/** 8대 영역별 자료 묶음 (업로드 + 공개) */
const areaGroups = FUNCTION_AREAS.map((a) => ({
  id: a.id,
  name: a.name,
  docs: uploadedDocs.filter((d) => d.area === a.id),
  pubs: publicSources.filter((p) => p.area === a.id),
  coverage: areaCoverages.find((c) => c.areaId === a.id),
}));

/** 기본 펼침: 자료가 많은 상위 3개 영역 */
const DEFAULT_OPEN_AREAS: Record<string, boolean> = Object.fromEntries(
  [...areaGroups]
    .sort((x, y) => y.docs.length + y.pubs.length - (x.docs.length + x.pubs.length))
    .slice(0, 3)
    .map((g) => [g.id, true]),
);

function helperText(q: SurveyQuestion): string | null {
  if (q.type === "multi") return "여러 개를 고를 수 있어요";
  if (q.type === "single_text") return "선택한 뒤 내용을 적을 수 있어요";
  return null;
}

/* ── 공용 스타일 ── */

const mono: CSSProperties = { fontFamily: "var(--font-mono)" };

const h2Style: CSSProperties = {
  margin: 0,
  font: "var(--text-h2)",
  letterSpacing: "var(--track-heading)",
  color: "var(--fg-primary)",
};

const subStyle: CSSProperties = {
  margin: "8px 0 0",
  font: "var(--text-body2)",
  letterSpacing: "var(--track-body)",
  color: "var(--fg-secondary)",
};

const captionStyle: CSSProperties = {
  font: "var(--text-caption)",
  letterSpacing: "var(--track-body)",
  color: "var(--fg-tertiary)",
};

const textBtnStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px 6px",
  font: "var(--text-caption)",
  letterSpacing: "var(--track-body)",
  color: "var(--fg-tertiary)",
  textDecoration: "underline",
  textUnderlineOffset: 3,
  flex: "none",
};

const detailBtnStyle: CSSProperties = {
  ...textBtnStyle,
  color: "var(--fg-brand)",
};

export default function CollectPage() {
  const router = useRouter();
  const { companyInput, confirmedDocIds, surveyDone, completedSteps, update, completeStep } =
    useDiagnosis();

  /* sessionStorage 하이드레이션 대기 (가드 오판 방지) */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  /* ── 로딩 화면 (재방문 시 생략) ── */
  const revisit = completedSteps.includes("collect");
  const [ready, setReady] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!hydrated || !companyInput || ready) return;
    if (revisit) {
      setReady(true);
      return;
    }
    const iv = window.setInterval(
      () => setMsgIdx((i) => (i < LOADING_MESSAGES.length - 1 ? i + 1 : i)),
      1200,
    );
    const to = window.setTimeout(() => setReady(true), 4200);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(to);
    };
  }, [hydrated, companyInput, revisit, ready]);

  /* ── 문서 확인 (2건) ── */
  const [docChoices, setDocChoices] = useState<Record<string, string>>({});
  const chooseDoc = (docId: string, option: string) => {
    setDocChoices((prev) => ({ ...prev, [docId]: option }));
    if (!confirmedDocIds.includes(docId)) {
      update({ confirmedDocIds: [...confirmedDocIds, docId] });
    }
  };

  /* ── 설문 12문항 ── */
  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [skipped, setSkipped] = useState<Record<number, boolean>>({});
  const [otherText, setOtherText] = useState<Record<number, string>>({});
  const [reasonText, setReasonText] = useState<Record<number, string>>({});

  /* 재방문 복원: 완료 상태인데 로컬 응답이 비어 있으면 기본 응답으로 표시 */
  useEffect(() => {
    if (!hydrated) return;
    if (surveyDone) {
      setAnswers((prev) => (Object.keys(prev).length > 0 ? prev : defaultAnswers));
    }
    if (confirmedDocIds.length > 0) {
      setDocChoices((prev) => {
        const next = { ...prev };
        for (const id of confirmedDocIds) {
          if (!next[id] && DOC_DEFAULT_CHOICE[id]) next[id] = DOC_DEFAULT_CHOICE[id];
        }
        return next;
      });
    }
  }, [hydrated, surveyDone, confirmedDocIds]);

  const selectOption = (q: SurveyQuestion, option: string) => {
    setSkipped((prev) => (prev[q.no] ? { ...prev, [q.no]: false } : prev));
    setAnswers((prev) => {
      const cur = prev[q.no] ?? [];
      if (q.type === "multi") {
        const next = cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option];
        return { ...prev, [q.no]: next };
      }
      return { ...prev, [q.no]: [option] };
    });
  };

  const toggleSkip = (no: number) => {
    const willSkip = !skipped[no];
    setSkipped((prev) => ({ ...prev, [no]: willSkip }));
    if (willSkip) setAnswers((prev) => ({ ...prev, [no]: [] }));
  };

  const fillDefaults = () => {
    setAnswers(defaultAnswers);
    setSkipped({});
  };

  const isCompleted = (q: SurveyQuestion) =>
    Boolean(skipped[q.no]) || (answers[q.no]?.length ?? 0) > 0;
  const completedCount = visibleSurvey.filter(isCompleted).length;
  const answeredCount = visibleSurvey.filter(
    (q) => !skipped[q.no] && (answers[q.no]?.length ?? 0) > 0,
  ).length;
  const skippedCount = visibleSurvey.filter((q) => skipped[q.no]).length;

  /* 12문항 모두 응답 또는 보류되면 완료 (보류 포함) */
  useEffect(() => {
    if (!hydrated || surveyDone) return;
    if (visibleSurvey.every((q) => skipped[q.no] || (answers[q.no]?.length ?? 0) > 0)) {
      update({ surveyDone: true });
    }
  }, [answers, skipped, hydrated, surveyDone, update]);

  const docsConfirmed = hitlDocs.every((d) => confirmedDocIds.includes(d.id));
  const confirmComplete = docsConfirmed && surveyDone;
  const canProceed = confirmComplete;

  /* 확인 섹션 접힘 (완료 시 자동 접힘, 다시 펼치기 가능) */
  const [confirmOpenOverride, setConfirmOpenOverride] = useState<boolean | null>(null);
  const confirmOpen = confirmOpenOverride ?? !confirmComplete;

  /* ── 공개 데이터 · 영역 아코디언 ── */
  const [openSources, setOpenSources] = useState<Record<string, boolean>>({});
  const [openAreas, setOpenAreas] = useState<Record<string, boolean>>(DEFAULT_OPEN_AREAS);
  const [openDocDetails, setOpenDocDetails] = useState<Record<string, boolean>>({});

  const onProceed = () => {
    if (!canProceed) return;
    completeStep("collect");
    router.push("/result");
  };

  if (!hydrated) return null;

  /* ── 가드: 기업 정보 없음 ── */
  if (!companyInput) {
    return (
      <section style={{ padding: "96px 24px" }}>
        <Card radius="l" style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", color: "var(--fg-quaternary)" }}>
            <Icons.info size={22} />
          </div>
          <h1
            style={{
              margin: "12px 0 0",
              font: "var(--text-h4)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            진단을 시작할 기업 정보가 없어요
          </h1>
          <p style={subStyle}>기업 이름이나 사업자번호를 먼저 입력해 주세요.</p>
          <div style={{ marginTop: 20 }}>
            <Button variant="secondary" size="md" href="/">
              처음으로
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  /* ── 로딩 화면 ── */
  if (!ready) {
    return (
      <section
        style={{
          minHeight: "calc(100vh - 220px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            font: "var(--text-h1)",
            fontSize: 34,
            letterSpacing: "var(--track-heading)",
            color: "var(--fg-primary)",
          }}
        >
          {companyInput || "(주)데모기업"}
        </h1>
        <Loader style={{ color: "var(--fg-brand)" }} />
        <p
          key={msgIdx}
          className="ax-step-enter"
          style={{
            margin: 0,
            font: "var(--text-body1)",
            letterSpacing: "var(--track-body)",
            color: "var(--fg-secondary)",
          }}
        >
          {LOADING_MESSAGES[msgIdx]}
        </p>
      </section>
    );
  }

  /* ── 본문 ── */
  return (
    <main className="ax-step-enter" style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px 96px" }}>
      {/* 1) 확인이 필요해요 — 최상단 */}
      <section>
        <h2 style={h2Style}>몇 가지만 확인해 주세요</h2>
        <p style={subStyle}>응답은 판정 근거와 시스템 현황 데이터로 함께 쓰여요.</p>

        {!confirmOpen ? (
          <Card
            radius="l"
            style={{
              marginTop: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Badge tone="success">확인 완료</Badge>
              <span style={{ font: "var(--text-body2)", color: "var(--fg-primary)" }}>
                응답 <span style={mono}>{answeredCount}</span>건이 판정에 반영됐어요
                {skippedCount > 0 && (
                  <>
                    {" "}
                    · <span style={mono}>{skippedCount}</span>건은 판정을 보류했어요
                  </>
                )}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpenOverride(true)}>
              다시 펼치기
            </Button>
          </Card>
        ) : (
          <div style={{ marginTop: 20 }}>
            {confirmComplete && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
                <Button variant="ghost" size="sm" onClick={() => setConfirmOpenOverride(false)}>
                  접기
                </Button>
              </div>
            )}

            {/* 문서 확인 2건 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 12,
              }}
            >
              {hitlDocs.map((doc) => {
                const chosen = docChoices[doc.id];
                return (
                  <Card key={doc.id} radius="l">
                    {/* ① 질문 */}
                    <div
                      style={{
                        font: "var(--text-title2)",
                        letterSpacing: "var(--track-body)",
                        color: "var(--fg-primary)",
                      }}
                    >
                      {doc.hitlPrompt?.question}
                    </div>
                    {/* ② 출처 */}
                    <div
                      style={{
                        ...captionStyle,
                        marginTop: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Icons.file size={13} />
                      {doc.fileName} · {doc.docType}
                    </div>
                    {/* ③ 선택지 */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                      {doc.hitlPrompt?.options.map((opt) => (
                        <Tag
                          key={opt}
                          selected={chosen === opt}
                          onClick={() => chooseDoc(doc.id, opt)}
                        >
                          {opt}
                        </Tag>
                      ))}
                    </div>
                    <p style={{ ...captionStyle, margin: "10px 0 0" }}>나중에 다시 바꿀 수 있어요</p>
                  </Card>
                );
              })}
            </div>

            {/* 설문 12문항 */}
            <div style={{ marginTop: 32 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <span
                    style={{
                      font: "var(--text-title1)",
                      letterSpacing: "var(--track-body)",
                      color: "var(--fg-primary)",
                    }}
                  >
                    이어서 여쭤볼게요
                  </span>
                  <span style={captionStyle}>
                    <span style={mono}>{completedCount}</span>/<span style={mono}>12</span>
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={fillDefaults}>
                  기본 응답으로 채우기
                </Button>
              </div>
              <p style={{ ...captionStyle, margin: "6px 0 0" }}>
                매출 구간은 재무정보가 확인되어 묻지 않아요
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                {visibleSurvey.map((q, idx) => {
                  const sel = answers[q.no] ?? [];
                  const isSkipped = Boolean(skipped[q.no]);
                  const helper = helperText(q);
                  const options = q.allowOther ? [...q.options, "기타"] : q.options;
                  const otherSelected = sel.includes("기타");
                  const reasonNeeded = q.reasonOn?.some((r) => sel.includes(r)) ?? false;
                  const investSelected = q.type === "single_text" && sel.includes("있다");
                  return (
                    <div
                      key={q.no}
                      style={{
                        border: "1px solid var(--line-default)",
                        borderRadius: "var(--radius-l)",
                        padding: "16px 18px",
                        background: isSkipped ? "var(--bg-secondary)" : "var(--bg-base)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{ ...mono, ...captionStyle, paddingTop: 3 }}>
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* 질문 */}
                          <div
                            style={{
                              font: "var(--text-label-m)",
                              letterSpacing: "var(--track-body)",
                              color: "var(--fg-primary)",
                            }}
                          >
                            {q.question}
                          </div>
                          {/* 보조설명 */}
                          {helper && <p style={{ ...captionStyle, margin: "4px 0 0" }}>{helper}</p>}
                        </div>
                        <button type="button" style={textBtnStyle} onClick={() => toggleSkip(q.no)}>
                          {isSkipped ? "다시 답하기" : "건너뛰기"}
                        </button>
                      </div>

                      {isSkipped && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <Badge tone="neutral">이 문항은 판정을 보류해요</Badge>
                          <span style={captionStyle}>감점은 아니에요 · 아래에서 다시 답할 수 있어요</span>
                        </div>
                      )}

                      {/* 선택지 */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginTop: 12,
                          opacity: isSkipped ? 0.55 : 1,
                        }}
                      >
                        {options.map((opt) => (
                          <Tag
                            key={opt}
                            selected={!isSkipped && sel.includes(opt)}
                            onClick={() => selectOption(q, opt)}
                          >
                            {opt}
                          </Tag>
                        ))}
                      </div>

                      {!isSkipped && otherSelected && (
                        <div style={{ marginTop: 10, maxWidth: 440 }}>
                          <Input
                            value={otherText[q.no] ?? ""}
                            onChange={(e) =>
                              setOtherText((p) => ({ ...p, [q.no]: e.target.value }))
                            }
                            placeholder="직접 적어 주세요"
                            aria-label="기타 응답 입력"
                          />
                        </div>
                      )}
                      {!isSkipped && investSelected && (
                        <div style={{ marginTop: 10, maxWidth: 440 }}>
                          <Input
                            value={otherText[q.no] ?? ""}
                            onChange={(e) =>
                              setOtherText((p) => ({ ...p, [q.no]: e.target.value }))
                            }
                            placeholder="내역을 간단히 적어 주시면 판정 근거로 써요 (선택)"
                            aria-label="투자 내역 입력"
                          />
                        </div>
                      )}
                      {!isSkipped && reasonNeeded && (
                        <div style={{ marginTop: 10, maxWidth: 440 }}>
                          <Input
                            value={reasonText[q.no] ?? ""}
                            onChange={(e) =>
                              setReasonText((p) => ({ ...p, [q.no]: e.target.value }))
                            }
                            placeholder="사유를 적어 주시면 배포 방식 설계에 반영해요 (선택)"
                            aria-label="불가 사유 입력"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 2) 공개 데이터 수집 결과 */}
      <section style={{ marginTop: 64 }}>
        <h2 style={h2Style}>이런 공개 데이터를 모았어요</h2>
        <p style={subStyle}>행을 누르면 수집한 내용을 볼 수 있어요.</p>

        <Card padded={false} radius="l" style={{ marginTop: 20, overflow: "hidden" }}>
          {publicSources.map((src, i) => {
            const open = Boolean(openSources[src.id]);
            return (
              <div key={src.id} style={{ borderTop: i > 0 ? "1px solid var(--line-subtle)" : "none" }}>
                <button
                  type="button"
                  onClick={() => setOpenSources((p) => ({ ...p, [src.id]: !p[src.id] }))}
                  aria-expanded={open}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "minmax(130px, 190px) 1fr auto 20px",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 20px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <span
                    style={{
                      font: "var(--text-label-m)",
                      letterSpacing: "var(--track-body)",
                      color: "var(--fg-primary)",
                    }}
                  >
                    {src.name}
                  </span>
                  <span style={{ ...captionStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {src.sourceApi}
                  </span>
                  <span
                    style={{
                      ...mono,
                      fontSize: 13,
                      color: "var(--fg-secondary)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      justifySelf: "end",
                    }}
                  >
                    {src.count}건
                    {src.status === "partial" && (
                      <span
                        title="일부만 수집했어요"
                        aria-label="일부만 수집했어요"
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: "var(--radius-full)",
                          background: "var(--orange-500)",
                        }}
                      />
                    )}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      display: "inline-flex",
                      color: "var(--fg-quaternary)",
                      transition: "transform var(--dur-base) var(--ease)",
                      transform: open ? "rotate(180deg)" : "none",
                    }}
                  >
                    <Icons.chevronDown size={16} />
                  </span>
                </button>
                {open && (
                  <div style={{ padding: "2px 20px 16px 20px" }}>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                      {src.items.map((item) => (
                        <li
                          key={item}
                          style={{
                            display: "flex",
                            gap: 8,
                            font: "var(--text-body3)",
                            letterSpacing: "var(--track-body)",
                            color: "var(--fg-secondary)",
                            padding: "3px 0",
                          }}
                        >
                          <span aria-hidden style={{ color: "var(--grey-300)", flex: "none" }}>
                            ·
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                    {src.note && <p style={{ ...captionStyle, margin: "8px 0 0" }}>{src.note}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </section>

      {/* 3) 8대 영역 자료 분류 */}
      <section style={{ marginTop: 64 }}>
        <h2 style={h2Style}>자료를 8대 영역으로 나눴어요</h2>
        <p style={subStyle}>
          올려주신 자료와 공개 데이터를 영역별로 정리했어요. 자료가 부족한 영역은 따로 표시했어요.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 }}>
          {areaGroups.map((group) => {
            const open = Boolean(openAreas[group.id]);
            const insufficient = group.coverage?.insufficient ?? false;
            return (
              <Card key={group.id} padded={false} radius="l" style={{ overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenAreas((p: Record<FunctionAreaId | string, boolean>) => ({
                      ...p,
                      [group.id]: !p[group.id],
                    }))
                  }
                  aria-expanded={open}
                  style={{
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    padding: "16px 20px",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span
                      style={{
                        font: "var(--text-title1)",
                        letterSpacing: "var(--track-body)",
                        color: "var(--fg-primary)",
                      }}
                    >
                      {group.name}
                    </span>
                    <span style={{ ...captionStyle, ...mono }}>
                      업로드 {group.docs.length} · 공개 {group.pubs.length}
                    </span>
                    {insufficient && <Badge tone="warning">자료가 부족해요</Badge>}
                    <span
                      aria-hidden
                      style={{
                        marginLeft: "auto",
                        display: "inline-flex",
                        color: "var(--fg-quaternary)",
                        transition: "transform var(--dur-base) var(--ease)",
                        transform: open ? "rotate(180deg)" : "none",
                      }}
                    >
                      <Icons.chevronDown size={16} />
                    </span>
                  </div>
                  {insufficient && group.coverage?.missingHint && (
                    <p style={{ ...captionStyle, margin: "6px 0 0" }}>
                      {group.coverage.missingHint} 자료를 올리면 진단이 더 정확해져요
                    </p>
                  )}
                </button>

                {open && (
                  <div>
                    {group.docs.map((doc) => {
                      const detailOpen = Boolean(openDocDetails[doc.id]);
                      return (
                        <div
                          key={doc.id}
                          style={{ borderTop: "1px solid var(--line-subtle)", padding: "12px 20px" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ display: "inline-flex", color: "var(--fg-quaternary)" }}>
                              <Icons.file size={14} />
                            </span>
                            <span
                              style={{
                                font: "var(--text-label-m)",
                                letterSpacing: "var(--track-body)",
                                color: "var(--fg-primary)",
                              }}
                            >
                              {doc.fileName}
                            </span>
                            <Badge tone="neutral">{DIGITAL_LEVELS[doc.level]}</Badge>
                            <Badge tone="outline">{doc.docType}</Badge>
                            {doc.masked && <Badge tone="success">개인정보 가림</Badge>}
                            <button
                              type="button"
                              style={{ ...detailBtnStyle, marginLeft: "auto" }}
                              aria-expanded={detailOpen}
                              onClick={() =>
                                setOpenDocDetails((p) => ({ ...p, [doc.id]: !p[doc.id] }))
                              }
                            >
                              상세 {detailOpen ? "접기" : "보기"}
                            </button>
                          </div>
                          {detailOpen && (
                            <div
                              style={{
                                marginTop: 10,
                                padding: "12px 14px",
                                borderRadius: "var(--radius-s)",
                                background: "var(--bg-secondary)",
                              }}
                            >
                              <p
                                style={{
                                  margin: 0,
                                  font: "var(--text-body3)",
                                  letterSpacing: "var(--track-body)",
                                  color: "var(--fg-secondary)",
                                }}
                              >
                                {doc.extractedDetail}
                              </p>
                              <p style={{ ...captionStyle, margin: "8px 0 0" }}>
                                근거 — {doc.summaryTeaser}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {group.pubs.map((pub) => (
                      <div
                        key={pub.id}
                        style={{ borderTop: "1px solid var(--line-subtle)", padding: "12px 20px" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ display: "inline-flex", color: "var(--fg-quaternary)" }}>
                            <Icons.globe size={14} />
                          </span>
                          <span
                            style={{
                              font: "var(--text-label-m)",
                              letterSpacing: "var(--track-body)",
                              color: "var(--fg-primary)",
                            }}
                          >
                            {pub.name}
                          </span>
                          <Badge tone="neutral">{DIGITAL_LEVELS[pub.digitalLevel]}</Badge>
                          <Badge tone="outline">{pub.sourceApi}</Badge>
                          <span style={{ ...mono, ...captionStyle, marginLeft: "auto" }}>
                            {pub.count}건
                          </span>
                        </div>
                      </div>
                    ))}

                    {group.docs.length === 0 && group.pubs.length === 0 && (
                      <div style={{ borderTop: "1px solid var(--line-subtle)", padding: "12px 20px" }}>
                        <span style={captionStyle}>이 영역에서 확인된 자료가 아직 없어요</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* 4) CTA */}
      <section style={{ marginTop: 64, textAlign: "center" }}>
        <Button
          variant="primary"
          size="xl"
          disabled={!canProceed}
          onClick={onProceed}
          style={{ minWidth: 280 }}
        >
          진단 결과 보기
        </Button>
        {!canProceed && (
          <p style={{ ...captionStyle, margin: "12px 0 0" }}>
            위 확인을 마치면 진단으로 넘어갈 수 있어요
          </p>
        )}
      </section>
    </main>
  );
}
