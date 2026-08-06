"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { useDiagnosis, type AttachedFileInfo } from "@/components/flow/DiagnosisContext";
import { TextShimmer } from "@/components/ui/text-shimmer";
import { api, API_URL } from "@/lib/api";
import {
  Autocomplete,
  BackIconButton,
  Badge,
  Button,
  Card,
  DotProgress,
  Icons,
  Loader,
  Modal,
} from "@/components/ui";

/**
 * S0 랜딩 — Hero 검색 + 2단계 확인 위저드 (진단 플로우 개편 1차)
 * phase: search(히어로) → confirm(기업 확인 1/2) → upload(자료 2/2)
 * 개편: 업로드는 '모두 올리기' 단순 드롭존으로 원복, AI 분류는 자료 정리(collect)에서 시작.
 * 사용 중인 프로그램 질문은 collect의 '자료 확인' 단계로 이동.
 */

type Phase = "search" | "confirm" | "upload";

/** 플레이스홀더 타이핑 애니메이션 문구 (수정요청v9) */
const TYPING_PHRASES = ["(주)에이엑스코어", "123-45-67890"];
const STATIC_PLACEHOLDER = "기업명 또는 사업자번호";

/** 올리면 좋은 서류 — 드롭존에 칩으로 강조 (v5-1: 개별 서류명 나열 → 사내 문서 통칭) */
const DOC_HINTS = ["사내 문서(사무, 공정 등)"];

/** 필수 문서 현황 — 업로드 단계 우측 패널이 쓴다 (자료 정리 화면과 같은 API) */
type RequiredDocs = {
  items: { docTypeId: number; docTypeName: string; groupName: string; files: { fileId: string }[] }[];
  filled: number;
  total: number;
};

type SearchHit = {
  name: string;
  bizNo: string;
  corpRegNo: string | null; // 법인등록번호 — 동명 기업 구분용
  statusCode: string | null; // 01 계속 / 02 휴업 / 그 외·null 미확인 (폐업은 서버가 제외)
  status: string | null;
  /** DART에 같은 사업자번호로 등록된 기업 — 공시·재무를 받아올 수 있다는 뜻 */
  dart: boolean;
  region: string | null; // 시·도 + 시·군·구
};

/** 법인등록번호 표기 — 000000-0000000 */
const fmtCorpRegNo = (v: string) => (v.length === 13 ? `${v.slice(0, 6)}-${v.slice(6)}` : v);

/** 사업자번호 표기 — 000-00-00000 */
const fmtBizNo = (b: string) => `${b.slice(0, 3)}-${b.slice(3, 5)}-${b.slice(5)}`;

/**
 * 입력 중 사업자번호 형식 맞추기 (수정요청v9) — 숫자·하이픈만 입력했을 때 000-00-00000으로.
 * 기업명(한글·영문)이 섞이면 그대로 둔다.
 */
