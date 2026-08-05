"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge, Button, Card, Loader } from "@/components/ui";
import { api } from "@/lib/api";

/**
 * 멀티 에이전트 — 진단 파이프라인 그래프(노드·엣지)와 노드별 설정·실행 트레이스 (어드민)
 * 그래프 구조는 서버(agent_graph)가 원본이고, 여기서는 노드 속성(도구·스텝 상한·출력 스키마)과
 * 노드가 참조하는 지시문(prompt)·모델을 편집한다. 엣지 편집은 v1에서 열지 않는다 — 설계.md §7.
 * 노드 외 지시문(분류·판정·요약 등)은 기존 /admin/prompts 화면에서 그대로 편집한다.
 */
type GraphNode = {
  id: string;
  type: "agent" | "code" | "hitl";
  label?: string;
  promptKey?: string;
  tools?: string[];
  maxSteps?: number;
  outputSchema?: Record<string, unknown>;
  impl?: string;
};
type GraphDef = { nodes: GraphNode[]; edges: { from: string; to: string }[] };
type GraphRes = {
  active: { version: number; graph: GraphDef };
  usingDefault: boolean;
  versions: { version: number; isActive: boolean; createdAt: string }[];
  tools: string[];
};
type NodeRun = {
  nodeId: string;
  status: string;
  durationMs: number | null;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
  output: unknown;
  steps: { tool: string; input: unknown; output: string }[] | null;
  finishedAt: string | null;
};
type PromptItem = {
  key: string;
  label: string;
  system: string;
  usingDefault: boolean;
  activeVersion: number | null;
  provider: string;
  model: string;
};
type Providers = Record<string, { label: string; models: string[] }>;
type AdminAnalysis = { id: string; companyName: string | null; status: string; createdAt: string };

const TYPE_LABEL: Record<GraphNode["type"], string> = {
  agent: "에이전트",
  code: "코드",
  hitl: "사람 확인",
};
const RUN_TONE: Record<string, string> = {
  succeeded: "var(--fg-success)",
  failed: "var(--fg-danger)",
  running: "var(--fg-brand)",
  waiting_hitl: "var(--fg-warning)",
  queued: "var(--grey-400)",
  skipped: "var(--grey-400)",
};

/** 그래프 JSON에는 좌표가 없다 — 위상 깊이(가장 긴 선행 경로)로 좌→우 자동 배치한다 */
function layoutNodes(graph: GraphDef, runByNode: Map<string, NodeRun>): Node[] {
  const depth = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < graph.nodes.length; i += 1) {
    for (const e of graph.edges) {
      const d = (depth.get(e.from) ?? 0) + 1;
      if (d > (depth.get(e.to) ?? 0)) depth.set(e.to, d);
    }
  }
  const laneIndex = new Map<number, number>();
  return graph.nodes.map((n) => {
    const d = depth.get(n.id) ?? 0;
    const lane = laneIndex.get(d) ?? 0;
    laneIndex.set(d, lane + 1);
    const run = runByNode.get(n.id);
    return {
      id: n.id,
      position: { x: 40 + d * 260, y: 40 + lane * 120 },
      data: {
        label: (
          <div style={{ textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {run && (
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: RUN_TONE[run.status] ?? "var(--grey-400)",
                    flex: "none",
                  }}
                />
              )}
              <strong style={{ font: "var(--text-label-s)" }}>{n.label ?? n.id}</strong>
            </div>
            <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
              {TYPE_LABEL[n.type]}
              {run ? ` · ${run.status}` : ""}
            </span>
          </div>
        ),
      },
      style: {
        width: 200,
        borderRadius: 12,
        padding: "10px 12px",
        border: `1.5px solid ${
          n.type === "agent" ? "var(--blue-500)" : n.type === "hitl" ? "var(--fg-warning)" : "var(--grey-400)"
        }`,
        background:
          n.type === "agent" ? "rgba(10,80,255,0.05)" : n.type === "hitl" ? "rgba(255,160,0,0.06)" : "var(--bg-secondary)",
      },
    };
  });
}

