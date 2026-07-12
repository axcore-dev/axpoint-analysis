"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Tabs from "@radix-ui/react-tabs";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { RouteLoading } from "@/components/flow/RouteLoading";
import { hitlDocs, uploadedDocs } from "@/data/scenario/documents";
import { publicSources } from "@/data/scenario/publicData";
import { surveyQuestions } from "@/data/rubric/survey";
import { hitlResponses } from "@/data/scenario/hitl";
import { DIGITAL_LEVELS, FUNCTION_AREAS } from "@/data/rubric/meta";
import type { DigitalLevel, FunctionAreaId, PublicSource, SurveyQuestion } from "@/lib/types";
import {
  BackIconButton,
  Button,
  Card,
  DotProgress,
  FlowStepper,
  ForwardIconButton,
  Icons,
  Input,
  Modal,
} from "@/components/ui";

/**
 * S1 자료 정리 — 상단 FlowStepper(자료 확인 → 자료 분류) 가운데 정렬 (수정요청v3).
 * 자료 확인은 팝업 대신 자료 올리기와 같은 카드 위저드로 통합(자료확인 → 설문 2개 흐름),
 * 설문은 체크+행(row) UI. 자료 분류는 공개 데이터(팝업 탭: 정보/출처) + 8대 영역 탭.
 * 점수·등급 등 해석은 노출하지 않는다.
 */

/* ── 정적 데이터 ── */

/**
 * 1번(사용 시스템)은 자료 올리기 단계에서 이미 응답, 10번(매출 구간)은
 * 재무정보가 확인되어 묻지 않는다 → 11문항
 */
const visibleSurvey = surveyQuestions.filter((q) => q.no !== 1 && q.no !== 10);

/** 기본 응답 (전 문항 채우기용) */
const defaultAnswers: Record<number, string[]> = Object.fromEntries(
  hitlResponses.map((r) => [r.questionNo, [r.answer]]),
);

/** 재방문 시 문서 확인 선택 복원값 (시나리오 응답) */
const DOC_DEFAULT_CHOICE: Record<string, string> = {
  d07: "현장에서 종이에 수기 작성",
  d08: "일보를 보고 사무실에서 다시 입력",
};

/** 최초 진입 수집 로딩 문구 */
const COLLECT_MESSAGES = [
  "공개 데이터를 모으고 있어요",
  "올려주신 자료를 읽고 있어요",
  "8대 영역으로 나누고 있어요",
  "개인 정보를 가리고 있어요",
];

/** 자료 확인 → 자료 분류 전환 로딩 문구 */
const CLASSIFY_MESSAGES = ["응답을 판정에 반영하고 있어요", "자료를 8대 영역으로 나누고 있어요"];

/** 출처 표기 — sourceApi에서 'API' 단어를 뗀 사람 언어 표기 + 한 줄 설명 */
const SOURCE_META: Record<string, { label: string; desc: string }> = {
  "DART API": {
    label: "DART(전자공시)",
    desc: "금융감독원 전자공시에서 기업 기본정보와 재무 정보를 가져와요.",
  },
  "KIPRISPlus(특허청) API": {
    label: "KIPRISPlus(특허청)",
    desc: "특허청 지식재산 정보 서비스에서 특허·실용신안 이력을 가져와요.",
  },
  "공공데이터포탈(조달청) API": {
    label: "공공데이터포탈(조달청)",
    desc: "조달청 공공데이터에서 공공 조달 낙찰 이력을 가져와요.",
  },
  "공공데이터포탈 API": {
    label: "공공데이터포탈",
    desc: "정부 공공데이터에서 기업 인증 이력을 조회해요.",
  },
  "Tavily API": {
    label: "Tavily 웹 검색",
    desc: "웹 검색으로 공개된 고용·커뮤니티 정보를 모아요.",
  },
  "NaverNews API": {
    label: "NaverNews",
    desc: "네이버 뉴스에서 기업 관련 보도를 찾아요.",
  },
  "NTIS API": {
    label: "NTIS",
    desc: "국가과학기술지식정보서비스에서 정부 R&D 과제 참여 이력을 조회해요.",
  },
  "AXpoint 확인 응답": {
    label: "AXpoint 확인 응답",
    desc: "이 진단 과정에서 직접 답해 주신 설문 응답이에요.",
  },
};

