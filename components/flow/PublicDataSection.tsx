"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Icons, Loader, Modal } from "@/components/ui";
import { api, API_URL } from "@/lib/api";

/**
 * 공개데이터 수집 카드 (수정요청v9 복구 · v10 실연동)
 * 진입 시 수집을 시작하고 SSE로 진행률을 받는다. 출처 하나가 실패해도 나머지는 그대로 보인다.
 * 수집 0건도 0으로 표기한다 — 카드를 숨기지 않는다.
 */
type PublicItem = { title: string; date: string | null; summary: string | null; sourceUrl: string | null };

export type PublicSourceCard = {
  source: string;
  label: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  itemCount: number;
  items: PublicItem[];
  note: string | null;
  error: string | null;
  /** AI 요약 — 수집 직후 워커가 생성. 없으면 요약 탭을 숨긴다 */
  summary: string[] | null;
  summaryStatus: string | null;
};

/** 화면 상단 기업 개요 — 대표·소재지는 DART 기업개황에서 채워지므로 없을 수 있다 */
type CompanyBrief = {
  name: string;
  bizNo: string | null;
  ceoName: string | null;
  address: string | null;
};

type Snapshot = {
  company: CompanyBrief | null;
  items: PublicSourceCard[];
  progress: { settled: number; total: number; running: boolean };
};

/** 사업자번호 000-00-00000 표기 */
const formatBizNo = (v: string) =>
  /^\d{10}$/.test(v) ? `${v.slice(0, 3)}-${v.slice(3, 5)}-${v.slice(5)}` : v;

const STATUS_TEXT: Record<PublicSourceCard["status"], string> = {
  pending: "대기",
  running: "수집 중",
  done: "",
  failed: "수집 실패",
  skipped: "미수집",
};

