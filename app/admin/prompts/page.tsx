"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Loader } from "@/components/ui";
import { api } from "@/lib/api";

/**
 * 프롬프트 — AI에 주는 system 지시문 편집 (어드민)
 * 저장하면 새 버전이 쌓이고 그 버전만 활성이 된다. '기본값으로'를 누르면 코드 값으로 돌아간다.
 * 사용자 메시지(문항·근거·수집 항목)는 코드가 조립하므로 여기서 다루지 않는다.
 */
type PromptItem = {
  key: string;
  label: string;
  desc: string;
  vars: { name: string; desc: string }[];
  guard: boolean;
  defaultSystem: string;
  system: string;
  usingDefault: boolean;
  activeVersion: number | null;
  versions: { version: number; isActive: boolean; createdAt: string }[];
  /** 이 프롬프트가 실제 호출에 쓰는 공급자·모델 */
  provider: string;
  model: string;
};

type Providers = Record<string, { label: string; models: string[] }>;

export default function AdminPromptsPage() {
  const [items, setItems] = useState<PromptItem[] | null>(null);
  const [providers, setProviders] = useState<Providers>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ items: PromptItem[]; providers: Providers }>("/api/admin/prompts")
      .then((res) => {
        setItems(res.items);
        setProviders(res.providers);
        setDraft(Object.fromEntries(res.items.map((p) => [p.key, p.system])));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했어요."));
  }, []);
  useEffect(load, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setError(null);
    setMsg((p) => ({ ...p, [key]: "" }));
    try {
      await fn();
      setMsg((p) => ({ ...p, [key]: done }));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했어요.");
    } finally {
      setBusy(null);
    }
  };

  /** 공급자·모델 저장 — 선택 즉시 반영. 해당 공급자 키는 외부 연동에 등록돼 있어야 호출된다 */
  const saveModel = (key: string, provider: string, model: string) =>
    run(
      key,
      () =>
        api(`/api/admin/prompts/${key}/model`, {
          method: "PUT",
          body: JSON.stringify({ provider, model }),
        }),
      "모델을 저장했어요",
    );

  const selectStyle: React.CSSProperties = {
    height: 32,
    padding: "0 8px",
    borderRadius: "var(--radius-m)",
    border: "1px solid var(--line-default)",
    background: "transparent",
    color: "var(--fg-secondary)",
    font: "var(--text-caption)",
  };

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
        프롬프트
      </h1>
      <p style={{ margin: "0 0 24px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        AI에 주는 지시문 — 저장하면 새 버전으로 쌓이고, 언제든 이전 버전이나 기본값으로 되돌릴 수 있어요
      </p>

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
            gridTemplateColumns: "minmax(0, 1fr) 300px",
            gap: 16,
            alignItems: "start",
          }}
        >
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((p) => {
            const changed = (draft[p.key] ?? "") !== p.system;
            return (
              <Card key={p.key} radius="xl" padded={false}>
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                      {p.label}
                    </span>
                    {p.usingDefault ? (
                      <Badge tone="outline">코드 기본값</Badge>
                    ) : (
                      <Badge tone="success">v{p.activeVersion} 사용 중</Badge>
                    )}
                    {p.guard && <Badge tone="neutral">주입 방어 자동 유지</Badge>}
                  </div>
                  <p style={{ margin: "4px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                    {p.desc}
                  </p>

                  {/* 공급자·모델 — 이 프롬프트의 실제 호출 대상. 선택 즉시 저장된다 */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                    <select
                      value={p.provider}
                      disabled={busy === p.key}
                      onChange={(e) => {
                        const provider = e.target.value;
                        const models = providers[provider]?.models ?? [];
                        void saveModel(p.key, provider, models[0] ?? p.model);
                      }}
                      style={selectStyle}
                      aria-label={`${p.label} 공급자`}
                    >
                      {Object.entries(providers).map(([id, prov]) => (
                        <option key={id} value={id}>
                          {prov.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={p.model}
                      disabled={busy === p.key}
                      onChange={(e) => void saveModel(p.key, p.provider, e.target.value)}
                      style={selectStyle}
                      aria-label={`${p.label} 모델`}
                    >
                      {(providers[p.provider]?.models ?? [p.model]).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    value={draft[p.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.key]: e.target.value }))}
                    spellCheck={false}
                    rows={Math.min(20, (draft[p.key] ?? "").split("\n").length + 2)}
                    style={{
                      width: "100%",
                      marginTop: 12,
                      padding: "10px 12px",
                      borderRadius: "var(--radius-m)",
                      border: "1px solid var(--line-default)",
                      background: "var(--bg-surface, transparent)",
                      color: "var(--fg-primary)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      lineHeight: 1.6,
                      resize: "vertical",
                    }}
                    aria-label={`${p.label} 지시문`}
                  />

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy === p.key || !changed || (draft[p.key] ?? "").trim().length < 10}
                      onClick={() =>
                        run(
                          p.key,
                          () =>
                            api(`/api/admin/prompts/${p.key}`, {
                              method: "PUT",
                              body: JSON.stringify({ system: draft[p.key] }),
                            }),
                          "새 버전으로 저장했어요",
                        )
                      }
                    >
                      저장
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy === p.key || !changed}
                      onClick={() => setDraft((d) => ({ ...d, [p.key]: p.system }))}
                    >
                      편집 취소
                    </Button>
                    {!p.usingDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === p.key}
                        onClick={() =>
                          run(
                            p.key,
                            () => api(`/api/admin/prompts/${p.key}`, { method: "DELETE" }),
                            "코드 기본값으로 되돌렸어요",
                          )
                        }
                      >
                        기본값으로
                      </Button>
                    )}
                    {p.versions.length > 0 && (
                      <select
                        value=""
                        disabled={busy === p.key}
                        onChange={(e) => {
                          const version = Number(e.target.value);
                          if (!version) return;
                          run(
                            p.key,
                            () =>
                              api(`/api/admin/prompts/${p.key}/activate`, {
                                method: "POST",
                                body: JSON.stringify({ version }),
                              }),
                            `v${version}으로 되돌렸어요`,
                          );
                        }}
                        style={{
                          height: 32,
                          padding: "0 8px",
                          borderRadius: "var(--radius-m)",
                          border: "1px solid var(--line-default)",
                          background: "transparent",
                          color: "var(--fg-secondary)",
                          font: "var(--text-caption)",
                        }}
                        aria-label={`${p.label} 이전 버전으로 되돌리기`}
                      >
                        <option value="">이전 버전으로…</option>
                        {p.versions.map((v) => (
                          <option key={v.version} value={v.version}>
                            v{v.version} · {v.createdAt.slice(0, 10)}
                            {v.isActive ? " (사용 중)" : ""}
                          </option>
                        ))}
                      </select>
                    )}
                    {msg[p.key] && (
                      <span style={{ font: "var(--text-caption)", color: "var(--fg-secondary)" }}>
                        {msg[p.key]}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* 우측 패널 — 프롬프트별 자리표시자 모음. 지시문에 {이름} 그대로 쓰면 저장 시 치환된다 */}
        <Card radius="xl" padded={false} style={{ position: "sticky", top: 24 }}>
          <div style={{ padding: "16px 20px" }}>
            <p style={{ margin: 0, font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
              자리표시자
            </p>
            <p style={{ margin: "4px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
              지시문에 아래 이름을 그대로 쓰면 실행 시 값으로 치환돼요
            </p>
            {items.filter((p) => p.vars.length > 0).length === 0 ? (
              <p style={{ margin: "12px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                자리표시자를 쓰는 프롬프트가 없어요
              </p>
            ) : (
              items
                .filter((p) => p.vars.length > 0)
                .map((p) => (
                  <div key={p.key} style={{ marginTop: 14 }}>
                    <p style={{ margin: 0, font: "var(--text-caption)", color: "var(--fg-secondary)", fontWeight: 600 }}>
                      {p.label}
                    </p>
                    {p.vars.map((v) => (
                      <p key={v.name} style={{ margin: "4px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                        <code style={{ fontFamily: "var(--font-mono)", color: "var(--fg-secondary)" }}>
                          {`{${v.name}}`}
                        </code>{" "}
                        {v.desc}
                      </p>
                    ))}
                  </div>
                ))
            )}
          </div>
        </Card>
        </div>
      )}
    </section>
  );
}
