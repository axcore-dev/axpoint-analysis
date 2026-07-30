"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import { useDiagnosis, type AttachedFileInfo } from "@/components/flow/DiagnosisContext";
import { api, API_URL } from "@/lib/api";
import {
  Autocomplete,
  BackIconButton,
  Button,
  Card,
  DotProgress,
  Icons,
  Loader,
  Modal,
  Tag,
  type AutocompleteItem,
} from "@/components/ui";

/**
 * S0 랜딩 — Hero 검색 + 3단계 확인 위저드 (수정요청v1 · v3)
 * phase: search(히어로) → confirm(기업 확인 1/3) → upload(자료 2/3) → systems(현황 3/3)
 * v3: 자동완성은 Autocomplete 컴포넌트, 업로드는 1회 일괄 첨부,
 *     프로그램·관심 영역 모두 선택해야 진단 시작 가능
 */

type Phase = "search" | "confirm" | "upload" | "systems";

const SYSTEM_OPTIONS = ["ERP", "MES", "WMS", "회계SW", "없음"];

/** 플레이스홀더 타이핑 애니메이션 문구 */
const TYPING_PHRASES = ["(주)데모기업", "123-45-67890"];
const STATIC_PLACEHOLDER = "기업명 또는 사업자번호";

/** 올리면 좋은 서류 — 업로드 존에 칩으로 강조 (v3 개선) */
const DOC_HINTS = ["생산일지", "발주서", "재고표", "검사성적서"];

type SearchHit = {
  id: string | null;
  name: string;
  bizNo: string | null;
  region: string | null;
  industry: string | null;
  estDate: string | null;
  address: string | null;
  source: string;
};

/** 사업자번호 표기 — 000-00-00000 */
const fmtBizNo = (b: string) => `${b.slice(0, 3)}-${b.slice(3, 5)}-${b.slice(5)}`;

/** 자동완성 상세줄 — 지역 · 업종 · 설립연도 (없으면 주소로 대체) */
const hitDetail = (it: SearchHit) => {
  const parts = [it.region, it.industry, it.estDate ? `설립 ${it.estDate.slice(0, 4)}` : null].filter(
    Boolean,
  );
  return parts.length > 0 ? parts.join(" · ") : (it.address ?? "");
};

const stepCardStyle: CSSProperties = {
  width: "100%",
  /* 카드 사이즈 확대 (v5: 더 키움): 572 → 640, 패딩 40 */
  maxWidth: 640,
  position: "relative",
  /* 중앙보다 위로 — v5: 15% 추가 상향 */
  top: "calc(-28px - 10vh)",
  padding: 40,
  /* margin auto — 카드가 뷰포트보다 길어져도 위가 잘리지 않는 중앙 정렬 (v4) */
  margin: "auto",
};

