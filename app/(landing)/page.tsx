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
  Input,
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

/** 플레이스홀더 타이핑 애니메이션 문구 (수정요청v9) */
const TYPING_PHRASES = ["(주)에이엑스코어", "123-45-67890"];
const STATIC_PLACEHOLDER = "기업명 또는 사업자번호";

type RequiredDocs = {
  items: { docTypeId: number; docTypeName: string; groupName: string; files: { fileId: string; name: string }[] }[];
  filled: number;
  total: number;
  /** 분석 진행률 — 분석이 끝나야 부족 검증이 정확하다 */
  analysis: { analyzing: number; uploaded: number; done: number };
  /** 유형을 못 정한 파일 — 슬롯에 끌어다 놓아 지정한다 */
  unclassified: { fileId: string; name: string }[];
};

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

/**
 * 입력 중 사업자번호 형식 맞추기 (수정요청v9) — 숫자·하이픈만 입력했을 때 000-00-00000으로.
 * 기업명(한글·영문)이 섞이면 그대로 둔다.
 */
function fmtBizNoInput(raw: string): string {
  if (!/^[\d-]+$/.test(raw)) return raw;
  const d = raw.replace(/\D/g, "").slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5)].filter(Boolean).join("-");
}

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
  /** 필수 서류 현황 — 문서유형 마스터(필수/선택)가 원본 (수정요청v9) */
  const [requiredDocs, setRequiredDocs] = useState<RequiredDocs | null>(null);
  /** 업로드 실패·거부 안내 */
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** 자료 부족 경고 팝업 */
  const [shortageOpen, setShortageOpen] = useState(false);
  /** 슬롯에서 올릴 때의 대상 문서 유형 (파일 선택창은 하나를 공유한다) */
  const uploadTargetRef = useRef<number | undefined>(undefined);
  /** 부족한 슬롯만 보기 */
  const [onlyMissing, setOnlyMissing] = useState(false);
  /** 드래그 중인 미분류 파일 id */
  const [draggingFileId, setDraggingFileId] = useState<string | null>(null);
  /** 기타 프로그램 직접 입력 (수정요청v9) */
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherInput, setOtherInput] = useState("");
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
            /* 지역은 맨 우측에 (수정요청v9) */
            description: it.region ?? undefined,
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
  const startUpload = async (files: File[], docTypeId?: number) => {
    if (!assessmentId || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);
      /* 슬롯에서 올리면 그 유형으로 확정한다 — 분석은 워커가 이어서 채운다 (수정요청v9) */
      if (docTypeId !== undefined) form.append("docTypeId", String(docTypeId));
      const res = await fetch(`${API_URL}/api/assessments/${assessmentId}/files`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        saved?: { id: string; name: string }[];
        rejected?: { name: string; reason: string }[];
        error?: string;
      };
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
      } else if (!res.ok && added.length === 0) {
        setUploadError(body.error ?? "파일을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    } catch {
      setUploadError("파일을 올리지 못했어요. 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setUploading(false);
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

  /* 필수 서류 현황 — 업로드 단계에서 조회하고, 분류가 끝날 때까지 4초마다 갱신 */
  useEffect(() => {
    if (phase !== "upload" || !assessmentId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api<RequiredDocs>(`/api/assessments/${assessmentId}/required-docs`);
        if (!cancelled) setRequiredDocs(data);
      } catch {
        /* 조회 실패 시 슬롯 없이 기본 업로드 존만 노출 */
      }
    };
    load();
    const timer = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [phase, assessmentId, attachedFiles.length]);

  /** 업로드 존 클릭 → 실제 파일 선택 (v6) */
  const handleUploadClick = (docTypeId?: number) => {
    if (uploading) return;
    /* 선택창을 취소하면 change 이벤트가 오지 않으므로 열 때마다 대상을 다시 정한다 */
    uploadTargetRef.current = docTypeId;
    fileInputRef.current?.click();
  };

  /** 파일 선택 완료 → 서버 업로드 */
  const onFilesPicked = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    const target = uploadTargetRef.current;
    uploadTargetRef.current = undefined;
    if (files.length === 0) return;
    void startUpload(files, target);
  };

  /** 미분류 파일을 슬롯에 놓아 유형을 지정한다 (드래그앤드롭, 수정요청v9) */
  const assignDocType = async (fileId: string, docTypeId: number) => {
    try {
      await api(`/api/files/${fileId}/doc-type`, {
        method: "PATCH",
        body: JSON.stringify({ docTypeId }),
      });
      const data = await api<RequiredDocs>(`/api/assessments/${assessmentId}/required-docs`);
      setRequiredDocs(data);
    } catch {
      /* 실패 시 다음 주기 갱신에서 원래 상태가 다시 보인다 */
    }
  };

  /** 기업 확인 → 국세청 검증 + 진단 세션 생성 후 다음 단계 */
  const confirmCompany = async () => {
    if (verifying) return;
    const bizNo = resolved?.bizNo ?? null;
    const name = resolved?.name || company.trim();
    if (!bizNo) {
      /* 사업자번호를 못 찾으면 진단을 시작하지 않는다 (수정요청v9) */
      setVerifyNotice({
        kind: "blocked",
        message:
          "사업자번호를 확인할 수 없어요. 검색 결과에서 기업을 선택하거나 사업자번호로 검색해 주세요.",
      });
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
              /* 숫자만 입력하면 사업자번호 형식으로 맞춘다 — 000-00-00000 (수정요청v9) */
              formatValue={fmtBizNoInput}
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
            {/* 필수 서류 슬롯 — 업무영역별로 묶어 무엇이 비었는지 바로 보이게 (수정요청v9).
                올린 파일이 어느 유형인지는 분류가 끝나야 정해지므로 채움 표시는 분류 결과를 따른다 */}
            {requiredDocs && requiredDocs.items.length > 0 && (
              <div className="rounded-[var(--radius-l)] border border-line">
                <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
                  <span className="min-w-0 [font:var(--text-label-s)] text-ink">
                    필수 서류 {requiredDocs.filled}/{requiredDocs.total}
                    {requiredDocs.analysis.analyzing > 0 && (
                      <span className="ml-2 [font:var(--text-caption)] text-ink-3">
                        분석 {requiredDocs.analysis.done}/{requiredDocs.analysis.uploaded}
                      </span>
                    )}
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    {requiredDocs.filled < requiredDocs.total && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOnlyMissing((v) => !v)}
                      >
                        {onlyMissing ? "전체 보기" : "부족한 것만"}
                      </Button>
                    )}
                    {/* 업로드 진입점 — 여러 건을 한 번에 올리면 유형은 분류가 정한다 (수정요청v9) */}
                    <Button variant="secondary" size="sm" disabled={uploading} onClick={() => handleUploadClick()}>
                      {uploading ? "올리는 중" : "한번에 올리기"}
                    </Button>
                  </span>
                </div>
                <div className="ax-scrollbar-none max-h-[300px] overflow-y-auto">
                {Object.entries(
                  requiredDocs.items
                    .filter((it) => !onlyMissing || it.files.length === 0)
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
                          /* 미분류 파일을 끌어다 놓으면 이 유형으로 지정한다 (수정요청v9) */
                          onDragOver={(e) => {
                            if (!draggingFileId) return;
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const fileId = e.dataTransfer.getData("text/plain") || draggingFileId;
                            setDraggingFileId(null);
                            if (fileId) void assignDocType(fileId, d.docTypeId);
                          }}
                          className={`flex items-center gap-2.5 border-t border-line-subtle px-3.5 py-2 ${
                            draggingFileId && !done ? "bg-[var(--bg-brand-weak)]" : ""
                          }`}
                        >
                          <span
                            aria-hidden
                            className={`inline-flex size-4 flex-none items-center justify-center rounded-full ${
                              done ? "bg-[var(--bg-success-weak)] text-[var(--fg-success)]" : "bg-surface-3 text-ink-4"
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

            {/* 유형을 못 정한 파일 — 슬롯으로 끌어다 놓으면 그 유형으로 지정된다 (수정요청v9) */}
            {requiredDocs && requiredDocs.unclassified.length > 0 && (
              <div className="mt-3 rounded-[var(--radius-l)] border border-dashed border-[var(--grey-300)] p-3">
                <p className="[font:var(--text-label-s)] text-ink">
                  유형을 못 정한 자료 {requiredDocs.unclassified.length}건
                </p>
                <p className="mt-1 [font:var(--text-caption)] text-ink-4">
                  위 목록의 서류 칸으로 끌어다 놓으면 그 유형으로 반영돼요.
                </p>
                <ul className="mt-2 flex list-none flex-wrap gap-1.5">
                  {requiredDocs.unclassified.map((f) => (
                    <li key={f.fileId}>
                      <span
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", f.fileId);
                          setDraggingFileId(f.fileId);
                        }}
                        onDragEnd={() => setDraggingFileId(null)}
                        className={`inline-flex cursor-grab items-center gap-1.5 rounded-[var(--radius-full)] border border-line bg-surface px-2.5 py-1 [font:var(--text-label-s)] text-ink ${
                          draggingFileId === f.fileId ? "opacity-50" : ""
                        }`}
                      >
                        <Icons.file size={13} />
                        {f.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
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
              /* 분석이 끝나기 전에는 부족 검증이 정확하지 않아 대기시킨다 (수정요청v9) */
              disabled={attachedFiles.length === 0 || (requiredDocs?.analysis.analyzing ?? 0) > 0}
              onClick={() => {
                /* 필수 서류가 덜 찼으면 한 번 더 묻는다 */
                if (requiredDocs && requiredDocs.filled < requiredDocs.total) {
                  setShortageOpen(true);
                  return;
                }
                setPhase("systems");
              }}
            >
              {(requiredDocs?.analysis.analyzing ?? 0) > 0
                ? `자료를 분석하고 있어요 (${requiredDocs?.analysis.done}/${requiredDocs?.analysis.uploaded})`
                : "다음"}
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

      {/* 자료 부족 경고 — 필수 서류가 덜 찬 상태로 진행할 때 (수정요청v9) */}
      <Modal open={shortageOpen} onClose={() => setShortageOpen(false)} title="자료가 부족합니다">
        <p style={{ margin: 0, font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
          필수 서류 {requiredDocs?.total ?? 0}종 중 {requiredDocs?.filled ?? 0}종만 올라왔어요.
          그래도 진행하시겠습니까?
        </p>
        <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
          부족한 서류는 판정 보류로 남고, 설문으로 보완할 수 있어요.
        </p>
        <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
          <Button
            variant="secondary"
            full
            onClick={() => {
              setShortageOpen(false);
              setPhase("systems");
            }}
          >
            그래도 진행
          </Button>
          <Button
            variant="primary"
            full
            onClick={() => {
              setOnlyMissing(true);
              setShortageOpen(false);
            }}
          >
            자료 더 올리기
          </Button>
        </div>
      </Modal>

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
