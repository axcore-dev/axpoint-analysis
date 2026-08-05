"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge, Button, Card, Loader } from "@/components/ui";
import { api } from "@/lib/api";

/**
 * 멀티 에이전트 — 진단 파이프라인을 설정하는 화면 (어드민)
 *
 * 두 탭으로 나눈다.
 *  · 그래프 — 노드(에이전트)와 데이터가 흐르는 방향을 보고, 노드를 눌러 도구·출력 규격·지시문·모델을 편집한다.
 *    노드 카드에는 그 노드가 무엇에 연결돼 있는지(내부 DB / 외부 API)를 함께 표시한다. 키 설정은
 *    '외부 연동' 화면이 원본이라 여기서 하지 않는다 — 어디에 붙어 있는지만 보여준다.
 *  · 실행 로그 — 노드 실행 이력·실패를 진단과 무관하게 최근 순으로 본다. 오류 확인은 여기서 한다.
 *
 * 그래프 구조(노드·엣지)는 서버(agent_graph)가 원본이다. 엣지 편집은 아직 열지 않는다 — 설계.md §7.
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
type ToolMeta = Record<string, { label: string; source: string; external: boolean }>;
type GraphRes = {
  active: { version: number; graph: GraphDef };
  usingDefault: boolean;
  versions: { version: number; isActive: boolean; createdAt: string }[];
  tools: string[];
  toolMeta: ToolMeta;
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
type LogRow = {
  id: string;
  assessmentId: string;
  companyName: string | null;
  nodeId: string;
  status: string;
  durationMs: number | null;
  tokensIn: number;
  tokensOut: number;
  error: string | null;
  createdAt: string;
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
/** 노드 성격을 한눈에 — 아이콘 대신 글자 배지(외부 아이콘 의존 없이 일관된 톤) */
const NODE_MARK: Record<string, { text: string; tone: string }> = {
  collect: { text: "수집", tone: "#0A50FF" },
  classify: { text: "분류", tone: "#7A5AF8" },
  judge: { text: "판정", tone: "#0F9D58" },
  narrative: { text: "서사", tone: "#F59E0B" },
  tasks: { text: "추천", tone: "#EC4899" },
  review: { text: "검증", tone: "#EF4444" },
};

const NODE_W = 236;

