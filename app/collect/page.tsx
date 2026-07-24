"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Tabs from "@radix-ui/react-tabs";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { RouteLoading } from "@/components/flow/RouteLoading";
import { hitlDocs, uploadedDocs } from "@/data/scenario/documents";
import { publicSources } from "@/data/scenario/publicData";
import { surveyQuestions } from "@/data/rubric/survey";
import { hitlResponses } from "@/data/scenario/hitl";
import { DIGITAL_LEVELS } from "@/data/rubric/meta";
import {
  COMPANY_FLOW,
  STANDARD_FLOW,
  SUPPORT_DEPT_IDS,
  getDept,
  type WorkflowDept,
} from "@/data/scenario/workflow";
import { COMPANY_DIRECTORY, findCompany } from "@/data/scenario/companies";
import type { PublicSource, SurveyQuestion } from "@/lib/types";
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
 * 설문은 체크+행(row) UI. 자료 분류는 공개 데이터(팝업 탭: 정보/출처) +
 * 워크플로우 비교(수정요청v6 — 8대 영역 탭 대체, 8대 영역 분류는 데이터 계층에서 유지).
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

/**
 * 워크플로우 표시용 문서 참조 (수정요청v6)
 * 8대 영역 분류는 데이터 계층(documents.ts의 area 태깅)에서 그대로 유지되고,
 * 화면은 부서 단위 워크플로우로 표시한다.
 */
const docById = new Map(uploadedDocs.map((d) => [d.id, d]));

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

