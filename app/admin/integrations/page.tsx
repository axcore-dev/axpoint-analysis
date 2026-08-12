"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Icons, Input, Loader } from "@/components/ui";
import { api } from "@/lib/api";

/**
 * 외부 연동 — API 키 등록·테스트 (어드민)
 * 값은 서버가 AES-256-GCM으로 저장하고 응답은 항상 마스킹(앞 4자)이다. 평문 조회는 없다.
 * 키는 여기 등록한 값만 쓴다 — 서버 env 폴백은 없으므로 미등록 서비스는 동작하지 않는다.
 * 이노비즈·메인비즈 인증은 확인서 API로 사업자번호를 조회한다 — '데이터·메일' 목록의 키 카드로 관리.
 */
type Integration = {
  service: string;
  label: string;
  desc: string;
  group: "data" | "ai";
  keyLabel: string;
  secretLabel: string | null;
  note: string | null;
  keyMasked: string | null;
  secretMasked: string | null;
  corrupted: boolean;
  updatedAt: string | null;
};

type TestResult = { ok: boolean; message: string; latencyMs?: number };

/** 키 발급·관리 콘솔 바로가기 — 값이 만료됐을 때 여기서 바로 재발급한다 */
const ISSUE_URL: Record<string, string> = {
  nts: "https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15081808",
  bizno: "https://bizno.net/",
  dart: "https://opendart.fss.or.kr/mng/apiUsageStatus.do",
  kipris: "https://plus.kipris.or.kr/portal/main.do",
  naver_news: "https://developers.naver.com/apps/#/list",
  procurement: "https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15129394",
  cert_innobiz: "https://portal.smes.go.kr/home/cs/opndata/UI_USR_L_210",
  cert_mainbiz: "https://portal.smes.go.kr/home/cs/opndata/UI_USR_L_210",
  ntis: "https://www.ntis.go.kr/rndopen/api/mng/apiMain.do",
  tavily: "https://app.tavily.com/home",
  resend: "https://resend.com/api-keys",
  openai: "https://platform.openai.com/api-keys",
  claude: "https://console.anthropic.com/settings/keys",
  gemini: "https://aistudio.google.com/apikey",
};

