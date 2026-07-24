"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import { useDiagnosis, type AttachedFileInfo } from "@/components/flow/DiagnosisContext";
import { uploadedDocs } from "@/data/scenario/documents";
import { COMPANY_DIRECTORY, companyDesc, findCompany } from "@/data/scenario/companies";
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

/** 예상 검색어 (자동완성) — 기업 디렉터리(companies.ts)에서 파생 (v7: 단일 원본 이동) */
const COMPANY_ITEMS: AutocompleteItem[] = COMPANY_DIRECTORY.map((c) => ({
  value: c.aliases[0] ?? c.name,
  description: companyDesc(c),
}));

/** 미등록 기업 폴백 — 데모 시나리오 기본값 */
const DEMO_COMPANY_DESC = companyDesc(COMPANY_DIRECTORY[0]);

/** 올리면 좋은 서류 — 업로드 존에 칩으로 강조 (v3 개선) */
const DOC_HINTS = ["생산일지", "발주서", "재고표", "검사성적서"];

/** 데모 버튼용 시나리오 자료 12건 (v6: 실제 업로드와 분리) */
const DEMO_FILES: AttachedFileInfo[] = uploadedDocs.map((d) => ({
  key: d.id,
  name: d.fileName,
  type: d.fileType.toUpperCase(),
}));

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
    attachedFiles,
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
  /** 업로드 판독 로딩 — 완료 시 파일을 첨부 목록에 합침 (v6 개편) */
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [noMoreDemo, setNoMoreDemo] = useState(false);

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

  /* 업로드 판독 로딩 — 1초 후 첨부 목록에 합침 (v6: 실제 업로드·데모 공용) */
  const startUpload = (files: AttachedFileInfo[]) => {
    setNoMoreDemo(false);
    setUploading(true);
    /* ponytail: 판독 1초 중 파일 삭제 시 삭제 전 목록 기준 병합 — 문제 되면 ref로 최신 목록 참조 */
    setTimeout(() => {
      const merged = [
        ...attachedFiles,
        ...files.filter((f) => !attachedFiles.some((a) => a.key === f.key)),
      ];
      setUploading(false);
      update({ attachedFiles: merged });
    }, 1000);
  };

  /** 첨부 파일 삭제 (v3 개선) — 전부 지우면 업로드 안 한 상태로 */
  const removeDoc = (key: string) => {
    setNoMoreDemo(false);
    update({ attachedFiles: attachedFiles.filter((f) => f.key !== key) });
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

  /** 파일 선택 완료 → 판독 로딩 후 첨부 */
  const onFilesPicked = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    startUpload(
      files.map((f, i) => ({
        key: `up-${Date.now()}-${i}-${f.name}`,
        name: f.name,
        type: (f.name.split(".").pop() ?? "").toUpperCase(),
      })),
    );
  };

  /** 데모 버튼 — 기존 더미 데이터 12건 일괄 첨부 (v6: 실제 업로드와 분리) */
  const attachDemo = () => {
    if (uploading) return;
    const missing = DEMO_FILES.filter((d) => !attachedFiles.some((a) => a.key === d.key));
    if (missing.length === 0) {
      setNoMoreDemo(true);
      return;
    }
    startUpload(missing);
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

  /* 두 섹션(프로그램·관심 영역) 모두 골라야 진단 시작 (v3) */
  const canStart = systems.length > 0 && interestAreas.length > 0;

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
              /* v6: 입력 전에는 드롭다운 미노출 — 최근 검색 기록처럼 보이는 전체 목록 제거 */
              items={company.trim() ? COMPANY_ITEMS : []}
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
              {company.trim()}
            </div>
            <div
              style={{
                margin: "8px 0 0",
                font: "var(--text-body2)",
                color: "var(--fg-tertiary)",
              }}
            >
              {/* v6: 검색한 기업의 메타를 그대로 전달 (미등록 기업은 데모 기본값) */}
              {(() => {
                const found = findCompany(company);
                return found ? companyDesc(found) : DEMO_COMPANY_DESC;
              })()}
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

            {/* 데모 버튼 — 기존 더미 데이터 파일 일괄 첨부 (v6) */}
            <div className="mt-2 flex items-center justify-between gap-2">
              {noMoreDemo ? (
                <p className="m-0 [font:var(--text-caption)] text-ink-4">더 올릴 자료가 없어요</p>
              ) : (
                <span />
              )}
              <Button variant="ghost" size="sm" disabled={uploading} onClick={attachDemo}>
                데모
              </Button>
            </div>

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
