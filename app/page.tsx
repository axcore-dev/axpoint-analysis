"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDiagnosis } from "@/components/flow/DiagnosisContext";
import { STEPS } from "@/components/flow/steps";
import { uploadedDocs } from "@/data/scenario/documents";
import { FUNCTION_AREAS } from "@/data/rubric/meta";
import { Button, Card, Eyebrow, Icons, Input, Tag } from "@/components/ui";

/**
 * S0 랜딩 — 진입·진단 시작 (역할 1개 원칙, F-CMN-01)
 * 식별값 1자 이상 입력 시에만 진단 시작 가능 (REQ-F-04).
 */

const SYSTEM_OPTIONS = ["ERP", "MES", "WMS", "회계SW", "없음"];

/** 필드 라벨 — 카드 내 a)~d) 공통 문법 */
function FieldLabel({
  no,
  title,
  optional = false,
}: {
  no: string;
  title: string;
  optional?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--ax-blue)",
          fontWeight: 600,
        }}
      >
        {no}
      </span>
      <span
        style={{
          fontSize: "var(--type-body-strong-size)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--text-strong)",
        }}
      >
        {title}
      </span>
      <span style={{ fontSize: 12, color: "var(--slate-400)" }}>
        {optional ? "선택" : "필수"}
      </span>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { companyInput, uploadSimulated, systems, interestAreas, update, completeStep } =
    useDiagnosis();

  const [company, setCompany] = useState("");

  /* sessionStorage 복원 값 반영 (재방문 시) */
  useEffect(() => {
    if (companyInput) setCompany((prev) => (prev === "" ? companyInput : prev));
  }, [companyInput]);

  const canStart = company.trim().length >= 1;

  const toggleSystem = (name: string) => {
    const next = systems.includes(name)
      ? systems.filter((s) => s !== name)
      : [...systems, name];
    update({ systems: next });
  };

  const toggleArea = (id: string) => {
    const next = interestAreas.includes(id)
      ? interestAreas.filter((a) => a !== id)
      : [...interestAreas, id];
    update({ interestAreas: next });
  };

  const onStart = () => {
    if (!canStart) return;
    update({ companyInput: company.trim() });
    completeStep("landing");
    router.push("/collect");
  };

  const previewDocs = uploadedDocs.slice(0, 4);

  return (
    <div>
      {/* ── 다크 히어로 타일 ─────────────────────────────── */}
      <section
        style={{
          background: "var(--tile-dark-1)",
          padding: "var(--space-section) var(--gutter) 150px",
        }}
      >
        <div style={{ maxWidth: "var(--container-content)", margin: "0 auto", textAlign: "center" }}>
          <Eyebrow tone="on-dark">AXPOINT · 제조 AX 진단</Eyebrow>
          <h1
            style={{
              margin: "20px 0 0",
              fontSize: "var(--type-hero-size)",
              fontWeight: 700,
              lineHeight: "var(--type-hero-line)",
              letterSpacing: "var(--type-hero-track)",
              color: "var(--on-dark)",
            }}
          >
            우리 공장에 맞는 AI는?
          </h1>
          <p
            style={{
              margin: "22px auto 0",
              maxWidth: 640,
              fontSize: 19,
              lineHeight: 1.55,
              letterSpacing: "-0.008em",
              color: "var(--on-dark-muted)",
            }}
          >
            자료만 올리면, 우리 공장의 AX 단계·개선 과제·로드맵·예상 효과까지 — 즉시,
            무료로, 근거와 함께.
          </p>
        </div>
      </section>

      {/* ── 진단 시작 카드 (히어로에 겹침) ───────────────── */}
      <section style={{ background: "var(--canvas)", padding: "0 var(--gutter) var(--space-section)" }}>
        <Card
          padded={false}
          style={{
            maxWidth: 780,
            margin: "-90px auto 0",
            position: "relative",
            zIndex: 1,
            padding: "var(--space-xl)",
            boxShadow: "var(--shadow-soft)",
          }}
        >
          {/* a) 기업 식별값 */}
          <div>
            <FieldLabel no="a" title="기업명 또는 사업자번호" />
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="(주)데모기업 또는 123-45-67890"
              leadingIcon={<Icons.building size={18} />}
              aria-label="기업명 또는 사업자번호"
            />
            <p style={{ margin: "8px 0 0", fontSize: "var(--type-fine-size)", color: "var(--slate-400)" }}>
              데모 환경 — 어떤 기업명을 입력해도 데모 시나리오((주)데모기업)로 진행됩니다.
            </p>
          </div>

          {/* b) 자료 업로드 (시뮬레이션) */}
          <div style={{ marginTop: "var(--space-xl)" }}>
            <FieldLabel no="b" title="자료 업로드" optional />
            {uploadSimulated ? (
              <div
                style={{
                  border: "1px solid var(--ax-blue-hairline)",
                  background: "var(--ax-blue-wash)",
                  borderRadius: "var(--radius-md)",
                  padding: "16px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--ax-blue)",
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  <Icons.check size={16} />
                  데모 자료 <span style={{ fontFamily: "var(--font-mono)" }}>12</span>건 첨부됨
                </div>
                <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none" }}>
                  {previewDocs.map((d) => (
                    <li
                      key={d.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 13,
                        color: "var(--slate-600)",
                        padding: "3px 0",
                      }}
                    >
                      <Icons.file size={13} />
                      {d.fileName}
                    </li>
                  ))}
                  <li style={{ fontSize: 13, color: "var(--slate-400)", padding: "3px 0 0 20px" }}>
                    외 <span style={{ fontFamily: "var(--font-mono)" }}>8</span>건
                  </li>
                </ul>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => update({ uploadSimulated: true })}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1.5px dashed var(--slate-300)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface-ghost)",
                  padding: "28px 18px",
                  cursor: "pointer",
                  textAlign: "center",
                  fontFamily: "var(--font-sans)",
                  transition: "border-color .15s ease, background-color .15s ease",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--slate-700)",
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                >
                  <Icons.upload size={18} />
                  생산일지·발주서·재고표 등을 여기에 올려 주세요
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 8,
                    fontSize: "var(--type-fine-size)",
                    color: "var(--slate-400)",
                  }}
                >
                  이미지(jpg/png) · PDF · xlsx · docx/hwp 지원 — 클릭 시 데모 자료 12건이
                  첨부됩니다
                </span>
              </button>
            )}
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--slate-500)" }}>
              자료를 올릴수록 진단이 정확해집니다.
            </p>
          </div>

          {/* c) 시스템·관심 영역 */}
          <div style={{ marginTop: "var(--space-xl)" }}>
            <FieldLabel no="c" title="시스템·8대 기능 현황" optional />
            <div style={{ fontSize: 13, color: "var(--slate-500)", marginBottom: 8 }}>
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
            <div style={{ fontSize: 13, color: "var(--slate-500)", margin: "16px 0 8px" }}>
              관심 영역 (8대 기능)
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

          {/* d) CTA */}
          <div style={{ marginTop: "var(--space-xl)" }}>
            <Button variant="primary" size="lg" full disabled={!canStart} onClick={onStart}>
              AI 진단 시작
            </Button>
            {!canStart && (
              <p
                style={{
                  margin: "10px 0 0",
                  fontSize: 13,
                  color: "var(--slate-500)",
                  textAlign: "center",
                }}
              >
                기업명 또는 사업자번호를 입력하면 시작할 수 있습니다
              </p>
            )}
            <p
              style={{
                margin: "14px 0 0",
                fontSize: "var(--type-fine-size)",
                color: "var(--slate-400)",
                textAlign: "center",
              }}
            >
              업로드 자료의 개인정보는 판독 직후 마스킹되며 진단 목적 외 사용되지 않습니다.
            </p>
          </div>
        </Card>
      </section>

      {/* ── mist 섹션 — 차별점 3카드 ─────────────────────── */}
      <section
        style={{
          background: "var(--surface-mist)",
          padding: "var(--space-section) var(--gutter)",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <Eyebrow>왜 AXPOINT인가</Eyebrow>
          <h2
            style={{
              margin: "16px 0 0",
              fontSize: "var(--type-section-size)",
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: "-0.014em",
              color: "var(--text-strong)",
            }}
          >
            설문이 아니라, 귀사의 실제 자료로 진단합니다
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "var(--space-lg)",
              marginTop: "var(--space-xl)",
            }}
          >
            {[
              {
                icon: <Icons.clipboard size={22} />,
                title: "실물 자료 기반 진단",
                body: "생산일지·발주서 같은 실물 자료를 판독해 점수마다 근거 문서를 답니다. 감이 아니라 기록으로 진단합니다.",
              },
              {
                icon: <Icons.link size={22} />,
                title: "가치사슬 교차 분석",
                body: "발주–생산–재고 문서를 서로 대조해 끊긴 지점을 찾아냅니다. 귀사 자료로만 산출되는 분석입니다.",
              },
              {
                icon: <Icons.shield size={22} />,
                title: "정부사업 언어 정합",
                body: "KSMS·스마트공장 수준확인 기준과 같은 언어로 결과를 냅니다. 지원사업 신청서에 바로 연결됩니다.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <div style={{ color: "var(--ax-blue)" }}>{item.icon}</div>
                <h3
                  style={{
                    margin: "14px 0 0",
                    fontSize: 19,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: "var(--text-strong)",
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: "var(--text-secondary)",
                  }}
                >
                  {item.body}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── 다크 섹션 — 진행 안내 ───────────────────────── */}
      <section
        style={{
          background: "var(--tile-dark-2)",
          padding: "var(--space-section) var(--gutter)",
        }}
      >
        <div style={{ maxWidth: "var(--container-content)", margin: "0 auto", textAlign: "center" }}>
          <Eyebrow tone="on-dark">진행 안내</Eyebrow>
          <h2
            style={{
              margin: "16px 0 0",
              fontSize: "var(--type-section-size)",
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: "-0.014em",
              color: "var(--on-dark)",
            }}
          >
            여섯 단계, 약{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--ax-blue-on-dark)" }}>3</span>
            분이면 끝납니다
          </h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
              marginTop: "var(--space-xl)",
            }}
          >
            {STEPS.map((step, i) => (
              <span key={step.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {i > 0 && (
                  <span aria-hidden style={{ color: "var(--slate-600)", display: "inline-flex" }}>
                    <Icons.chevronRight size={14} />
                  </span>
                )}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 15px",
                    borderRadius: "var(--radius-pill)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "var(--on-dark-muted)",
                    fontSize: 14,
                    letterSpacing: "-0.006em",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--ax-blue-on-dark)",
                    }}
                  >
                    {i + 1}
                  </span>
                  {step.label}
                </span>
              </span>
            ))}
          </div>
          <p
            style={{
              margin: "24px auto 0",
              maxWidth: 620,
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--on-dark-muted)",
            }}
          >
            자료를 올리면 공개 데이터와 함께 자동 분류하고, 진단 결과에서 개선 과제를 골라
            로드맵과 보고서까지 한 흐름으로 이어집니다.
          </p>
        </div>
      </section>
    </div>
  );
}
