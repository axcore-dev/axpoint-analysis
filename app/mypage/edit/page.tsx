"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Icons, Input, Modal, Toast } from "@/components/ui";
import { useAuth, type AuthUser } from "@/components/auth/AuthContext";
import { COMPANY_DIRECTORY, companyDesc } from "@/data/scenario/companies";

/* ---------- 비밀번호 규칙 (수정요청v7) ----------
   허용 특수문자 32자: ! " # $ % & ' ( ) * + , - . / : ; < = > ? @ [ ₩ ] ^ _ ` { | } ~
   ₩(U+20A9)와 백슬래시(\)는 동일 취급으로 둘 다 허용. 목록 밖 문자는 ③ 실패. */
const SPECIAL_DISPLAY = "! \" # $ % & ' ( ) * + , - . / : ; < = > ? @ [ ₩ ] ^ _ ` { | } ~";
/** 허용 특수문자 1자 이상 포함 */
const RE_SPECIAL = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~₩]/;
/** 영문 대소문자·숫자·허용 특수문자 외 문자 없음 */
const RE_ALLOWED_ONLY = /^[A-Za-z0-9!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~₩]*$/;

/** 검색 모드 — 사업자등록번호(하이픈 무시 전방 일치) / 상호명(부분 일치) */
type SearchMode = "bizNo" | "name";

/**
 * 내 정보 수정 (수정요청v7) — 가짜 인증 데모.
 * 진입 시 계정 비밀번호 재확인(본인 확인)을 거친 뒤에만 폼 노출 — URL 직접 접근도 동일.
 * 이름·회사명·직책·연락처만 저장(updateProfile), 이메일은 수정 불가.
 * 회사명은 기업 디렉터리 검색 팝업으로만 선택, 비밀번호 변경은 검증만 하고 저장하지 않는다.
 */