const cardHeadingStyle: CSSProperties = {
  margin: "16px 0 0",
  font: "var(--text-h3)",
  letterSpacing: "var(--track-heading)",
  color: "var(--fg-primary)",
  textAlign: "center",
};

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    companyInput,
    companyId,
    assessmentId,
    attachedFiles,
    systems,
    update,
    completeStep,
  } = useDiagnosis();

  const [phase, setPhase] = useState<Phase>("search");
  const [loginOpen, setLoginOpen] = useState(false);
  const [company, setCompany] = useState("");
  /** 포커스가 한 번이라도 닿으면 타이핑 애니메이션 종료 */
  const [touched, setTouched] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  /** 업로드 판독 로딩 — 완료 시 파일을 첨부 목록에 합침 (v6 개편) */
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 자동완성 — 백엔드 검색(디렉터리+비즈노) 결과 */
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  /** 검색 결과의 기업명 → 사업자번호 (기업 확인 단계의 국세청 검증에 사용) */
  const bizNoByName = useRef<Map<string, string>>(new Map());
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  /** 검증 결과 팝업 — 차단(폐업·미등록)이면 blocked, 국세청 조회 실패면 unchecked (v9) */
  const [verifyNotice, setVerifyNotice] = useState<
    { kind: "blocked" | "unchecked"; message: string } | null
  >(null);
  /** 기업 확인 카드용 — 사업자번호로 검색해도 기업명을 조회해 표시한다 */
  const [resolved, setResolved] = useState<{ name: string; bizNo: string | null } | null>(null);

  /* 기업 확인 진입 시 기업명·사업자번호 해석 — 번호로 검색했으면 이름을 찾아온다 */
  useEffect(() => {
    if (phase !== "confirm") return;
    const input = company.trim();
    const raw = input.replace(/\D/g, "");
    const isBizNo = raw.length === 10;
    setResolved(null);
    let cancelled = false;
    (async () => {
      try {
        const { items } = await api<{ items: SearchHit[] }>(
          `/api/companies/search?q=${encodeURIComponent(input)}`,
        );
        const hit = isBizNo
          ? (items.find((it) => it.bizNo === raw) ?? items[0])
          : (items.find((it) => it.name === input) ?? items[0]);
        if (cancelled) return;
        if (hit) setResolved({ name: hit.name, bizNo: hit.bizNo });
        else setResolved({ name: isBizNo ? "" : input, bizNo: isBizNo ? raw : (bizNoByName.current.get(input) ?? null) });
      } catch {
        if (!cancelled)
          setResolved({ name: isBizNo ? "" : input, bizNo: isBizNo ? raw : (bizNoByName.current.get(input) ?? null) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, company]);

  /* 뒤로 돌아왔을 때 진행 중 입력값 복원 */
  useEffect(() => {
    if (companyInput) setCompany((prev) => (prev === "" ? companyInput : prev));
  }, [companyInput]);

  const idle = company.length === 0;

  /* 플레이스홀더 타이핑 애니메이션 — 비어 있고 포커스 전일 때만.
     setTimeout 체인으로 한 글자씩 타이핑 → 대기 → 지우기 → 다음 문구. */
  useEffect(() => {
    if (phase !== "search") return;
    if (touched || !idle) {
      setPlaceholder(STATIC_PLACEHOLDER);
      return;
    }
    let phraseIdx = 0;
    let charIdx = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const phrase = TYPING_PHRASES[phraseIdx];
      if (!deleting) {
        charIdx += 1;
        setPlaceholder(phrase.slice(0, charIdx) + "|");
        if (charIdx >= phrase.length) {
          deleting = true;
          timer = setTimeout(tick, 1500); // 다 쓴 뒤 잠시 머무름
          return;
        }
        timer = setTimeout(tick, 110);
      } else {
        charIdx -= 1;
        setPlaceholder(phrase.slice(0, charIdx) + "|");
        if (charIdx <= 0) {
          deleting = false;
          phraseIdx = (phraseIdx + 1) % TYPING_PHRASES.length;
          timer = setTimeout(tick, 450);
          return;
        }
        timer = setTimeout(tick, 55);
      }
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [phase, touched, idle]);

  /* 자동완성 — 입력 후 300ms 디바운스로 백엔드 검색 (검색 API는 공개, 오류는 빈 목록) */
  useEffect(() => {
    const q = company.trim();
    if (phase !== "search" || !q) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { items } = await api<{ items: SearchHit[] }>(
          `/api/companies/search?q=${encodeURIComponent(q)}`,
        );
        for (const it of items) if (it.bizNo) bizNoByName.current.set(it.name, it.bizNo);
        setSuggestions(
          items.map((it) => ({
            value: it.name,
            badge: it.bizNo ? fmtBizNo(it.bizNo) : undefined,
            detail: hitDetail(it),
          })),
        );
      } catch {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [company, phase]);

  /** 실제 업로드 — MinIO 저장 + 분류 큐 등록. 거부된 파일은 목록에서 제외 */
  const startUpload = async (files: File[]) => {
    if (!assessmentId || files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      const res = await fetch(`${API_URL}/api/assessments/${assessmentId}/files`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const body = (await res.json()) as {
        saved?: { id: string; name: string }[];
        rejected?: { name: string; reason: string }[];
        error?: string;
      };
      const added: AttachedFileInfo[] = (body.saved ?? []).map((s) => ({
        key: s.id,
        name: s.name,
        type: (s.name.split(".").pop() ?? "").toUpperCase(),
      }));
      update({ attachedFiles: [...attachedFiles, ...added] });
    } finally {
      setUploading(false);
    }
  };

  /** 첨부 파일 삭제 (v3 개선) — 서버 원본도 함께 삭제 */
  const removeDoc = async (key: string) => {
    update({ attachedFiles: attachedFiles.filter((f) => f.key !== key) });
    try {
      await api(`/api/files/${key}`, { method: "DELETE" });
    } catch {
      /* 이미 삭제된 경우 등 — 목록에서 이미 제거됨 */
    }
  };

  const canSubmit = company.trim().length >= 1;

  const submitSearch = () => {
    if (!canSubmit) return;
    /* 검색 기업을 즉시 저장 — 로그인 왕복에도 기업 확인 단계로 그대로 전달 (v6 버그 수정) */
    update({ companyInput: company.trim() });
    if (!user) {
      setLoginOpen(true); // 검색 입력값은 state에 그대로 보존
      return;
    }
    setPhase("confirm");
  };

  /** 예상 검색어 선택 → 입력값 채우고 동일 제출 흐름(로그인 체크) */
  const pickSuggestion = (value: string) => {
    setCompany(value);
    update({ companyInput: value.trim() });
    if (!user) {
      setLoginOpen(true);
      return;
    }
    setPhase("confirm");
  };

  /** 업로드 존 클릭 → 실제 파일 선택 (v6) */
  const handleUploadClick = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  /** 파일 선택 완료 → 서버 업로드 */
  const onFilesPicked = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    void startUpload(files);
  };

  /** 기업 확인 → 국세청 검증 + 진단 세션 생성 후 다음 단계 */
  const confirmCompany = async () => {
    if (verifying) return;
    const bizNo = resolved?.bizNo ?? null;
    const name = resolved?.name || company.trim();
    if (!bizNo) {
      setVerifyError("사업자번호를 확인할 수 없어요. 검색 결과에서 기업을 선택하거나 사업자번호로 검색해 주세요.");
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await api<{
        verified: boolean;
        ntsChecked?: boolean;
        reason?: string;
        company?: { id: string; name: string };
      }>("/api/companies/verify", {
        method: "POST",
        body: JSON.stringify({ bizNo, name }),
      });
      if (!res.verified || !res.company) {
        /* 미등록·폐업 — 진단을 진행하지 않는다 (v9) */
        setVerifyNotice({
          kind: "blocked",
          message: res.reason ?? "기업 확인에 실패했어요.",
        });
        return;
      }
      /* 국세청 조회가 안 된 경우 — 확인 보류로 알리고 진단은 계속한다 (v9) */
      if (res.ntsChecked === false) {
        setVerifyNotice({
          kind: "unchecked",
          message: "국세청 확인이 지금 안 돼요. 확인은 나중에 다시 하고, 진단은 이어서 진행해요.",
        });
      }
      // 이미 만든 진단이 있으면 재사용, 없으면 생성
      let aid = assessmentId;
      if (!aid || companyId !== res.company.id) {
        const created = await api<{ assessment: { id: string } }>("/api/assessments", {
          method: "POST",
          body: JSON.stringify({ companyId: res.company.id }),
        });
        aid = created.assessment.id;
      }
      update({ companyId: res.company.id, assessmentId: aid, companyInput: res.company.name });
      setPhase("upload");
    } catch (e) {
      setVerifyNotice({
        kind: "blocked",
        message: e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.",
      });
    } finally {
      setVerifying(false);
    }
  };

  /** '없음'은 배타 선택 — 없음을 고르면 나머지 해제, 다른 걸 고르면 없음 해제 */
  const toggleSystem = (name: string) => {
    if (systems.includes(name)) {
      update({ systems: systems.filter((s) => s !== name) });
      return;
    }
    update({
      systems: name === "없음" ? ["없음"] : [...systems.filter((s) => s !== "없음"), name],
    });
  };

  const startDiagnosis = async () => {
    if (assessmentId) {
      try {
        await api(`/api/assessments/${assessmentId}`, {
          method: "PATCH",
          body: JSON.stringify({ systems, completedSteps: ["landing"] }),
        });
      } catch {
        /* 저장 실패해도 진행 — 다음 단계에서 재시도 가능 */
      }
    }
    completeStep("landing");
    router.push("/collect");
  };

  /* 사용 중인 프로그램을 골라야 진단 시작 (관심 영역은 삭제 확정 — 작업 요청v2) */
  const canStart = systems.length > 0;

  return (
    <div className="axp-landing flex min-h-[calc(100vh-56px)] flex-col bg-surface px-[var(--gutter)] py-12">
      {/* 자료 올리기 페이지 한정 타이포 20% 확대 — 페이지 스코프 토큰 재정의 (v7: +2px) */}
      <style>{`
        .axp-landing {
          --text-display2: 700 50px/1.2 var(--font-sans);
          --text-h2: 700 31px/1.3 var(--font-sans);
          --text-h3: 700 28px/1.3 var(--font-sans);
          --text-body1: 400 22px/1.55 var(--font-sans);
          --text-body2: 400 20px/1.55 var(--font-sans);
          --text-body3: 400 18px/1.5 var(--font-sans);
          --text-label-m: 600 20px/1.25 var(--font-sans);
          --text-label-s: 600 18px/1.25 var(--font-sans);
          --text-caption: 500 16px/1.4 var(--font-sans);
        }
      `}</style>
      {/* ─── phase: search — 검색바가 수직 중앙, 헤드라인은 그 위에 부착 ── */}
      {phase === "search" && (
        <div key="search" className="ax-step-enter relative m-auto w-full max-w-[640px]">
          <div className="absolute bottom-full left-1/2 mb-10 flex w-max max-w-[calc(100vw-48px)] -translate-x-1/2 flex-col items-center text-center">
            <h1 className="flex-col ax-heading mt-4 [font:var(--text-display2)] tracking-[var(--track-display)] text-ink">
              제조 AX 첫걸음, AX<b className="text-brand">point</b>
            </h1>
            <p className="mt-3 [font:var(--text-body1)] tracking-[var(--track-body)] text-ink-3">
              조사·분석·진단·설계까지, One-stop 맞춤형 솔루션
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            className="relative w-full"
          >
            <Autocomplete
              value={company}
              onValueChange={setCompany}
              onSelect={pickSuggestion}
              /* v6: 입력 전에는 드롭다운 미노출. 목록은 백엔드 검색(디렉터리+비즈노) 결과 */
              items={company.trim() ? suggestions : []}
              placeholder={placeholder}
              aria-label="기업명 또는 사업자번호"
              onFocus={() => setTouched(true)}
              leading={<Icons.search size={22} />}
              fieldClassName="ax-field--pill"
              fieldStyle={{ height: 66, paddingLeft: 26, paddingRight: 9, gap: 12 }}
              inputStyle={{ fontSize: 19 }}
              trailing={
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={!canSubmit}
                  aria-label="진단 시작"
                  style={{ borderRadius: "var(--radius-full)", flex: "none", height: 50 }}
                >
                  진단 시작
                  <Icons.arrow size={16} />
                </Button>
              }
            />
          </form>
        </div>
      )}

      {/* ─── phase: confirm — 기업 확인 (1/3) ─────────────── */}
      {phase === "confirm" && (
        <Card key="confirm" className="ax-step-enter" radius="2xl" style={stepCardStyle}>
          <BackIconButton label="검색으로 돌아가기" onClick={() => setPhase("search")} />
          <DotProgress step={1} total={3} />
          <h2 style={cardHeadingStyle}>이 기업이 맞나요?</h2>
          <div style={{ textAlign: "center", margin: "24px 0 0" }}>
            <div
              style={{
                font: "var(--text-h2)",
                letterSpacing: "var(--track-heading)",
                color: "var(--fg-primary)",
                overflowWrap: "anywhere",
              }}
            >
              {/* 기업명 우선 표시 — 사업자번호로 검색해도 조회된 기업명을 보여준다 */}
              {resolved === null ? "…" : resolved.name || company.trim()}
            </div>
            <div
              style={{
                margin: "8px 0 0",
                font: "var(--text-body2)",
                color: "var(--fg-tertiary)",
              }}
            >
              {resolved?.bizNo ? `사업자번호 ${fmtBizNo(resolved.bizNo)}` : ""}
            </div>
            {verifyError && (
              <p
                style={{
                  margin: "12px 0 0",
                  font: "var(--text-caption)",
                  color: "var(--fg-danger, #d4380d)",
                }}
              >
                {verifyError}
              </p>
            )}
            {/* 검증 중 — 배경을 살짝 덮어 조작을 막고 진행 중임을 보인다 (v9) */}
            {verifying && (
              <div
                aria-live="polite"
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 60,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  background: "rgba(25,31,40,0.28)",
                  backdropFilter: "blur(1.5px)",
                }}
              >
                <Loader />
                <span style={{ font: "var(--text-label-s)", color: "var(--white)" }}>
                  사업자 정보를 확인하고 있어요
                </span>
              </div>
            )}
          </div>
          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 8 }}>
            <Button variant="primary" size="lg" full disabled={verifying} onClick={confirmCompany}>
              {verifying ? "확인하고 있어요" : "맞아요, 계속할게요"}
            </Button>
            <Button variant="ghost" size="md" full onClick={() => setPhase("search")}>
              다시 검색
            </Button>
          </div>
        </Card>
      )}

      {/* ─── phase: upload — 자료 올리기 (2/3) ────────────── */}
      {phase === "upload" && (
        <Card key="upload" className="ax-step-enter" radius="2xl" style={stepCardStyle}>
          <BackIconButton label="기업 확인으로 돌아가기" onClick={() => setPhase("confirm")} />
          <DotProgress step={2} total={3} />
          <h2 className="ax-heading mt-4 text-center [font:var(--text-h3)] tracking-[var(--track-heading)] text-ink">
            <b>현장 서류</b>를 올려주세요
          </h2>
          <p className="mt-2 text-center [font:var(--text-body2)] tracking-[var(--track-body)] text-ink-3">
            자료를 올릴수록 진단이 더 정확해져요
          </p>

          <div className="mt-6">
            {/* 실제 파일 업로드 input — 업로드 존 클릭으로 열림 (v6) */}
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
            {/* 업로드 존 — 업로드 후에도 남아 추가 업로드 가능 */}
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading}
              aria-label="자료 올리기"
              className="box-border w-full cursor-pointer rounded-[var(--radius-l)] border-[1.5px] border-dashed border-[var(--grey-300)] bg-surface-2 px-4 py-7 text-center font-[family-name:var(--font-sans)] transition-colors duration-[var(--dur-base)] hover:border-line-strong hover:bg-surface-3 disabled:cursor-default disabled:hover:border-[var(--grey-300)] disabled:hover:bg-surface-2"
            >
              {uploading ? (
                <span className="flex min-h-[124px] flex-col items-center justify-center gap-3 text-ink-2">
                  <Loader style={{ color: "var(--fg-brand)" }} />
                  <span className="[font:var(--text-body2)]">자료를 읽고 있어요</span>
                </span>
              ) : (
                <span className="flex flex-col items-center gap-3.5">
                  <span className="flex size-11 items-center justify-center rounded-[var(--radius-m)] border border-line bg-surface text-ink-2 shadow-[var(--shadow-1)]">
                    <Icons.upload size={20} />
                  </span>
                  <span className="[font:var(--text-label-m)] text-ink">
                    파일 업로드, 또는 가져다 놓기
                  </span>
                  {/* 올리면 좋은 서류 — 칩으로 강조 (v3 개선) */}
                  <span className="flex flex-wrap items-center justify-center gap-1.5">
                    {DOC_HINTS.map((hint) => (
                      <span
                        key={hint}
                        className="inline-flex items-center rounded-[var(--radius-full)] border border-line bg-surface px-2.5 py-1 [font:var(--text-label-s)] text-ink-2"
                      >
                        {hint}
                      </span>
                    ))}
                  </span>
                  <span className="[font:var(--text-caption)] text-ink-4">
                    PDF · 엑셀(xlsx) · 사진(jpg/png) · 한글(hwp)/워드(docx)
                  </span>
                </span>
              )}
            </button>

            {/* 업로드된 파일 리스트 — 콤팩트 행 + 파일별 삭제 (v3 개선) */}
            {attachedFiles.length > 0 && (
              <ul className="ax-scrollbar-none mt-3 flex max-h-[236px] list-none flex-col gap-1 overflow-y-auto">
                {attachedFiles.map((f) => (
                  <li
                    key={f.key}
                    className="flex items-center gap-2.5 rounded-[var(--radius-s)] border border-line bg-surface py-1.5 pl-3 pr-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-left [font:var(--text-label-s)] text-ink">
                      {f.name}
                    </span>
                    <span className="flex-none [font:var(--text-caption)] text-ink-4">
                      {f.type}
                    </span>
                    <button
                      type="button"
                      aria-label={`${f.name} 삭제`}
                      onClick={() => removeDoc(f.key)}
                      className="inline-flex flex-none cursor-pointer items-center justify-center rounded-[var(--radius-xs)] border-0 bg-transparent p-1 text-ink-4 transition-colors duration-[var(--dur-fast)] hover:bg-[var(--hover-overlay)] hover:text-ink-2"
                    >
                      <Icons.x size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              full
              disabled={attachedFiles.length === 0}
              onClick={() => setPhase("systems")}
            >
              다음
            </Button>
            {attachedFiles.length === 0 && (
              <Button
                variant="ghost"
                size="md"
                full
                disabled={uploading}
                onClick={() => setPhase("systems")}
              >
                자료 없이 진행
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* ─── phase: systems — 시스템·관심 영역 (3/3) ──────── */}
      {phase === "systems" && (
        <Card key="systems" className="ax-step-enter" radius="2xl" style={stepCardStyle}>
          <BackIconButton label="자료 올리기로 돌아가기" onClick={() => setPhase("upload")} />
          <DotProgress step={3} total={3} />
          <h2 className="ax-heading" style={cardHeadingStyle}>
            <b>사용 중인 프로그램</b>을 골라주세요
          </h2>

          <div style={{ marginTop: 24 }}>
            <div
              style={{
                font: "var(--text-label-s)",
                color: "var(--fg-secondary)",
                marginBottom: 10,
              }}
            >
              사용 중인 프로그램
            </div>
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
            </div>

          </div>

          <div className="mt-7 flex flex-col gap-2">
            <Button variant="primary" size="xl" full disabled={!canStart} onClick={startDiagnosis}>
              진단 시작하기
              <Icons.arrow size={17} />
            </Button>
          </div>
        </Card>
      )}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false);
          setPhase("confirm");
        }}
      />

      {/* 기업 확인 결과 팝업 — 차단은 검색으로 되돌리고, 확인 보류는 그대로 다음 단계로 (v9) */}
      <Modal
        open={verifyNotice !== null}
        onClose={() => setVerifyNotice(null)}
        title={verifyNotice?.kind === "blocked" ? "진단을 진행할 수 없어요" : "국세청 확인 보류"}
      >
        <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
          {verifyNotice?.message}
        </p>
        <div style={{ marginTop: 20 }}>
          {verifyNotice?.kind === "blocked" ? (
            <Button
              variant="primary"
              full
              onClick={() => {
                setVerifyNotice(null);
                setPhase("search");
              }}
            >
              다시 검색
            </Button>
          ) : (
            <Button variant="primary" full onClick={() => setVerifyNotice(null)}>
              계속하기
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
