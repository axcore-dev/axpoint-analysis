"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { LoginModal } from "@/components/auth/LoginModal";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { uploadedDocs } from "@/data/scenario/documents";
import { FUNCTION_AREAS } from "@/data/rubric/meta";
import { Button, Card, Icons, Loader, Tag } from "@/components/ui";

/**
 * S0 랜딩 — Hero 검색 + 3단계 확인 위저드 (수정요청v1)
 * phase: search(히어로) → confirm(기업 확인 1/3) → upload(자료 2/3) → systems(현황 3/3)
 */

type Phase = "search" | "confirm" | "upload" | "systems";

const SYSTEM_OPTIONS = ["ERP", "MES", "WMS", "회계SW", "없음"];

/** 플레이스홀더 타이핑 애니메이션 문구 */
const TYPING_PHRASES = ["(주)데모기업", "123-45-67890"];
const STATIC_PLACEHOLDER = "기업명 또는 사업자번호";

/** 진행 도트 (●●○ + n/3) */
function Progress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div
      aria-label={`3단계 중 ${step}단계`}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "var(--radius-full)",
            background: i <= step ? "var(--bg-brand)" : "var(--grey-300)",
            transition: "background-color var(--dur-base) var(--ease)",
          }}
        />
      ))}
      <span
        style={{
          marginLeft: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--fg-quaternary)",
        }}
      >
        {step}/3
      </span>
    </div>
  );
}

/** 카드 좌상단 뒤로 가기 chevron */
function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--hover-overlay)";
        e.currentTarget.style.color = "var(--fg-secondary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--fg-tertiary)";
      }}
      style={{
        position: "absolute",
        top: 14,
        left: 14,
        width: 32,
        height: 32,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: "var(--radius-s)",
        background: "transparent",
        color: "var(--fg-tertiary)",
        cursor: "pointer",
        transition:
          "background-color var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
      }}
    >
      <span aria-hidden style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
        <Icons.chevronRight size={18} />
      </span>
    </button>
  );
}

const stepCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  position: "relative",
  padding: "var(--space-8)",
};

const cardHeadingStyle: CSSProperties = {
  margin: "16px 0 0",
  font: "var(--text-h3)",
  letterSpacing: "var(--track-heading)",
  color: "var(--fg-primary)",
  textAlign: "center",
};

