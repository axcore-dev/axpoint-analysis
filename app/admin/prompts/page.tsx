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
};

export default function AdminPromptsPage() {
  const [items, setItems] = useState<PromptItem[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ items: PromptItem[] }>("/api/admin/prompts")
      .then((res) => {
        setItems(res.items);
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

                  {p.vars.length > 0 && (
                    <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                      자리표시자:{" "}
                      {p.vars.map((v) => (
                        <span key={v.name} style={{ marginRight: 10 }}>
                          <code style={{ fontFamily: "var(--font-mono)", color: "var(--fg-secondary)" }}>
                            {`{${v.name}}`}
                          </code>{" "}
                          {v.desc}
                        </span>
                      ))}
                    </p>
                  )}

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
      )}
    </section>
  );
}
