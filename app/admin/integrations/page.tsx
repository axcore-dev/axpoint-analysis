"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Input, Loader } from "@/components/ui";
import { api } from "@/lib/api";

/**
 * 외부 연동 — API 키 등록·테스트 (어드민)
 * 값은 서버가 AES-256-GCM으로 저장하고 응답은 항상 마스킹(앞 4자)이다. 평문 조회는 없다.
 * 키를 등록하지 않은 서비스는 서버 env 값으로 동작한다(폴백) — 등록은 선택 사항.
 */
type Integration = {
  service: string;
  label: string;
  desc: string;
  keyLabel: string | null;
  secretLabel: string | null;
  note: string | null;
  keyMasked: string | null;
  secretMasked: string | null;
  envSet: boolean;
  corrupted: boolean;
  testable: boolean;
  updatedAt: string | null;
};

type TestResult = { ok: boolean; message: string; latencyMs?: number };

export default function AdminIntegrationsPage() {
  const [items, setItems] = useState<Integration[] | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /* 서비스별 입력·진행 상태 */
  const [keyInput, setKeyInput] = useState<Record<string, string>>({});
  const [secretInput, setSecretInput] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, TestResult>>({});

  const load = useCallback(() => {
    api<{ items: Integration[]; encryptionReady: boolean }>("/api/admin/integrations")
      .then((res) => {
        setItems(res.items);
        setEncryptionReady(res.encryptionReady);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "목록을 불러오지 못했어요."));
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

  return (
    <section style={{ maxWidth: 1040 }}>
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
            없어 키 저장이 비활성 상태예요. env 폴백으로는 정상 동작해요.
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
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((svc) => {
            const dbSet = svc.keyMasked !== null;
            const result = testResult[svc.service];
            return (
              <Card key={svc.service} radius="xl" padded={false}>
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                      {svc.label}
                    </span>
                    {svc.corrupted ? (
                      <Badge tone="warning">복호화 오류 — 재등록 필요</Badge>
                    ) : dbSet ? (
                      <Badge tone="success">등록됨</Badge>
                    ) : svc.envSet ? (
                      <Badge tone="neutral">env 사용 중</Badge>
                    ) : svc.keyLabel ? (
                      <Badge tone="outline">미설정</Badge>
                    ) : (
                      <Badge tone="outline">출처 미정</Badge>
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                    {svc.desc}
                    {svc.note ? ` · ${svc.note}` : ""}
                  </p>

                  {svc.keyLabel && (
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
                        <div style={{ flex: 1, minWidth: 220 }}>
                          <Input
                            value={keyInput[svc.service] ?? ""}
                            onChange={(e) =>
                              setKeyInput((p) => ({ ...p, [svc.service]: e.target.value }))
                            }
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
                          <div style={{ flex: 1, minWidth: 220 }}>
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
                        {svc.testable && (
                          <Button
                            variant="utility"
                            size="sm"
                            disabled={busy === svc.service}
                            onClick={() => runTest(svc)}
                          >
                            {busy === svc.service ? "확인 중" : "테스트"}
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
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
