"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { hitlDocs, uploadedDocs } from "@/data/scenario/documents";
import { publicSources } from "@/data/scenario/publicData";
import { surveyQuestions } from "@/data/rubric/survey";
import { hitlResponses } from "@/data/scenario/hitl";
import { areaCoverages } from "@/data/scenario/areas";
import { DIGITAL_LEVELS, FUNCTION_AREAS, areaName } from "@/data/rubric/meta";
import type { DigitalLevel, FunctionAreaId, UploadedDoc } from "@/lib/types";
import { Badge, Button, Card, Eyebrow, Icons, Tag } from "@/components/ui";

/**
 * S1 자료 수집·정리 — 수집·분류·확인만 담당 (역할 1개 원칙).
 * 점수·인사이트·등급 등 해석은 절대 노출하지 않는다 (REQ-F-01②).
 */

/* 설문: 10번(매출 구간)은 재무 확인되어 조건부 미노출 */
const visibleSurvey = surveyQuestions.filter((q) => q.no !== 10);
const demoAnswers: Record<number, string> = Object.fromEntries(
  hitlResponses.map((r) => [r.questionNo, r.answer]),
);

const FILE_TYPE_LABEL: Record<UploadedDoc["fileType"], string> = {
  image: "이미지",
  pdf: "PDF",
  xlsx: "XLSX",
  docx: "DOCX",
  hwp: "HWP",
};

/* 수집 시뮬레이션 3단계 */
const SIM_STEPS = [
  "공개 데이터 수집 (국세청·DART·특허청 등 6종)",
  "업로드 자료 분류 — 3축 태깅 (영역 × 디지털화수준 × 문서유형)",
  "개인정보 마스킹 처리",
];
const SIM_WIDTHS = [14, 46, 80, 100];

const sectionTitle: React.CSSProperties = {
  margin: "14px 0 0",
  fontSize: 26,
  fontWeight: 600,
  lineHeight: 1.2,
  letterSpacing: "-0.012em",
  color: "var(--text-strong)",
};

const mono: React.CSSProperties = { fontFamily: "var(--font-mono)" };

const selectStyle: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  padding: "7px 10px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--hairline)",
  background: "var(--canvas)",
  color: "var(--text-body)",
};

