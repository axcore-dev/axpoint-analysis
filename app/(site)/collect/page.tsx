"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ClassifyProgress } from "@/components/flow/ClassifyProgress";
import { FileEditBoard } from "@/components/flow/FileEditBoard";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { PublicDataSection } from "@/components/flow/PublicDataSection";
import { WorkflowSection } from "@/components/flow/WorkflowSection";
import { RouteLoading } from "@/components/flow/RouteLoading";
import { SurveyModal } from "@/components/flow/SurveyModal";
import { DIGITAL_LEVELS } from "@/data/rubric/meta";
import { api } from "@/lib/api";
import { Button, Card, Icons, Input, Loader, Modal, Tag } from "@/components/ui";
import { waitForJudge } from "@/lib/judgeWait";

/**
 * S1 자료 정리 — 2단계 구성 (진단 플로우 개편 2차)
 * 1단계: 진입과 동시에 분류를 시작하고(pending 전체, 파일 0건이면 생략) 순차 스텝 위저드로 진행.
 *   ① 자료 확인 — 분류 진행 로그 → 분류 결과가 반영된 필수 서류 충족/부족 검증.
 *     추가 업로드는 그 건만 바로 분류(fileIds 지정).
 *   ② 사용 중인 프로그램 — '다음'에 PATCH {systems} 저장.
 *   ③ 사전 설문(kind=primary) — '다음'에 PUT surveys 저장 후 2단계로 전환.
 * 2단계 '자료 분류': 기존 분류 결과 그리드·공개데이터·워크플로우. 보완 설문(kind=supplement)이
 *   내려오면 배너 + SurveyModal로 응답.
 * 프로그램 선택을 마친 적 있는 진단(assessment.systems 비어 있지 않음)은 재방문으로 보고 2단계 직행.
 */

/** 1단계 위저드 스텝 이름 — 상단 단계 표시용 */
const REVIEW_STEP_LABELS = ["자료 확인", "사용 프로그램", "사전 설문"];

/** 최초 진입 수집 로딩 문구 (기존 문구 유지) */
const COLLECT_MESSAGES = [
  "공개 데이터를 모으고 있어요",
  "올려주신 자료를 읽고 있어요",
  "8대 영역으로 나누고 있어요",
  "개인 정보를 가리고 있어요",
];

/** 제출 후 판정 로딩 문구 (기존 문구 유지) */
const CLASSIFY_MESSAGES = ["자료를 분석하고 있어요", "분석된 점수를 계산하고 있어요", "업무 영역을 상태를 정리하고 있어요"];

const SYSTEM_OPTIONS = ["ERP", "MES", "WMS", "회계SW", "없음"];

type FileRow = {
  id: string;
  name: string;
  status: string | null; // pending / processing / done / failed / unclassified
  docTypeId: number | null; // 자료 편집 보드가 영역(그룹) 컬럼을 정하는 근거
  docTypeName: string | null;
  digitalLevel: number | null;
  confidence: number | null;
};

type RequiredDocs = {
  items: { docTypeId: number; docTypeName: string; groupName: string; files: { fileId: string; name: string }[] }[];
  filled: number;
  total: number;
  analysis: { analyzing: number; uploaded: number; done: number };
  unclassified: { fileId: string; name: string }[];
};

type SurveyItem = {
  code: string;
  kind: string; // primary(사전 설문) / supplement(보완 설문)
  text: string;
  choices: { value: string; label: string }[];
  answer: { choiceValues: string[] } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "분류 대기",
  processing: "분류 중",
  failed: "분류 실패",
  unclassified: "미분류",
  split: "양식집 · 페이지별 분류", // 묶음 PDF — 페이지가 개별 파일로 분할되어 각각 분류된다
};

/** 파일 1건 행 — 그리드와 '모두 보기' 팝업이 같은 표기를 쓴다 */
function FileCell({ f }: { f: FileRow }) {
  const busy = f.status === "pending" || f.status === "processing";
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-m)] border border-solid border-line bg-surface px-3.5 py-2.5">
      <span className="flex-none text-ink-4">
        <Icons.file size={12} />
      </span>
      <span className="min-w-0 flex-1 truncate [font:var(--text-body3)] tracking-[var(--track-body)] text-ink">
        {f.name}
      </span>
      {busy ? (
        <span className="flex flex-none items-center gap-1.5 [font:var(--text-caption)] text-ink-3">
          <Loader style={{ width: 14, height: 14 }} />
          {STATUS_LABEL[f.status ?? "pending"]}
        </span>
      ) : f.status === "done" ? (
        <span className="flex flex-none items-center gap-1.5 [font:var(--text-caption)] text-ink-2">
          {f.docTypeName}
          {f.digitalLevel != null && (
            <span className="flex-none rounded-[var(--radius-xs)] bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-ink-3">
              {DIGITAL_LEVELS[`L${f.digitalLevel}`] ?? `L${f.digitalLevel}`}
            </span>
          )}
          <Icons.check size={14} />
        </span>
      ) : (
        <span className="flex-none [font:var(--text-caption)] text-ink-4">
          {STATUS_LABEL[f.status ?? "failed"]}
        </span>
      )}
    </div>
  );
}

