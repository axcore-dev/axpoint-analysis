"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { uploadedDocs } from "@/data/scenario/documents";
import { FUNCTION_AREAS } from "@/data/rubric/meta";
import {
  Autocomplete,
  BackIconButton,
  Button,
  Card,
  DotProgress,
  Icons,
  Loader,
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

/** 예상 검색어 (자동완성) */
const COMPANY_ITEMS: AutocompleteItem[] = [
  { value: "데모기업", description: "금속가공제품 제조업 · 광주" },
  { value: "AXCRE", description: "소프트웨어 개발 · 광명" },
];

/** 올리면 좋은 서류 — 업로드 존에 칩으로 강조 (v3 개선) */
const DOC_HINTS = ["생산일지", "발주서", "재고표", "검사성적서"];

const ALL_DOC_IDS = uploadedDocs.map((d) => d.id);

const stepCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  position: "relative",
  padding: "var(--space-8)",
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
    uploadSimulated,
    systems,
    interestAreas,
    update,
    completeStep,
  } = useDiagnosis();

  const [phase, setPhase] = useState<Phase>("search");
  const [loginOpen, setLoginOpen] = useState(false);
  const [company, setCompany] = useState("");
  /** 포커스가 한 번이라도 닿으면 타이핑 애니메이션 종료 */
  const [touched, setTouched] = useState(false);
  const [placeholder, setPlaceholder] = useState("");
  /** 업로드 시뮬레이션 — 일괄 첨부 후 파일별 삭제 가능 (v3 개선) */
  const [uploading, setUploading] = useState(false);
  const [attachedIds, setAttachedIds] = useState<string[]>([]);
  const [noMoreDocs, setNoMoreDocs] = useState(false);

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

  /* 업로드 시뮬레이션 — 1초 판독 로딩 후 일괄 첨부 (지운 파일 재업로드 포함) */
  useEffect(() => {
    if (!uploading) return;
    const t = setTimeout(() => {
      setAttachedIds(ALL_DOC_IDS);
      setUploading(false);
      update({ uploadSimulated: true });
    }, 1000);
    return () => clearTimeout(t);
  }, [uploading, update]);

  /* 뒤로 돌아왔을 때 — 이미 업로드했다면 리스트 복원 (최초 1회) */
  useEffect(() => {
    if (uploadSimulated) setAttachedIds((prev) => (prev.length > 0 ? prev : ALL_DOC_IDS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 첨부 파일 삭제 (v3 개선) — 전부 지우면 업로드 안 한 상태로 */
  const removeDoc = (id: string) => {
    setNoMoreDocs(false);
    setAttachedIds((prev) => {
      const next = prev.filter((d) => d !== id);
      if (next.length === 0) update({ uploadSimulated: false });
      return next;
    });
  };

  const canSubmit = company.trim().length >= 1;

  const submitSearch = () => {
    if (!canSubmit) return;
    if (!user) {
      setLoginOpen(true); // 검색 입력값은 state에 그대로 보존
      return;
    }
    setPhase("confirm");
  };

  /** 예상 검색어 선택 → 입력값 채우고 동일 제출 흐름(로그인 체크) */
  const pickSuggestion = (value: string) => {
    setCompany(value);
    if (!user) {
      setLoginOpen(true);
      return;
    }
    setPhase("confirm");
  };

  const handleUploadClick = () => {
    if (uploading) return;
    if (attachedIds.length === ALL_DOC_IDS.length) {
      setNoMoreDocs(true);
      return;
    }
    setUploading(true);
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

  const toggleArea = (id: string) => {
    update({
      interestAreas: interestAreas.includes(id)
        ? interestAreas.filter((a) => a !== id)
        : [...interestAreas, id],
    });
  };

  const startDiagnosis = () => {
    update({ companyInput: company.trim() });
    completeStep("landing");
    router.push("/collect");
  };

  const attachedDocs = uploadedDocs.filter((d) => attachedIds.includes(d.id));
  /* 두 섹션(프로그램·관심 영역) 모두 골라야 진단 시작 (v3) */
  const canStart = systems.length > 0 && interestAreas.length > 0;

  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-surface px-[var(--gutter)] py-12">
      {/* ─── phase: search — 검색바가 수직 중앙, 헤드라인은 그 위에 부착 ── */}
      {phase === "search" && (
        <div key="search" className="ax-step-enter relative m-auto w-full max-w-[560px]">
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
              items={COMPANY_ITEMS}
              placeholder={placeholder}
              aria-label="기업명 또는 사업자번호"
              onFocus={() => setTouched(true)}
              leading={<Icons.search size={20} />}
              fieldClassName="ax-field--pill"
              fieldStyle={{ height: 58, paddingLeft: 24, paddingRight: 8, gap: 12 }}
              inputStyle={{ fontSize: 16 }}
              trailing={
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={!canSubmit}
                  aria-label="진단 시작"
                  style={{ borderRadius: "var(--radius-full)", flex: "none", height: 42 }}
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
              {company.trim()}
            </div>
            <div
              style={{
                margin: "8px 0 0",
                font: "var(--text-body2)",
                color: "var(--fg-tertiary)",
              }}
            >
              금속가공제품 제조업 · 광주
            </div>
          </div>
          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 8 }}>
            <Button variant="primary" size="lg" full onClick={() => setPhase("upload")}>
              맞아요, 계속할게요
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

            {noMoreDocs && (
              <p className="mt-2 text-center [font:var(--text-caption)] text-ink-4">
                더 올릴 자료가 없어요
              </p>
            )}

            {/* 업로드된 파일 리스트 — 콤팩트 행 + 파일별 삭제 (v3 개선) */}
            {attachedDocs.length > 0 && (
              <ul className="ax-scrollbar-none mt-3 flex max-h-[236px] list-none flex-col gap-1 overflow-y-auto">
                {attachedDocs.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2.5 rounded-[var(--radius-s)] border border-line bg-surface py-1.5 pl-3 pr-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-left [font:var(--text-label-s)] text-ink">
                      {d.fileName}
                    </span>
                    <span className="flex-none [font:var(--text-caption)] text-ink-4">
                      {d.fileType.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      aria-label={`${d.fileName} 삭제`}
                      onClick={() => removeDoc(d.id)}
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
              disabled={attachedDocs.length === 0}
              onClick={() => setPhase("systems")}
            >
              다음
            </Button>
            {attachedDocs.length === 0 && (
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
            <b>사용 중인 프로그램</b>과 <b>관심 영역</b>을 골라주세요
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

            <div
              style={{
                font: "var(--text-label-s)",
                color: "var(--fg-secondary)",
                margin: "20px 0 10px",
              }}
            >
              관심 영역
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {FUNCTION_AREAS.map((area) => (
                <Tag
                  key={area.id}
                  selected={interestAreas.includes(area.id)}
                  onClick={() => toggleArea(area.id)}
                >
                  {area.name}
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
    </div>
  );
}
