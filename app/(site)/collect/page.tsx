"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { PublicDataSection } from "@/components/flow/PublicDataSection";
import { WorkflowSection } from "@/components/flow/WorkflowSection";
import { RouteLoading } from "@/components/flow/RouteLoading";
import { DIGITAL_LEVELS } from "@/data/rubric/meta";
import { api } from "@/lib/api";
import { Button, Card, Icons, Loader, Modal } from "@/components/ui";
import { waitForJudge } from "@/lib/judgeWait";

/**
 * S1 자료 정리 — 백엔드 실연동 + 원본 분류 그리드 레이아웃 복원.
 * 업로드 문서의 AI 분류 진행 현황을 폴링으로 그리드에 보여주고, 분류가 끝나면 제출(판정 시작).
 * 확정 개편 반영: 문서 확인(HITL 질문) 삭제, 설문은 결측 문항 발생 시에만 발행(현재 시드 전),
 * 공개 데이터 그리드·워크플로우 비교는 해당 백엔드 데이터 확정 후 재도입.
 */

/** 최초 진입 수집 로딩 문구 (기존 문구 유지) */
const COLLECT_MESSAGES = [
  "공개 데이터를 모으고 있어요",
  "올려주신 자료를 읽고 있어요",
  "8대 영역으로 나누고 있어요",
  "개인 정보를 가리고 있어요",
];

/** 제출 후 판정 로딩 문구 (기존 문구 유지) */
const CLASSIFY_MESSAGES = ["자료를 분석하고 있어요", "분석된 점수를 계산하고 있어요", "업무 영역을 상태를 정리하고 있어요"];

type FileRow = {
  id: string;
  name: string;
  status: string | null; // pending / processing / done / failed / unclassified
  docTypeName: string | null;
  digitalLevel: number | null;
  confidence: number | null;
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
  const { companyInput, assessmentId, completedSteps, completeStep } = useDiagnosis();

  const [booting, setBooting] = useState(!completedSteps.includes("collect"));
  const [files, setFiles] = useState<FileRow[] | null>(null);
  /** 파일 전체 보기 팝업 — 그리드에는 최대 9개만 보인다 */
  const [allFilesOpen, setAllFilesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** 자료 부족 경고 — 필수 서류가 하나도 없을 때 */
  const [shortage, setShortage] = useState<{ filled: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* 최초 진입 수집 연출 로딩 (재방문 시 생략 — 기존 정책 유지) */
  useEffect(() => {
    if (!booting) return;
    const t = setTimeout(() => setBooting(false), 4200);
    return () => clearTimeout(t);
  }, [booting]);

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

  useEffect(() => {
    if (!assessmentId) return;
    void fetchFiles();
    pollTimer.current = setInterval(fetchFiles, 3000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [assessmentId, fetchFiles]);

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

  const total = files?.length ?? 0;
  const doneCount =
    files?.filter((f) => f.status && f.status !== "pending" && f.status !== "processing").length ??
    0;
  const classifying = total > 0 && doneCount < total;

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

  if (booting) return <RouteLoading title={companyInput} messages={COLLECT_MESSAGES} />;
  if (submitting) return <RouteLoading messages={CLASSIFY_MESSAGES} />;


  return (
    <main className="ax-step-enter mx-auto max-w-[980px] px-6 pb-24 pt-8">
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

      {/* ── 파일별 분류 결과 그리드 — 최대 9개, 나머지는 팝업으로 (문서유형·디지털화 수준·진행 상태) ── */}
      {files && files.length > 0 && (
        <section className="mt-10">
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
        </section>
      )}

      {/* ── 공개 데이터 수집 — 진입 시 수집 시작, 진행률은 SSE (수정요청v9·v10) ── */}
      {assessmentId && <PublicDataSection assessmentId={assessmentId} />}

      {/* ── 워크플로우 — 표준 정의 전까지 접힌 데모 ── */}
      <WorkflowSection />

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
