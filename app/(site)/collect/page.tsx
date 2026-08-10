"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import { ClassifyProgress } from "@/components/flow/ClassifyProgress";
import { CoverageSurveyModal } from "@/components/flow/CoverageSurveyModal";
import { FileEditBoard } from "@/components/flow/FileEditBoard";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { DigitalLevelSection } from "@/components/flow/DigitalLevelSection";
import { PublicDataSection } from "@/components/flow/PublicDataSection";
import { WorkflowSection } from "@/components/flow/WorkflowSection";
import { RouteLoading } from "@/components/flow/RouteLoading";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { DIGITAL_LEVELS } from "@/data/rubric/meta";
import { api } from "@/lib/api";
import { BackIconButton, Button, Card, Icons, Input, Loader, Modal, Tag } from "@/components/ui";
import { waitForJudge } from "@/lib/judgeWait";

/**
 * S1 자료 정리 — 2단계 구성 (진단 플로우 개편 2차 · 작업 요청 v5)
 * 1단계: 진입과 동시에 분류를 시작하고(pending 전체, 파일 0건이면 생략) 순차 스텝 위저드로 진행.
 *   ① 자료 확인 — 분류 진행 로그 → 분류 결과가 반영된 필수 서류 충족/부족 검증.
 *     부족한 자료 목록은 카드 밖 우측 패널에 모아 표시(v5-2). 추가 업로드는 그 건만 바로 분류.
 *   ② 사용 중인 프로그램 — '다음'에 PATCH {systems} 저장 후 2단계로 전환.
 *   (사전 설문 스텝은 v5에서 삭제 — 설문은 판정 후 결측 문항에 대해 에이전트가 생성해
 *    진단 결과 화면의 보완 설문 카드로 대체된다)
 * 2단계 '자료 분류': 분류 결과 그리드·공개데이터·워크플로우.
 * 프로그램 선택을 마친 적 있는 진단(assessment.systems 비어 있지 않음)은 재방문으로 보고 2단계 직행.
 */

/** 1단계 위저드 스텝 이름 — 상단 단계 표시용 */
const REVIEW_STEP_LABELS = ["자료 확인", "사용 프로그램"];

/** 최초 진입 수집 로딩 문구 (기존 문구 유지) */
const COLLECT_MESSAGES = [
  "공개 데이터를 모으고 있어요",
  "올려주신 자료를 읽고 있어요",
  "업무 영역으로 나누고 있어요",
];

/** 제출 후 판정 로딩 문구 (기존 문구 유지) */
const CLASSIFY_MESSAGES = ["자료를 분석하고 있어요", "분석된 점수를 계산하고 있어요", "업무 영역을 상태를 정리하고 있어요"];

/* v5 — 제조기업 대표 사내 프로그램 예시 확장 (2026-08-05 사용자 승인). '없음'은 항상 마지막(배타 토글) */
const SYSTEM_OPTIONS = [
  "ERP(그룹웨어)",
  "MES",
  "WMS",
  "회계SW",
  "PLS/PLM",
  "POP",
  "CAD",
  "SCADA·PLC",
  "QMS",
  "없음",
];

/** 1단계 위저드 카드 — 랜딩 phase 카드와 같은 골격.
    v5-2: 상단 고정 — 내용 길이에 따라 카드가 상하로 튀지 않게 세로 중앙 정렬을 버린다 */
const reviewCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 680,
  position: "relative",
  padding: 40,
};

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
  const { user } = useAuth();
  /** 결과 분석 직전 로그인 요구 (v6-4) — 성공하면 곧바로 제출로 이어진다 */
  const [loginOpen, setLoginOpen] = useState(false);
  /** 분석 직전 보완 설문 (v7) — 결과가 나온 뒤 묻고 재분석하던 동선을 앞으로 당긴 것 */
  const [surveyOpen, setSurveyOpen] = useState(false);

  /** 1단계(자료 확인) / 2단계(자료 분류) — null은 판별 전 */
  const [stage, setStage] = useState<"review" | "classify" | null>(null);
  /** 1단계 내 순차 스텝 — ① 자료 확인 ② 사용 프로그램 (사전 설문 스텝은 v5 삭제) */
  const [reviewStep, setReviewStep] = useState<1 | 2>(1);
  const [files, setFiles] = useState<FileRow[] | null>(null);
  /** 파일 전체 보기 팝업 — 그리드에는 최대 9개만 보인다 */
  const [allFilesOpen, setAllFilesOpen] = useState(false);
  /** 자료 편집 칸반 보드 팝업 */
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** 자료 부족 경고 — 필수 서류가 하나도 없을 때 */
  const [shortage, setShortage] = useState<{ filled: number; total: number } | null>(null);
  /* 부족 문서 목록 복사 버튼 피드백 (v4-2) */
  const [copiedMissing, setCopiedMissing] = useState(false);
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
  /** 기타 프로그램 직접 입력 (수정요청v9) */
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherInput, setOtherInput] = useState("");
  /** 프로그램 저장 진행 중 */
  const [proceeding, setProceeding] = useState(false);

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

  /* ── 스텝 전환 — 프로그램 저장 실패는 진행을 막지 않는다 (기존 정책 유지) ── */

  /** 스텝 ② → 2단계: 사용 중인 프로그램 저장 후 자료 분류 화면으로 (사전 설문 스텝은 v5 삭제) */
  const proceedSystems = async () => {
    if (!assessmentId || proceeding) return;
    setProceeding(true);
    await api(`/api/assessments/${assessmentId}`, {
      method: "PATCH",
      body: JSON.stringify({ systems }),
    }).catch(() => {});
    setProceeding(false);
    setStage("classify");
  };

  /* 제출 전 점검 — 필수 서류가 하나도 없으면 점수를 낼 수 없다. 결과 화면에서 처음 알리지 않는다 (v9) */
  const checkThenSubmit = async () => {
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

  const requestSubmit = async () => {
    if (!assessmentId || submitting) return;
    /* 여기가 로그인 경계다 (v6-4) — 자료 분류까지는 익명 세션으로 왔고,
       결과를 만들려면 결과를 담을 계정이 있어야 한다. 로그인·가입에 성공하면
       서버가 지금까지의 진단을 그 계정으로 옮기고(auth.ts onLinkAccount) 그대로 이어진다. */
    if (!user || user.isAnonymous) {
      setLoginOpen(true);
      return;
    }
    /* 로그인 다음이 설문이다 (v7) — 자료로 못 채운 문항을 여기서 받아 첫 분석에 함께 넣는다.
       물을 게 없으면 모달이 스스로 통과시킨다 */
    setSurveyOpen(true);
  };

  /* 제출 → 판정 완료 폴링 → 진단 결과로 이동 */
  const submit = async () => {
    if (!assessmentId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/api/assessments/${assessmentId}/submit`, { method: "POST" });
      const outcome = await waitForJudge(assessmentId);
      if (outcome === "failed") throw new Error("분석에 실패했어요. 다시 시도해 주세요.");
      if (outcome === "timeout")
        throw new Error("분석이 예상보다 오래 걸려요. 잠시 후 마이페이지에서 결과를 확인해 주세요.");
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
  if (submitting)
    return (
      <RouteLoading
        messages={CLASSIFY_MESSAGES}
        /* 47문항 판정 + 영역 판정 + 종합 서사가 이어 도는 구간이다. 실측 2~3분(자료 33건 기준) */
        hint="약 5분 정도 소요될 수 있어요."
      />
    );

  /* ═══════════ 1단계 — 순차 스텝 위저드 (① 자료 확인 ② 사용 프로그램) ═══════════ */
  if (stage === "review") {
    /* 부족한 자료 — 카드 밖 우측 패널로 분리 (v5-2). 목록 복사로 사내 자료 요청에 바로 쓴다 */
    const missingDocs = requiredDocs?.items.filter((d) => d.files.length === 0) ?? [];
    const missingCopyText = [
      "부족한 필수 문서",
      ...missingDocs.map((d) => `- ${d.docTypeName}`),
    ].join("\n");
    return (
      /* v5-2: 카드 상단 고정 — 내용 길이가 바뀌어도 상하로 튀지 않게 위 정렬 유지 */
      <main className="min-h-[calc(100vh-56px)] bg-surface px-[var(--gutter)] py-12">
        <div className="mx-auto flex w-full max-w-[1000px] flex-col items-start justify-center gap-4 md:flex-row">
        <Card key={reviewStep} className="ax-step-enter" radius="2xl" style={reviewCardStyle}>
        {/* 뒤로 가기 — 카드 좌상단 (랜딩 카드와 같은 패턴) */}
        {reviewStep > 1 && (
          <BackIconButton
            label={`${REVIEW_STEP_LABELS[reviewStep - 2]}으로 돌아가기`}
            onClick={() => setReviewStep(1)}
          />
        )}
        {/* 단계 표시 — 랜딩 DotProgress 패턴의 축소판 (도트 + 스텝 이름) */}
        <div
          aria-label={`${REVIEW_STEP_LABELS.length}단계 중 ${reviewStep}단계`}
          className="flex items-center justify-center gap-4"
        >
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
            <h2 className="ax-heading mb-0 mt-4 text-center [font:var(--text-h3)] tracking-[var(--track-heading)] text-ink">
              자료 확인
            </h2>

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
                    {/* 분석 진행 문구 — 텍스트 자체 시머 (v5-1) */}
                    <TextShimmer style={{ font: "var(--text-label-s)" }}>
                      {`AI가 자료를 분류하고 있어요 (${doneCount}/${total})`}
                    </TextShimmer>
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

            {/* 필수 서류 현황 — 업무영역별로 묶어 무엇이 비었는지 바로 보이게 (수정요청v9)
                v5-2: 부족한 자료 목록·올리기 버튼은 카드 밖 우측 패널로 분리 (여기서는 현황만) */}
            {requiredDocs && requiredDocs.items.length > 0 && (
              <section className="mt-8 rounded-[var(--radius-l)] border border-line">
                <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
                  <span className="min-w-0 [font:var(--text-label-s)] text-ink">
                    필수 문서 {requiredDocs.filled}/{requiredDocs.total}
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
                            {done && (
                              <span className="flex-none truncate [font:var(--text-caption)] text-ink-4">
                                {d.files[0].name}
                              </span>
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
            <h2 className="ax-heading mb-0 mt-4 text-center [font:var(--text-h3)] tracking-[var(--track-heading)] text-ink">
              사용 중인 프로그램
            </h2>

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

        </Card>

        {/* ── 부족한 자료 — 카드 밖 우측 패널 (v5-2). 올리기는 여기서만 (중복 제거) ── */}
        {reviewStep === 1 && requiredDocs && requiredDocs.items.length > 0 && (
          <aside className="ax-step-enter w-full flex-none rounded-[var(--radius-2xl)] border border-line bg-[var(--bg-elevated)] md:sticky md:top-20 md:w-[280px]">
            <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
              <span className="[font:var(--text-label-s)] text-ink">
                부족한 자료 {missingDocs.length}종
              </span>
              {missingDocs.length > 0 && (
                <Button
                  variant="utility"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(missingCopyText).then(() => {
                      setCopiedMissing(true);
                      setTimeout(() => setCopiedMissing(false), 1500);
                    });
                  }}
                >
                  {copiedMissing ? "복사됨" : "목록 복사"}
                </Button>
              )}
            </div>
            <div className="ax-scrollbar-none max-h-[60vh] overflow-y-auto px-3.5 py-2">
              {missingDocs.length === 0 ? (
                <p className="m-0 py-2 [font:var(--text-caption)] text-ink-4">
                  필수 문서가 모두 올라왔어요.
                </p>
              ) : (
                missingDocs.map((d) => (
                  <div
                    key={d.docTypeId}
                    className="flex items-center gap-2 border-b border-line-subtle py-2 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate [font:var(--text-label-s)] text-ink">
                      {d.docTypeName}
                    </span>
                    <Button
                      variant="utility"
                      size="sm"
                      disabled={uploading}
                      onClick={() => handleUploadClick(d.docTypeId)}
                    >
                      올리기
                    </Button>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
        </div>
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
          {total === 0 ? (
            "올려주신 자료 없이 진행해요. 공개 데이터로 추정 진단해요."
          ) : classifying ? (
            /* 분석 진행 문구 — 텍스트 자체 시머 (v5-1) */
            <TextShimmer>{`AI가 자료를 분류하고 있어요 (${doneCount}/${total})`}</TextShimmer>
          ) : (
            `자료 ${total}건의 분류를 마쳤어요`
          )}
        </p>
      </header>

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

      {/* ── 디지털화 수준 — 도넛 + 문서 목록, 워크플로우 위 (작업 요청 v8 이슈④) ── */}
      {files && <DigitalLevelSection files={files} />}

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
          필수 문서 {shortage?.total ?? 0}종 중 올라온 자료가 없어요. 이대로 진단하면 점수를
          산출하지 못해요.
        </p>
        <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
          자료를 올리면 분석이 되고, 부족한 문항은 진단 결과에서 설문으로 보완할 수 있어요.
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

      {/* 결과 분석 직전 로그인 요구 (v6-4) — 여기까지의 진단은 로그인 성공 시 그 계정으로 넘어온다 */}
      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false);
          setSurveyOpen(true);
        }}
      />

      {/* 분석 직전 보완 설문 (v7) — 응답만 저장하고 곧바로 첫 분석으로 넘어간다(재분석 없음).
          팝업을 닫으면 분석은 시작하지 않는다 — 되돌아갈 길을 남긴다 */}
      <CoverageSurveyModal
        assessmentId={assessmentId}
        open={surveyOpen}
        phase="pre"
        onClose={() => setSurveyOpen(false)}
        onApplied={() => {
          setSurveyOpen(false);
          void checkThenSubmit();
        }}
      />

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