const cardSubStyle: CSSProperties = {
  margin: "8px 0 0",
  font: "var(--text-body2)",
  letterSpacing: "var(--track-body)",
  color: "var(--fg-tertiary)",
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
  const [uploading, setUploading] = useState(false);

  /* sessionStorage 복원 값 반영 (재방문 시) */
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

  /* 업로드 시뮬레이션 — 1초 판독 로딩 후 완료 */
  useEffect(() => {
    if (!uploading) return;
    const t = setTimeout(() => {
      update({ uploadSimulated: true });
      setUploading(false);
    }, 1000);
    return () => clearTimeout(t);
  }, [uploading, update]);

  const canSubmit = company.trim().length >= 1;

  const submitSearch = () => {
    if (!canSubmit) return;
    if (!user) {
      setLoginOpen(true); // 검색 입력값은 state에 그대로 보존
      return;
    }
    setPhase("confirm");
  };

  const toggleSystem = (name: string) => {
    update({
      systems: systems.includes(name)
        ? systems.filter((s) => s !== name)
        : [...systems, name],
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

  const previewDocs = uploadedDocs.slice(0, 4);
  const restCount = uploadedDocs.length - previewDocs.length;

  return (
    <div
      style={{
        background: "var(--bg-base)",
        minHeight: "calc(100vh - 230px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px var(--gutter)",
        boxSizing: "border-box",
      }}
    >
      {/* ─── phase: search — Hero ─────────────────────────── */}
      {phase === "search" && (
        <div
          key="search"
          className="ax-step-enter"
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <span
            style={{
              font: "var(--text-label-s)",
              letterSpacing: "0.08em",
              color: "var(--fg-brand)",
            }}
          >
            AXpoint
          </span>
          <h1
            style={{
              margin: "16px 0 0",
              font: "var(--text-display2)",
              letterSpacing: "var(--track-display)",
              color: "var(--fg-primary)",
            }}
          >
            3분이면 나와요,
            <br />
            우리 회사의 AI 도입 답안지
          </h1>
          <p
            style={{
              margin: "16px 0 0",
              font: "var(--text-body1)",
              letterSpacing: "var(--track-body)",
              color: "var(--fg-tertiary)",
            }}
          >
            제조 기업 진단 무료 — 근거 있는 점수로 알려드려요
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
            style={{ width: "100%", maxWidth: 560, marginTop: 40 }}
          >
            <div
              className="ax-field ax-field--pill"
              style={{ height: 58, paddingLeft: 24, paddingRight: 8, gap: 12 }}
            >
              <span className="ax-field__icon">
                <Icons.search size={20} />
              </span>
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onFocus={() => setTouched(true)}
                placeholder={placeholder}
                aria-label="기업명 또는 사업자번호"
                autoComplete="off"
                style={{ fontSize: 16 }}
              />
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
            </div>
          </form>
        </div>
      )}

      {/* ─── phase: confirm — 기업 확인 (1/3) ─────────────── */}
      {phase === "confirm" && (
        <Card key="confirm" className="ax-step-enter" radius="2xl" style={stepCardStyle}>
          <BackButton label="검색으로 돌아가기" onClick={() => setPhase("search")} />
          <Progress step={1} />
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
          <BackButton label="기업 확인으로 돌아가기" onClick={() => setPhase("confirm")} />
          <Progress step={2} />
          <h2 style={cardHeadingStyle}>자료를 올려주세요</h2>
          <p style={cardSubStyle}>
            생산일지·발주서·재고표면 충분해요.
            <br />
            올릴수록 진단이 정확해져요
          </p>

          <div style={{ marginTop: 24 }}>
            {uploadSimulated ? (
              <div
                style={{
                  border: "1px solid var(--line-brand)",
                  background: "var(--bg-brand-weak)",
                  borderRadius: "var(--radius-l)",
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--fg-brand)",
                    font: "var(--text-label-m)",
                  }}
                >
                  <Icons.check size={16} />
                  파일 <span style={{ fontFamily: "var(--font-mono)" }}>12</span>건 첨부됨
                </div>
                <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
                  {previewDocs.map((d) => (
                    <li
                      key={d.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        font: "var(--text-body3)",
                        color: "var(--fg-secondary)",
                        padding: "3px 0",
                      }}
                    >
                      <Icons.file size={13} />
                      {d.fileName}
                    </li>
                  ))}
                  <li
                    style={{
                      font: "var(--text-body3)",
                      color: "var(--fg-quaternary)",
                      padding: "3px 0 0 20px",
                    }}
                  >
                    외 <span style={{ fontFamily: "var(--font-mono)" }}>{restCount}</span>건
                  </li>
                </ul>
              </div>
            ) : uploading ? (
              <div
                style={{
                  border: "1.5px dashed var(--grey-300)",
                  borderRadius: "var(--radius-l)",
                  background: "var(--bg-secondary)",
                  padding: "34px 18px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  color: "var(--fg-secondary)",
                }}
              >
                <Loader style={{ color: "var(--fg-brand)" }} />
                <span style={{ font: "var(--text-body2)" }}>자료를 읽고 있어요</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setUploading(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--line-strong)";
                  e.currentTarget.style.background = "var(--bg-tertiary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--grey-300)";
                  e.currentTarget.style.background = "var(--bg-secondary)";
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1.5px dashed var(--grey-300)",
                  borderRadius: "var(--radius-l)",
                  background: "var(--bg-secondary)",
                  padding: "30px 18px",
                  cursor: "pointer",
                  textAlign: "center",
                  fontFamily: "var(--font-sans)",
                  transition:
                    "border-color var(--dur-base) var(--ease), background-color var(--dur-base) var(--ease)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--fg-secondary)",
                    font: "var(--text-label-m)",
                  }}
                >
                  <Icons.upload size={18} />
                  여기를 눌러 자료를 올려주세요
                </span>
              </button>
            )}
            <p
              style={{
                margin: "10px 0 0",
                font: "var(--text-caption)",
                color: "var(--fg-quaternary)",
                textAlign: "center",
              }}
            >
              이미지(jpg/png) · PDF · xlsx · docx/hwp
            </p>
          </div>

          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            {uploadSimulated ? (
              <Button variant="primary" size="lg" full onClick={() => setPhase("systems")}>
                다음
              </Button>
            ) : (
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
          <BackButton label="자료 올리기로 돌아가기" onClick={() => setPhase("upload")} />
          <Progress step={3} />
          <h2 style={cardHeadingStyle}>지금 상황을 알려주세요</h2>
          <p style={cardSubStyle}>선택 사항이에요. 건너뛰어도 진단에는 문제 없어요</p>

          <div style={{ marginTop: 24 }}>
            <div
              style={{
                font: "var(--text-label-s)",
                color: "var(--fg-secondary)",
                marginBottom: 10,
              }}
            >
              사용 중인 시스템
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

          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 8 }}>
            <Button variant="primary" size="xl" full onClick={startDiagnosis}>
              진단 시작하기
            </Button>
            <Button variant="ghost" size="md" full onClick={startDiagnosis}>
              건너뛰고 시작
            </Button>
          </div>
          <p
            style={{
              margin: "16px 0 0",
              font: "var(--text-caption)",
              color: "var(--fg-quaternary)",
              textAlign: "center",
            }}
          >
            올려주신 자료의 개인 정보는 읽는 즉시 가리고, 진단에만 써요.
          </p>
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