export default function MyPageEditPage() {
  const { user, hydrated, updateProfile } = useAuth();
  /* 본인 확인 — 페이지 진입(마운트)마다 다시 요구 */
  const [verified, setVerified] = useState(false);

  /* 세션 복원 전 — 깜빡임 방지 */
  if (!hydrated) return null;

  /* 가드: 비로그인 (mypage와 동일 문법) */
  if (!user) {
    return (
      <section
        style={{
          padding: "var(--space-20) var(--gutter)",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Card radius="2xl" style={{ maxWidth: 520, textAlign: "center" }}>
          <h2
            style={{
              margin: "0 0 10px",
              font: "var(--text-h4)",
              letterSpacing: "var(--track-heading)",
              color: "var(--fg-primary)",
            }}
          >
            내 정보 수정
          </h2>
          <p style={{ margin: "0 0 20px", font: "var(--text-body2)", color: "var(--fg-secondary)" }}>
            내 정보는 로그인한 뒤에 확인할 수 있어요.
          </p>
          <Button variant="primary" href="/auth/login">
            로그인
          </Button>
        </Card>
      </section>
    );
  }

  /* 본인 확인 전 — 비밀번호 확인 게이트 */
  if (!verified) return <VerifyPassword onVerified={() => setVerified(true)} />;

  /* 폼은 user 확보 후에만 마운트 — 초기값을 렌더 시점에 시드 (effect 불필요) */
  return <EditForm user={user} updateProfile={updateProfile} />;
}

/**
 * 본인 확인 게이트 — 계정 비밀번호 재입력 후 수정 폼 진입.
 * 가짜 인증 컨벤션(AuthForm과 동일): 4자 이상이면 통과, 600ms 지연으로 확인 흐름감만 재현.
 */
function VerifyPassword({ onVerified }: { onVerified: () => void }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const canSubmit = pw.length >= 4;

  const submit = () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      onVerified();
    }, 600);
  };

  return (
    <section
      style={{
        padding: "var(--space-20) var(--gutter)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Card radius="2xl" style={{ width: "100%", maxWidth: 440 }}>
        <h2
          style={{
            margin: "0 0 8px",
            font: "var(--text-h4)",
            letterSpacing: "var(--track-heading)",
            color: "var(--fg-primary)",
          }}
        >
          비밀번호 확인
        </h2>
        <p style={{ margin: "0 0 18px", font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
          개인정보 보호를 위해 비밀번호를 한 번 더 확인해요.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="비밀번호"
            aria-label="비밀번호"
            autoComplete="current-password"
            autoFocus
          />
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <Button type="submit" variant="primary" full disabled={!canSubmit || busy}>
              {busy ? "확인하고 있어요" : "확인"}
            </Button>
            <Button variant="ghost" size="md" full onClick={() => router.back()}>
              취소
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}

function EditForm({
  user,
  updateProfile,
}: {
  user: AuthUser;
  updateProfile: (patch: Partial<AuthUser>) => void;
}) {
  const router = useRouter();

  /* 폼 상태 — user 값으로 초기화 */
  const [name, setName] = useState(user.name);
  const [company, setCompany] = useState(user.company ?? "");
  const [title, setTitle] = useState(user.title ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");

  /* 회사 검색 팝업 */
  const [companyOpen, setCompanyOpen] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("bizNo");
  const [query, setQuery] = useState("");

  /* 비밀번호 변경 팝업 */
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwDone, setPwDone] = useState(false);

  /* 기업 디렉터리 검색 결과 */
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    if (searchMode === "name") {
      const lower = q.toLowerCase();
      return COMPANY_DIRECTORY.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.aliases.some((a) => a.toLowerCase().includes(lower)),
      );
    }
    const qNo = q.replace(/-/g, "");
    if (!qNo) return [];
    return COMPANY_DIRECTORY.filter((c) => c.bizNo.replace(/-/g, "").startsWith(qNo));
  }, [query, searchMode]);

  /* 비밀번호 체크리스트 — 4개 모두 충족 시에만 변경 가능 */
  const pwChecks = [
    { label: "8자 이상", ok: pw.length >= 8 },
    {
      label: "영문·숫자·특수문자 각 1자 이상",
      ok: /[A-Za-z]/.test(pw) && /\d/.test(pw) && RE_SPECIAL.test(pw),
    },
    { label: "허용 문자만 사용", ok: pw.length > 0 && RE_ALLOWED_ONLY.test(pw) },
    { label: "새 비밀번호 확인 일치", ok: pw.length > 0 && pw === pw2 },
  ];
  const pwValid = pwChecks.every((c) => c.ok);

  /* 라벨 + 컨트롤 행 */
  const fieldRow = (label: string, control: ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "9px 0" }}>
      <span
        style={{
          width: 88,
          flex: "none",
          font: "var(--text-label-s)",
          color: "var(--fg-tertiary)",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
        {control}
      </div>
    </div>
  );

  const save = () => {
    updateProfile({ name, company, title, phone });
    router.push("/mypage");
  };

  const closePwModal = () => {
    setPwOpen(false);
    setPw("");
    setPw2("");
  };

  const closeCompanyModal = () => {
    setCompanyOpen(false);
    setQuery("");
  };

  return (
    <section style={{ padding: "var(--space-16) var(--gutter)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h2
          style={{
            margin: "0 0 24px",
            font: "var(--text-h4)",
            letterSpacing: "var(--track-heading)",
            color: "var(--fg-primary)",
          }}
        >
          내 정보 수정
        </h2>

        <Card radius="xl">
          {fieldRow(
            "이름",
            <div style={{ flex: 1, minWidth: 0 }}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
            </div>,
          )}
          {fieldRow(
            "이메일",
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input value={user.email} disabled />
              </div>
              <span
                style={{
                  flex: "none",
                  font: "var(--text-caption)",
                  color: "var(--fg-quaternary)",
                  whiteSpace: "nowrap",
                }}
              >
                수정 불가
              </span>
            </>,
          )}
          {fieldRow(
            "회사명",
            <>
              {/* 직접 입력 대신 기업 디렉터리 검색으로만 선택 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input value={company} readOnly placeholder="회사 검색으로 선택" />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCompanyOpen(true)}
                style={{ flex: "none" }}
              >
                회사 검색
              </Button>
            </>,
          )}
          {fieldRow(
            "직책",
            <div style={{ flex: 1, minWidth: 0 }}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="직책" />
            </div>,
          )}
          {fieldRow(
            "연락처",
            <div style={{ flex: 1, minWidth: 0 }}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="연락처" />
            </div>,
          )}
          {fieldRow(
            "비밀번호",
            <>
              <span
                style={{
                  flex: 1,
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  letterSpacing: "0.2em",
                  color: "var(--fg-tertiary)",
                }}
              >
                ********
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPwOpen(true)}
                style={{ flex: "none" }}
              >
                비밀번호 변경
              </Button>
            </>,
          )}

          <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
            <Button variant="primary" onClick={save}>
              저장
            </Button>
            <Button variant="ghost" onClick={() => router.back()}>
              취소
            </Button>
          </div>
        </Card>
      </div>

      {/* 비밀번호 변경 완료 안내 — 데모라 실제 저장 없음 */}
      <Toast open={pwDone} onClose={() => setPwDone(false)} tone="success">
        비밀번호 변경 완료
      </Toast>

      {/* 회사 검색 팝업 — data/scenario/companies.ts 기업 디렉터리 대상 */}
      <Modal open={companyOpen} onClose={closeCompanyModal} title="회사 검색">
        {/* 검색 모드 토글 */}
        <div
          style={{
            display: "flex",
            background: "var(--bg-tertiary)",
            borderRadius: "var(--radius-m)",
            padding: 4,
            marginBottom: 14,
          }}
        >
          {(
            [
              { mode: "bizNo", label: "사업자등록번호로 찾기" },
              { mode: "name", label: "상호명으로 찾기" },
            ] as const
          ).map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => {
                setSearchMode(m.mode);
                setQuery("");
              }}
              style={{
                flex: 1,
                height: 36,
                border: "none",
                cursor: "pointer",
                borderRadius: 9,
                font: "var(--text-label-m)",
                fontFamily: "var(--font-sans)",
                background: searchMode === m.mode ? "var(--bg-base)" : "transparent",
                color: searchMode === m.mode ? "var(--fg-primary)" : "var(--fg-tertiary)",
                boxShadow: searchMode === m.mode ? "var(--shadow-1)" : "none",
                transition: "all var(--dur-base) var(--ease)",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchMode === "bizNo" ? "사업자등록번호 10자리" : "상호명으로 찾기"}
          leadingIcon={<Icons.search size={16} />}
          autoFocus
        />

        {/* 검색 결과 */}
        <div style={{ marginTop: 12 }}>
          {query.trim() !== "" && results.length === 0 && (
            <p
              style={{
                margin: 0,
                padding: "14px 0",
                font: "var(--text-body3)",
                color: "var(--fg-tertiary)",
                textAlign: "center",
              }}
            >
              검색 결과 없음
            </p>
          )}
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {results.map((c, i) => (
              <li key={c.bizNo}>
                <button
                  type="button"
                  onClick={() => {
                    setCompany(c.name);
                    closeCompanyModal();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    padding: "11px 8px",
                    border: "none",
                    borderTop: i > 0 ? "1px solid var(--line-default)" : "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    borderRadius: "var(--radius-s)",
                  }}
                >
                  <span style={{ flex: "none", color: "var(--fg-tertiary)", display: "inline-flex" }}>
                    <Icons.building size={16} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        font: "var(--text-label-m)",
                        color: "var(--fg-primary)",
                      }}
                    >
                      {c.name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 2,
                        font: "var(--text-caption)",
                        color: "var(--fg-tertiary)",
                      }}
                    >
                      {companyDesc(c)}
                    </span>
                  </span>
                  <span
                    style={{
                      flex: "none",
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      color: "var(--fg-quaternary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.bizNo}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {/* 비밀번호 변경 팝업 — 검증만 수행, 데모라 저장 없음 */}
      <Modal open={pwOpen} onClose={closePwModal} title="비밀번호 변경">
        <div style={{ marginBottom: 12 }}>
          <div style={{ font: "var(--text-label-s)", color: "var(--fg-secondary)", marginBottom: 6 }}>
            새 비밀번호
          </div>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="새 비밀번호"
            autoComplete="new-password"
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ font: "var(--text-label-s)", color: "var(--fg-secondary)", marginBottom: 6 }}>
            새 비밀번호 확인
          </div>
          <Input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="새 비밀번호 확인"
            autoComplete="new-password"
          />
        </div>

        {/* 실시간 검증 체크리스트 */}
        <ul style={{ margin: "0 0 10px", padding: 0, listStyle: "none" }}>
          {pwChecks.map((c) => (
            <li
              key={c.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 0",
                font: "var(--text-caption)",
                color: c.ok ? "var(--fg-success)" : "var(--fg-quaternary)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  flex: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: c.ok ? "var(--bg-success-weak)" : "var(--bg-tertiary)",
                  color: c.ok ? "var(--fg-success)" : "var(--fg-quaternary)",
                }}
              >
                <Icons.check size={10} />
              </span>
              {c.label}
            </li>
          ))}
        </ul>

        {/* 허용 특수문자 안내 (32자) */}
        <p
          style={{
            margin: "0 0 16px",
            font: "var(--text-caption)",
            color: "var(--fg-quaternary)",
            wordBreak: "break-all",
          }}
        >
          허용 특수문자: {SPECIAL_DISPLAY}
        </p>

        <Button
          variant="primary"
          full
          disabled={!pwValid}
          onClick={() => {
            closePwModal();
            setPwDone(true);
          }}
        >
          변경하기
        </Button>
      </Modal>
    </section>
  );
}
