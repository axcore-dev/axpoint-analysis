"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { DIGITAL_LEVELS } from "@/data/rubric/meta";

/**
 * 디지털화 수준 통계 (작업 요청 v8 이슈④) — 자료 정리 상단, 워크플로우 위.
 * 왼쪽 도넛이 수준별 비중, 오른쪽이 문서 목록. 조각을 누르면 그 수준의 문서만 남는다.
 *
 * 수준은 순서 척도(L1 수기 → L4 시스템출력)라 색은 카테고리가 아니라 **한 파랑의 밝기 단계**다
 * — 어두울수록 디지털화가 깊다. 조각마다 수준명·건수·%를 직접 라벨로 달아 색만으로 읽게 두지
 * 않고, 문서 목록이 표 역할을 겸한다.
 */
type LevelFile = { id: string; name: string; digitalLevel: number | null; docTypeName: string | null };

/** L1→L4 순차 램프 — 명도 단조(밝→어두움), 팔레트 검증기 통과값 (dataviz) */
const LEVEL_TONE: Record<number, string> = {
  1: "#93B2FB",
  2: "#5E8BFF",
  3: "#2E63F7",
  4: "#0A3ECC",
};

const R = 74; // 도넛 바깥 반지름
const THICK = 26; // 링 두께
const C = 96; // 중심 좌표 (viewBox 192×192)