export function PublicDataSection({ assessmentId }: { assessmentId: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [opened, setOpened] = useState<PublicSourceCard | null>(null);
  const [tab, setTab] = useState<"summary" | "items">("items");

  useEffect(() => {
    if (!assessmentId) return;
    /* 재마운트(StrictMode 포함) 시 다시 시작해도 안전하다 — 서버가 jobId로 중복 수집을 막는다 */
    let stream: EventSource | null = null;
    /* POST 응답을 기다리는 사이에 화면을 떠날 수 있다 — 그때 스트림을 새로 열지 않는다 */
    let cancelled = false;
    (async () => {
      try {
        /* 수집 시작 — 같은 진단은 큐에서 중복 실행되지 않는다 */
        const first = await api<Snapshot>(`/api/assessments/${assessmentId}/public-data`, {
          method: "POST",
        });
        if (cancelled) return;
        setSnap(first);
        if (!first.progress.running) return;

        /* 진행률은 SSE로 받는다 (수집이 끝나면 서버가 스트림을 닫는다) */
        stream = new EventSource(
          `${API_URL}/api/assessments/${assessmentId}/public-data/stream`,
          { withCredentials: true },
        );
        stream.addEventListener("progress", (e) => {
          setSnap(JSON.parse((e as MessageEvent).data) as Snapshot);
        });
        stream.addEventListener("done", () => stream?.close());
        stream.onerror = () => stream?.close();
      } catch {
        /* 수집 실패는 화면을 막지 않는다 — 카드 없이 진행 */
      }
    })();

    return () => {
      cancelled = true;
      stream?.close();
    };
  }, [assessmentId]);

  if (!snap) return null;

  const collected = snap.items.reduce((sum, s) => sum + s.itemCount, 0);

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="ax-heading m-0 [font:var(--text-h4)] tracking-[var(--track-heading)] text-ink">
          공개 데이터 <span className="[font-family:var(--font-mono)]">{snap.items.length}</span>종
        </h3>
        <span className="[font:var(--text-caption)] text-ink-3">
          {snap.progress.running
            ? `수집 중 ${snap.progress.settled}/${snap.progress.total}`
            : `${collected}건 수집`}
        </span>
      </div>

      {/* 사업자번호·대표는 폭이 고정이고 주소가 남는 자리를 다 쓴다 — 3등분하면 주소가 잘렸다 (v7) */}
      {snap.company && (
        <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-1.5 rounded-[var(--radius-l)] bg-surface-3 px-4 py-3 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
          {[
            { label: "사업자번호", value: snap.company.bizNo && formatBizNo(snap.company.bizNo), mono: true },
            { label: "대표", value: snap.company.ceoName },
            { label: "사업지 주소", value: snap.company.address },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex min-w-0 gap-2">
              <dt className="flex-none [font:var(--text-caption)] text-ink-4">{label}</dt>
              <dd
                className={`m-0 min-w-0 break-words [font:var(--text-caption)] text-ink-2 ${
                  mono ? "[font-family:var(--font-mono)] whitespace-nowrap" : ""
                }`}
              >
                {value || "—"}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {/* 자료 많은 순 정렬 — 동률은 카탈로그 순서 유지 (sort는 stable) */}
        {[...snap.items].sort((a, b) => b.itemCount - a.itemCount).map((s) => {
          const busy = s.status === "pending" || s.status === "running";
          const clickable = s.itemCount > 0;
          return (
            <Card
              key={s.source}
              radius="l"
              padded={false}
              interactive={clickable}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={() => {
                if (!clickable) return;
                setTab(s.summary?.length ? "summary" : "items");
                setOpened(s);
              }}
              onKeyDown={(e) => {
                if (!clickable || (e.key !== "Enter" && e.key !== " ")) return;
                e.preventDefault();
                setTab(s.summary?.length ? "summary" : "items");
                setOpened(s);
              }}
              style={{ cursor: clickable ? "pointer" : "default" }}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0 truncate [font:var(--text-label-m)] text-ink">
                  {s.label}
                </span>
                {busy ? (
                  <Loader style={{ width: 14, height: 14 }} />
                ) : (
                  <span className="flex flex-none items-center gap-1.5">
                    {s.status === "failed" && (
                      <span
                        role="img"
                        aria-label="수집 실패"
                        title="수집 실패"
                        className="flex flex-none text-[var(--fg-warning)]"
                      >
                        <Icons.alertCircle size={14} />
                      </span>
                    )}
                    {s.status === "skipped" && <Badge tone="outline">보류</Badge>}
                    <span className="[font-family:var(--font-mono)] text-[13px] font-semibold text-ink">
                      {s.itemCount}건
                    </span>
                    {clickable && <Icons.chevronRight size={14} />}
                  </span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 상세 팝업 — 요약 / 원본(제목에 출처 링크) */}
      <Modal open={opened !== null} onClose={() => setOpened(null)} title={opened?.label} wide>
        {opened && <PublicSourceDetail card={opened} tab={tab} onTab={setTab} />}
      </Modal>
    </section>
  );
}

/**
 * 출처 하나의 상세 — 요약 탭 / 원본 탭 (제목에 출처 링크).
 * 자료 정리 화면의 팝업과 진단 결과 화면의 통계 칩 팝업이 같은 몸통을 쓴다 (v7).
 */
export function PublicSourceDetail({
  card,
  tab,
  onTab,
}: {
  card: PublicSourceCard;
  tab: "summary" | "items";
  onTab: (t: "summary" | "items") => void;
}) {
  return (
    <div>
      {card.summary?.length ? (
        <div className="mb-3 flex gap-1 rounded-[var(--radius-m)] bg-surface-3 p-1">
          {(["summary", "items"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTab(t)}
              className={`h-8 flex-1 cursor-pointer rounded-[9px] border-0 [font:var(--text-label-s)] [font-family:var(--font-sans)] transition-colors ${
                tab === t ? "bg-surface text-ink shadow-[var(--shadow-1)]" : "bg-transparent text-ink-3"
              }`}
            >
              {t === "summary" ? "요약" : `원본 ${card.itemCount}건`}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "summary" && card.summary?.length ? (
        <ul className="ax-scrollbar-none m-0 flex max-h-[46vh] list-none flex-col gap-2 overflow-y-auto p-0">
          {card.summary.map((line, i) => (
            <li key={i} className="flex gap-2 [font:var(--text-body3)] text-ink-2">
              <span aria-hidden className="flex-none text-ink-4">
                •
              </span>
              <span className="min-w-0">{line}</span>
            </li>
          ))}
          <li className="mt-1 [font:var(--text-caption)] text-ink-4">
            AI가 수집 원본을 정리한 요약이에요 — 원문은 원본 탭에서 확인해 주세요.
          </li>
        </ul>
      ) : (
        <div>
          {(card.note ?? card.error) && (
            <p className="mt-0 mb-2 [font:var(--text-caption)] text-ink-3">
              {card.note ?? card.error}
            </p>
          )}
          {card.items.length === 0 ? (
            <p className="m-0 [font:var(--text-body3)] text-ink-3">
              수집된 원본이 없어요.
            </p>
          ) : (
            <ul className="ax-scrollbar-none m-0 flex max-h-[46vh] list-none flex-col gap-2 overflow-y-auto p-0">
              {card.items.map((it, i) => (
                <li
                  key={`${it.title}-${i}`}
                  className="border-t border-line-subtle pt-2 first:border-t-0 first:pt-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    {it.sourceUrl ? (
                      <a
                        href={it.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 [font:var(--text-label-m)] text-[var(--fg-brand)] hover:underline"
                      >
                        {it.title}
                      </a>
                    ) : (
                      <span className="min-w-0 [font:var(--text-label-m)] text-ink">{it.title}</span>
                    )}
                    {it.date && (
                      <span className="flex-none [font-family:var(--font-mono)] text-[12px] text-ink-4">
                        {it.date}
                      </span>
                    )}
                  </div>
                  {it.summary && (
                    <p className="mt-1 mb-0 [font:var(--text-body3)] text-ink-3">{it.summary}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