/** 작은 분류 칩 (3축 태깅 표기용) */
function MiniChip({ children, accent = false }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        border: accent ? "1px solid var(--ax-blue-hairline)" : "1px solid var(--hairline)",
        background: accent ? "var(--ax-blue-wash)" : "var(--surface-ghost)",
        color: accent ? "var(--ax-blue)" : "var(--slate-600)",
        fontSize: 12,
        letterSpacing: "-0.004em",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function CollectPage() {
  const router = useRouter();
  const {
    companyInput,
    confirmedDocIds,
    surveyDone,
    completedSteps,
    update,
    completeStep,
  } = useDiagnosis();

  /* sessionStorage 하이드레이션 대기 (가드 오판 방지) */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  /* ── 수집 시뮬레이션 ── */
  const [simPhase, setSimPhase] = useState(0);
  const [simDone, setSimDone] = useState(false);
  const revisit = completedSteps.includes("collect");

  useEffect(() => {
    if (!hydrated || !companyInput) return;
    if (revisit) {
      setSimDone(true);
      return;
    }
    if (simDone) return;
    const t1 = setTimeout(() => setSimPhase(1), 850);
    const t2 = setTimeout(() => setSimPhase(2), 1700);
    const t3 = setTimeout(() => {
      setSimPhase(3);
      setSimDone(true);
    }, 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, companyInput, revisit]);

  /* ── HITL 문서 원탭 확인 ── */
  const [docChoices, setDocChoices] = useState<Record<string, string>>({});
  const confirmDoc = (docId: string, option: string) => {
    setDocChoices((prev) => ({ ...prev, [docId]: option }));
    if (!confirmedDocIds.includes(docId)) {
      update({ confirmedDocIds: [...confirmedDocIds, docId] });
    }
  };

  /* ── 최소 설문 ── */
  const [answers, setAnswers] = useState<Record<number, string>>({});
  useEffect(() => {
    /* 재방문 시(이미 완료) 데모 응답으로 표시 복원 */
    if (surveyDone) {
      setAnswers((prev) => (Object.keys(prev).length > 0 ? prev : demoAnswers));
    }
  }, [surveyDone]);

  const answerQuestion = (no: number, option: string) => {
    setAnswers((prev) => {
      const next = { ...prev, [no]: option };
      if (visibleSurvey.every((q) => next[q.no] !== undefined) && !surveyDone) {
        update({ surveyDone: true });
      }
      return next;
    });
  };

  const fillDemo = () => {
    setAnswers(demoAnswers);
    update({ surveyDone: true });
  };

  /* ── 공개 데이터 재수집 (시뮬레이션) ── */
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const retrySource = (id: string) => {
    setRetrying((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => setRetrying((prev) => ({ ...prev, [id]: false })), 1000);
  };

  /* ── 업로드 자료 카드 상태 ── */
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [editingTags, setEditingTags] = useState<Record<string, boolean>>({});
  const [tagEdits, setTagEdits] = useState<
    Record<string, { area: FunctionAreaId; level: DigitalLevel; touched: boolean }>
  >({});

  /* ── 커버리지 추가 업로드 안내 ── */
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const answeredCount = visibleSurvey.filter((q) => answers[q.no] !== undefined).length;
  const docsConfirmed = hitlDocs.every((d) => confirmedDocIds.includes(d.id));
  const pendingCount =
    hitlDocs.filter((d) => !confirmedDocIds.includes(d.id)).length +
    (surveyDone ? 0 : visibleSurvey.length - answeredCount);
  const canProceed = docsConfirmed && surveyDone;

  const coverageByArea = useMemo(
    () =>
      FUNCTION_AREAS.map(
        (a) => areaCoverages.find((c) => c.areaId === a.id),
      ).filter((c): c is (typeof areaCoverages)[number] => c !== undefined),
    [],
  );

  const onProceed = () => {
    if (!canProceed) return;
    completeStep("collect");
    router.push("/result");
  };

  if (!hydrated) return null;

  /* ── 가드: 랜딩 미완 ── */
  if (!companyInput) {
    return (
      <section style={{ background: "var(--surface-mist)", padding: "var(--space-section) var(--gutter)" }}>
        <Card style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <div style={{ color: "var(--slate-400)", display: "flex", justifyContent: "center" }}>
            <Icons.info size={24} />
          </div>
          <h1
            style={{
              margin: "14px 0 0",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "var(--text-strong)",
            }}
          >
            진단 시작 정보가 없습니다
          </h1>
          <p style={{ margin: "10px 0 0", fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.55 }}>
            기업명 또는 사업자번호를 입력하면 자료 수집·정리를 시작할 수 있습니다.
          </p>
          <div style={{ marginTop: 20 }}>
            <Button variant="secondary" href="/">
              처음으로
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  /* ── 수집 시뮬레이션 화면 ── */
  if (!simDone) {
    return (
      <section style={{ background: "var(--surface-mist)", padding: "var(--space-section) var(--gutter)", minHeight: 480 }}>
        <Card style={{ maxWidth: 640, margin: "0 auto" }}>
          <Eyebrow>자료 정리</Eyebrow>
          <h1 style={{ ...sectionTitle, fontSize: 24 }}>
            {companyInput} 자료를 수집·정리하고 있습니다
          </h1>
          <div
            aria-hidden
            style={{
              marginTop: 24,
              height: 6,
              borderRadius: "var(--radius-pill)",
              background: "var(--slate-100)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${SIM_WIDTHS[simPhase]}%`,
                background: "var(--ax-blue)",
                borderRadius: "var(--radius-pill)",
                transition: "width .8s ease",
              }}
            />
          </div>
          <ol style={{ margin: "22px 0 0", padding: 0, listStyle: "none" }}>
            {SIM_STEPS.map((label, i) => {
              const done = simPhase > i;
              const active = simPhase === i;
              return (
                <li
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 0",
                    fontSize: 15,
                    color: done
                      ? "var(--text-body)"
                      : active
                        ? "var(--ax-blue)"
                        : "var(--slate-400)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 22,
                      height: 22,
                      borderRadius: "var(--radius-pill)",
                      border: done ? "none" : "1px solid var(--hairline)",
                      background: done ? "var(--ax-blue)" : "var(--canvas)",
                      color: done ? "var(--on-primary)" : "inherit",
                      flex: "none",
                    }}
                  >
                    {done ? (
                      <Icons.check size={12} />
                    ) : (
                      <span style={{ ...mono, fontSize: 11 }}>{i + 1}</span>
                    )}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
        </Card>
      </section>
    );
  }

  /* ── 본문 ── */
  return (
    <div>
      {/* 1) [확인 필요] — 페이지 최상단 고정 (F-COL-04) */}
      <section style={{ background: "var(--canvas)", padding: "var(--space-2xl) var(--gutter) var(--space-section)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <Eyebrow>자료 정리 · {companyInput}</Eyebrow>
          </div>
          <h1 style={{ ...sectionTitle, fontSize: 30 }}>수집한 자료를 정리했습니다</h1>
          <p style={{ margin: "10px 0 0", fontSize: 15, color: "var(--text-secondary)" }}>
            분류 결과를 확인하고, 아래 확인 필요 항목에 답해 주시면 진단으로 넘어갑니다.
          </p>

          <Card
            style={{
              marginTop: "var(--space-xl)",
              border: canProceed ? "1px solid var(--hairline)" : "1px solid var(--ax-blue-hairline)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 19,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: "var(--text-strong)",
                  }}
                >
                  확인 필요
                </span>
                {canProceed ? (
                  <Badge tone="success">모두 완료</Badge>
                ) : (
                  <Badge tone="accent">
                    남은 항목 <span style={mono}>{pendingCount}</span>건
                  </Badge>
                )}
              </div>
              <span style={{ fontSize: 13, color: "var(--slate-500)" }}>
                응답은 채점 근거와 시스템 현황 데이터로 재활용됩니다.
              </span>
            </div>

            {/* 문서 원탭 확인 2건 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                gap: "var(--space-md)",
                marginTop: "var(--space-lg)",
              }}
            >
              {hitlDocs.map((doc) => {
                const confirmed = confirmedDocIds.includes(doc.id);
                const chosen = docChoices[doc.id];
                return (
                  <div
                    key={doc.id}
                    style={{
                      border: confirmed ? "1px solid var(--ax-blue-hairline)" : "1px solid var(--hairline)",
                      background: confirmed ? "var(--ax-blue-wash)" : "var(--surface-ghost)",
                      borderRadius: "var(--radius-md)",
                      padding: "16px 18px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate-500)" }}>
                      <Icons.file size={14} />
                      {doc.fileName}
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 15,
                        fontWeight: 600,
                        letterSpacing: "-0.008em",
                        color: "var(--text-strong)",
                      }}
                    >
                      {doc.hitlPrompt?.question}
                    </div>
                    {confirmed ? (
                      <div
                        style={{
                          marginTop: 12,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7,
                          color: "var(--ax-blue)",
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        <Icons.check size={15} />
                        확인됨{chosen ? ` — ${chosen}` : ""}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                        {doc.hitlPrompt?.options.map((opt) => (
                          <Tag key={opt} onClick={() => confirmDoc(doc.id, opt)}>
                            {opt}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 최소 설문 12문항 */}
            <div style={{ marginTop: "var(--space-xl)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-strong)" }}>
                    최소 설문
                  </span>
                  <span style={{ fontSize: 13, color: "var(--slate-500)" }}>
                    <span style={mono}>{answeredCount}</span>/<span style={mono}>{visibleSurvey.length}</span> 완료
                  </span>
                </div>
                {!surveyDone && (
                  <Button variant="ghost" size="sm" onClick={fillDemo}>
                    데모 응답으로 모두 채우기
                  </Button>
                )}
              </div>
              <p style={{ margin: "6px 0 0", fontSize: "var(--type-fine-size)", color: "var(--slate-400)" }}>
                10번 문항(연 매출 구간)은 재무 정보가 이미 확인되어 표시하지 않습니다.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                {visibleSurvey.map((q) => {
                  const selected = answers[q.no];
                  return (
                    <div
                      key={q.no}
                      style={{
                        border: "1px solid var(--divider-soft)",
                        borderRadius: "var(--radius-md)",
                        padding: "13px 16px",
                        background: selected ? "var(--surface-ghost)" : "var(--canvas)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <span style={{ ...mono, fontSize: 11, color: "var(--slate-400)" }}>
                          {String(q.no).padStart(2, "0")}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.008em", color: "var(--text-strong)" }}>
                          {q.question}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10 }}>
                        {q.options.map((opt) => (
                          <Tag
                            key={opt}
                            selected={selected === opt}
                            onClick={() => answerQuestion(q.no, opt)}
                            style={{ padding: "8px 13px", fontSize: 13 }}
                          >
                            {opt}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* 2) 공개 데이터 수집 결과 */}
      <section style={{ background: "var(--surface-mist)", padding: "var(--space-section) var(--gutter)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Eyebrow>공개 데이터</Eyebrow>
          <h2 style={sectionTitle}>공개 데이터 수집 결과 — 6종</h2>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--slate-500)" }}>
            기업 정보 기준: DART
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "var(--space-md)",
              marginTop: "var(--space-xl)",
            }}
          >
            {publicSources.map((src) => (
              <Card key={src.id}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.008em", color: "var(--text-strong)" }}>
                    {src.name}
                  </span>
                  <Badge tone={src.status === "done" ? "success" : "warning"}>
                    {src.status === "done" ? "수집 완료" : "일부 수집"}
                  </Badge>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--slate-500)" }}>
                  수집 <span style={{ ...mono, color: "var(--text-strong)" }}>{src.count}</span>건
                </div>
                <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
                  {src.items.map((item) => (
                    <li
                      key={item}
                      style={{
                        display: "flex",
                        gap: 8,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "var(--text-secondary)",
                        padding: "3px 0",
                      }}
                    >
                      <span aria-hidden style={{ color: "var(--slate-300)", flex: "none" }}>
                        ·
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                {src.note && (
                  <p style={{ margin: "10px 0 0", fontSize: "var(--type-fine-size)", color: "var(--slate-400)" }}>
                    {src.note}
                  </p>
                )}
                {src.status === "partial" && (
                  <div style={{ marginTop: 12 }}>
                    <Button variant="ghost" size="sm" onClick={() => retrySource(src.id)} disabled={retrying[src.id]}>
                      {retrying[src.id] ? "다시 수집 중…" : "다시 수집"}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 3) 업로드 자료 분류 (3축 태깅) */}
      <section style={{ background: "var(--canvas)", padding: "var(--space-section) var(--gutter)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Eyebrow>업로드 자료</Eyebrow>
          <h2 style={sectionTitle}>
            업로드 자료 분류 — <span style={mono}>12</span>건, 3축 태깅
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>
            업무영역 × 디지털화수준 × 문서유형으로 자동 분류했습니다. 태그가 다르면 바로
            고칠 수 있습니다.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)", marginTop: "var(--space-xl)" }}>
            {uploadedDocs.map((doc) => {
              const edit = tagEdits[doc.id];
              const area = edit?.area ?? doc.area;
              const level = edit?.level ?? doc.level;
              const lowConf = doc.confidence < 0.7;
              const detailOpen = openDetails[doc.id];
              const editing = editingTags[doc.id];
              return (
                <Card key={doc.id} style={{ padding: "18px 22px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", color: "var(--slate-400)" }}>
                      <Icons.file size={16} />
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.008em", color: "var(--text-strong)" }}>
                      {doc.fileName}
                    </span>
                    <Badge tone="outline">{FILE_TYPE_LABEL[doc.fileType]}</Badge>
                    {doc.masked && <Badge tone="neutral">개인정보 마스킹</Badge>}
                    <span
                      style={{
                        ...mono,
                        marginLeft: "auto",
                        fontSize: 13,
                        color: lowConf ? "#9a6a12" : "var(--slate-500)",
                      }}
                    >
                      신뢰도 {Math.round(doc.confidence * 100)}%
                      {lowConf ? " · 확인 필요" : ""}
                    </span>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
                    <MiniChip accent>{areaName(area)}</MiniChip>
                    <MiniChip>{DIGITAL_LEVELS[level]}</MiniChip>
                    <MiniChip>{doc.docType}</MiniChip>
                  </div>

                  <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)" }}>
                    {doc.summaryTeaser}
                  </p>

                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenDetails((p) => ({ ...p, [doc.id]: !p[doc.id] }))}
                      aria-expanded={!!detailOpen}
                    >
                      판독 상세 {detailOpen ? "접기" : "보기"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTags((p) => ({ ...p, [doc.id]: !p[doc.id] }))}
                    >
                      태그 수정
                    </Button>
                  </div>

                  {detailOpen && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "13px 16px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--surface-ghost)",
                        border: "1px solid var(--divider-soft)",
                        fontSize: 14,
                        lineHeight: 1.55,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {doc.extractedDetail}
                    </div>
                  )}

                  {editing && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: "13px 16px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--ax-blue-hairline)",
                        background: "var(--ax-blue-wash)",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--slate-600)" }}>
                        영역
                        <select
                          value={area}
                          onChange={(e) =>
                            setTagEdits((p) => ({
                              ...p,
                              [doc.id]: {
                                area: e.target.value as FunctionAreaId,
                                level,
                                touched: true,
                              },
                            }))
                          }
                          style={selectStyle}
                        >
                          {FUNCTION_AREAS.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--slate-600)" }}>
                        수준
                        <select
                          value={level}
                          onChange={(e) =>
                            setTagEdits((p) => ({
                              ...p,
                              [doc.id]: {
                                area,
                                level: e.target.value as DigitalLevel,
                                touched: true,
                              },
                            }))
                          }
                          style={selectStyle}
                        >
                          {Object.entries(DIGITAL_LEVELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {edit?.touched && (
                        <span style={{ fontSize: "var(--type-fine-size)", color: "var(--ax-blue)" }}>
                          수정 이력이 저장되어 분류 개선에 사용됩니다
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4) 8영역 커버리지 (F-COL-06) */}
      <section style={{ background: "var(--surface-mist)", padding: "var(--space-section) var(--gutter)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Eyebrow>자료 커버리지</Eyebrow>
          <h2 style={sectionTitle}>8영역 자료 커버리지</h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>
            영역별로 진단에 필요한 자료 대비 보유율입니다. 부족 영역은 자료를 더 올리면
            진단이 정확해집니다.
          </p>

          <Card style={{ marginTop: "var(--space-xl)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {coverageByArea.map((cov) => (
                <div
                  key={cov.areaId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "88px 1fr auto",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-strong)", whiteSpace: "nowrap" }}>
                    {areaName(cov.areaId)}
                  </span>
                  <div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: "var(--radius-pill)",
                        background: "var(--slate-100)",
                        overflow: "hidden",
                      }}
                      role="img"
                      aria-label={`${areaName(cov.areaId)} 자료 보유율 ${Math.round(cov.ratio * 100)}%`}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.max(cov.ratio * 100, cov.ratio > 0 ? 3 : 0)}%`,
                          background: cov.insufficient ? "var(--slate-300)" : "var(--ax-blue)",
                          borderRadius: "var(--radius-pill)",
                        }}
                      />
                    </div>
                    {cov.insufficient && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                          marginTop: 7,
                        }}
                      >
                        <Badge tone="warning">자료 부족</Badge>
                        {cov.missingHint && (
                          <span style={{ fontSize: 13, color: "var(--slate-500)" }}>
                            필요: {cov.missingHint}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUploadNotice(cov.areaId)}
                        >
                          자료 추가 업로드 (선택)
                        </Button>
                        {uploadNotice === cov.areaId && (
                          <span style={{ fontSize: "var(--type-fine-size)", color: "var(--slate-500)" }}>
                            데모에서는 추가 업로드를 지원하지 않습니다
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span style={{ ...mono, fontSize: 13, color: "var(--slate-500)", whiteSpace: "nowrap" }}>
                    {cov.docCount}건
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* 5) CTA */}
      <section style={{ background: "var(--canvas)", padding: "var(--space-section) var(--gutter)" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <Button variant="primary" size="lg" full disabled={!canProceed} onClick={onProceed}>
            진단 결과 보기
          </Button>
          {!canProceed && (
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--slate-500)" }}>
              확인 필요 항목을 완료하면 진단 결과를 볼 수 있습니다
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