export default function AdminIntegrationsPage() {
  const [items, setItems] = useState<Integration[] | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* 서비스별 입력·진행 상태 */
  const [keyInput, setKeyInput] = useState<Record<string, string>>({});
  const [secretInput, setSecretInput] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, TestResult>>({});
  /* DART 기업코드 색인 */
  const [corpCount, setCorpCount] = useState<number | null>(null);

  const load = useCallback(() => {
    api<{ items: Integration[]; encryptionReady: boolean }>("/api/admin/integrations")
      .then((res) => {
        setItems(res.items);
        setEncryptionReady(res.encryptionReady);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "목록을 불러오지 못했어요."));
    api<{ count: number }>("/api/admin/dart-corp")
      .then((res) => setCorpCount(res.count))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  const save = async (svc: Integration) => {
    const apiKey = keyInput[svc.service]?.trim();
    const apiSecret = secretInput[svc.service]?.trim();
    if (!apiKey && !apiSecret) return;
    setBusy(svc.service);
    setError(null);
    try {
      await api(`/api/admin/integrations/${svc.service}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(apiKey ? { apiKey } : {}),
          ...(apiSecret ? { apiSecret } : {}),
        }),
      });
      setKeyInput((p) => ({ ...p, [svc.service]: "" }));
      setSecretInput((p) => ({ ...p, [svc.service]: "" }));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    } finally {
      setBusy(null);
    }
  };

  const removeKey = async (svc: Integration) => {
    setBusy(svc.service);
    setError(null);
    try {
      await api(`/api/admin/integrations/${svc.service}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제하지 못했어요.");
    } finally {
      setBusy(null);
    }
  };

  const runTest = async (svc: Integration) => {
    setBusy(svc.service);
    setTestResult((p) => {
      const next = { ...p };
      delete next[svc.service];
      return next;
    });
    try {
      const res = await api<TestResult>(`/api/admin/integrations/${svc.service}/test`, {
        method: "POST",
      });
      setTestResult((p) => ({ ...p, [svc.service]: res }));
    } catch (e) {
      setTestResult((p) => ({
        ...p,
        [svc.service]: { ok: false, message: e instanceof Error ? e.message : "테스트 실패" },
      }));
    } finally {
      setBusy(null);
    }
  };

  /* DART는 이름 검색 API가 없어 기업코드 사전을 따로 내려받아 둬야 공시·재무가 조회된다 */
  const refreshCorpIndex = async () => {
    setBusy("dart-corp");
    setTestResult((p) => ({ ...p, dart: { ok: true, message: "기업코드 내려받는 중… (1분 정도)" } }));
    try {
      const res = await api<{ count: number }>("/api/admin/dart-corp/refresh", { method: "POST" });
      setCorpCount(res.count);
      setTestResult((p) => ({
        ...p,
        dart: { ok: true, message: `기업코드 ${res.count.toLocaleString("ko-KR")}건 갱신` },
      }));
    } catch (e) {
      setTestResult((p) => ({
        ...p,
        dart: { ok: false, message: e instanceof Error ? e.message : "갱신 실패" },
      }));
    } finally {
      setBusy(null);
    }
  };

  const issueLink = (service: string) =>
    ISSUE_URL[service] ? (
      <a
        href={ISSUE_URL[service]}
        target="_blank"
        rel="noreferrer"
        title="발급·관리 콘솔 열기"
        aria-label="발급·관리 콘솔 열기"
        style={{ display: "inline-flex", color: "var(--fg-tertiary)" }}
      >
        <Icons.link size={14} />
      </a>
    ) : null;

  const renderCard = (svc: Integration) => {
    const dbSet = svc.keyMasked !== null;
    const result = testResult[svc.service];
    return (
      <Card key={svc.service} radius="xl" padded={false}>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
              {svc.label}
            </span>
            {issueLink(svc.service)}
            {svc.corrupted ? (
              <Badge tone="warning">복호화 오류 — 재등록 필요</Badge>
            ) : dbSet ? (
              <Badge tone="success">등록됨</Badge>
            ) : (
              <Badge tone="outline">미설정</Badge>
            )}
          </div>
          <p style={{ margin: "4px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
            {svc.desc}
            {svc.note ? ` · ${svc.note}` : ""}
          </p>

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span
                style={{
                  font: "var(--text-caption)",
                  color: "var(--fg-tertiary)",
                  minWidth: 90,
                  flex: "none",
                }}
              >
                {svc.keyLabel}
              </span>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Input
                  value={keyInput[svc.service] ?? ""}
                  onChange={(e) => setKeyInput((p) => ({ ...p, [svc.service]: e.target.value }))}
                  placeholder={dbSet ? `${svc.keyMasked} — 새 값 입력 시 교체` : "키 입력"}
                  aria-label={`${svc.label} ${svc.keyLabel}`}
                  autoComplete="off"
                />
              </div>
            </div>
            {svc.secretLabel && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span
                  style={{
                    font: "var(--text-caption)",
                    color: "var(--fg-tertiary)",
                    minWidth: 90,
                    flex: "none",
                  }}
                >
                  {svc.secretLabel}
                </span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Input
                    value={secretInput[svc.service] ?? ""}
                    onChange={(e) =>
                      setSecretInput((p) => ({ ...p, [svc.service]: e.target.value }))
                    }
                    placeholder={
                      svc.secretMasked ? `${svc.secretMasked} — 새 값 입력 시 교체` : "시크릿 입력"
                    }
                    aria-label={`${svc.label} ${svc.secretLabel}`}
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={
                  !encryptionReady ||
                  busy === svc.service ||
                  !(keyInput[svc.service]?.trim() || secretInput[svc.service]?.trim())
                }
                onClick={() => save(svc)}
              >
                저장
              </Button>
              <Button
                variant="utility"
                size="sm"
                disabled={busy === svc.service}
                onClick={() => runTest(svc)}
              >
                {busy === svc.service ? "확인 중" : "테스트"}
              </Button>
              {svc.service === "dart" && (
                <Button
                  variant="utility"
                  size="sm"
                  disabled={busy === "dart-corp"}
                  onClick={refreshCorpIndex}
                >
                  기업코드 색인 {corpCount ? `갱신 (${corpCount.toLocaleString("ko-KR")}건)` : "내려받기"}
                </Button>
              )}
              {dbSet && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy === svc.service}
                  onClick={() => removeKey(svc)}
                >
                  등록 키 삭제
                </Button>
              )}
              {result && (
                <span
                  style={{
                    font: "var(--text-caption)",
                    color: result.ok ? "var(--fg-success, var(--fg-secondary))" : "var(--fg-danger)",
                  }}
                >
                  {result.ok ? "✓" : "✕"} {result.message}
                  {result.latencyMs !== undefined ? ` · ${result.latencyMs}ms` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const sectionTitle = (text: string) => (
    <h2 style={{ margin: 0, font: "var(--text-label-m)", color: "var(--fg-secondary)" }}>{text}</h2>
  );

  return (
    <section style={{ maxWidth: 1440 }}>
      <h1
        style={{
          margin: "0 0 6px",
          font: "var(--text-h4)",
          letterSpacing: "var(--track-heading)",
          color: "var(--fg-primary)",
        }}
      >
        외부 연동
      </h1>
      <p style={{ margin: "0 0 24px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        공공 API·메일·AI 키 등록과 연결 상태 확인 — 값은 암호화 저장, 조회는 마스킹만
      </p>

      {!encryptionReady && items !== null && (
        <Card radius="l" style={{ marginBottom: 16, borderColor: "var(--line-warning, var(--line-default))" }}>
          <p style={{ margin: 0, font: "var(--text-body3)", color: "var(--fg-secondary)" }}>
            서버에 암호화 키(<code style={{ fontFamily: "var(--font-mono)" }}>ADMIN_ENCRYPTION_KEY</code>)가
            없어 키 저장이 비활성 상태예요. 키를 등록할 수 없으면 외부 연동 기능도 동작하지 않아요.
          </p>
        </Card>
      )}

      {error && (
        <p role="alert" style={{ margin: "0 0 12px", font: "var(--text-caption)", color: "var(--fg-danger)" }}>
          {error}
        </p>
      )}

      {items === null ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <Loader />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 420px)",
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {sectionTitle("데이터·메일")}
            {items.filter((s) => s.group === "data").map(renderCard)}
          </div>

          <div style={{ display: "grid", gap: 24 }}>
            <div style={{ display: "grid", gap: 12 }}>
              {sectionTitle("AI API KEY")}
              {items.filter((s) => s.group === "ai").map(renderCard)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
