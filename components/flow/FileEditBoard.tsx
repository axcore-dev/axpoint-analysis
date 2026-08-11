"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { DIGITAL_LEVELS } from "@/data/rubric/meta";
import { api } from "@/lib/api";
import { Button, Loader, Modal } from "@/components/ui";

/**
 * 자료 편집 칸반 보드 — 자료 정리 2단계 팝업 (사용자 인터뷰 확정안).
 * 분류된 파일을 8대 업무 영역 + 미분류 컬럼으로 펼쳐 보여주고,
 * HTML5 드래그앤드롭으로 영역을 옮긴다. 컬럼별 '+ 파일 추가'는 즉시 업로드.
 * 이동·추가된 카드에는 그 영역의 소분류 select가 열린다(기본 '자동 분류').
 * 저장 시 변경된 파일만 처리한다:
 *  - 소분류를 고른 파일 → PATCH /files/:id/doc-type (유형 확정, 재분류 불필요).
 *    단, 새로 올린 파일은 분석(디지털화 수준·본문 추출)이 없으므로 classify에도 넣는다.
 *  - '자동 분류' 파일 → PATCH /files/:id/group(영역 확정 — asserted_group_id) 후
 *    POST /classify {fileIds}로 그 영역 안 소분류·디지털화 레벨 재판정.
 * 변경 없는 파일은 재분류하지 않는다.
 */

/** 서버 doc_group 마스터 (GET /api/doc-groups) */
type DocGroupItem = {
  id: number;
  major: string; // '8대 업무 영역' (2026-08-11 개정에서 ISO 관리영역이 여기로 흡수됐다)
  name: string;
  sortOrder: number;
  docTypes: { id: number; name: string }[];
};

/** collect 파일 행 중 보드가 쓰는 필드 (구조 타이핑 — FileRow와 호환) */
export type BoardFile = {
  id: string;
  name: string;
  status: string | null;
  docTypeId: number | null;
  docTypeName: string | null;
  digitalLevel: number | null;
};

/** 컬럼 키 — 8대 영역은 groupId 숫자, 미분류만 고정 문자열 */
type ColKey = number | "none";

type CardState = {
  file: BoardFile;
  col: ColKey;
  /** 사용자가 고른 소분류(문서 유형) — null이면 '자동 분류'(영역만 지정) */
  docTypeId: number | null;
  /** 열었을 때의 위치 — null이면 팝업에서 새로 올린 파일(항상 변경 취급) */
  init: { col: ColKey } | null;
};

const isChanged = (c: CardState) =>
  c.init === null || c.col !== c.init.col || c.docTypeId !== null;

/** select 조작이 카드 드래그로 번지지 않게 막는 공통 속성 */
const selectDragBlock = {
  draggable: true,
  onDragStart: (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  },
} as const;