/** 그래프 JSON에는 좌표가 없다 — 위상 깊이(가장 긴 선행 경로)로 좌→우 자동 배치한다 */
function layoutNodes(graph: GraphDef, runByNode: Map<string, NodeRun>, toolMeta: ToolMeta): Node[] {
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
    const mark = NODE_MARK[n.id] ?? { text: TYPE_LABEL[n.type].slice(0, 2), tone: "#6B7684" };
    const externals = [
      ...new Set((n.tools ?? []).filter((t) => toolMeta[t]?.external).map((t) => toolMeta[t].source)),
    ];
    return {
      id: n.id,
      position: { x: 40 + d * (NODE_W + 90), y: 40 + lane * 150 },
      data: {
        label: (
          <div style={{ textAlign: "left", display: "flex", gap: 10 }}>
            <span
              aria-hidden
              style={{
                flex: "none",
                width: 34,
                height: 34,
                borderRadius: 9,
                background: `${mark.tone}14`,
                color: mark.tone,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                font: "600 12px/1 var(--font-sans)",
              }}
            >
              {mark.text}
            </span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {run && (
                  <span
                    aria-hidden
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: RUN_TONE[run.status] ?? "var(--grey-400)",
                      flex: "none",
                    }}
                  />
                )}
                <strong style={{ font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
                  {n.label ?? n.id}
                </strong>
              </span>
              <span style={{ display: "block", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                {n.type === "agent" ? `도구 ${n.tools?.length ?? 0}개` : TYPE_LABEL[n.type]}
                {run ? ` · ${run.status}` : ""}
              </span>
              {externals.length > 0 && (
                <span style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                  {externals.map((s) => (
                    <span
                      key={s}
                      style={{
                        font: "10px/1.4 var(--font-sans)",
                        padding: "1px 6px",
                        borderRadius: 999,
                        border: "1px solid var(--line-default)",
                        color: "var(--fg-tertiary)",
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </span>
              )}
            </span>
          </div>
        ),
      },
      style: {
        width: NODE_W,
        borderRadius: 12,
        padding: "10px 12px",
        border: `1px solid ${run?.status === "failed" ? "var(--fg-danger)" : "var(--line-default)"}`,
        background: "var(--bg-elevated)",
        boxShadow: "var(--shadow-1)",
      },
    };
  });
}

export default function AdminAgentsPage() {
  const [tab, setTab] = useState<"graph" | "logs">("graph");
  const [graphRes, setGraphRes] = useState<GraphRes | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [providers, setProviders] = useState<Providers>({});
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  /** 로그에서 펼쳐 본 실행의 상세 트레이스 (진단×노드) */
  const [logDetail, setLogDetail] = useState<{ key: string; run: NodeRun | null } | null>(null);
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
  }, []);
  useEffect(load, [load]);

  const loadLogs = useCallback((failedOnly: boolean) => {
    api<{ items: LogRow[] }>(`/api/admin/agent-logs${failedOnly ? "?status=failed" : ""}`)
      .then((res) => setLogs(res.items))
      .catch((e) => setError(e instanceof Error ? e.message : "로그를 불러오지 못했어요."));
  }, []);
  useEffect(() => {
    if (tab === "logs") loadLogs(onlyFailed);
  }, [tab, onlyFailed, loadLogs]);

  const graph = graphRes?.active.graph;
  const toolMeta = graphRes?.toolMeta ?? {};
  const selected = graph?.nodes.find((n) => n.id === selectedId) ?? null;
  const selectedPrompt = prompts.find((p) => p.key === selected?.promptKey) ?? null;

  const flowNodes = useMemo(
    () => (graph ? layoutNodes(graph, new Map(), toolMeta) : []),
    [graph, toolMeta],
  );
  const flowEdges: Edge[] = useMemo(
    () =>
      (graph?.edges ?? []).map((e) => ({
        id: `${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "var(--grey-400)" },
        style: { stroke: "var(--grey-400)", strokeWidth: 1.4 },
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

  /** 로그 행 펼치기 — 그 진단의 트레이스에서 해당 노드 실행을 찾아 도구 호출·출력을 보여준다 */
  const openLog = async (row: LogRow) => {
    const key = `${row.assessmentId}:${row.nodeId}`;
    if (logDetail?.key === key) {
      setLogDetail(null);
      return;
    }
    setLogDetail({ key, run: null });
    try {
      const res = await api<{ items: NodeRun[] }>(`/api/admin/agent-runs/${row.assessmentId}`);
      setLogDetail({ key, run: res.items.find((r) => r.nodeId === row.nodeId) ?? null });
    } catch {
      setLogDetail({ key, run: null });
    }
  };

  const tabButton = (id: "graph" | "logs", label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        height: 34,
        padding: "0 14px",
        borderRadius: "var(--radius-m)",
        border: "none",
        background: tab === id ? "var(--bg-elevated)" : "transparent",
        boxShadow: tab === id ? "var(--shadow-1)" : "none",
        color: tab === id ? "var(--fg-primary)" : "var(--fg-tertiary)",
        font: "var(--text-label-s)",
        fontFamily: "var(--font-sans)",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );

  return (
    <section style={{ maxWidth: 1440 }}>
      <h1 style={{ margin: "0 0 6px", font: "var(--text-h4)", letterSpacing: "var(--track-heading)", color: "var(--fg-primary)" }}>
        멀티 에이전트
      </h1>
      <p style={{ margin: "0 0 14px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        진단 파이프라인 설정 — 노드를 누르면 도구·출력 규격·지시문·모델을 편집할 수 있어요. 실행 오류는
        실행 로그 탭에서 확인해요. 노드 외 지시문은{" "}
        <a href="/admin/prompts" style={{ color: "var(--fg-brand)" }}>
          지시문 전체 편집
        </a>
        에서 관리해요.
      </p>

      <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: "var(--radius-l)", background: "var(--bg-secondary)", marginBottom: 12 }}>
        {tabButton("graph", "그래프")}
        {tabButton("logs", "실행 로그")}
      </div>

      {error && (
        <p role="alert" style={{ margin: "0 0 12px", font: "var(--text-caption)", color: "var(--fg-danger)" }}>
          {error}
        </p>
      )}
      {msg && <p style={{ margin: "0 0 12px", font: "var(--text-caption)", color: "var(--fg-secondary)" }}>{msg}</p>}

      {tab === "logs" ? (
        <Card radius="xl" padded={false}>
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--line-subtle)" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "var(--text-caption)", color: "var(--fg-secondary)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={onlyFailed}
                onChange={(e) => setOnlyFailed(e.target.checked)}
                style={{ accentColor: "var(--blue-500)" }}
              />
              실패만 보기
            </label>
            <Button variant="ghost" size="sm" onClick={() => loadLogs(onlyFailed)}>
              새로고침
            </Button>
            {logs && (
              <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)", marginLeft: "auto" }}>
                {logs.length}건 · 실패 {logs.filter((l) => l.status === "failed").length}건
              </span>
            )}
          </div>
          {logs === null ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Loader />
            </div>
          ) : logs.length === 0 ? (
            <p style={{ margin: 0, padding: "24px 16px", font: "var(--text-body3)", color: "var(--fg-tertiary)" }}>
              아직 실행 기록이 없어요.
            </p>
          ) : (
            <div>
              {logs.map((l) => {
                const key = `${l.assessmentId}:${l.nodeId}`;
                const open = logDetail?.key === key;
                return (
                  <div key={l.id} style={{ borderBottom: "1px solid var(--line-subtle)" }}>
                    <button
                      type="button"
                      onClick={() => void openLog(l)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 16px",
                        border: "none",
                        background: "transparent",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <span
                        aria-hidden
                        style={{ width: 7, height: 7, borderRadius: 999, background: RUN_TONE[l.status] ?? "var(--grey-400)", flex: "none" }}
                      />
                      <span style={{ font: "var(--text-label-s)", color: "var(--fg-primary)", minWidth: 120 }}>{l.nodeId}</span>
                      <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)", minWidth: 150 }}>
                        {l.companyName ?? "이름 없음"}
                      </span>
                      <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)", fontFamily: "var(--font-mono)", minWidth: 130 }}>
                        {l.createdAt.slice(5, 16).replace("T", " ")}
                      </span>
                      <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)", fontFamily: "var(--font-mono)", minWidth: 70 }}>
                        {l.durationMs != null ? `${(l.durationMs / 1000).toFixed(1)}s` : "-"}
                      </span>
                      <span style={{ font: "var(--text-caption)", color: "var(--fg-quaternary)", fontFamily: "var(--font-mono)", minWidth: 110 }}>
                        in {l.tokensIn.toLocaleString("ko-KR")}
                      </span>
                      <span
                        style={{
                          font: "var(--text-caption)",
                          color: l.status === "failed" ? "var(--fg-danger)" : "var(--fg-tertiary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {l.error ?? l.status}
                      </span>
                    </button>
                    {open && (
                      <div style={{ padding: "0 16px 12px 44px" }}>
                        {logDetail?.run == null ? (
                          <p style={{ margin: 0, font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                            상세 트레이스를 불러오는 중이거나 남아 있지 않아요.
                          </p>
                        ) : (
                          <>
                            {(logDetail.run.steps ?? []).map((s, i) => (
                              <details key={i} style={{ marginBottom: 4 }}>
                                <summary style={{ font: "var(--text-caption)", color: "var(--fg-secondary)", cursor: "pointer" }}>
                                  {i + 1}. {s.tool}
                                </summary>
                                <pre style={{ margin: "4px 0 0", padding: "8px 10px", borderRadius: "var(--radius-m)", background: "var(--bg-secondary)", font: "11px/1.5 var(--font-mono)", color: "var(--fg-secondary)", overflowX: "auto" }}>
                                  {`입력 ${JSON.stringify(s.input)}\n결과 ${s.output}`}
                                </pre>
                              </details>
                            ))}
                            {logDetail.run.output != null && (
                              <pre style={{ margin: "8px 0 0", padding: "10px 12px", borderRadius: "var(--radius-m)", background: "var(--bg-secondary)", font: "12px/1.6 var(--font-mono)", color: "var(--fg-primary)", overflowX: "auto", maxHeight: 280, overflowY: "auto" }}>
                                {JSON.stringify(logDetail.run.output, null, 2)}
                              </pre>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : !graphRes || !graph ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <Loader />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            {graphRes.usingDefault ? (
              <Badge tone="outline">코드 기본 그래프</Badge>
            ) : (
              <Badge tone="success">v{graphRes.active.version} 사용 중</Badge>
            )}
            <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
              노드 {graph.nodes.length} · 연결 {graph.edges.length} — 화살표가 데이터가 흐르는 방향이에요
            </span>
          </div>

          {/* 그래프 캔버스 */}
          <Card radius="xl" padded={false} style={{ height: 460, overflow: "hidden" }}>
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
                    {/* 연결 — 이 노드가 무엇을 보는지. 키 등록은 '외부 연동' 화면이 원본이라 여기서는 표시만 */}
                    <p style={{ margin: "14px 0 6px", font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
                      연결
                      <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)", marginLeft: 8 }}>
                        키 등록은{" "}
                        <a href="/admin/integrations" style={{ color: "var(--fg-brand)" }}>
                          외부 연동
                        </a>
                        에서 해요
                      </span>
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(toolDraft.length ? toolDraft : ["(선택된 도구 없음)"]).map((t) => {
                        const meta = toolMeta[t];
                        return (
                          <span
                            key={t}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "5px 10px",
                              borderRadius: "var(--radius-m)",
                              border: `1px solid ${meta?.external ? "var(--line-brand)" : "var(--line-default)"}`,
                              background: meta?.external ? "var(--bg-brand-weak)" : "transparent",
                              font: "var(--text-caption)",
                              color: meta?.external ? "var(--fg-brand)" : "var(--fg-secondary)",
                            }}
                          >
                            {meta?.label ?? t}
                            {meta && (
                              <span style={{ color: "var(--fg-tertiary)" }}>· {meta.source}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>

                    {/* 도구 체크리스트 — 레지스트리(코드)가 원본, 노드는 부분집합만 고른다 */}
                    <p style={{ margin: "16px 0 6px", font: "var(--text-label-s)", color: "var(--fg-primary)" }}>도구 선택</p>
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
                      <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                        마지막 1스텝은 결론 작성에 쓰여요
                      </span>
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
              </div>
            </Card>
          )}
        </>
      )}
    </section>
  );
}
