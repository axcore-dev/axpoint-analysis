"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AgentCanvas,
  type CanvasPrompt,
  type FlowMain,
  type GraphDef,
  type ToolMeta,
} from "@/components/admin/AgentCanvas";
import { FieldHelp, HelpExample } from "@/components/admin/FieldHelp";
import { diffCounts, diffLines, PromptDiff } from "@/components/admin/PromptDiff";
import { Badge, Button, Card, Loader, Modal } from "@/components/ui";
import { api } from "@/lib/api";

/**
 * 멀티 에이전트 — 진단 파이프라인을 설정하는 화면 (어드민)
 *
 * 두 탭으로 나눈다.
 *  · 그래프 — 메인 에이전트를 사용자 동선 순서로 잇고, 그 메인을 거드는 지시문(전처리·폴백·보조·
 *    후처리·파일럿)을 서브로 매단 관계도. **편집 가능한 지시문이 전부** 노드로 올라가 있다.
 *    노드를 누르면 팝업에서 지시문·모델을 편집하고, 도구를 쓰는 에이전트면 도구·출력 규격도 함께 편집한다.
 *    에이전트 위에는 그 에이전트가 부르는 외부 API를, 아래에는 쓸 수 있는 도구를 매단다(작업요청 v6-1).
 *    키 등록은 '외부 연동' 화면이 원본이라 여기서 하지 않는다 — 어디에 붙어 있는지만 보여준다.
 *  · 실행 로그 — 노드 실행 이력·실패를 진단과 무관하게 최근 순으로 본다. 오류 확인은 여기서 한다.
 *
 * 지시문 편집 화면(/admin/prompts)은 2026-08-07에 이 화면으로 합쳤다 — 링크로만 들어갈 수 있어
 * 공개데이터 수집·요약 지시문이 어디서 고치는지 보이지 않았다. 지시문은 전부 이 캔버스에 있다.
 */
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
type PromptItem = CanvasPrompt & {
  desc: string;
  vars: { name: string; desc: string }[];
  guard: boolean;
  /** 코드 기본값(v0) 내용 — '수정됨' 판별과 v0 비교 diff의 기준 */
  defaultSystem: string;
  system: string;
  versions: { version: number; isActive: boolean; createdAt: string }[];
};
type Providers = Record<string, { label: string; models: string[] }>;
/** 모델별 스펙 — 백엔드 메타 응답에 실리는 계약. 배포 전이면 필드가 없으니 전부 옵셔널로 받는다 */
type ModelMeta = Record<
  string,
  { contextK?: number; inPer1M?: number; outPer1M?: number; structured?: boolean; tier?: string }
>;

const RUN_TONE: Record<string, string> = {
  succeeded: "var(--fg-success)",
  failed: "var(--fg-danger)",
  running: "var(--fg-brand)",
  waiting_hitl: "var(--fg-warning)",
  queued: "var(--grey-400)",
  skipped: "var(--grey-400)",
};