function sourceLabel(api: string): string {
  return SOURCE_META[api]?.label ?? api.replace(/\s*API$/, "");
}

/** 공개 데이터 — 건수 많은 순 정렬 */
const sortedSources = [...publicSources].sort((a, b) => b.count - a.count);

const pubTotal = publicSources.reduce((sum, p) => sum + p.count, 0);
/** 총 수집 건수 = 업로드 12 + 공개 데이터 count 합 (런타임 계산) */
const totalCollected = uploadedDocs.length + pubTotal;

const LEVEL_ORDER: DigitalLevel[] = ["L1", "L2", "L3", "L4"];

interface AreaEntry {
  key: string;
  kind: "doc" | "pub";
  title: string;
  /** 문서유형 또는 출처 표기 — 배경 없는 텍스트로만 표기 */
  sub: string;
  level: DigitalLevel;
  count?: number;
  detail?: string;
  teaser?: string;
}

/** 8대 영역별 자료 묶음 — 디지털화 수준(L) 낮은 순 정렬 */
const areaGroups = FUNCTION_AREAS.map((a) => {
  const entries: AreaEntry[] = [
    ...uploadedDocs
      .filter((d) => d.area === a.id)
      .map<AreaEntry>((d) => ({
        key: d.id,
        kind: "doc",
        title: d.fileName,
        sub: d.docType,
        level: d.level,
        detail: d.extractedDetail,
        teaser: d.summaryTeaser,
      })),
    ...publicSources
      .filter((p) => p.area === a.id)
      .map<AreaEntry>((p) => ({
        key: p.id,
        kind: "pub",
        title: p.name,
        sub: sourceLabel(p.sourceApi),
        level: p.digitalLevel,
        count: p.count,
      })),
  ].sort((x, y) => LEVEL_ORDER.indexOf(x.level) - LEVEL_ORDER.indexOf(y.level));
  return { id: a.id, name: a.name, entries };
});

function helperText(q: SurveyQuestion): string | null {
  if (q.type === "multi") return "여러 개를 고를 수 있어요";
  if (q.type === "single_text") return "선택한 뒤 내용을 적을 수 있어요";
  return null;
}