/** 파일 카드 — 파일명 + 소분류명 + L레벨 뱃지 + 분류 상태, 변경 시 점 표시 */
function BoardCard({
  card,
  docTypes,
  onDragStart,
  onPickType,
}: {
  card: CardState;
  /** 카드가 놓인 영역의 소분류 목록 — 미분류 컬럼은 빈 배열 */
  docTypes: { id: number; name: string }[];
  onDragStart: (e: DragEvent, fileId: string) => void;
  onPickType: (fileId: string, docTypeId: number | null) => void;
}) {
  const f = card.file;
  const busy = f.status === "pending" || f.status === "processing";
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, f.id)}
      className="cursor-grab rounded-[var(--radius-m)] border border-solid border-line bg-surface px-2.5 py-2 active:cursor-grabbing"
    >
      <div className="flex items-center gap-1.5">
        {isChanged(card) && (
          <span
            aria-label="변경됨"
            className="size-1.5 flex-none rounded-full bg-[var(--fg-brand)]"
          />
        )}
        <span className="min-w-0 flex-1 truncate [font:var(--text-body3)] tracking-[var(--track-body)] text-ink">
          {f.name}
        </span>
      </div>
      {(busy || f.docTypeName || f.digitalLevel != null) && (
        <div className="mt-1 flex items-center gap-1.5">
          {busy ? (
            <span className="flex items-center gap-1.5 [font:var(--text-caption)] text-ink-3">
              <Loader style={{ width: 12, height: 12 }} />
              {f.status === "processing" ? "분류 중" : "분류 대기"}
            </span>
          ) : (
            <>
              {f.docTypeName && (
                <span className="min-w-0 truncate [font:var(--text-caption)] text-ink-3">
                  {f.docTypeName}
                </span>
              )}
              {f.digitalLevel != null && (
                <span className="flex-none rounded-[var(--radius-xs)] bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-ink-3">
                  {DIGITAL_LEVELS[`L${f.digitalLevel}`] ?? `L${f.digitalLevel}`}
                </span>
              )}
            </>
          )}
        </div>
      )}
      {/* 이동·추가된 카드는 소분류까지 지정할 수 있다 — 기본 '자동 분류'(영역만 지정) */}
      {isChanged(card) && card.col !== "none" && docTypes.length > 0 && (
        <select
          value={card.docTypeId ?? ""}
          onChange={(e) => onPickType(f.id, e.target.value === "" ? null : Number(e.target.value))}
          {...selectDragBlock}
          aria-label="소분류 선택"
          className="mt-1.5 w-full rounded-[var(--radius-xs)] border border-line bg-surface px-1.5 py-1 [font:var(--text-caption)] text-ink-2"
        >
          <option value="">자동 분류</option>
          {docTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function FileEditBoard({
  assessmentId,
  open,
  onClose,
  files,
  onSaved,
}: {
  assessmentId: string;
  open: boolean;
  onClose: () => void;
  files: BoardFile[];
  /** 저장 완료 직후 — 부모가 목록 새로고침·폴링 재개를 이어받는다 */
  onSaved: () => void;
}) {
  const [groups, setGroups] = useState<DocGroupItem[] | null>(null);
  const [cards, setCards] = useState<CardState[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** '+ 파일 추가'를 누른 컬럼 — 파일 선택창은 하나를 공유한다 */
  const uploadColRef = useRef<ColKey>("none");

  const areaGroups = groups ?? [];

  /* 영역(그룹) 마스터 — 첫 오픈에 한 번만 */
  useEffect(() => {
    if (!open || groups) return;
    api<{ items: DocGroupItem[] }>("/api/doc-groups")
      .then(({ items }) => setGroups(items))
      .catch(() => setError("잠시 후 다시 시도해 주세요."));
  }, [open, groups]);

  /* 보드 초기화 — 열려 있는 동안은 부모 폴링과 동기화하지 않는다 (이동 상태 보존) */
  useEffect(() => {
    if (!open) {
      setCards(null);
      setError(null);
      return;
    }
    if (!groups || cards !== null) return;
    const groupByType = new Map<number, DocGroupItem>();
    for (const g of groups) for (const t of g.docTypes) groupByType.set(t.id, g);
    setCards(
      files
        // 양식집(묶음 PDF) 부모는 제외 — 유형·영역은 분할된 자식 페이지가 갖는다
        .filter((f) => f.status !== "split")
        .map((f) => {
          const g = f.docTypeId != null ? groupByType.get(f.docTypeId) : undefined;
          const col: ColKey = g === undefined ? "none" : g.id;
          return { file: f, col, docTypeId: null, init: { col } };
        }),
    );
  }, [open, groups, cards, files]);

  const moveCard = (fileId: string, to: ColKey) => {
    setCards(
      (prev) =>
        prev?.map((c) => {
          if (c.file.id !== fileId || c.col === to) return c;
          // 컬럼이 바뀌면 소분류 목록도 바뀐다 — 고른 소분류는 '자동 분류'로 되돌린다
          return { ...c, col: to, docTypeId: null };
        }) ?? null,
    );
  };

  const pickType = (fileId: string, docTypeId: number | null) =>
    setCards(
      (prev) => prev?.map((c) => (c.file.id === fileId ? { ...c, docTypeId } : c)) ?? null,
    );

  /** 카드가 놓인 영역의 소분류 목록 — 미분류 컬럼은 없음 */
  const typesFor = (c: CardState): { id: number; name: string }[] =>
    c.col === "none" ? [] : (areaGroups.find((g) => g.id === c.col)?.docTypes ?? []);

  /* '+ 파일 추가' — 즉시 업로드 후 해당 컬럼에 배치. 미분류 컬럼은 영역 지정 없이 올리기만 */
  const uploadTo = async (col: ColKey, list: FileList | null) => {
    const chosen = Array.from(list ?? []);
    if (chosen.length === 0 || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of chosen) form.append("files", f);
      const res = await api<{
        saved?: { id: string; name: string }[];
        rejected?: { name: string; reason: string }[];
      }>(`/api/assessments/${assessmentId}/files`, { method: "POST", body: form });
      const rejected = res.rejected ?? [];
      if (rejected.length > 0) {
        setError(rejected.map((r) => `${r.name} — ${r.reason}`).join(" / "));
      }
      setCards(
        (prev) =>
          prev && [
            ...prev,
            ...(res.saved ?? []).map((s) => ({
              file: {
                id: s.id,
                name: s.name,
                status: "pending",
                docTypeId: null,
                docTypeName: null,
                digitalLevel: null,
              },
              col,
              docTypeId: null, // 카드에 열리는 select에서 소분류를 고를 수 있다 (기본 '자동 분류')
              init: null, // 새로 올린 파일 — 저장 시 영역 확정 + 분류 대상
            })),
          ],
      );
    } catch {
      setError("파일을 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  };

  /* 저장 — 변경 파일만 확정(PATCH) 후 필요한 것만 재분류 한 번(POST classify {fileIds}).
     소분류를 고른 파일은 doc-type으로 유형 확정(재분류 불필요) — 단 새로 올린 파일은
     분석(디지털화 수준·본문 추출)이 아직 없어 classify에 넣는다(워커가 유형은 유지) */
  const save = async () => {
    if (!cards || saving) return;
    const changed = cards.filter(isChanged);
    if (changed.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const c of changed) {
        if (c.docTypeId != null) {
          await api(`/api/files/${c.file.id}/doc-type`, {
            method: "PATCH",
            body: JSON.stringify({ docTypeId: c.docTypeId }),
          });
          continue;
        }
        // 미분류로 옮긴 파일은 영역 지정 없이 재분류만 건다
        const groupId = c.col === "none" ? null : c.col;
        if (groupId != null) {
          await api(`/api/files/${c.file.id}/group`, {
            method: "PATCH",
            body: JSON.stringify({ groupId }),
          });
        }
      }
      const classifyIds = changed
        .filter((c) => c.docTypeId == null || c.init === null)
        .map((c) => c.file.id);
      if (classifyIds.length > 0) {
        await api(`/api/assessments/${assessmentId}/classify`, {
          method: "POST",
          body: JSON.stringify({ fileIds: classifyIds }),
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  const columns: { key: ColKey; label: string }[] = [
    ...areaGroups.map((g) => ({ key: g.id as ColKey, label: g.name })),
    { key: "none" as ColKey, label: "미분류" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="자료 편집" full>
      <p className="mt-0 mb-4 [font:var(--text-body3)] tracking-[var(--track-body)] text-ink-3">
        파일을 끌어 영역을 바꾸면 그 영역 안에서 AI가 다시 분류해요
      </p>

      {/* 실제 파일 업로드 input — 컬럼별 '+ 파일 추가'가 이 input을 연다 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.hwp,.docx,.doc"
        onChange={(e) => {
          void uploadTo(uploadColRef.current, e.target.files);
          e.target.value = "";
        }}
        style={{ display: "none" }}
        aria-hidden
        tabIndex={-1}
      />

      {cards === null || groups === null ? (
        <div className="flex h-[320px] items-center justify-center">
          <Loader />
        </div>
      ) : (
        <div className="ax-scrollbar-none flex h-[min(62vh,700px)] gap-2.5 overflow-x-auto pb-1">
          {columns.map((colDef) => {
            const colCards = cards.filter((c) => c.col === colDef.key);
            return (
              <div
                key={String(colDef.key)}
                // 넓은 화면에서는 컬럼이 가로를 나눠 채우고, 좁아지면 min-width가 가로 스크롤을 만든다
                className="flex min-w-[170px] flex-1 flex-col rounded-[var(--radius-l)] border border-line bg-surface-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) moveCard(id, colDef.key);
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                  <span className="truncate [font:var(--text-label-s)] text-ink-2">
                    {colDef.label}
                  </span>
                  <span className="flex-none [font:var(--text-caption)] text-ink-4">
                    {colCards.length}
                  </span>
                </div>
                <div className="ax-scrollbar-none flex min-h-[80px] flex-1 flex-col gap-1.5 overflow-y-auto p-2">
                  {colCards.map((c) => (
                    <BoardCard
                      key={c.file.id}
                      card={c}
                      docTypes={typesFor(c)}
                      onDragStart={(e, fileId) => {
                        e.dataTransfer.setData("text/plain", fileId);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onPickType={pickType}
                    />
                  ))}
                </div>
                <div className="border-t border-line p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    full
                    disabled={uploading}
                    onClick={() => {
                      uploadColRef.current = colDef.key;
                      fileInputRef.current?.click();
                    }}
                  >
                    + 파일 추가
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 mb-0 [font:var(--text-caption)] text-[var(--fg-danger)]">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" disabled={saving} onClick={onClose}>
          취소
        </Button>
        <Button
          variant="primary"
          disabled={saving || uploading || cards === null}
          onClick={() => void save()}
        >
          저장
        </Button>
      </div>
    </Modal>
  );
}