export default function AdminAgentsPage() {
  const [tab, setTab] = useState<"graph" | "logs">("graph");
  const [graphRes, setGraphRes] = useState<GraphRes | null>(null);
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [flow, setFlow] = useState<FlowMain[]>([]);
  const [providers, setProviders] = useState<Providers>({});
  const [modelMeta, setModelMeta] = useState<ModelMeta>({});
  /** 프롬프트 키 → 권장(코드 기본) 모델 */
  const [recommended, setRecommended] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  /** 로그에서 펼쳐 본 실행의 상세 트레이스 (진단×노드) */
  const [logDetail, setLogDetail] = useState<{ key: string; run: NodeRun | null } | null>(null);
  /** 편집 중인 지시문 키 — 그래프 노드가 아니라 지시문이 선택 단위다 */
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // 노드 편집 초안 — 선택 시 노드·프롬프트 값으로 채운다
  const [toolDraft, setToolDraft] = useState<string[]>([]);
  const [stepDraft, setStepDraft] = useState(12);
  const [schemaDraft, setSchemaDraft] = useState("");
  const [systemDraft, setSystemDraft] = useState("");
  /** 편집 중 텍스트를 v0(코드 기본값)과 줄 단위로 비교하는 패널 표시 여부 */
  const [showDiff, setShowDiff] = useState(false);
  /** 저장은 2단계 — 변경 요약(추가·삭제 줄 수)을 먼저 보여주고 확정을 받는다 */
  const [confirmSave, setConfirmSave] = useState(false);
  const sysRef = useRef<HTMLTextAreaElement | null>(null);

  const load = useCallback(() => {
    api<GraphRes>("/api/admin/agent-graph")
      .then(setGraphRes)
      .catch((e) => setError(e instanceof Error ? e.message : "그래프를 불러오지 못했어요."));
    api<{
      items: PromptItem[];
      providers: Providers;
      flow: FlowMain[];
      modelMeta?: ModelMeta;
      recommended?: Record<string, string>;
    }>("/api/admin/prompts")
      .then((res) => {
        setPrompts(res.items);
        setProviders(res.providers);
        setFlow(res.flow);
        // 모델 스펙·권장 모델은 서버가 아직 안 실어 줄 수 있다 — 없으면 표시만 조용히 생략
        setModelMeta(res.modelMeta ?? {});
        setRecommended(res.recommended ?? {});
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
  const selected = prompts.find((p) => p.key === selectedKey) ?? null;
  /** 이 지시문을 쓰는 그래프 노드 — 없으면 코드가 직접 부르는 단일 호출이다 */
  const selectedNode = graph?.nodes.find((n) => n.promptKey === selectedKey) ?? null;
  const isAgent = selectedNode?.type === "agent";

  /** 코드 기본값과 다른 내용으로 운영 중인가 — 저장 버전이 활성이어도 내용이 같으면 수정으로 안 친다 */
  const isModified = (p: PromptItem) =>
    !p.usingDefault && p.defaultSystem != null && p.system !== p.defaultSystem;
  /** v0(코드 기본값) 내용 — 목록 응답에 이미 실려 온다(defaultSystem) */
  const v0System = selected?.defaultSystem ?? "";
  /** v0에는 있는데 편집본에서 빠진 자리표시자 — 실행 때 값이 채워지지 않으니 경고한다 */
  const missingVars = selected
    ? selected.vars
        .map((v) => v.name)
        .filter((n) => v0System.includes(`{${n}}`) && !systemDraft.includes(`{${n}}`))
    : [];

  /** 지시문 선택 — 편집 팝업을 열고 초안을 현재 값으로 채운다 */
  const selectPrompt = (key: string) => {
    setSelectedKey(key);
    setMsg(null);
    const p = prompts.find((x) => x.key === key);
    setSystemDraft(p?.system ?? "");
    setShowDiff(false);
    setConfirmSave(false);
    const node = graph?.nodes.find((n) => n.promptKey === key);
    setToolDraft(node?.tools ?? []);
    setStepDraft(node?.maxSteps ?? 12);
    setSchemaDraft(JSON.stringify(node?.outputSchema ?? {}, null, 2));
  };

  /** 자리표시자 클릭 삽입 — 커서 위치에 {이름}을 넣고 커서를 그 뒤로 옮긴다 */
  const insertVar = (name: string) => {
    const token = `{${name}}`;
    const el = sysRef.current;
    const start = el?.selectionStart ?? systemDraft.length;
    const end = el?.selectionEnd ?? start;
    setSystemDraft(systemDraft.slice(0, start) + token + systemDraft.slice(end));
    setConfirmSave(false);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
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
    if (!graph || !selectedNode) return;
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
        n.id === selectedNode.id ? { ...n, tools: toolDraft, maxSteps: stepDraft, outputSchema } : n,
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
      <h1 style={{ margin: "0 0 6px", font: "var(--text-h4)", letterSpacing: "var(--track-heading)", color: "var(--fg-primary)" }}>
        멀티 에이전트
      </h1>
      <p style={{ margin: "0 0 14px", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
        진단 파이프라인 설정 — 메인 에이전트를 진단이 흐르는 순서대로 잇고, 그 메인을 거드는 지시문을
        아래에 매달아 두었어요. 노드를 누르면 지시문·모델을, 도구를 쓰는 에이전트면 도구·출력 규격까지
        편집할 수 있어요. 실행 오류는 실행 로그 탭에서 확인해요.
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
      ) : !graphRes || !graph || prompts.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <Loader />
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {graphRes.usingDefault ? (
              <Badge tone="outline">코드 기본 그래프</Badge>
            ) : (
              <Badge tone="success">v{graphRes.active.version} 사용 중</Badge>
            )}
            <span style={{ font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
              지시문 {prompts.length} · 메인 에이전트 {flow.length} · 도구를 쓰는 에이전트{" "}
              {graph.nodes.filter((n) => n.type === "agent").length} — 실선 화살표가 진단이 흐르는
              방향이고, 점선으로 매달린 것은 위가 외부 API·아래가 그 에이전트의 도구예요. 왼쪽 통로로
              내려간 작은 카드는 그 메인을 거드는 서브 지시문이에요. 노드를 누르면 편집 팝업이 열려요.
            </span>
          </div>

          {/* 코드 기본값과 다른 지시문으로 도는 것들 — 노드를 일일이 열지 않아도 한눈에 보인다 */}
          {(() => {
            const modified = prompts.filter(isModified);
            if (modified.length === 0) return null;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                <Badge tone="warning">수정됨 {modified.length}</Badge>
                {modified.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => selectPrompt(p.key)}
                    title="코드 기본값(v0)과 다른 지시문으로 운영 중 — 누르면 편집 팝업이 열려요"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      height: 24,
                      padding: "0 9px",
                      borderRadius: "var(--radius-m)",
                      border: "1px solid var(--line-default)",
                      background: "transparent",
                      font: "var(--text-caption)",
                      color: "var(--fg-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    {p.label}
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-quaternary)" }}>
                      v{p.activeVersion}
                    </span>
                  </button>
                ))}
              </div>
            );
          })()}

          {/* 캔버스 — 단계별 열, 각 열에 그 단계에서 도는 지시문 */}
          <Card radius="xl" padded={false} style={{ overflow: "hidden" }}>
            <AgentCanvas
              graph={graph}
              prompts={prompts}
              flow={flow}
              toolMeta={toolMeta}
              selectedKey={selectedKey}
              onSelect={selectPrompt}
            />
          </Card>

          {/* 선택한 지시문 편집 — 팝업 (v6-1, v7-3에서 프롬프트 화면 흡수) */}
          <Modal
            open={selected !== null}
            onClose={() => setSelectedKey(null)}
            title={selected ? `${selected.label} · ${selected.key}` : ""}
            xl
          >
            {selected && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Badge tone={isAgent ? "accent" : "neutral"}>
                    {isAgent ? "에이전트 (도구 사용)" : "단일 호출"}
                  </Badge>
                  {selected.usingDefault ? (
                    <Badge tone="outline">코드 기본값</Badge>
                  ) : (
                    <Badge tone="success">v{selected.activeVersion} 사용 중</Badge>
                  )}
                  {isModified(selected) && (
                    <Badge tone="warning" title="코드 기본값(v0)과 다른 지시문으로 운영 중">
                      수정됨
                    </Badge>
                  )}
                  {selected.guard && <Badge tone="neutral">주입 방어 자동 유지</Badge>}
                </div>
                <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                  {selected.desc}
                </p>

                {selectedNode?.type === "code" && (
                  <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                    코드 노드 — 점수 환산·달성 조건 같은 산식은 코드가 원본이라 여기서 편집하지 않아요 (impl:{" "}
                    <code style={{ fontFamily: "var(--font-mono)" }}>{selectedNode.impl}</code>)
                  </p>
                )}

                {/* 지시문·모델 — prompt 테이블 원본을 그대로 편집한다 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                  <span style={{ font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
                    지시문
                    <FieldHelp title="지시문 (시스템 프롬프트)">
                      <p style={{ margin: 0 }}>
                        AI에게 매 실행마다 먼저 주는 지침이에요. 역할·판단 기준·금지 사항· 어체를 여기서
                        정합니다. 사용자 입력이나 문서 내용보다 위에 놓여서, 문서에 섞여 들어온 지시를
                        무시하게 만드는 방어선이기도 해요.
                      </p>
                      <p style={{ margin: "10px 0 0" }}>
                        저장하면 새 버전으로 쌓이고 바로 적용돼요. &lsquo;기본값으로&rsquo;를 누르면 코드에
                        적힌 원래 지시문으로 돌아갑니다.
                      </p>
                      <HelpExample>{`너는 제조기업 AX 진단 판정자다.
문항마다 앵커 하나를 고르고 근거를 인용한다.
- 근거 문서를 읽지 않고는 앵커를 고르지 않는다
- 근거가 없으면 anchorLevel을 null로 두고 사유를 쓴다
- 같은 문서를 두 번 읽지 않는다`}</HelpExample>
                    </FieldHelp>
                  </span>
                  <select
                    value={selected.provider}
                    disabled={busy}
                    onChange={(e) => {
                      const provider = e.target.value;
                      const models = providers[provider]?.models ?? [];
                      void run(
                        () =>
                          api(`/api/admin/prompts/${selected.key}/model`, {
                            method: "PUT",
                            body: JSON.stringify({ provider, model: models[0] ?? selected.model }),
                          }),
                        "모델을 저장했어요",
                      );
                    }}
                    style={selectStyle}
                    aria-label="공급자"
                  >
                    {Object.entries(providers).map(([id, prov]) => (
                      <option key={id} value={id}>
                        {prov.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selected.model}
                    disabled={busy}
                    onChange={(e) =>
                      void run(
                        () =>
                          api(`/api/admin/prompts/${selected.key}/model`, {
                            method: "PUT",
                            body: JSON.stringify({ provider: selected.provider, model: e.target.value }),
                          }),
                        "모델을 저장했어요",
                      )
                    }
                    style={selectStyle}
                    aria-label="모델"
                  >
                    {/* 모델 옆에 스펙(컨텍스트·입력 단가)과 권장 표시 — 메타가 없으면 이름만 */}
                    {(providers[selected.provider]?.models ?? [selected.model]).map((m) => {
                      const meta = modelMeta[m];
                      const parts = [m];
                      if (meta?.contextK != null) parts.push(`${meta.contextK}K`);
                      if (meta?.inPer1M != null) parts.push(`$${meta.inPer1M.toFixed(2)}/1M`);
                      if (recommended[selected.key] === m) parts.push("권장");
                      return (
                        <option key={m} value={m}>
                          {parts.join(" · ")}
                        </option>
                      );
                    })}
                  </select>
                  {/* 버전 — 코드 기본값이 v0이다. 지금 무엇이 도는지가 늘 보여야 해서
                      선택값을 활성 버전에 맞춰 둔다(고를 것이 없어도 '사용 중'은 읽힌다) */}
                  <select
                    value={selected.usingDefault ? 0 : (selected.activeVersion ?? 0)}
                    disabled={busy}
                    onChange={(e) => {
                      const version = Number(e.target.value);
                      // v0 = 코드 기본값 — 저장본을 모두 내리는 것이라 되돌리기가 아니라 삭제다
                      if (version === 0) {
                        void run(
                          () => api(`/api/admin/prompts/${selected.key}`, { method: "DELETE" }),
                          "v0(코드 기본값)으로 되돌렸어요",
                        );
                        return;
                      }
                      void run(
                        () =>
                          api(`/api/admin/prompts/${selected.key}/activate`, {
                            method: "POST",
                            body: JSON.stringify({ version }),
                          }),
                        `v${version}으로 되돌렸어요`,
                      );
                    }}
                    style={selectStyle}
                    aria-label="사용할 지시문 버전"
                  >
                    <option value={0}>
                      v0 · 코드 기본값{selected.usingDefault ? " (사용 중)" : ""}
                    </option>
                    {selected.versions.map((v) => (
                      <option key={v.version} value={v.version}>
                        v{v.version} · {v.createdAt.slice(0, 10)}
                        {v.isActive ? " (사용 중)" : ""}
                      </option>
                    ))}
                  </select>
                  {/* 편집 중 텍스트가 코드 기본값에서 무엇이 달라졌는지 줄 단위로 본다 */}
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      marginLeft: "auto",
                      font: "var(--text-caption)",
                      color: "var(--fg-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showDiff}
                      onChange={(e) => setShowDiff(e.target.checked)}
                      style={{ accentColor: "var(--blue-500)" }}
                    />
                    v0과 비교
                  </label>
                </div>

                {/* 고른 모델의 스펙·권장 여부 — 서버 메타가 아직 없으면 아무것도 안 그린다 */}
                {(() => {
                  const meta = modelMeta[selected.model];
                  const rec = recommended[selected.key];
                  if (!meta && !rec) return null;
                  const specs = meta
                    ? [
                        meta.contextK != null ? `컨텍스트 ${meta.contextK}K` : null,
                        meta.inPer1M != null ? `입력 $${meta.inPer1M.toFixed(2)}/1M` : null,
                        meta.outPer1M != null ? `출력 $${meta.outPer1M.toFixed(2)}/1M` : null,
                        meta.structured != null
                          ? `구조화 출력 ${meta.structured ? "지원" : "미지원"}`
                          : null,
                      ].filter(Boolean)
                    : [];
                  return (
                    <p
                      style={{
                        margin: "6px 0 0",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        font: "var(--text-caption)",
                        color: "var(--fg-tertiary)",
                      }}
                    >
                      {rec === selected.model && (
                        <Badge tone="accent" title="코드 기본 모델">
                          권장
                        </Badge>
                      )}
                      {specs.length > 0 && <span>{specs.join(" · ")}</span>}
                      {rec != null && rec !== selected.model && <span>권장(코드 기본) {rec}</span>}
                    </p>
                  );
                })()}

                {/* 자리표시자 — 지시문에 {이름} 그대로 쓰면 실행 시 값으로 치환된다. 누르면 커서 위치에 삽입 */}
                {selected.vars.length > 0 && (
                  <p style={{ margin: "8px 0 0", font: "var(--text-caption)", color: "var(--fg-tertiary)" }}>
                    자리표시자{" "}
                    {selected.vars.map((v, i) => (
                      <span key={v.name}>
                        {i > 0 && " · "}
                        <button
                          type="button"
                          onClick={() => insertVar(v.name)}
                          title="누르면 커서 위치에 들어가요"
                          style={{
                            padding: 0,
                            border: "none",
                            borderBottom: "1px dashed var(--line-default)",
                            background: "transparent",
                            font: "inherit",
                            fontFamily: "var(--font-mono)",
                            color: "var(--fg-secondary)",
                            cursor: "pointer",
                          }}
                        >
                          {`{${v.name}}`}
                        </button>{" "}
                        {v.desc}
                      </span>
                    ))}
                  </p>
                )}

                {/* v0에 있는 자리표시자가 빠지면 알린다 — 저장은 막지 않는다 */}
                {missingVars.length > 0 && (
                  <p
                    role="alert"
                    style={{
                      margin: "8px 0 0",
                      padding: "8px 10px",
                      borderRadius: "var(--radius-m)",
                      background: "var(--bg-warning-weak)",
                      font: "var(--text-caption)",
                      color: "var(--fg-warning)",
                    }}
                  >
                    자리표시자 누락 — {missingVars.map((n) => `{${n}}`).join(" · ")} · v0에는 있는데
                    편집본에 없어요. 실행 때 그 값이 지시문에 들어가지 않아요 (저장은 가능).
                  </p>
                )}

                {showDiff && <PromptDiff base={v0System} draft={systemDraft} />}

                <textarea
                  ref={sysRef}
                  value={systemDraft}
                  onChange={(e) => {
                    setSystemDraft(e.target.value);
                    setConfirmSave(false);
                  }}
                  spellCheck={false}
                  rows={Math.min(18, systemDraft.split("\n").length + 2)}
                  style={{ width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: "var(--radius-m)", border: "1px solid var(--line-default)", background: "var(--bg-surface, transparent)", color: "var(--fg-primary)", fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6, resize: "vertical" }}
                  aria-label="지시문"
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  {/* 저장은 2단계 — 먼저 무엇이 바뀌는지(추가·삭제 줄 수)를 보여주고 확정을 받는다 */}
                  {confirmSave ? (
                    (() => {
                      const { added, removed } = diffCounts(diffLines(selected.system, systemDraft));
                      return (
                        <>
                          <span style={{ font: "var(--text-caption)", color: "var(--fg-secondary)" }}>
                            추가 {added}줄 · 삭제 {removed}줄
                          </span>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setConfirmSave(false);
                              void run(
                                () =>
                                  api(`/api/admin/prompts/${selected.key}`, {
                                    method: "PUT",
                                    body: JSON.stringify({ system: systemDraft }),
                                  }),
                                "지시문을 새 버전으로 저장했어요",
                              );
                            }}
                          >
                            저장 확정
                          </Button>
                        </>
                      );
                    })()
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy || systemDraft === selected.system || systemDraft.trim().length < 10}
                      onClick={() => setConfirmSave(true)}
                    >
                      지시문 저장
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy || systemDraft === selected.system}
                    onClick={() => {
                      setSystemDraft(selected.system);
                      setConfirmSave(false);
                    }}
                  >
                    편집 취소
                  </Button>
                  {/* '기본값으로' 버튼은 두지 않는다 — 위 버전 드롭다운의 v0이 같은 일을 한다 */}
                  <span
                    title="한글 위주 근사치 — 글자 수 ÷ 2.5라 실제 토큰 수와 달라요"
                    style={{
                      marginLeft: "auto",
                      font: "var(--text-caption)",
                      color: "var(--fg-quaternary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {systemDraft.length.toLocaleString("ko-KR")}자 · 약{" "}
                    {Math.round(systemDraft.length / 2.5).toLocaleString("ko-KR")}토큰
                  </span>
                </div>

                {/* 도구·출력 규격 — 그래프 에이전트 노드에만 있다 */}
                {isAgent && selectedNode && (
                  <>
                    {/* 연결 — 이 노드가 무엇을 보는지. 키 등록은 '외부 연동' 화면이 원본이라 여기서는 표시만 */}
                    <p style={{ margin: "22px 0 6px", font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
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
                            {meta && <span style={{ color: "var(--fg-tertiary)" }}>· {meta.source}</span>}
                          </span>
                        );
                      })}
                    </div>

                    {/* 도구 체크리스트 — 레지스트리(코드)가 원본, 노드는 부분집합만 고른다 */}
                    <p style={{ margin: "16px 0 6px", font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
                      도구 선택
                      <FieldHelp title="도구 선택">
                        <p style={{ margin: 0 }}>
                          체크한 도구만 이 에이전트가 부를 수 있어요. 체크를 풀면 그 도구는 이
                          에이전트에게 아예 보이지 않아서, 부르고 싶어도 부르지 못해요.
                        </p>
                        <p style={{ margin: "10px 0 0" }}>
                          목록 자체는 코드(도구 레지스트리)가 원본이라 여기서 늘리거나 줄일 수 없고,
                          그중 어떤 것을 이 에이전트에게 열어 줄지만 정해요. 파란 테두리는 외부 API를
                          부르는 도구예요 — 키가 없으면 그 도구는 실패합니다.
                        </p>
                        <HelpExample>{`판정 에이전트 예시
  ☑ 문항·앵커 조회   get_judgment_questions
  ☑ 근거 문서 목록   list_evidence_docs
  ☑ 문서 읽기        read_document
  ☐ 과제 카탈로그    get_task_catalog  ← 판정에는 필요 없어 닫아 둔다`}</HelpExample>
                      </FieldHelp>
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(graphRes.tools ?? []).map((t) => {
                        const on = toolDraft.includes(t);
                        const meta = toolMeta[t];
                        return (
                          <label
                            key={t}
                            title={meta ? `${meta.label} · ${meta.source}` : t}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: "var(--radius-m)", border: `1px solid ${on ? "var(--blue-500)" : meta?.external ? "var(--line-brand)" : "var(--line-default)"}`, font: "var(--text-caption)", color: on ? "var(--fg-brand)" : "var(--fg-secondary)", cursor: "pointer" }}
                          >
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() =>
                                setToolDraft((d) => (on ? d.filter((x) => x !== t) : [...d, t]))
                              }
                              style={{ accentColor: "var(--blue-500)" }}
                            />
                            <span>
                              {meta?.label ?? t}
                              <span style={{ display: "block", font: "10px/1.3 var(--font-mono)", color: "var(--fg-quaternary)" }}>
                                {t}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                      <span style={{ font: "var(--text-label-s)", color: "var(--fg-primary)" }}>
                        도구 호출 상한
                        <FieldHelp title="도구 호출 상한">
                          <p style={{ margin: 0 }}>
                            에이전트가 한 번 실행되는 동안 도구를 최대 몇 번까지 부를 수 있는지예요.
                            에이전트는 &lsquo;도구를 불러 결과를 보고, 다시 판단하고, 또 부르는&rsquo; 식으로
                            움직이는데 그 왕복 횟수의 상한입니다.
                          </p>
                          <p style={{ margin: "10px 0 0" }}>
                            마지막 1회는 결론을 쓰는 데 씁니다 — 상한을 전부 도구에 쓰면 답을 못 내고
                            끝나요. <strong>낮으면</strong> 근거를 다 못 읽어 결측(판단 보류)이 늘고,
                            <strong>높으면</strong> 같은 대화가 매 단계 다시 전송돼 토큰·시간이 늘고 분당
                            한도에 걸립니다.
                          </p>
                          <HelpExample>{`상한 20 · 판정 에이전트
 1  문항·앵커 조회
 2  근거 문서 목록
 3~19  문서 읽기 (필요한 만큼)
 20  ← 도구가 꺼지고 판정 결과 JSON을 쓴다

실측: 상한이 모자라면 문항 47개 중 14~17개만 판정됐다`}</HelpExample>
                        </FieldHelp>
                      </span>
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
                      <FieldHelp title="출력 스키마 (JSON Schema)">
                        <p style={{ margin: 0 }}>
                          에이전트가 반드시 이 모양의 JSON으로만 답하도록 강제하는 규격이에요.
                          모델이 문장으로 늘어놓지 못하게 막아, 결과를 코드가 바로 저장할 수 있게 합니다.
                        </p>
                        <p style={{ margin: "10px 0 0" }}>
                          여기 없는 필드는 버려지고, <code>required</code>에 넣은 필드는 반드시 채워집니다.
                          <code>description</code>은 모델에게 주는 힌트라 판정 품질에 영향을 줘요.
                        </p>
                        <HelpExample>{`{
  "type": "object",
  "required": ["judgments"],
  "properties": {
    "judgments": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["questionCode", "anchorLevel"],
        "properties": {
          "questionCode": { "type": "string" },
          "anchorLevel": { "type": ["integer", "null"] },
          "rationale": {
            "type": "string",
            "description": "읽은 문서명·근거 인용"
          }
        }
      }
    }
  }
}`}</HelpExample>
                      </FieldHelp>
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
                  </>
                )}
              </div>
            )}
          </Modal>
        </>
      )}
    </section>
  );
}