/** 체크+행 선택지 (수정요청v3 — 설문·문서 확인 공용) */
function CheckRow({
  label,
  checked,
  onClick,
}: {
  label: ReactNode;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-[var(--radius-m)] border border-solid px-4 py-3 text-left transition-colors duration-[var(--dur-fast)] ${
        checked
          ? "border-[var(--line-brand)] bg-brand-weak"
          : "border-line bg-surface hover:bg-surface-2"
      }`}
    >
      <span
        aria-hidden
        className={`box-border inline-flex size-[20px] flex-none items-center justify-center rounded-full transition-colors duration-[var(--dur-fast)] ${
          checked
            ? "border border-solid border-[var(--blue-500)] bg-[var(--blue-500)] text-white"
            : "border-[1.5px] border-solid border-[var(--grey-300)] bg-surface"
        }`}
      >
        {checked && <Icons.check size={12} />}
      </span>
      <span className="min-w-0 flex-1 [font:var(--text-body2)] tracking-[var(--track-body)] text-ink">
        {label}
      </span>
    </button>
  );
}

export default function CollectPage() {
  const router = useRouter();
  const { companyInput, confirmedDocIds, surveyDone, completedSteps, update, completeStep } =
    useDiagnosis();

  /* ── 최초 진입 수집 로딩 (재방문 시 생략) ── */
  const revisit = completedSteps.includes("collect");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!companyInput || ready) return;
    if (revisit) {
      setReady(true);
      return;
    }
    const to = window.setTimeout(() => setReady(true), 4200);
    return () => window.clearTimeout(to);
  }, [companyInput, revisit, ready]);

  /* ── 자료 확인 위저드 (팝업 X — 카드 흐름 2개: 문서 확인 → 설문) ── */
  const [wizard, setWizard] = useState<"docs" | "survey" | null>(null);
  const [docChoices, setDocChoices] = useState<Record<string, string>>({});
  const [docIdx, setDocIdx] = useState(0);

  const [answers, setAnswers] = useState<Record<number, string[]>>({});
  const [otherText, setOtherText] = useState<Record<number, string>>({});
  const [reasonText, setReasonText] = useState<Record<number, string>>({});
  const [surveyIdx, setSurveyIdx] = useState(0);

  const [stageOverride, setStageOverride] = useState<"confirm" | "classify" | null>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);

  /* ── 자료 분류 화면 상태 ── */
  const [activeArea, setActiveArea] = useState<FunctionAreaId>(FUNCTION_AREAS[0].id);
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({});
  const [sourceCard, setSourceCard] = useState<PublicSource | null>(null);
  const [sourceTab, setSourceTab] = useState<"info" | "origin">("info");

  /* 재방문 복원: 완료 상태인데 로컬 응답이 비어 있으면 기본 응답으로 표시 */
  useEffect(() => {
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
  }, [surveyDone, confirmedDocIds]);

  /* 자료 분류 전환 로딩 — 1.5초 내외 */
  useEffect(() => {
    if (!classifyLoading) return;
    const to = window.setTimeout(() => setClassifyLoading(false), 1600);
    return () => window.clearTimeout(to);
  }, [classifyLoading]);

  const docsConfirmed = hitlDocs.every((d) => confirmedDocIds.includes(d.id));
  const confirmComplete = docsConfirmed && surveyDone;
  const stage: "confirm" | "classify" =
    stageOverride ?? (confirmComplete ? "classify" : "confirm");

  /* ── 핸들러 ── */

  const openChain = () => {
    setDocIdx(0);
    setSurveyIdx(0);
    setStageOverride("confirm");
    setWizard("docs");
  };

  const chooseDocAt = (idx: number, docId: string, option: string) => {
    setDocChoices((prev) => ({ ...prev, [docId]: option }));
    if (!confirmedDocIds.includes(docId)) {
      update({ confirmedDocIds: [...confirmedDocIds, docId] });
    }
    /* 응답하면 자동으로 다음 문서 → 설문 흐름으로 전환 */
    window.setTimeout(() => {
      if (idx + 1 < hitlDocs.length) setDocIdx(idx + 1);
      else setWizard("survey");
    }, 400);
  };

  /** 단일 선택 자동 진행 타이머 (연타 시 중복 진행 방지) */
  const advanceTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  /** 이 선택지가 추가 입력란을 여는가 (기타 · 투자 내역 · 불가 사유) */
  const opensInput = (q: SurveyQuestion, option: string) =>
    option === "기타" ||
    (q.type === "single_text" && option === "있다") ||
    (q.reasonOn?.includes(option) ?? false);

  const selectOption = (q: SurveyQuestion, option: string) => {
    setAnswers((prev) => {
      const cur = prev[q.no] ?? [];
      if (q.type === "multi") {
        const next = cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option];
        return { ...prev, [q.no]: next };
      }
      return { ...prev, [q.no]: [option] };
    });
    /* 단일 선택은 클릭하면 자동으로 다음 문항 (v3 개선 — 입력란이 열리는 선택지는 제외) */
    if (q.type !== "multi" && !opensInput(q, option)) {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(() => nextSurvey(), 400);
    }
  };

  const answered = (q: SurveyQuestion) => (answers[q.no]?.length ?? 0) > 0;

  /* 위저드 완료 → 반영 + '자료 분류' 전환 로딩 */
  const finishChain = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setWizard(null);
    setStageOverride(null);
    if (!surveyDone) update({ surveyDone: true });
    setClassifyLoading(true);
  };

  const fillDefaults = () => {
    setAnswers(defaultAnswers);
    finishChain();
  };

  const nextSurvey = () => {
    if (surveyIdx < visibleSurvey.length - 1) setSurveyIdx(surveyIdx + 1);
    else finishChain();
  };

  /** 앞으로 가기 (v4) — 확인을 이미 마친 경우 원하는 구간으로 빠르게 이동 */
  const goForward = () => {
    if (wizard === "docs") {
      if (docIdx + 1 < hitlDocs.length) setDocIdx(docIdx + 1);
      else setWizard("survey");
    } else if (wizard === "survey") {
      if (surveyIdx < visibleSurvey.length - 1) setSurveyIdx(surveyIdx + 1);
      else setWizard(null); /* 이미 완료 상태 — 재로딩 없이 완료 카드로 */
    }
  };

  const openSourceCard = (src: PublicSource) => {
    setSourceCard(src);
    setSourceTab("info");
  };

  const onProceed = () => {
    if (!confirmComplete) return;
    completeStep("collect");
    router.push("/result");
  };

  /* ── 가드: 기업 정보 없음 ── */
  if (!companyInput) {
    return (
      <section className="px-6 py-24">
        <Card radius="l" className="mx-auto max-w-[480px] text-center">
          <div className="flex justify-center text-ink-4">
            <Icons.info size={22} />
          </div>
          <h1 className="ax-heading mt-3 mb-0 [font:var(--text-h4)] tracking-[var(--track-heading)] text-ink">
            진단을 시작할 <b>기업 정보</b>가 없어요
          </h1>
          <p className="mt-2 mb-0 [font:var(--text-body2)] tracking-[var(--track-body)] text-ink-2">
            기업 이름이나 사업자번호를 먼저 입력해 주세요.
          </p>
          <div className="mt-5">
            <Button variant="secondary" size="md" href="/">
              처음으로
            </Button>
          </div>
        </Card>
      </section>
    );
  }

  /* ── 최초 진입 수집 로딩 ── */
  if (!ready) {
    return <RouteLoading title={companyInput || "(주)데모기업"} messages={COLLECT_MESSAGES} />;
  }

  const currentDoc = hitlDocs[docIdx];
  const currentQ = visibleSurvey[surveyIdx];

  return (
    <>
      <main className="ax-step-enter mx-auto max-w-[980px] px-6 pb-24 pt-8">
        {/* ── 단계 스텝퍼: 자료 확인 → 자료 분류 (가운데 정렬, 완료 시 체크) ── */}
        <FlowStepper
          steps={[{ label: "자료 확인" }, { label: "자료 분류" }]}
          active={stage === "confirm" ? 0 : 1}
          completed={[confirmComplete, confirmComplete && revisit]}
          onStepClick={(i) => setStageOverride(i === 0 ? "confirm" : "classify")}
        />

        {classifyLoading ? (
          /* ── 자료 분류 전환 로딩 ── */
          <RouteLoading messages={CLASSIFY_MESSAGES} interval={800} />
        ) : stage === "confirm" ? (
          /* ── 단계 1: 자료 확인 (카드 위저드 — 자료 올리기와 동일 문법) ── */
          <section className="mt-12 flex justify-center">
            {wizard === "docs" && currentDoc ? (
              <Card
                key={`doc-${currentDoc.id}`}
                className="ax-step-enter relative w-full max-w-[560px] p-[var(--space-8)]"
                radius="2xl"
              >
                <BackIconButton
                  label="이전으로"
                  onClick={() => (docIdx > 0 ? setDocIdx(docIdx - 1) : setWizard(null))}
                />
                {confirmComplete && <ForwardIconButton label="다음으로" onClick={goForward} />}
                <DotProgress step={1} total={2} />
                <h2 className="ax-heading mt-4 mb-0 text-center [font:var(--text-h4)] tracking-[var(--track-heading)] text-ink">
                  {currentDoc.hitlPrompt?.question}
                </h2>
                <p className="mt-2 mb-0 flex items-center justify-center gap-1.5 [font:var(--text-caption)] tracking-[var(--track-body)] text-ink-3">
                  {currentDoc.fileName} · {currentDoc.docType}
                  <span className="text-[12px] [font-family:var(--font-mono)] text-ink-4">
                    {Math.min(docIdx + 1, hitlDocs.length)}/{hitlDocs.length}
                  </span>
                </p>
                <div className="mt-6 flex flex-col gap-2">
                  {currentDoc.hitlPrompt?.options.map((opt) => (
                    <CheckRow
                      key={opt}
                      label={opt}
                      checked={docChoices[currentDoc.id] === opt}
                      onClick={() => chooseDocAt(docIdx, currentDoc.id, opt)}
                    />
                  ))}
                </div>
              </Card>
            ) : wizard === "survey" && currentQ ? (
              (() => {
                const sel = answers[currentQ.no] ?? [];
                const helper = helperText(currentQ);
                const options = currentQ.allowOther
                  ? [...currentQ.options, "기타"]
                  : currentQ.options;
                const otherSelected = sel.includes("기타");
                const investSelected = currentQ.type === "single_text" && sel.includes("있다");
                const reasonNeeded = currentQ.reasonOn?.some((r) => sel.includes(r)) ?? false;
                return (
                  <Card
                    key={`q-${currentQ.no}`}
                    className="ax-step-enter relative w-full max-w-[560px] p-[var(--space-8)]"
                    radius="2xl"
                  >
                    <BackIconButton
                      label="이전 문항"
                      onClick={() =>
                        surveyIdx > 0 ? setSurveyIdx(surveyIdx - 1) : setWizard("docs")
                      }
                    />
                    {confirmComplete && <ForwardIconButton label="다음으로" onClick={goForward} />}
                    <DotProgress step={2} total={2} />
                    <h2 className="ax-heading mt-4 mb-0 text-center [font:var(--text-h4)] tracking-[var(--track-heading)] text-ink">
                      {currentQ.question}
                    </h2>
                    <p className="mt-2 mb-0 text-center [font:var(--text-caption)] tracking-[var(--track-body)] text-ink-3">
                      {helper && <>{helper} · </>}
                      <span className="[font-family:var(--font-mono)]">
                        {surveyIdx + 1}/{visibleSurvey.length}
                      </span>
                    </p>
                    <div className="mt-6 flex flex-col gap-2">
                      {options.map((opt) => (
                        <CheckRow
                          key={opt}
                          label={opt}
                          checked={sel.includes(opt)}
                          onClick={() => selectOption(currentQ, opt)}
                        />
                      ))}
                    </div>
                    {otherSelected && (
                      <div className="mt-2.5">
                        <Input
                          value={otherText[currentQ.no] ?? ""}
                          onChange={(e) =>
                            setOtherText((p) => ({ ...p, [currentQ.no]: e.target.value }))
                          }
                          placeholder="직접 적어 주세요"
                          aria-label="기타 응답 입력"
                        />
                      </div>
                    )}
                    {investSelected && (
                      <div className="mt-2.5">
                        <Input
                          value={otherText[currentQ.no] ?? ""}
                          onChange={(e) =>
                            setOtherText((p) => ({ ...p, [currentQ.no]: e.target.value }))
                          }
                          placeholder="내역을 간단히 적어 주시면 판정 근거로 써요 (선택)"
                          aria-label="투자 내역 입력"
                        />
                      </div>
                    )}
                    {reasonNeeded && (
                      <div className="mt-2.5">
                        <Input
                          value={reasonText[currentQ.no] ?? ""}
                          onChange={(e) =>
                            setReasonText((p) => ({ ...p, [currentQ.no]: e.target.value }))
                          }
                          placeholder="사유를 적어 주시면 배포 방식 설계에 반영해요 (선택)"
                          aria-label="불가 사유 입력"
                        />
                      </div>
                    )}
                    {/* 단일 선택은 클릭 즉시 자동 진행 — 복수 선택·입력란이 열린 경우에만 다음 버튼 노출 (v3 개선) */}
                    <div className="mt-7 flex items-center justify-between gap-2">
                      <Button variant="ghost" size="sm" onClick={fillDefaults}>
                        기본 응답으로 채우기
                      </Button>
                      {(currentQ.type === "multi" ||
                        otherSelected ||
                        investSelected ||
                        reasonNeeded) && (
                        <Button
                          variant="primary"
                          size="md"
                          disabled={!answered(currentQ)}
                          onClick={nextSurvey}
                        >
                          {surveyIdx === visibleSurvey.length - 1 ? "완료" : "다음"}
                          <Icons.arrow size={15} />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })()
            ) : confirmComplete ? (
              /* 확인을 이미 마친 경우 — 완료 카드 (뒤로 가기 = 다시 열기) */
              <Card radius="2xl" className="relative w-full max-w-[520px] p-[var(--space-8)] text-center">
                <BackIconButton label="다시 열기" onClick={openChain} />
                <div className="flex justify-center">
                  <span className="inline-flex size-12 items-center justify-center rounded-full bg-success-weak text-success">
                    <Icons.check size={24} />
                  </span>
                </div>
                <h2 className="ax-heading mt-4 mb-0 [font:var(--text-h3)] tracking-[var(--track-heading)] text-ink">
                  확인을 <b>모두 마쳤어요</b>
                </h2>
                <p className="mt-2 mb-0 [font:var(--text-body2)] tracking-[var(--track-body)] text-ink-2">
                  문서 <span className="[font-family:var(--font-mono)]">2</span>건 · 설문{" "}
                  <span className="[font-family:var(--font-mono)]">{visibleSurvey.length}</span>
                  문항이 판정에 반영됐어요.
                </p>
                <div className="mt-6 flex justify-center">
                  <Button variant="secondary" size="md" onClick={() => setStageOverride("classify")}>
                    자료 분류 보기
                    <Icons.arrow size={15} />
                  </Button>
                </div>
              </Card>
            ) : (
              /* 안내 화면 → 위저드 시작 */
              <Card radius="2xl" className="w-full max-w-[520px] p-[var(--space-8)] text-center">
                <h2 className="ax-heading m-0 [font:var(--text-h3)] tracking-[var(--track-heading)] text-ink">
                  <b>딱 맞는 결과</b>를 위해 몇 가지만 알려주세요
                </h2>
                <p className="mt-2 mb-0 [font:var(--text-body2)] tracking-[var(--track-body)] text-ink-2">
                  확인 <span className="[font-family:var(--font-mono)]">2</span>건과{" "}
                  <span className="[font-family:var(--font-mono)]">{visibleSurvey.length}</span>건
                  설문이 있어요
                </p>
                <div className="mt-6">
                  <Button variant="primary" size="lg" onClick={openChain} className="min-w-[200px]">
                    시작하기
                    <Icons.arrow size={16} />
                  </Button>
                </div>
              </Card>
            )}
          </section>
        ) : (
          /* ── 단계 2: 자료 분류 ── */
          <div key="classify" className="ax-step-enter">
            <header className="mt-10">
              <h2 className="ax-heading m-0 [font:var(--text-h2)] tracking-[var(--track-heading)] text-ink">
                <b>{companyInput.trim()}</b>에 대해 총{" "}
                <b>
                  <span className="[font-family:var(--font-mono)]">{totalCollected}</span>건
                </b>
                을 수집했어요
              </h2>
              <p className="mt-2 mb-0 [font:var(--text-body2)] tracking-[var(--track-body)] text-ink-2">
                올려주신 자료{" "}
                <span className="[font-family:var(--font-mono)]">{uploadedDocs.length}</span>건 ·
                공개 데이터 <span className="[font-family:var(--font-mono)]">{pubTotal}</span>건
              </p>
            </header>

            {/* 공개 데이터 — 콤팩트 그리드, 건수 많은 순. 출처는 카드 팝업 탭에서 */}
            <section className="mt-10">
              <h3 className="ax-heading m-0 [font:var(--text-title1)] tracking-[var(--track-heading)] text-ink">
                <b>공개 데이터</b> {publicSources.length}종
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {sortedSources.map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => openSourceCard(src)}
                    className="flex cursor-pointer items-baseline gap-2 rounded-[var(--radius-m)] border border-solid border-line bg-surface px-3.5 py-2.5 text-left transition-colors duration-[var(--dur-fast)] hover:bg-[var(--hover-overlay)]"
                  >
                    <span className="min-w-0 flex-1 truncate [font:var(--text-body3)] tracking-[var(--track-body)] text-ink">
                      {src.name}
                    </span>
                    <span className="flex-none text-[13px] [font-family:var(--font-mono)] text-ink-2">
                      {src.count}건
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* 8대 영역 — 가로 탭 (스크롤바 숨김) */}
            <section className="mt-12">
              <h3 className="ax-heading m-0 [font:var(--text-title1)] tracking-[var(--track-heading)] text-ink">
                <b>8대 영역</b>으로 나눴어요
              </h3>
              <p className="mt-1 mb-0 [font:var(--text-caption)] tracking-[var(--track-body)] text-ink-3">
                디지털화 수준이 낮은 자료부터 보여드려요.
              </p>

              <Tabs.Root
                value={activeArea}
                onValueChange={(v) => setActiveArea(v as FunctionAreaId)}
              >
                <Tabs.List
                  aria-label="8대 영역"
                  className="ax-scrollbar-none mt-4 flex gap-0.5 overflow-x-auto border-b border-line"
                >
                  {areaGroups.map((g) => (
                    <Tabs.Trigger
                      key={g.id}
                      value={g.id}
                      className="group -mb-px flex flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap border-0 border-b-2 border-solid border-transparent bg-transparent px-3 py-2.5 [font:var(--text-label-m)] tracking-[var(--track-body)] text-ink-3 hover:text-ink-2 data-[state=active]:border-brand data-[state=active]:text-brand"
                    >
                      {g.name}
                      <span className="text-xs text-ink-4 [font-family:var(--font-mono)] group-data-[state=active]:text-brand">
                        {g.entries.length}
                      </span>
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>

                {areaGroups.map((g) => (
                  <Tabs.Content
                    key={g.id}
                    value={g.id}
                    className="ax-scrollbar-none ax-step-enter mt-1 overflow-y-auto"
                    /* 높이 고정(자료 약 10행 기준) — 개수와 무관하게 일정, 초과분은 내부 스크롤 (v4) */
                    style={{ height: 460 }}
                  >
                    {/* L별 그룹 — 낮은 순 */}
                    {LEVEL_ORDER.map((lv) => {
                      const rows = g.entries.filter((e) => e.level === lv);
                      if (rows.length === 0) return null;
                      return (
                        <div key={lv} className="mt-5">
                          {/* 디지털화 수준 강조 (v4) */}
                          <span className="inline-flex items-center rounded-[var(--radius-s)] bg-surface-3 px-2 py-1 [font:var(--text-label-s)] tracking-[var(--track-body)] text-ink-2">
                            {DIGITAL_LEVELS[lv]}
                          </span>
                          <div className="mt-1">
                            {rows.map((row) => {
                              const open = Boolean(openDetails[row.key]);
                              return (
                                <div
                                  key={row.key}
                                  className="border-t border-[var(--line-subtle)] py-2 first:border-t-0"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span className="inline-flex flex-none text-ink-4">
                                      {row.kind === "doc" ? (
                                        <Icons.file size={14} />
                                      ) : (
                                        <Icons.globe size={14} />
                                      )}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[15px] font-light tracking-[var(--track-body)] text-ink">
                                      {row.title}
                                    </span>
                                    <span className="flex-none [font:var(--text-caption)] tracking-[var(--track-body)] text-ink-3">
                                      {row.sub}
                                    </span>
                                    {row.kind === "pub" ? (
                                      <span className="flex-none text-xs [font-family:var(--font-mono)] text-ink-3">
                                        {row.count}건
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        aria-expanded={open}
                                        onClick={() =>
                                          setOpenDetails((p) => ({ ...p, [row.key]: !p[row.key] }))
                                        }
                                        className="flex-none cursor-pointer border-0 bg-transparent p-1 [font:var(--text-caption)] tracking-[var(--track-body)] text-brand underline underline-offset-2"
                                      >
                                        상세 {open ? "접기" : "보기"}
                                      </button>
                                    )}
                                  </div>
                                  {open && row.detail && (
                                    <div className="mt-1.5 ml-6 rounded-[var(--radius-s)] bg-surface-2 px-3 py-2.5">
                                      <p className="m-0 [font:var(--text-body3)] tracking-[var(--track-body)] text-ink-2">
                                        {row.detail}
                                      </p>
                                      {row.teaser && (
                                        <p className="mt-1.5 mb-0 [font:var(--text-caption)] tracking-[var(--track-body)] text-ink-3">
                                          근거 — {row.teaser}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {g.entries.length === 0 && (
                      <p className="mt-5 mb-0 [font:var(--text-body3)] tracking-[var(--track-body)] text-ink-3">
                        이 영역에서 확인된 자료가 아직 없어요.
                      </p>
                    )}
                  </Tabs.Content>
                ))}
              </Tabs.Root>
            </section>

            {/* ── 다음 단계: 우측 하단 배치 (플로팅 X, v3) ── */}
            <div className="mt-14 flex justify-end">
              <Button
                variant="primary"
                size="lg"
                disabled={!confirmComplete}
                onClick={onProceed}
              >
                진단 결과 보기
                <Icons.arrow size={17} />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* ── 공개 데이터 카드 팝업 — 탭: 정보 / 출처 (크기 통일) ── */}
      <Modal
        open={sourceCard !== null}
        onClose={() => setSourceCard(null)}
        title={sourceCard?.name}
      >
        {sourceCard && (
          <Tabs.Root
            value={sourceTab}
            onValueChange={(v) => setSourceTab(v as "info" | "origin")}
            style={{ minHeight: 220 }}
          >
            <Tabs.List aria-label="공개 데이터 상세" className="flex gap-0.5 border-b border-line">
              {(
                [
                  { id: "info", label: "정보" },
                  { id: "origin", label: "출처" },
                ] as const
              ).map((t) => (
                <Tabs.Trigger
                  key={t.id}
                  value={t.id}
                  className="-mb-px cursor-pointer border-0 border-b-2 border-solid border-transparent bg-transparent px-3 py-2 [font:var(--text-label-s)] tracking-[var(--track-body)] text-ink-3 hover:text-ink-2 data-[state=active]:border-brand data-[state=active]:text-brand"
                >
                  {t.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="info" className="ax-step-enter pt-3">
              <p className="m-0 [font:var(--text-caption)] tracking-[var(--track-body)] text-ink-3">
                수집 <span className="[font-family:var(--font-mono)]">{sourceCard.count}</span>건
              </p>
              <ul className="m-0 mt-2 list-none p-0">
                {sourceCard.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 py-1 [font:var(--text-body3)] tracking-[var(--track-body)] text-ink-2"
                  >
                    <span aria-hidden className="flex-none text-ink-4">
                      ·
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              {sourceCard.note && (
                <p className="mt-2 mb-0 [font:var(--text-caption)] tracking-[var(--track-body)] text-ink-3">
                  {sourceCard.note}
                </p>
              )}
            </Tabs.Content>

            <Tabs.Content value="origin" className="ax-step-enter pt-3">
              <div className="[font:var(--text-title2)] tracking-[var(--track-body)] text-ink">
                {sourceLabel(sourceCard.sourceApi)}
              </div>
              <p className="mt-1.5 mb-0 [font:var(--text-body3)] tracking-[var(--track-body)] text-ink-2">
                {SOURCE_META[sourceCard.sourceApi]?.desc ?? "공개된 정보를 수집해 정리했어요."}
              </p>
              <p className="mt-3 mb-0 [font:var(--text-caption)] tracking-[var(--track-body)] text-ink-3">
                {sourceCard.name}{" "}
                <span className="[font-family:var(--font-mono)]">{sourceCard.count}</span>건을 이
                출처에서 가져왔어요.
              </p>
            </Tabs.Content>
          </Tabs.Root>
        )}
      </Modal>
    </>
  );
}