function fmtBizNoInput(raw: string): string {
  if (!/^[\d-]+$/.test(raw)) return raw;
  const d = raw.replace(/\D/g, "").slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5)].filter(Boolean).join("-");
}

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
  const { ensureSession } = useAuth();
  const {
    companyInput,
    companyId,
    assessmentId,
    attachedFiles,
    update,
    completeStep,
  } = useDiagnosis();

  const [phase, setPhase] = useState<Phase>("search");
  const [company, setCompany] = useState("");
  /** 포커스가 한 번이라도 닿으면 타이핑 애니메이션 종료 */
  const [touched, setTouched] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  /** 업로드 판독 로딩 — 완료 시 파일을 첨부 목록에 합침 (v6 개편) */
  const [uploading, setUploading] = useState(false);
  /** 업로드 전송 진행률(0~100) — 전송 중일 때만 값이 있다 */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** 검색 결과 — 사용자가 검색을 실행했을 때만 채워진다 (null = 아직 검색 전) */
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  /** 목록에서 고른 기업 — 확인 단계는 이 값만 쓴다(재조회 없음) */
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  /** 업로드 실패·거부 안내 */
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** 검증 결과 팝업 — 차단(폐업·미등록)이면 blocked, 국세청 조회 실패면 unchecked (v9) */
  const [verifyNotice, setVerifyNotice] = useState<
    { kind: "blocked" | "unchecked"; message: string } | null
  >(null);
  /** 필요한 자료 목록 — 업로드 단계 우측 패널. 무엇을 모아야 하는지 먼저 보여준다 */
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocs | null>(null);
  const [copiedDocs, setCopiedDocs] = useState(false);

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

  /* 검색은 사용자가 실행할 때만 나간다 — 타이핑마다 외부 API를 부르지 않는다 */
  const runSearch = async () => {
    const q = company.trim();
    if (q.length < 2 || searching) return;
    setSearching(true);
    setSearchError(null);
    setResults(null);
    update({ companyInput: q });
    try {
      const { items } = await api<{ items: SearchHit[] }>(
        `/api/companies/search?q=${encodeURIComponent(q)}`,
      );
      setResults(items);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "검색에 실패했어요.");
    } finally {
      setSearching(false);
    }
  };

  /* 목록에서 기업 선택 → 기업 확인 단계로. 로그인은 여기서 묻지 않는다 (v6-4) —
     자료 분류까지는 익명 세션으로 진행하고, 결과 분석을 누를 때 로그인을 요구한다.
     세션 발급이 실패하면 다음 단계의 진단 생성이 401로 막히므로 그때 안내가 뜬다. */
  const pickCompany = (hit: SearchHit) => {
    setSelected(hit);
    setCompany(hit.name);
    update({ companyInput: hit.name });
    void ensureSession().catch(() => {});
    setPhase("confirm");
  };

  /** 실제 업로드 — MinIO 저장만 한다. AI 분류는 자료 정리(collect)에서 시작. 거부된 파일은 목록에서 제외 */
  const startUpload = async (files: File[]) => {
    if (!assessmentId || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      /* fetch는 업로드 진행률을 주지 않는다 — XHR upload.onprogress로 프로그레스바를 채운다 */
      const { ok, body } = await new Promise<{
        ok: boolean;
        body: {
          saved?: { id: string; name: string }[];
          rejected?: { name: string; reason: string }[];
          error?: string;
        };
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_URL}/api/assessments/${assessmentId}/files`);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          let parsed = {};
          try {
            parsed = JSON.parse(xhr.responseText || "{}");
          } catch {
            /* 본문이 JSON이 아니면 빈 응답으로 처리 */
          }
          resolve({ ok: xhr.status >= 200 && xhr.status < 300, body: parsed });
        };
        xhr.onerror = () => reject(new Error("network"));
        xhr.send(form);
      });
      const added: AttachedFileInfo[] = (body.saved ?? []).map((s) => ({
        key: s.id,
        name: s.name,
        type: (s.name.split(".").pop() ?? "").toUpperCase(),
      }));
      if (added.length > 0) update((s) => ({ attachedFiles: [...s.attachedFiles, ...added] }));

      /* 올라가지 못한 파일은 반드시 알린다 — 조용히 빠지면 부족한 줄 모르고 제출한다 */
      const rejected = body.rejected ?? [];
      if (rejected.length > 0) {
        /* 사유가 있으면 사유를 그대로 — 왜 빠졌는지 알아야 다시 올릴 수 있다 */
        setUploadError(rejected.map((r) => `${r.name} — ${r.reason}`).join(" / "));
      } else if (!ok && added.length === 0) {
        setUploadError(body.error ?? "파일을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setUploadError("파일을 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  /** 첨부 파일 삭제 (v3 개선) — 서버 원본도 함께 삭제 */
  const removeDoc = async (key: string) => {
    update((s) => ({ attachedFiles: s.attachedFiles.filter((f) => f.key !== key) }));
    try {
      await api(`/api/files/${key}`, { method: "DELETE" });
    } catch {
      /* 이미 삭제된 경우 등 — 목록에서 이미 제거됨 */
    }
  };

  /* 다시 검색 — 입력창·자동완성 후보를 비우고 처음 상태로 돌린다.
     이전 검색어가 남아 있으면 새 기업을 찾는 흐름에서 그대로 확정돼 버린다 */
  const backToSearch = () => {
    setCompany("");
    setResults(null);
    setSelected(null);
    setSearchError(null);
    setVerifyError(null);
    update({ companyInput: "" });
    setPhase("search");
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
    if (!selected) {
      setVerifyNotice({ kind: "blocked", message: "검색 결과에서 기업을 선택해 주세요." });
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      /* 상호는 보내지 않는다 — 서버가 사업자번호로 다시 확인해 정한다 */
      const res = await api<{
        confirmed: boolean;
        reason?: string;
        company?: { id: string; name: string };
      }>("/api/companies/confirm", {
        method: "POST",
        body: JSON.stringify({ bizNo: selected.bizNo }),
      });
      if (!res.confirmed || !res.company) {
        setVerifyNotice({ kind: "blocked", message: res.reason ?? "기업 확인에 실패했어요." });
        return;
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

  /** 업로드 완료 → 자료 정리(collect)로 — 분류·프로그램 질문·설문은 거기서 이어진다 */
  const goCollect = () => {
    completeStep("landing");
    router.push("/collect");
  };

  /* 업로드 단계에 들어오면 필요한 자료 목록을 받아 우측에 띄운다.
     이 시점에는 분류가 돌기 전이라 충족 여부는 알 수 없다 — '무엇을 모아야 하는가'를 보여주는 목록이다.
     (충족/부족 검증은 자료 정리 화면에서 분류가 끝난 뒤에 한다) */
  useEffect(() => {
    if (phase !== "upload" || !assessmentId || requiredDocs) return;
    let cancelled = false;
    api<RequiredDocs>(`/api/assessments/${assessmentId}/required-docs`)
      .then((res) => {
        if (!cancelled) setRequiredDocs(res);
      })
      .catch(() => {
        /* 목록을 못 받아도 업로드는 그대로 진행한다 — 패널만 뜨지 않는다 */
      });
    return () => {
      cancelled = true;
    };
  }, [phase, assessmentId, requiredDocs]);

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
              제조 <b className="text-brand">AX</b>를 위한 <b className="text-brand">AI</b> 컨설턴트
            </h1>
            <p className="mt-3 [font:var(--text-body1)] tracking-[var(--track-body)] text-ink-3">
              조사·분석·진단·설계까지, One-stop 맞춤형 솔루션
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSearch();
            }}
            /* 콤보박스가 Enter를 자기 것으로 삼켜 submit이 오지 않는다 —
               캡처 단계에서 먼저 받아 검색을 실행한다 */
            onKeyDownCapture={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              runSearch();
            }}
            className="relative w-full"
          >
            <Autocomplete
              value={company}
              onValueChange={setCompany}
              /* 후보를 비워 자동완성 드롭다운을 끈다 — 검색은 버튼·엔터로만 나간다 */
              items={[]}
              onSelect={() => {}}
              placeholder={placeholder}
              aria-label="기업명 또는 사업자번호"
              onFocus={() => setTouched(true)}
              leading={<Icons.search size={22} />}
              /* 숫자만 입력하면 사업자번호 형식으로 맞춘다 — 000-00-00000 */
              formatValue={fmtBizNoInput}
              fieldClassName="ax-field--pill"
              fieldStyle={{ height: 66, paddingLeft: 26, paddingRight: 9, gap: 12 }}
              inputStyle={{ fontSize: 19 }}
              trailing={
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={company.trim().length < 2 || searching}
                  aria-label="기업 검색"
                  style={{ borderRadius: "var(--radius-full)", flex: "none", height: 50 }}
                >
                  {searching ? "찾는 중" : "기업 찾기"}
                  <Icons.arrow size={16} />
                </Button>
              }
            />
          </form>

          {searchError && (
            <p role="alert" className="mt-4 text-center [font:var(--text-caption)] text-[var(--fg-danger)]">
              {searchError}
            </p>
          )}

          {results !== null && (
            <div className="mt-5">
              {results.length === 0 ? (
                <p className="text-center [font:var(--text-body3)] text-ink-3">
                  검색 결과가 없어요. 상호를 조금 더 정확히 적거나 사업자번호로 찾아 주세요.
                </p>
              ) : (
                <>
                  <p className="mb-2 [font:var(--text-caption)] text-ink-4">
                    <span className="[font-family:var(--font-mono)]">{results.length}</span>곳 —
                    진단할 기업을 선택해 주세요
                  </p>
                  <ul className="ax-scrollbar-thin m-0 flex max-h-[46vh] list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
                    {results.map((hit) => (
                      <li key={hit.bizNo}>
                        <Card
                          radius="l"
                          padded={false}
                          interactive
                          role="button"
                          tabIndex={0}
                          onClick={() => pickCompany(hit)}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            pickCompany(hit);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <div className="flex items-center justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate [font:var(--text-label-m)] text-ink">
                                  {hit.name}
                                </span>
                                {hit.dart && <Badge tone="accent">DART</Badge>}
                                {hit.statusCode === "02" && <Badge tone="warning">휴업</Badge>}
                                {hit.statusCode !== "01" && hit.statusCode !== "02" && (
                                  <Badge tone="outline">상태 미확인</Badge>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap gap-x-3 [font:var(--text-caption)] text-ink-4">
                                <span className="[font-family:var(--font-mono)]">
                                  사업자 {fmtBizNo(hit.bizNo)}
                                </span>
                                {hit.corpRegNo && (
                                  <span className="[font-family:var(--font-mono)]">
                                    법인 {fmtCorpRegNo(hit.corpRegNo)}
                                  </span>
                                )}
                                {hit.region && <span>{hit.region}</span>}
                              </div>
                            </div>
                            <Icons.chevronRight size={16} />
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── phase: confirm — 기업 확인 (1/2) ─────────────── */}
      {phase === "confirm" && (
        <Card key="confirm" className="ax-step-enter" radius="2xl" style={stepCardStyle}>
          <BackIconButton label="검색으로 돌아가기" onClick={() => setPhase("search")} />
          <DotProgress step={1} total={2} />
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
              {selected?.name ?? company.trim()}
            </div>
            <div
              style={{
                margin: "8px 0 0",
                font: "var(--text-body2)",
                color: "var(--fg-tertiary)",
              }}
            >
              {selected ? `사업자번호 ${fmtBizNo(selected.bizNo)}` : ""}
              {selected?.corpRegNo ? ` · 법인번호 ${fmtCorpRegNo(selected.corpRegNo)}` : ""}
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
            <Button variant="ghost" size="md" full onClick={backToSearch}>
              다시 검색
            </Button>
          </div>
        </Card>
      )}

      {/* ─── phase: upload — 자료 올리기 (2/2) — 중앙 드롭존에 모두 올리기 (개편 원복) ── */}
      {/* 업로드 단계 — 카드는 원래 자리(중앙) 그대로 두고, '필요한 자료' 패널만 오른쪽에 덧붙인다.
          패널을 흐름에 넣으면 카드가 왼쪽으로 밀리므로 넓은 화면에서는 absolute로 띄운다.
          좁은 화면(1024px 미만)에서는 카드 아래로 내려 쌓인다 */}
      {phase === "upload" && (
        <div
          key="upload"
          className="relative m-auto w-full max-w-[640px]"
          style={{ top: "calc(-28px - 10vh)" }}
        >
        <Card className="ax-step-enter" radius="2xl" style={{ ...stepCardStyle, top: 0, margin: 0, maxWidth: "none" }}>
          <BackIconButton label="기업 확인으로 돌아가기" onClick={() => setPhase("confirm")} />
          <DotProgress step={2} total={2} />
          {/* v5-1 — 업로드 단계 명칭 '파일 업로드' */}
          <h2 className="ax-heading mt-4 text-center [font:var(--text-h3)] tracking-[var(--track-heading)] text-ink">
            <b>파일 업로드</b>
          </h2>
          <p className="mt-2 text-center [font:var(--text-body2)] tracking-[var(--track-body)] text-ink-3">
            자료를 올릴수록 진단이 더 정확해져요
          </p>

          <div className="mt-6">
            {/* 실제 파일 업로드 input — 드롭존 클릭으로 열림 */}
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
            {/* 업로드 존 — 업로드 후에도 남아 추가 업로드 가능. 끌어다 놓기도 받는다 */}
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading}
              aria-label="자료 올리기"
              onDragOver={(e) => {
                if (uploading) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (uploading) return;
                const files = Array.from(e.dataTransfer.files ?? []);
                if (files.length > 0) void startUpload(files);
              }}
              className="box-border w-full cursor-pointer rounded-[var(--radius-l)] border-[1.5px] border-dashed border-[var(--grey-300)] bg-surface-2 px-4 py-7 text-center font-[family-name:var(--font-sans)] transition-colors duration-[var(--dur-base)] hover:border-line-strong hover:bg-surface-3 disabled:cursor-default disabled:hover:border-[var(--grey-300)] disabled:hover:bg-surface-2"
            >
              {uploading ? (
                <span className="flex min-h-[124px] flex-col items-center justify-center gap-3 text-ink-2">
                  <Loader style={{ color: "var(--fg-brand)" }} />
                  <TextShimmer style={{ font: "var(--text-body2)" }}>자료를 읽고 있어요</TextShimmer>
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

            {/* 업로드 진행률 — 전송 중일 때만. 100%가 되면 서버 판독을 기다리는 상태다 */}
            {uploadProgress !== null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full bg-[var(--fg-brand)] transition-[width] duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="flex-none [font-family:var(--font-mono)] text-[11px] text-ink-3">
                  {uploadProgress}%
                </span>
              </div>
            )}

            {uploadError && (
              <p
                role="alert"
                className="mt-3 [font:var(--text-caption)] text-[var(--fg-danger)]"
              >
                {uploadError}
              </p>
            )}

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
              disabled={attachedFiles.length === 0 || uploading}
              onClick={goCollect}
            >
              다음
            </Button>
            {attachedFiles.length === 0 && (
              <Button variant="ghost" size="md" full disabled={uploading} onClick={goCollect}>
                자료 없이 진행
              </Button>
            )}
          </div>
        </Card>

        {/* ── 필요한 자료 — 카드 밖 우측 패널. 무엇을 모아야 하는지 먼저 보여준다.
             올리기 버튼은 두지 않는다 — 업로드는 왼쪽 드롭존 하나로 받는다(중복 제거) ── */}
        {requiredDocs && requiredDocs.items.length > 0 && (
          <aside className="ax-step-enter mt-4 flex w-full flex-col rounded-[var(--radius-2xl)] border border-line bg-[var(--bg-elevated)] lg:absolute lg:left-full lg:top-0 lg:ml-4 lg:mt-0 lg:h-full lg:w-[280px]">
            <div className="flex flex-none items-center justify-between gap-2 border-b border-line px-3.5 py-2.5">
              <span className="[font:var(--text-label-s)] text-ink">
                필요한 자료 {requiredDocs.items.length}종
              </span>
              <Button
                variant="utility"
                size="sm"
                onClick={() => {
                  const text = [
                    "필요한 자료",
                    ...requiredDocs.items.map((d) => `- ${d.docTypeName}`),
                  ].join("\n");
                  void navigator.clipboard.writeText(text).then(() => {
                    setCopiedDocs(true);
                    setTimeout(() => setCopiedDocs(false), 1500);
                  });
                }}
              >
                {copiedDocs ? "복사됨" : "목록 복사"}
              </Button>
            </div>
            {/* 카드 높이에 맞춰 남는 공간을 목록이 차지하고, 넘치면 이 안에서만 스크롤한다 */}
            <div className="ax-scrollbar-none min-h-0 flex-1 overflow-y-auto px-3.5 py-2 max-lg:max-h-[50vh]">
              {Object.entries(
                requiredDocs.items.reduce<Record<string, string[]>>((acc, d) => {
                  (acc[d.groupName] ??= []).push(d.docTypeName);
                  return acc;
                }, {}),
              ).map(([group, names]) => (
                <div key={group} className="border-b border-line-subtle py-2 last:border-b-0">
                  <p className="m-0 mb-1 [font:var(--text-caption)] text-ink-4">{group}</p>
                  {names.map((name) => (
                    <p key={name} className="m-0 py-0.5 [font:var(--text-label-s)] text-ink">
                      {name}
                    </p>
                  ))}
                </div>
              ))}
            </div>
            <p className="m-0 flex-none border-t border-line px-3.5 py-2.5 [font:var(--text-caption)] text-ink-4">
              없는 자료는 건너뛰어도 돼요. 올린 자료는 다음 단계에서 분류돼요.
            </p>
          </aside>
        )}
        </div>
      )}

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
                backToSearch();
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