/** 부서 카드 본문 — 부서명 · 업무 리스트 · 업로드 문서 리스트(디지털화 수준 명시) (수정요청v6) */
function DeptCardBody({ dept, mismatch }: { dept: WorkflowDept; mismatch: boolean }) {
  const docs = dept.docIds
    .map((id) => docById.get(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <strong className="[font:var(--text-label-m)] tracking-[var(--track-heading)] text-ink">
          {dept.name}
        </strong>
        {/* v7: 문구 중복 제거 — 우상단 경고색 마커로만 표시 (호버 시 설명) */}
        {mismatch && (
          <span
            title="표준과 순서가 달라요"
            aria-label="표준과 순서가 달라요"
            className="size-2.5 flex-none rounded-full bg-[color:var(--fg-warning)]"
          />
        )}
      </div>

      {/* 업무 리스트 */}
      <ul className="m-0 mt-2.5 list-none p-0">
        {dept.tasks.map((task) => (
          <li
            key={task}
            className="flex items-start gap-2 py-0.5 [font:var(--text-body3)] tracking-[var(--track-body)] text-ink-2"
          >
            <span aria-hidden className="mt-[9px] size-[3.5px] flex-none rounded-full bg-[var(--grey-400)]" />
            {task}
          </li>
        ))}
      </ul>

      {/* 업로드 문서 리스트 — 디지털화 수준 명시 유지 */}
      <div className="mt-2.5 border-t border-[var(--line-subtle)] pt-2">
        {docs.length > 0 ? (
          <ul className="m-0 list-none p-0">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-1.5 py-1">
                <span className="flex-none text-ink-4">
                  <Icons.file size={12} />
                </span>
                <span className="min-w-0 flex-1 truncate [font:var(--text-caption)] tracking-[var(--track-body)] text-ink-2">
                  {d.fileName}
                </span>
                <span className="flex-none rounded-[var(--radius-xs)] bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-ink-3">
                  {DIGITAL_LEVELS[d.level]}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 py-1 [font:var(--text-caption)] text-ink-4">확인된 문서 없음</p>
        )}
      </div>
    </>
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
  const [sourceCard, setSourceCard] = useState<PublicSource | null>(null);
  const [sourceTab, setSourceTab] = useState<"info" | "origin">("info");
  /* 자사 워크플로우 순서 — 표준과 다르면 드래그앤드롭으로 수정 (수정요청v6) */
  const [companyFlow, setCompanyFlow] = useState<string[]>(COMPANY_FLOW);
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  /* 표준 상세 흐름 팝업 (수정요청v7) */
  const [stdOpen, setStdOpen] = useState(false);

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

  /** 처음부터 시작 — 안내 카드의 시작하기 */
  const startChain = () => {
    setDocIdx(0);
    setSurveyIdx(0);
    setStageOverride("confirm");
    setWizard("docs");
  };

  /**
   * 완료 카드에서 뒤로 가기 — 처음이 아니라 마지막 설문으로 (수정요청v6 버그 수정:
   * 뒤로가기가 아예 처음(문서 확인 1번)으로 가던 문제)
   */
  const reopenChain = () => {
    setDocIdx(hitlDocs.length - 1);
    setSurveyIdx(visibleSurvey.length - 1);
    setStageOverride("confirm");
    setWizard("survey");
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

  /** 앞으로 가기 (v6) — 이미 응답한 구간은 다시 응답하지 않고 앞으로 이동 */
  const goForward = () => {
    if (wizard === "docs") {
      if (docIdx + 1 < hitlDocs.length) setDocIdx(docIdx + 1);
      else setWizard("survey");
    } else if (wizard === "survey") {
      if (surveyIdx < visibleSurvey.length - 1) setSurveyIdx(surveyIdx + 1);
      else if (confirmComplete) setWizard(null); /* 이미 완료 상태 — 재로딩 없이 완료 카드로 */
      else finishChain(); /* 마지막 문항까지 응답된 상태로 도달 → 완료 처리 */
    }
  };

  /** 자사 워크플로우 부서 순서 이동 (드래그앤드롭, 수정요청v6) */
  const moveDept = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setCompanyFlow((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  /** 간략 흐름 필과 상세 카드가 공유하는 드래그 핸들러 — 두 줄이 같은 순서로 연동 (v7) */
  const dragProps = (i: number) => ({
    draggable: true,
    onDragStart: () => {
      dragFrom.current = i;
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(i);
    },
    onDragLeave: () => setDragOver((v) => (v === i ? null : v)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (dragFrom.current !== null) moveDept(dragFrom.current, i);
      dragFrom.current = null;
      setDragOver(null);
    },
    onDragEnd: () => {
      dragFrom.current = null;
      setDragOver(null);
    },
  });

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
  /* 표준 대비 순서가 다른 부서 수 — 비교 현황 표기 (수정요청v6) */
  const mismatchCount = companyFlow.filter((id, i) => id !== STANDARD_FLOW[i]).length;
  /* "{업종} 제조 표준" 라벨 — 검색 기업의 업종, 미등록 기업은 데모 기본값 (수정요청v7) */
  const industryShort = (findCompany(companyInput) ?? COMPANY_DIRECTORY[0]).industryShort;

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
                {/* 이미 응답한 문서는 앞으로 가기 허용 — 우측 배치 (수정요청v6) */}
                {(confirmComplete || Boolean(docChoices[currentDoc.id])) && (
                  <ForwardIconButton label="다음으로" onClick={goForward} />
                )}
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
                    {/* 이미 응답한 문항은 앞으로 가기 허용 — 우측 배치 (수정요청v6) */}
                    {(confirmComplete || answered(currentQ)) && (
                      <ForwardIconButton label="다음으로" onClick={goForward} />
                    )}
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
              /* 확인을 이미 마친 경우 — 완료 카드 (뒤로 가기 = 마지막 설문으로, 수정요청v6) */
              <Card radius="2xl" className="relative w-full max-w-[520px] p-[var(--space-8)] text-center">
                <BackIconButton label="다시 열기" onClick={reopenChain} />
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
                  <Button variant="primary" size="lg" onClick={startChain} className="min-w-[200px]">
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

            {/* 워크플로우 — 8대 영역 탭 대체 (수정요청v6). 분류 자체는 데이터 계층에서 유지 */}
            {/* v7: 흐름 잘림 방지 — 가운데 컨테이너를 벗어나 화면 최대 너비 사용 */}
            <section className="mx-[calc(50%-50vw)] mt-12 px-[var(--gutter)]">
              <h3 className="ax-heading m-0 [font:var(--text-title1)] tracking-[var(--track-heading)] text-ink">
                <b>워크플로우</b>로 정리했어요
              </h3>
              {/* v7: 설명 문구 대신 비교 현황 한 줄 — 숫자에만 색상 */}
              <p className="mt-1 mb-0 [font:var(--text-caption)] tracking-[var(--track-body)] text-ink-3">
                표준과 순서가 다른 부서{" "}
                <span
                  className={`[font-family:var(--font-mono)] font-bold ${
                    mismatchCount > 0 ? "text-[color:var(--fg-warning)]" : "text-ink-2"
                  }`}
                >
                  {mismatchCount}
                </span>
                곳
              </p>

              {/* {업종} 제조 표준 — 고정 참조 행 + 상세 팝업 (v7) */}
              <div className="mt-5 flex flex-wrap items-center gap-x-1.5 gap-y-2">
                <span className="mr-1 flex-none rounded-[var(--radius-s)] bg-surface-3 px-2 py-1 [font:var(--text-label-s)] tracking-[var(--track-body)] text-ink-2">
                  {industryShort} 제조 표준
                </span>
                {STANDARD_FLOW.map((id, i) => (
                  <span key={id} className="inline-flex items-center gap-1.5">
                    {i > 0 && (
                      <span aria-hidden className="inline-flex text-[color:var(--grey-400)]">
                        <Icons.chevronRight size={12} />
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-[var(--radius-full)] border border-solid border-line bg-surface px-2.5 py-1 [font:var(--text-label-s)] tracking-[var(--track-body)] text-ink-2">
                      {getDept(id).name}
                    </span>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setStdOpen(true)}
                  className="ml-1 flex-none cursor-pointer border-0 bg-transparent p-1 [font:var(--text-caption)] tracking-[var(--track-body)] text-brand underline underline-offset-2"
                >
                  표준 상세
                </button>
              </div>

              {/* {기업명} — 자사 간략 흐름. 드래그 가능, 아래 상세 카드와 순서 연동 (v7) */}
              <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
                <span className="mr-1 flex-none rounded-[var(--radius-s)] bg-brand-weak px-2 py-1 [font:var(--text-label-s)] tracking-[var(--track-body)] text-brand">
                  {companyInput.trim()}
                </span>
                {companyFlow.map((id, i) => {
                  const mismatch = STANDARD_FLOW[i] !== id;
                  return (
                    <span key={id} className="inline-flex items-center gap-1.5">
                      {i > 0 && (
                        <span aria-hidden className="inline-flex text-[color:var(--grey-400)]">
                          <Icons.chevronRight size={12} />
                        </span>
                      )}
                      <span
                        {...dragProps(i)}
                        aria-label={`${getDept(id).name} — 끌어서 순서 이동`}
                        className={`inline-flex cursor-grab items-center gap-1.5 rounded-[var(--radius-full)] border border-solid px-2.5 py-1 [font:var(--text-label-s)] tracking-[var(--track-body)] transition-colors duration-[var(--dur-fast)] active:cursor-grabbing ${
                          dragOver === i
                            ? "border-[var(--line-brand)] bg-brand-weak text-brand"
                            : mismatch
                              ? "border-[color:var(--fg-warning)] bg-surface text-[color:var(--fg-warning)]"
                              : "border-line bg-surface text-ink-2"
                        }`}
                      >
                        {mismatch && (
                          <span
                            aria-hidden
                            className="size-1.5 flex-none rounded-full bg-[color:var(--fg-warning)]"
                          />
                        )}
                        {getDept(id).name}
                      </span>
                    </span>
                  );
                })}
              </div>

              {/* 자사 상세 카드 행 — 간략 흐름과 같은 순서 (드래그 연동) */}
              <div className="ax-scrollbar-none mt-4 flex items-stretch gap-1.5 overflow-x-auto pb-2">
                {companyFlow.map((id, i) => {
                  const mismatch = STANDARD_FLOW[i] !== id;
                  return (
                    <div key={id} className="flex flex-none items-center gap-1.5">
                      {i > 0 && (
                        <span
                          aria-hidden
                          className="inline-flex flex-none text-[color:var(--grey-400)]"
                        >
                          <Icons.chevronRight size={14} />
                        </span>
                      )}
                      <div
                        {...dragProps(i)}
                        aria-label={`${getDept(id).name} — 끌어서 순서 이동`}
                        className={`w-[264px] flex-none cursor-grab rounded-[var(--radius-l)] border border-solid bg-surface p-3.5 transition-colors duration-[var(--dur-fast)] active:cursor-grabbing ${
                          dragOver === i
                            ? "border-[var(--line-brand)] bg-brand-weak"
                            : mismatch
                              ? "border-[color:var(--fg-warning)]"
                              : "border-line"
                        }`}
                      >
                        <DeptCardBody dept={getDept(id)} mismatch={mismatch} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 지원 부서 — 흐름(체인) 밖 별도 표기 */}
              <div className="mt-5 flex flex-wrap items-start gap-2">
                <span className="flex-none rounded-[var(--radius-s)] bg-surface-3 px-2 py-1 [font:var(--text-label-s)] tracking-[var(--track-body)] text-ink-2">
                  지원 부서
                </span>
                {SUPPORT_DEPT_IDS.map((id) => (
                  <div
                    key={id}
                    className="w-[264px] flex-none rounded-[var(--radius-l)] border border-solid border-line bg-surface p-3.5"
                  >
                    <DeptCardBody dept={getDept(id)} mismatch={false} />
                  </div>
                ))}
              </div>
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

      {/* ── 표준 상세 흐름 팝업 (수정요청v7) — 업종별 제조 표준, 추후 업종 추가 구축 예정 ── */}
      <Modal
        open={stdOpen}
        onClose={() => setStdOpen(false)}
        title={`${industryShort} 제조 표준`}
      >
        <ol className="m-0 list-none p-0">
          {STANDARD_FLOW.map((id, i) => {
            const dept = getDept(id);
            return (
              <li
                key={id}
                className="flex items-start gap-3 border-t border-[var(--line-subtle)] py-3 first:border-t-0"
              >
                <span className="mt-0.5 inline-flex size-[22px] flex-none items-center justify-center rounded-full bg-surface-3 text-[13px] font-bold [font-family:var(--font-mono)] text-ink-2">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block [font:var(--text-label-m)] tracking-[var(--track-heading)] text-ink">
                    {dept.name}
                  </span>
                  <span className="mt-0.5 block [font:var(--text-body3)] tracking-[var(--track-body)] text-ink-2">
                    {dept.tasks.join(" · ")}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </Modal>
    </>
  );
}