export default function AdminAgentsPage() {
  const [graphRes, setGraphRes] = useState<GraphRes | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [providers, setProviders] = useState<Providers>({});
  const [analyses, setAnalyses] = useState<AdminAnalysis[]>([]);
  const [assessmentId, setAssessmentId] = useState("");
  const [runs, setRuns] = useState<NodeRun[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // 노드 편집 초안 — 선택 시 노드·프롬프트 값으로 채운다
  const [toolDraft, setToolDraft] = useState<string[]>([]);
  const [stepDraft, setStepDraft] = useState(12);
  const [schemaDraft, setSchemaDraft] = useState("");
  const [systemDraft, setSystemDraft] = useState("");

  const load = useCallback(() => {
    api<GraphRes>("/api/admin/agent-graph")
      .then(setGraphRes)
      .catch((e) => setError(e instanceof Error ? e.message : "그래프를 불러오지 못했어요."));
    api<{ items: PromptItem[]; providers: Providers }>("/api/admin/prompts")
      .then((res) => {
        setPrompts(res.items);
        setProviders(res.providers);
      })
      .catch(() => {});
    api<{ items: AdminAnalysis[] }>("/api/admin/analyses")
      .then((res) => setAnalyses(res.items.slice(0, 20)))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  const loadRuns = useCallback((id: string) => {
    if (!id) return;
    api<{ items: NodeRun[] }>(`/api/admin/agent-runs/${id}`)
      .then((res) => setRuns(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "트레이스를 불러오지 못했어요."));
  }, []);

  /* 실행 중인 노드가 있으면 트레이스를 폴링한다 — SSE 없이 화면만 가볍게 */
  useEffect(() => {
    if (!assessmentId || !runs?.some((r) => r.status === "running" || r.status === "queued")) return;
    const t = setInterval(() => loadRuns(assessmentId), 2500);
    return () => clearInterval(t);
  }, [assessmentId, runs, loadRuns]);

  const graph = graphRes?.active.graph;
  const selected = graph?.nodes.find((n) => n.id === selectedId) ?? null;
  const selectedPrompt = prompts.find((p) => p.key === selected?.promptKey) ?? null;
  const runByNode = useMemo(
    () => new Map((runs ?? []).map((r) => [r.nodeId, r])),
    [runs],
  );
  const selectedRun = selected ? (runByNode.get(selected.id) ?? null) : null;

  const flowNodes = useMemo(
    () => (graph ? layoutNodes(graph, runByNode) : []),
    [graph, runByNode],
  );
  const flowEdges: Edge[] = useMemo(
    () =>
      (graph?.edges ?? []).map((e) => ({
        id: `${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        animated: true,
      })),
    [graph],
  );

  /** 노드 선택 — 편집 초안을 현재 값으로 채운다 */
  const selectNode = (id: string) => {
    setSelectedId(id);
    setMsg(null);
    const node = graph?.nodes.find((n) => n.id === id);
    if (!node) return;
    setToolDraft(node.tools ?? []);
    setStepDraft(node.maxSteps ?? 12);
    setSchemaDraft(JSON.stringify(node.outputSchema ?? {}, null, 2));
    const p = prompts.find((x) => x.key === node.promptKey);
    setSystemDraft(p?.system ?? "");
  };

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await fn();
      setMsg(done);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  /** 노드 속성 저장 — 그래프 새 버전 저장 후 즉시 발행(검증 실패 시 발행 단계에서 막힌다) */
  const saveNode = () => {
    if (!graph || !selected) return;
    let outputSchema: Record<string, unknown>;
    try {
      outputSchema = JSON.parse(schemaDraft) as Record<string, unknown>;
    } catch {
      setError("출력 스키마가 올바른 JSON이 아니에요.");
      return;
    }
    const next: GraphDef = {
      ...graph,
      nodes: graph.nodes.map((n) =>
        n.id === selected.id ? { ...n, tools: toolDraft, maxSteps: stepDraft, outputSchema } : n,
      ),
    };
    void run(async () => {
      const saved = await api<{ version: number }>("/api/admin/agent-graph", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      await api("/api/admin/agent-graph/activate", {
        method: "POST",
        body: JSON.stringify({ version: saved.version }),
      });
    }, "그래프 새 버전을 발행했어요");
  };

  return (
    <section style={{ maxWidth: 1440 }}>
      <h1 style={{ margin: "0 0 6px", font: "var(--text-h4)", letterSpacing: "var(--track-heading)", color: "var(--fg-primary)" }}>
        멀티 에이전트
      </h1>
      <p style={{ margin: "0 0 16px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        진단 파이프라인 그래프 — 노드를 누르면 도구·출력 규격·지시문을 편집할 수 있어요. 연결(엣지) 편집은
        아직 열지 않았어요. 노드 외 지시문은{" "}
        <a href="/admin/prompts" style={{ color: "var(--fg-brand)" }}>
          지시문 전체 편집
        </a>
        에서 관리해요.
      </p>

      {error && (
        <p role="alert" style={{ margin: "0 0 12px", font: "var(--text-caption)", color: "var(--fg-danger)" }}>
          {error}
        </p>
      )}
      {msg && <p style={{ margin: "0 0 12px", font: "var(--text-caption)", color: "var(--fg-secondary)" }}>{msg}</p>}

      {!graphRes || !graph ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <Loader />
        </div>
      ) : (
        <>
          {/* 파일럿 실행 — 진단 건을 골라 그래프를 수동으로 태운다 (기존 수집·판정 경로와 별개) */}
          <Card radius="xl" padded={false} style={{ marginBottom: 12 }}>
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {graphRes.usingDefault ? (
                <Badge tone="outline">코드 기본 그래프</Badge>
              ) : (
                <Badge tone="success">v{graphRes.active.version} 사용 중</Badge>
              )}
              <select
                value={assessmentId}
                onChange={(e) => {
                  setAssessmentId(e.target.value);
                  setRuns(null);
                  if (e.target.value) loadRuns(e.target.value);
                }}
                style={{ height: 32, padding: "0 8px", borderRadius: "var(--radius-m)", border: "1px solid var(--line-default)", background: "transparent", color: "var(--fg-secondary)", font: "var(--text-caption)", maxWidth: 320 }}
                aria-label="파일럿을 실행할 진단"
              >
                <option value="">파일럿 실행할 진단 선택…</option>
                {analyses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {(a.companyName ?? "이름 없음") + " · " + a.createdAt.slice(0, 10) + " · " + a.status}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy || !assessmentId}
                onClick={() =>
                  void run(async () => {
                    await api(`/api/admin/agent-runs/${assessmentId}/start`, { method: "POST" });
                    loadRuns(assessmentId);
                  }, "그래프 실행을 시작했어요 — 노드 상태가 그래프에 표시돼요")
                }
              >
                파일럿 실행
              </Button>
              <Button variant="ghost" size="sm" disabled={!assessmentId} onClick={() => loadRuns(assessmentId)}>
                트레이스 새로고침
              </Button>
              {runs && (
                <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                  토큰 입력 {runs.reduce((a, r) => a + r.tokensIn, 0).toLocaleString("ko-KR")} · 출력{" "}
                  {runs.reduce((a, r) => a + r.tokensOut, 0).toLocaleString("ko-KR")}
                </span>
              )}
            </div>
          </Card>

          {/* 그래프 캔버스 */}
          <Card radius="xl" padded={false} style={{ height: 380, overflow: "hidden" }}>
            <ReactFlow
              nodes={flowNodes}
              edges={flowEdges}
              onNodeClick={(_e, node) => selectNode(node.id)}
              fitView
              proOptions={{ hideAttribution: true }}
              nodesConnectable={false}
              deleteKeyCode={null}
            >
              <Background gap={20} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </Card>

          {/* 선택 노드 상세 */}
          {selected && (
            <Card radius="xl" padded={false} style={{ marginTop: 12 }}>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ font: "var(--text-label-m)", color: "var(--fg-primary)" }}>
                    {selected.label ?? selected.id}
                  </span>
                  <Badge tone={selected.type === "agent" ? "accent" : "neutral"}>{TYPE_LABEL[selected.type]}</Badge>
                  {selectedRun && (
                    <Badge tone={selectedRun.status === "succeeded" ? "success" : selectedRun.status === "failed" ? "danger" : "neutral"}>
                      {selectedRun.status}
                      {selectedRun.durationMs != null ? ` · ${(selectedRun.durationMs / 1000).toFixed(1)}s` : ""}
                    </Badge>
                  )}
                </div>

                {selected.type === "code" && (
                  <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                    코드 노드 — 점수 환산·달성 조건 같은 산식은 코드가 원본이라 여기서 편집하지 않아요 (impl:{" "}
                    <code style={{ fontFamily: "var(--font-mono)" }}>{selected.impl}</code>)
                  </p>
                )}
                {selected.type === "hitl" && (
                  <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                    사람 확인 노드 — 담당자가 확인을 마치면 다음 노드로 이어져요
                  </p>
                )}

                {selected.type === "agent" && (
                  <>
                    {/* 도구 체크리스트 — 레지스트리(코드)가 원본, 노드는 부분집합만 고른다 */}
                    <p style={{ margin: "14px 0 6px", font: "var(--text-label-s)", color: "var(--fg-primary)" }}>도구</p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {graphRes.tools.map((t) => {
                        const on = toolDraft.includes(t);
                        return (
                          <label
                            key={t}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: "var(--radius-m)", border: `1px solid ${on ? "var(--blue-500)" : "var(--line-default)"}`, font: "var(--text-caption)", color: on ? "var(--fg-brand)" : "var(--fg-secondary)", cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setToolDraft((d) => (on ? d.filter((x) => x !== t) : [...d, t]))
                              }
                              style={{ accentColor: "var(--blue-500)" }}
                            />
                            {t}
                          </label>
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                      <span style={{ font: "var(--text-label-s)", color: "var(--fg-primary)" }}>도구 호출 상한</span>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={stepDraft}
                        onChange={(e) => setStepDraft(Number(e.target.value))}
                        style={{ width: 72, height: 32, padding: "0 8px", borderRadius: "var(--radius-m)", border: "1px solid var(--line-default)", background: "transparent", color: "var(--fg-primary)", font: "var(--text-caption)" }}
                        aria-label="도구 호출 상한"
                      />
                    </div>

                    <p style={{ margin: "14px 0 6px", font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
                      출력 스키마 (JSON Schema)
                    </p>
                    <textarea
                      value={schemaDraft}
                      onChange={(e) => setSchemaDraft(e.target.value)}
                      spellCheck={false}
                      rows={Math.min(16, schemaDraft.split("\n").length + 1)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-m)", border: "1px solid var(--line-default)", background: "var(--bg-surface, transparent)", color: "var(--fg-primary)", fontFamily: "var(--font-mono)", fontSize: 12.5, lineHeight: 1.5, resize: "vertical" }}
                      aria-label="출력 스키마"
                    />
                    <div style={{ marginTop: 8 }}>
                      <Button variant="secondary" size="sm" disabled={busy} onClick={saveNode}>
                        노드 저장 · 발행
                      </Button>
                    </div>

                    {/* 지시문·모델 — prompt 테이블 원본을 그대로 편집 (기존 프롬프트 API 재사용) */}
                    {selectedPrompt && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                          <span style={{ font: "var(--text-label-s)", color: "var(--fg-primary)" }}>지시문</span>
                          {selectedPrompt.usingDefault ? (
                            <Badge tone="outline">코드 기본값</Badge>
                          ) : (
                            <Badge tone="success">v{selectedPrompt.activeVersion} 사용 중</Badge>
                          )}
                          <select
                            value={selectedPrompt.provider}
                            disabled={busy}
                            onChange={(e) => {
                              const provider = e.target.value;
                              const models = providers[provider]?.models ?? [];
                              void run(
                                () =>
                                  api(`/api/admin/prompts/${selectedPrompt.key}/model`, {
                                    method: "PUT",
                                    body: JSON.stringify({ provider, model: models[0] ?? selectedPrompt.model }),
                                  }),
                                "모델을 저장했어요",
                              );
                            }}
                            style={{ height: 32, padding: "0 8px", borderRadius: "var(--radius-m)", border: "1px solid var(--line-default)", background: "transparent", color: "var(--fg-secondary)", font: "var(--text-caption)" }}
                            aria-label="공급자"
                          >
                            {Object.entries(providers).map(([id, prov]) => (
                              <option key={id} value={id}>
                                {prov.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={selectedPrompt.model}
                            disabled={busy}
                            onChange={(e) =>
                              void run(
                                () =>
                                  api(`/api/admin/prompts/${selectedPrompt.key}/model`, {
                                    method: "PUT",
                                    body: JSON.stringify({ provider: selectedPrompt.provider, model: e.target.value }),
                                  }),
                                "모델을 저장했어요",
                              )
                            }
                            style={{ height: 32, padding: "0 8px", borderRadius: "var(--radius-m)", border: "1px solid var(--line-default)", background: "transparent", color: "var(--fg-secondary)", font: "var(--text-caption)" }}
                            aria-label="모델"
                          >
                            {(providers[selectedPrompt.provider]?.models ?? [selectedPrompt.model]).map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <textarea
                          value={systemDraft}
                          onChange={(e) => setSystemDraft(e.target.value)}
                          spellCheck={false}
                          rows={Math.min(18, systemDraft.split("\n").length + 2)}
                          style={{ width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: "var(--radius-m)", border: "1px solid var(--line-default)", background: "var(--bg-surface, transparent)", color: "var(--fg-primary)", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, resize: "vertical" }}
                          aria-label="지시문"
                        />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy || systemDraft === selectedPrompt.system || systemDraft.trim().length < 10}
                            onClick={() =>
                              void run(
                                () =>
                                  api(`/api/admin/prompts/${selectedPrompt.key}`, {
                                    method: "PUT",
                                    body: JSON.stringify({ system: systemDraft }),
                                  }),
                                "지시문을 새 버전으로 저장했어요",
                              )
                            }
                          >
                            지시문 저장
                          </Button>
                          {!selectedPrompt.usingDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  () => api(`/api/admin/prompts/${selectedPrompt.key}`, { method: "DELETE" }),
                                  "코드 기본값으로 되돌렸어요",
                                )
                              }
                            >
                              기본값으로
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* 실행 결과 — 도구 호출 로그와 최종 출력 */}
                {selectedRun && (
                  <div style={{ marginTop: 20 }}>
                    <p style={{ margin: "0 0 6px", font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
                      실행 트레이스
                      <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)", marginLeft: 8 }}>
                        토큰 입력 {selectedRun.tokensIn.toLocaleString("ko-KR")} · 출력{" "}
                        {selectedRun.tokensOut.toLocaleString("ko-KR")}
                      </span>
                    </p>
                    {selectedRun.error && (
                      <p style={{ margin: "0 0 8px", font: "var(--text-caption)", color: "var(--fg-danger)" }}>
                        {selectedRun.error}
                      </p>
                    )}
                    {(selectedRun.steps ?? []).map((s, i) => (
                      <details key={i} style={{ marginBottom: 4 }}>
                        <summary style={{ font: "var(--text-caption)", color: "var(--fg-secondary)", cursor: "pointer" }}>
                          {i + 1}. {s.tool}
                        </summary>
                        <pre style={{ margin: "4px 0 0", padding: "8px 10px", borderRadius: "var(--radius-m)", background: "var(--bg-secondary)", font: "11px/1.5 var(--font-mono)", color: "var(--fg-secondary)", overflowX: "auto" }}>
                          {`입력 ${JSON.stringify(s.input)}\n결과 ${s.output}`}
                        </pre>
                      </details>
                    ))}
                    {selectedRun.output != null && (
                      <pre style={{ margin: "8px 0 0", padding: "10px 12px", borderRadius: "var(--radius-m)", background: "var(--bg-secondary)", font: "12px/1.6 var(--font-mono)", color: "var(--fg-primary)", overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
                        {JSON.stringify(selectedRun.output, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