/** 조각 하나의 SVG 패스 — 시작·끝 각도(라디안, 12시 기준 시계방향) */
function arcPath(a0: number, rawA1: number): string {
  /* 한 조각이 100%면 호의 시작·끝점이 같아져 아무것도 안 그려진다 — 한 끗 못 미치게 자른다 */
  const a1 = Math.min(rawA1, a0 + Math.PI * 2 - 0.004);
  const r0 = R - THICK;
  const pt = (r: number, a: number) => `${C + r * Math.sin(a)} ${C - r * Math.cos(a)}`;
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${pt(R, a0)}`,
    `A ${R} ${R} 0 ${big} 1 ${pt(R, a1)}`,
    `L ${pt(r0, a1)}`,
    `A ${r0} ${r0} 0 ${big} 0 ${pt(r0, a0)}`,
    "Z",
  ].join(" ");
}

export function DigitalLevelSection({ files }: { files: LevelFile[] }) {
  /** 선택 고정한 수준 — 재클릭 또는 빈 영역 클릭으로 해제 */
  const [picked, setPicked] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const { slices, total, repLevel } = useMemo(() => {
    const done = files.filter((f) => f.digitalLevel != null);
    const count = new Map<number, number>();
    for (const f of done) count.set(f.digitalLevel!, (count.get(f.digitalLevel!) ?? 0) + 1);
    const total = done.length;
    const slices = [1, 2, 3, 4]
      .filter((lv) => (count.get(lv) ?? 0) > 0)
      .map((lv) => ({
        level: lv,
        label: DIGITAL_LEVELS[`L${lv}`] ?? `L${lv}`,
        n: count.get(lv)!,
        pct: Math.round(((count.get(lv) ?? 0) / Math.max(1, total)) * 100),
      }));
    /* 종합 수준 — 최다 수준(동률이면 높은 쪽). 평균 산식은 근거를 설명하기 어렵다 */
    const rep = [...slices].sort((a, b) => b.n - a.n || b.level - a.level)[0]?.level ?? null;
    return { slices, total, repLevel: rep };
  }, [files]);

  if (total === 0) return null;

  const active = picked ?? hovered;
  const shown = picked === null ? files.filter((f) => f.digitalLevel != null) : files.filter((f) => f.digitalLevel === picked);
  /* 기본 목록은 비중 높은 수준 순 (요청서) — 같은 수준끼리는 이름순 */
  const rank = new Map(slices.map((s, i) => [s.level, slices.length - i + s.n * 1000]));
  const sorted = [...shown].sort(
    (a, b) =>
      (rank.get(b.digitalLevel!) ?? 0) - (rank.get(a.digitalLevel!) ?? 0) ||
      a.name.localeCompare(b.name, "ko"),
  );
  const pickedSlice = slices.find((s) => s.level === picked) ?? null;

  /* 조각 각도 — 12시부터 시계방향, 수준 순서대로. 누적 건수로 각을 낸다 */
  const arcs = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((sum, x) => sum + x.n, 0);
    const a0 = (before / total) * Math.PI * 2;
    const a1 = ((before + s.n) / total) * Math.PI * 2;
    return { ...s, a0, a1 };
  });

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="ax-heading m-0 [font:var(--text-h4)] tracking-[var(--track-heading)] text-ink">
          디지털화 수준
        </h3>
        <span className="[font:var(--text-caption)] text-ink-3">
          분류 완료 <span className="[font-family:var(--font-mono)]">{total}</span>건 기준
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 왼쪽 — 도넛. 빈 영역 클릭으로 선택 해제 */}
        <Card radius="l" padded={false}>
          <div
            className="flex h-[340px] flex-col items-center justify-center gap-2 px-4 py-4"
            onClick={() => setPicked(null)}
            role="presentation"
          >
            <svg
              viewBox="0 0 192 192"
              className="h-[192px] w-[192px] flex-none"
              role="img"
              aria-label={`디지털화 수준 분포 — ${slices.map((s) => `${s.label} ${s.n}건 ${s.pct}%`).join(", ")}`}
            >
              {arcs.map((s) => (
                <path
                  key={s.level}
                  d={arcPath(s.a0, s.a1)}
                  fill={LEVEL_TONE[s.level]}
                  opacity={active === null || active === s.level ? 1 : 0.25}
                  stroke="var(--bg-elevated)"
                  strokeWidth={2}
                  style={{ cursor: "pointer", transition: "opacity var(--dur-fast) var(--ease)" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPicked((p) => (p === s.level ? null : s.level));
                  }}
                  onMouseEnter={() => setHovered(s.level)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <title>{`${s.label} · ${s.n}건 (${s.pct}%)`}</title>
                </path>
              ))}
              {/* 중앙 — 종합 수준(최다). 색이 아니라 글자가 결론을 말한다 */}
              <text
                x={C}
                y={C - 6}
                textAnchor="middle"
                style={{ font: "700 22px var(--font-sans)", fill: "var(--fg-primary)" }}
              >
                {repLevel ? `L${repLevel}` : "—"}
              </text>
              <text
                x={C}
                y={C + 14}
                textAnchor="middle"
                style={{ font: "11px var(--font-sans)", fill: "var(--fg-tertiary)" }}
              >
                종합 수준
              </text>
            </svg>

            {/* 조각 라벨 — 수준명·건수·% 전부. 조각이 하나뿐이어도 여기서 다 읽힌다 */}
            <ul className="m-0 flex list-none flex-wrap justify-center gap-x-4 gap-y-1 p-0">
              {arcs.map((s) => {
                const on = active === null || active === s.level;
                return (
                  <li key={s.level}>
                    <button
                      type="button"
                      aria-pressed={picked === s.level}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPicked((p) => (p === s.level ? null : s.level));
                      }}
                      onMouseEnter={() => setHovered(s.level)}
                      onMouseLeave={() => setHovered(null)}
                      className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-1 [font:var(--text-caption)]"
                      style={{ opacity: on ? 1 : 0.4 }}
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 flex-none rounded-[3px]"
                        style={{ background: LEVEL_TONE[s.level] }}
                      />
                      <span className="text-ink-2">{s.label}</span>
                      <span className="[font-family:var(--font-mono)] text-ink-3">
                        {s.n}건 · {s.pct}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        {/* 오른쪽 — 문서 목록. 스크롤은 이 안에서만 */}
        <Card radius="l" padded={false}>
          <div className="flex h-[340px] flex-col">
            <div className="flex items-baseline justify-between gap-2 border-b border-line-subtle px-4 py-3">
              <span className="[font:var(--text-label-m)] text-ink">
                {pickedSlice ? pickedSlice.label : "전체 문서"}
              </span>
              <span className="[font:var(--text-caption)] text-ink-3">
                <span className="[font-family:var(--font-mono)]">{sorted.length}</span>건
                {pickedSlice && (
                  <button
                    type="button"
                    onClick={() => setPicked(null)}
                    className="ml-2 cursor-pointer border-0 bg-transparent p-0 [font:var(--text-caption)] text-[var(--fg-brand)]"
                  >
                    전체 보기
                  </button>
                )}
              </span>
            </div>
            <ul className="ax-scrollbar-none m-0 flex-1 list-none overflow-y-auto p-0">
              {sorted.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2.5 border-b border-line-subtle px-4 py-2 last:border-b-0"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 flex-none rounded-[3px]"
                    style={{ background: LEVEL_TONE[f.digitalLevel!] ?? "var(--grey-300)" }}
                  />
                  <span className="min-w-0 flex-1 truncate [font:var(--text-body3)] text-ink-2">
                    {f.name}
                  </span>
                  {f.docTypeName && (
                    <span className="hidden flex-none [font:var(--text-caption)] text-ink-4 sm:inline">
                      {f.docTypeName}
                    </span>
                  )}
                  <span className="flex-none [font-family:var(--font-mono)] text-[11px] text-ink-3">
                    L{f.digitalLevel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </section>
  );
}