export default function CollectPage() {
  const router = useRouter();
  const { companyInput, assessmentId, systems, completeStep, update } = useDiagnosis();

  /** 1단계(자료 확인) / 2단계(자료 분류) — null은 판별 전 */
  const [stage, setStage] = useState<"review" | "classify" | null>(null);
  /** 1단계 내 순차 스텝 — ① 자료 확인 ② 사용 프로그램 ③ 사전 설문 */
  const [reviewStep, setReviewStep] = useState<1 | 2 | 3>(1);
  const [files, setFiles] = useState<FileRow[] | null>(null);
  /** 파일 전체 보기 팝업 — 그리드에는 최대 9개만 보인다 */
  const [allFilesOpen, setAllFilesOpen] = useState(false);
  /** 자료 편집 칸반 보드 팝업 */
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** 자료 부족 경고 — 필수 서류가 하나도 없을 때 */
  const [shortage, setShortage] = useState<{ filled: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── 1단계 상태 — 필수 서류·슬롯 업로드·프로그램·사전 설문 ── */
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocs | null>(null);
  /** 부족한 슬롯만 보기 */
  const [uploading, setUploading] = useState(false);
  /** 업로드 실패·거부 안내 */
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** 슬롯에서 올릴 때의 대상 문서 유형 (파일 선택창은 하나를 공유한다) */
  const uploadTargetRef = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [surveyItems, setSurveyItems] = useState<SurveyItem[] | null>(null);
  /** 사전 설문 선택값 — surveyCode → choiceValue */
  const [picked, setPicked] = useState<Record<string, string>>({});
  /** 기타 프로그램 직접 입력 (수정요청v9) */
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherInput, setOtherInput] = useState("");
  /** 분류 시작 진행 중 — 프로그램·설문 저장 후 classify 호출 */
  const [proceeding, setProceeding] = useState(false);
  /** 2단계 보완 설문 팝업 */
  const [surveyOpen, setSurveyOpen] = useState(false);

  /* 분류 현황 폴링 — 전부 끝나면(대기·처리중 없음) 중단 */
  const fetchFiles = useCallback(async () => {
    if (!assessmentId) return;
    try {
      const { items } = await api<{ items: FileRow[] }>(
        `/api/assessments/${assessmentId}/files`,
      );
      setFiles(items);
      const busy = items.some((f) => f.status === "pending" || f.status === "processing");
      if (!busy && pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    } catch {
      /* 폴링 실패는 다음 주기에 재시도 */
    }
  }, [assessmentId]);

  /* 진입 판별 — 프로그램 선택을 마친 적 있으면(assessment.systems 비어 있지 않음) 재방문으로 보고
     2단계 직행. 그 외에는 1단계 진입과 동시에 분류를 시작한다(파일 0건이면 호출 생략) */
  useEffect(() => {
    if (!assessmentId) return;
    let cancelled = false;
    (async () => {
      try {
        const { assessment } = await api<{ assessment: { systems: string[] | null } }>(
          `/api/assessments/${assessmentId}`,
        );
        if (cancelled) return;
        if ((assessment.systems ?? []).length > 0) {
          setStage("classify");
          return;
        }
        const { items } = await api<{ items: FileRow[] }>(
          `/api/assessments/${assessmentId}/files`,
        );
        if (cancelled) return;
        setFiles(items);
        /* body 없이 호출 — 미분류(pending) 전체를 분류 큐에 등록. 실패해도 진행은 막지 않는다 */
        if (items.length > 0)
          void api(`/api/assessments/${assessmentId}/classify`, { method: "POST" }).catch(
            () => {},
          );
        setStage("review");
      } catch {
        if (!cancelled) setStage("review");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  /* 분류 현황 폴링 — 1단계 자료 확인 스텝과 2단계에서 동작. 전부 끝나면 fetchFiles가 스스로 멈춘다 */
  useEffect(() => {
    if (!assessmentId || stage === null) return;
    if (stage === "review" && reviewStep !== 1) return;
    void fetchFiles();
    pollTimer.current = setInterval(fetchFiles, 3000);
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [assessmentId, stage, reviewStep, fetchFiles]);

  const total = files?.length ?? 0;
  const doneCount =
    files?.filter((f) => f.status && f.status !== "pending" && f.status !== "processing").length ??
    0;
  const classifying = total > 0 && doneCount < total;

  /* ── 필수 서류 현황 — 1단계에서 조회, 슬롯 업로드 후 갱신 ── */
  const loadRequiredDocs = useCallback(async () => {
    if (!assessmentId) return;
    try {
      setRequiredDocs(await api<RequiredDocs>(`/api/assessments/${assessmentId}/required-docs`));
    } catch {
      /* 조회 실패 시 슬롯 패널 없이 진행 버튼만 노출 */
    }
  }, [assessmentId]);

  /* 분류가 끝난 시점에 조회 — 필수 서류 패널이 분류 결과가 반영된 충족/부족(검증 결과)을 보여준다.
     추가 업로드·자료 편집으로 분류가 다시 돌면 끝난 뒤 재조회된다 */
  useEffect(() => {
    if (stage === "review" && reviewStep === 1 && !classifying) void loadRequiredDocs();
  }, [stage, reviewStep, classifying, loadRequiredDocs]);

  /* ── 설문 조회 — 1단계는 사전 설문 표시용, 2단계는 분류가 끝난 뒤 보완 설문 배너용 ── */
  const loadSurveys = useCallback(async () => {
    if (!assessmentId) return;
    try {
      const { items } = await api<{ items: SurveyItem[] }>(
        `/api/assessments/${assessmentId}/surveys`,
      );
      setSurveyItems(items);
      /* 서버에 저장된 응답을 미리 채우되, 화면에서 고른 값은 유지한다 */
      setPicked((prev) => ({
        ...Object.fromEntries(
          items
            .filter((i) => i.answer?.choiceValues?.[0] !== undefined)
            .map((i) => [i.code, i.answer!.choiceValues[0]]),
        ),
        ...prev,
      }));
    } catch {
      /* 설문을 못 불러와도 진행은 막지 않는다 */
    }
  }, [assessmentId]);

  useEffect(() => {
    if (stage === null) return;
    if (stage === "classify" && classifying) return; // 분류 끝난 뒤 보완 설문 발동 여부를 다시 본다
    void loadSurveys();
  }, [stage, classifying, loadSurveys]);

  const primaries = surveyItems?.filter((i) => i.kind === "primary") ?? [];
  const supplements = surveyItems?.filter((i) => i.kind === "supplement") ?? [];

  /* ── 슬롯 업로드 — docTypeId를 지정하면 그 유형으로 확정 업로드 ── */
  const slotUpload = async (list: File[], docTypeId?: number) => {
    if (!assessmentId || list.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      for (const f of list) form.append("files", f);
      if (docTypeId !== undefined) form.append("docTypeId", String(docTypeId));
      const res = await api<{
        saved?: { id: string; name: string }[];
        rejected?: { name: string; reason: string }[];
      }>(`/api/assessments/${assessmentId}/files`, { method: "POST", body: form });
      const rejected = res.rejected ?? [];
      if (rejected.length > 0) {
        /* 사유가 있으면 사유를 그대로 — 왜 빠졌는지 알아야 다시 올릴 수 있다 */
        setUploadError(rejected.map((r) => `${r.name} — ${r.reason}`).join(" / "));
      }
      /* 1단계 추가 업로드는 그 건만 바로 분류 — 멈춰 있던 폴링을 재개해 진행을 이어받는다 */
      const savedIds = (res.saved ?? []).map((s) => s.id);
      if (savedIds.length > 0) {
        await api(`/api/assessments/${assessmentId}/classify`, {
          method: "POST",
          body: JSON.stringify({ fileIds: savedIds }),
        }).catch(() => {});
        if (!pollTimer.current) pollTimer.current = setInterval(fetchFiles, 3000);
      }
      await Promise.all([loadRequiredDocs(), fetchFiles()]);
    } catch {
      setUploadError("파일을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  };

  /** 업로드 버튼 클릭 → 파일 선택창 (슬롯이면 그 유형으로 지정) */
  const handleUploadClick = (docTypeId?: number) => {
    if (uploading) return;
    /* 선택창을 취소하면 change 이벤트가 오지 않으므로 열 때마다 대상을 다시 정한다 */
    uploadTargetRef.current = docTypeId;
    fileInputRef.current?.click();
  };

  const onFilesPicked = (list: FileList | null) => {
    const chosen = Array.from(list ?? []);
    const target = uploadTargetRef.current;
    uploadTargetRef.current = undefined;
    if (chosen.length === 0) return;
    void slotUpload(chosen, target);
  };

  /* ── 사용 중인 프로그램 — 랜딩에서 이식 (배타 토글 로직 유지) ── */

  /** 목록에 없는(직접 입력한) 프로그램 — 저장된 선택에서 역산한다 */
  const otherSystems = systems.filter((s) => !SYSTEM_OPTIONS.includes(s));

  /** 기타 프로그램 추가 — 중복·빈값은 무시 */
  const addOtherSystem = () => {
    const name = otherInput.trim();
    if (!name || systems.includes(name)) {
      setOtherInput("");
      return;
    }
    update({ systems: [...systems.filter((s) => s !== "없음"), name] });
    setOtherInput("");
  };

  /** '기타'는 태그 자체가 선택 상태 — 입력창이 열렸거나 직접 입력한 프로그램이 있으면 켜짐 */
  const otherSelected = otherOpen || otherSystems.length > 0;

  /** '없음'은 배타 선택 — 없음을 고르면 나머지 해제, 다른 걸 고르면 없음 해제 */
  const toggleSystem = (name: string) => {
    if (systems.includes(name)) {
      update({ systems: systems.filter((s) => s !== name) });
      return;
    }
    if (name === "없음") {
      /* 직접 입력한 프로그램과 입력창도 함께 정리한다 — 없음과 같이 켜져 있으면 안 된다 */
      setOtherOpen(false);
      setOtherInput("");
      update({ systems: ["없음"] });
      return;
    }
    update({ systems: [...systems.filter((s) => s !== "없음"), name] });
  };

  /** '기타' 토글 — 다시 누르면 입력창을 닫고 직접 입력한 프로그램도 함께 해제한다 */
  const toggleOther = () => {
    if (!otherSelected) {
      /* '없음'과의 배타는 양방향 — 기타를 켜는 순간 '없음'을 푼다 */
      if (systems.includes("없음")) {
        update({ systems: systems.filter((s) => s !== "없음") });
      }
      setOtherOpen(true);
      return;
    }
    setOtherOpen(false);
    setOtherInput("");
    if (otherSystems.length > 0) {
      update({ systems: systems.filter((s) => SYSTEM_OPTIONS.includes(s)) });
    }
  };

  /* ── 스텝 전환 — 프로그램·설문 저장 실패는 진행을 막지 않는다 (기존 정책 유지) ── */

  /** 스텝 ② → ③: 사용 중인 프로그램 저장 */
  const proceedSystems = async () => {
    if (!assessmentId || proceeding) return;
    setProceeding(true);
    await api(`/api/assessments/${assessmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ systems }),
    }).catch(() => {});
    setProceeding(false);
    setReviewStep(3);
  };

  /** 스텝 ③ → 2단계: 사전 설문 응답 저장 후 자료 분류 화면으로 */
  const proceedSurveys = async () => {
    if (!assessmentId || proceeding) return;
    setProceeding(true);
    const answers = Object.entries(picked).map(([surveyCode, value]) => ({
      surveyCode,
      choiceValues: [value],
    }));
    if (answers.length > 0) {
      await api(`/api/assessments/${assessmentId}/surveys`, {
        method: "PUT",
        body: JSON.stringify({ answers }),
      }).catch(() => {});
    }
    setProceeding(false);
    setStage("classify");
  };

  /* 제출 전 점검 — 필수 서류가 하나도 없으면 점수를 낼 수 없다. 결과 화면에서 처음 알리지 않는다 (v9) */
  const requestSubmit = async () => {
    if (!assessmentId || submitting) return;
    try {
      const rd = await api<{ filled: number; total: number }>(
        `/api/assessments/${assessmentId}/required-docs`,
      );
      if (rd.filled === 0) {
        setShortage(rd);
        return;
      }
    } catch {
      /* 점검 실패는 진행을 막지 않는다 */
    }
    void submit();
  };

  /* 제출 → 판정 완료 폴링 → 진단 결과로 이동 */
  const submit = async () => {
    if (!assessmentId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/assessments/${assessmentId}/submit`, { method: "POST" });
      const outcome = await waitForJudge(assessmentId);
      if (outcome === "failed") throw new Error("판정에 실패했어요. 다시 시도해 주세요.");
      if (outcome === "timeout")
        throw new Error("판정이 예상보다 오래 걸려요. 잠시 후 마이페이지에서 결과를 확인해 주세요.");
      completeStep("collect");
      router.push("/result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
    }
  };

  /* 분류가 끝나야 제출할 수 있지만, 워커가 죽으면 파일이 pending으로 남아 버튼이 영영 잠긴다.
     3분이 지나면 분류된 자료만으로 진행할 수 있게 푼다 */
  const [classifyStuck, setClassifyStuck] = useState(false);
  useEffect(() => {
    if (!classifying) {
      setClassifyStuck(false);
      return;
    }
    const t = setTimeout(() => setClassifyStuck(true), 3 * 60 * 1000);
    return () => clearTimeout(t);
  }, [classifying]);

  /* 진입 가드 — 기업 식별값·세션 없이 직접 진입 (기존 정책 유지) */
  if (!companyInput || !assessmentId) {
    return (
      <div className="flex min-h-[calc(100vh-56px)] items-center justify-center px-[var(--gutter)]">
        <Card radius="2xl" style={{ maxWidth: 480, width: "100%", padding: 36, textAlign: "center" }}>
          <p style={{ font: "var(--text-h3)", color: "var(--fg-primary)", margin: 0 }}>
            진단 정보를 찾을 수 없어요
          </p>
          <p style={{ font: "var(--text-body2)", color: "var(--fg-tertiary)", margin: "10px 0 22px" }}>
            처음부터 다시 시작해 주세요.
          </p>
          <Button variant="primary" size="lg" full onClick={() => router.push("/")}>
            처음으로
          </Button>
        </Card>
      </div>
    );
  }

  /* 진입 판별(assessment 조회)·초기 파일 조회가 끝날 때까지만 로딩 — 끝나면 즉시 전환 */
  if (stage === null)
    return <RouteLoading title={companyInput} messages={COLLECT_MESSAGES} />;
  if (submitting) return <RouteLoading messages={CLASSIFY_MESSAGES} />;

  /* ═══════════ 1단계 — 순차 스텝 위저드 (① 자료 확인 ② 사용 프로그램 ③ 사전 설문) ═══════════ */
  if (stage === "review") {
    return (
      <main className="ax-step-enter mx-auto max-w-[760px] px-6 pb-12 pt-8">
        {/* 단계 표시 — 랜딩 DotProgress 패턴의 축소판 (도트 + 스텝 이름) */}
        <div aria-label={`3단계 중 ${reviewStep}단계`} className="mt-8 flex items-center gap-4">
          {REVIEW_STEP_LABELS.map((label, i) => (
            <span
              key={label}
              className="flex items-center gap-1.5 [font:var(--text-caption)]"
              style={{
                color: reviewStep === i + 1 ? "var(--fg-brand)" : "var(--fg-quaternary)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "var(--radius-full)",
                  background: reviewStep >= i + 1 ? "var(--bg-brand)" : "var(--grey-300)",
                  transition: "background-color var(--dur-base) var(--ease)",
                }}
              />
              {label}
            </span>
          ))}
        </div>

        {/* ── 스텝 ① 자료 확인 — 분류 진행 로그 → 분류 결과가 반영된 필수 서류 검증 ── */}
        {reviewStep === 1 && (
          <>
            <header className="mt-3">
              <h2 className="ax-heading m-0 [font:var(--text-h2)] tracking-[var(--track-heading)] text-ink">
                자료 확인
              </h2>
            </header>

            {/* 실제 파일 업로드 input — '한번에 올리기'·슬롯 올리기가 이 input을 연다 */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.hwp,.docx,.doc"
              onChange={(e) => {
                onFilesPicked(e.target.files);
                e.target.value = "";
              }}
              style={{ display: "none" }}
              aria-hidden
              tabIndex={-1}
            />

            {/* 분류 진행 로그 — 분류가 도는 동안 카드로 표시(라벨은 2단계 문구 재사용),
                끝나면 우측 접힌 아코디언('분류 과정 보기')으로 보존 */}
            {files &&
              files.length > 0 &&
              (classifying ? (
                <section className="mt-8 rounded-[var(--radius-l)] border border-line">
                  <div className="border-b border-line px-3.5 py-2.5">
                    <span className="[font:var(--text-label-s)] text-ink">
                      AI가 자료를 분류하고 있어요 ({doneCount}/{total})
                    </span>
                  </div>
                  <div className="px-3.5 py-3">
                    <ClassifyProgress files={files} />
                  </div>
                </section>
              ) : (
                <div className="mt-8">
                  <ClassifyProgress files={files} done />
                </div>
              ))}

            {/* 필수 서류 슬롯 — 업무영역별로 묶어 무엇이 비었는지 바로 보이게 (수정요청v9) */}
            {requiredDocs && requiredDocs.items.length > 0 && (
              <section className="mt-8 rounded-[var(--radius-l)] border border-line">
                <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
                  <span className="min-w-0 [font:var(--text-label-s)] text-ink">
                    필수 서류 {requiredDocs.filled}/{requiredDocs.total}
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    {/* 업로드 진입점 — 여러 건을 한 번에 올리면 유형은 분류가 정한다 (수정요청v9) */}
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={uploading}
                      onClick={() => handleUploadClick()}
                    >
                      {uploading ? "올리는 중" : "한번에 올리기"}
                    </Button>
                  </span>
                </div>
                {/* 화면 높이에 맞춰 확장 — 뷰포트가 낮으면 패널 안에서 자연 스크롤 */}
                <div className="ax-scrollbar-none max-h-[max(300px,60vh)] overflow-y-auto">
                  {Object.entries(
                    requiredDocs.items
                      .reduce<Record<string, RequiredDocs["items"]>>((acc, it) => {
                        acc[it.groupName] = [...(acc[it.groupName] ?? []), it];
                        return acc;
                      }, {}),
                  ).map(([group, docs]) => (
                    <div key={group} className="border-b border-line last:border-b-0">
                      <div className="flex items-baseline justify-between gap-2 bg-surface-2 px-3.5 py-2">
                        <span className="[font:var(--text-label-s)] text-ink-2">{group}</span>
                        <span className="[font:var(--text-caption)] text-ink-4">
                          {docs.filter((d) => d.files.length > 0).length}/{docs.length}
                        </span>
                      </div>
                      {docs.map((d) => {
                        const done = d.files.length > 0;
                        return (
                          <div
                            key={d.docTypeId}
                            className="flex items-center gap-2.5 border-t border-line-subtle px-3.5 py-2"
                          >
                            <span
                              aria-hidden
                              className={`inline-flex size-4 flex-none items-center justify-center rounded-full ${
                                done
                                  ? "bg-[var(--bg-success-weak)] text-[var(--fg-success)]"
                                  : "bg-surface-3 text-ink-4"
                              }`}
                            >
                              {done ? <Icons.check size={10} /> : null}
                            </span>
                            <span className="min-w-0 flex-1 truncate [font:var(--text-label-s)] text-ink">
                              {d.docTypeName}
                            </span>
                            {done ? (
                              <span className="flex-none truncate [font:var(--text-caption)] text-ink-4">
                                {d.files[0].name}
                              </span>
                            ) : (
                              <Button
                                variant="utility"
                                size="sm"
                                disabled={uploading}
                                onClick={() => handleUploadClick(d.docTypeId)}
                              >
                                올리기
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {uploadError && (
              <p role="alert" className="mt-3 [font:var(--text-caption)] text-[var(--fg-danger)]">
                {uploadError}
              </p>
            )}

            {/* 진행 — 자료 편집(칸반) + 다음. 분류가 끝나야 다음 스텝으로 (워커가 멈추면 3분 뒤 잠금 해제) */}
            <div className="mt-10 flex flex-col gap-2">
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={classifying || uploading || total === 0}
                  onClick={() => setEditOpen(true)}
                >
                  자료 편집
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  disabled={uploading || (classifying && !classifyStuck)}
                  onClick={() => setReviewStep(2)}
                >
                  다음 →
                </Button>
              </div>
              {total === 0 && (
                <Button
                  variant="ghost"
                  size="md"
                  full
                  disabled={uploading}
                  onClick={() => setReviewStep(2)}
                >
                  자료 없이 진행
                </Button>
              )}
            </div>

            {/* 자료 편집 칸반 보드 — 2단계와 같은 연결 (닫으면 목록 갱신, 저장 시 폴링 재개) */}
            {files && (
              <FileEditBoard
                assessmentId={assessmentId}
                open={editOpen}
                onClose={() => {
                  setEditOpen(false);
                  void fetchFiles(); // 팝업에서 올린 파일이 현황에 바로 보이게
                }}
                files={files}
                onSaved={() => {
                  // 재분류로 pending이 다시 생긴다 — 멈춰 있던 폴링을 재개해 이어받는다
                  if (!pollTimer.current) pollTimer.current = setInterval(fetchFiles, 3000);
                }}
              />
            )}
          </>
        )}

        {/* ── 스텝 ② 사용 중인 프로그램 — 랜딩 3단계에서 이동 ── */}
        {reviewStep === 2 && (
          <>
            <header className="mt-3">
              <h2 className="ax-heading m-0 [font:var(--text-h2)] tracking-[var(--track-heading)] text-ink">
                사용 중인 프로그램
              </h2>
            </header>

            <section className="mt-8">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {SYSTEM_OPTIONS.map((name) => (
                  <Tag
                    key={name}
                    selected={systems.includes(name)}
                    onClick={() => toggleSystem(name)}
                  >
                    {name}
                  </Tag>
                ))}
                {/* 목록에 없는 프로그램을 직접 담는다 (수정요청v9) */}
                <Tag selected={otherSelected} onClick={toggleOther}>
                  기타
                </Tag>
              </div>

              {/* 직접 입력한 프로그램 — 태그로 붙고 X로 뺀다 */}
              {otherOpen && (
                <div style={{ marginTop: 10 }}>
                  <Input
                    value={otherInput}
                    onChange={(e) => setOtherInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      addOtherSystem();
                    }}
                    placeholder="프로그램 이름을 입력하고 Enter"
                    aria-label="기타 프로그램 이름"
                    autoFocus
                  />
                  {otherSystems.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                      {otherSystems.map((name) => (
                        <Tag key={name} selected onClick={() => toggleSystem(name)}>
                          {name} ✕
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <div className="mt-10 flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                full
                disabled={proceeding}
                onClick={proceedSystems}
              >
                다음
              </Button>
            </div>
          </>
        )}

        {/* ── 스텝 ③ 사전 설문(프로파일링) — kind=primary, 카드형 단일 선택 ── */}
        {reviewStep === 3 && (
          <>
            <header className="mt-3">
              <h2 className="ax-heading m-0 [font:var(--text-h2)] tracking-[var(--track-heading)] text-ink">
                사전 설문
              </h2>
            </header>

            {primaries.length > 0 && (
              <section className="mt-8">
                {primaries.map((q) => (
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
                                /* 같은 선지를 다시 누르면 응답 취소 */
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
              </section>
            )}

            <div className="mt-10 flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                full
                disabled={proceeding}
                onClick={proceedSurveys}
              >
                다음
              </Button>
            </div>
          </>
        )}
      </main>
    );
  }

  /* ═══════════ 2단계 — 자료 분류 (기존 화면) ═══════════ */
  return (
    <main className="ax-step-enter mx-auto max-w-[1200px] px-6 pb-24 pt-8">
      {/* ── 수집 요약 헤더 (원본 레이아웃) — 건수는 업로드 파일 서버 응답 기준 ── */}
      <header className="mt-10">
        <h2 className="ax-heading m-0 [font:var(--text-h2)] tracking-[var(--track-heading)] text-ink">
          <b>{companyInput.trim()}</b>에 대해 총{" "}
          <b>
            <span className="[font-family:var(--font-mono)]">{total}</span>건
          </b>
          을 수집했어요
        </h2>
        <p className="mt-2 mb-0 [font:var(--text-body2)] tracking-[var(--track-body)] text-ink-2">
          {total === 0
            ? "올려주신 자료 없이 진행해요. 공개 데이터로 추정 진단해요."
            : classifying
              ? `AI가 자료를 분류하고 있어요 (${doneCount}/${total})`
              : `자료 ${total}건의 분류를 마쳤어요`}
        </p>
      </header>

      {/* ── 보완 설문 배너 — 결측 보완 문항이 발행되면 노출 ── */}
      {supplements.length > 0 && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-[var(--radius-l)] border border-line bg-surface-2 px-4 py-3">
          <span className="[font:var(--text-body3)] text-ink-2">
            보완 설문 {supplements.length}문항
          </span>
          <Button variant="secondary" size="sm" onClick={() => setSurveyOpen(true)}>
            설문으로 보완하기
          </Button>
        </div>
      )}

      {/* ── 파일별 분류 결과 그리드 — 최대 9개, 나머지는 팝업으로 (문서유형·디지털화 수준·진행 상태) ── */}
      {files && files.length > 0 && (
        <section className="mt-10">
          {/* 분류 진행 로그 — 진행 중엔 흐르는 로그, 끝나면 우측 접힌 아코디언('분류 과정 보기')으로 보존 */}
          <div className="mb-4">
            <ClassifyProgress files={files} done={!classifying} />
          </div>
          {/* 그리드 헤더 — 자료 편집(칸반 보드) 진입 */}
          <div className="mb-2 flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              자료 편집
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {files.slice(0, 9).map((f) => (
              <FileCell key={f.id} f={f} />
            ))}
          </div>
          {files.length > 9 && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setAllFilesOpen(true)}
                className="cursor-pointer border-0 bg-transparent p-0 [font:var(--text-label-s)] text-[var(--fg-brand)]"
              >
                모두 보기 →
              </button>
            </div>
          )}

          {/* 파일 전체 목록 팝업 */}
          <Modal
            open={allFilesOpen}
            onClose={() => setAllFilesOpen(false)}
            title={`자료 ${files.length}건`}
            wide
          >
            <div className="ax-scrollbar-none flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto">
              {files.map((f) => (
                <FileCell key={f.id} f={f} />
              ))}
            </div>
          </Modal>

          {/* 자료 편집 칸반 보드 — 영역 이동·추가 업로드, 저장 시 변경분만 재분류 */}
          <FileEditBoard
            assessmentId={assessmentId}
            open={editOpen}
            onClose={() => {
              setEditOpen(false);
              void fetchFiles(); // 팝업에서 올린 파일이 그리드에 바로 보이게
            }}
            files={files}
            onSaved={() => {
              // 재분류로 pending이 다시 생긴다 — 멈춰 있던 폴링을 재개해 이어받는다
              if (!pollTimer.current) pollTimer.current = setInterval(fetchFiles, 3000);
            }}
          />
        </section>
      )}

      {/* ── 공개 데이터 수집 — 진입 시 수집 시작, 진행률은 SSE (수정요청v9·v10) ── */}
      {assessmentId && <PublicDataSection assessmentId={assessmentId} />}

      {/* ── 워크플로우 — 8대 영역 표준 워크플로우 + 이 기업 문서 보유 현황 (실데이터) ── */}
      <WorkflowSection companyName={companyInput.trim()} assessmentId={assessmentId} />

      {error && (
        <p style={{ margin: "24px 0 0", font: "var(--text-caption)", color: "var(--fg-danger, #d4380d)" }}>
          {error}
        </p>
      )}

      {/* 자료 부족 경고 — 이대로 진단하면 점수가 나오지 않는다 (수정요청v9) */}
      <Modal
        open={shortage !== null}
        onClose={() => setShortage(null)}
        title="자료가 부족합니다"
      >
        <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
          필수 서류 {shortage?.total ?? 0}종 중 올라온 자료가 없어요. 이대로 진단하면 점수를
          산출하지 못해요.
        </p>
        <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
          자료를 올리면 판정이 되고, 부족한 문항은 진단 결과에서 설문으로 보완할 수 있어요.
        </p>
        <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
          <Button variant="secondary" full onClick={() => router.push("/")}>
            자료 올리러 가기
          </Button>
          <Button
            variant="primary"
            full
            onClick={() => {
              setShortage(null);
              void submit();
            }}
          >
            그래도 진행
          </Button>
        </div>
      </Modal>

      {/* 보완 설문 팝업 — 저장만 하고 재판정은 걸지 않는다(첫 판정 전) */}
      {assessmentId && (
        <SurveyModal
          assessmentId={assessmentId}
          open={surveyOpen}
          onClose={() => setSurveyOpen(false)}
          supplementOnly
          onApplied={() => void loadSurveys()}
        />
      )}

      {/* ── 다음 단계: 우측 하단 배치 (원본 레이아웃) ── */}
      <div className="mt-14 flex flex-col items-end gap-2">
        <Button
          variant="primary"
          size="lg"
          disabled={(classifying && !classifyStuck) || submitting}
          onClick={requestSubmit}
        >
          진단 결과 보기
          <Icons.arrow size={17} />
        </Button>
        {classifying && (
          <p className="m-0 [font:var(--text-caption)] text-ink-4">
            {classifyStuck
              ? `분류가 끝나지 않은 자료 ${total - doneCount}건이 있어요. 분류된 자료만으로 진행할 수 있어요.`
              : "분류가 끝나면 진단을 시작할 수 있어요."}
          </p>
        )}
      </div>
    </main>
  );
}
