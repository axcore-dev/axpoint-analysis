"use client";

import { useEffect, useRef, useState } from "react";
import { DIGITAL_LEVELS } from "@/data/rubric/meta";
import { api } from "@/lib/api";
import { Button, Icons, Loader, Modal } from "@/components/ui";

/**
 * 문서 편집 — 업로드된 문서의 분류 데이터를 문서 단위로 고치는 팝업 (2026-08-13 개편).
 * 종전 영역 칸반(드래그) 방식은 '영역 지정 편집'에 가까웠다 — 지금은 문서 한 건마다
 * 문서 유형(76종 소분류)과 디지털화 수준을 직접 고른다. 유형을 고르면 영역은 자동으로 따라온다.
 *
 * AI 재분류가 도는 시점은 **새 문서 업로드뿐이다**:
 *  - 사용자가 유형·수준을 바꾼 문서 → PATCH /files/:id/doc-type (사용자 확정, AI 미작동)
 *  - '+ 문서 추가'로 새로 올린 문서 → 저장 시 POST /classify {fileIds} (본문 추출·수준 판정 필요.
 *    유형을 미리 골랐다면 PATCH 후 classify — 워커가 사용자 지정 유형은 유지한다)
 */

/** 서버 doc_group 마스터 (GET /api/doc-groups) */
type DocGroupItem = {
  id: number;
  major: string;
  name: string;
  sortOrder: number;
  docTypes: { id: number; name: string }[];
};

/** collect 파일 행 중 편집기가 쓰는 필드 (구조 타이핑 — FileRow와 호환) */
export type BoardFile = {
  id: string;
  name: string;
  status: string | null;
  docTypeId: number | null;
  docTypeName: string | null;
  digitalLevel: number | null;
  hitlStatus?: string | null; // 'needed' = 저신뢰·미분류 — '확인 요청' 칩으로 정정을 유도
};

type RowState = {
  file: BoardFile;
  /** 고른 문서 유형 — null이면 미분류(기존 문서) 또는 자동 분류(새 문서) */
  docTypeId: number | null;
  /** 고른 디지털화 수준 — null이면 미정 */
  digitalLevel: number | null;
  /** 팝업에서 새로 올린 문서 — 저장 시 분류 대상 */
  isNew: boolean;
  init: { docTypeId: number | null; digitalLevel: number | null };
};

const isChanged = (r: RowState) =>
  r.docTypeId !== r.init.docTypeId || r.digitalLevel !== r.init.digitalLevel;

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
  const [rows, setRows] = useState<RowState[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* 영역(그룹) 마스터 — 첫 오픈에 한 번만 */
  useEffect(() => {
    if (!open || groups) return;
    api<{ items: DocGroupItem[] }>("/api/doc-groups")
      .then(({ items }) => setGroups(items))
      .catch(() => setError("잠시 후 다시 시도해 주세요."));
  }, [open, groups]);

  /* 목록 초기화 — 열려 있는 동안은 부모 폴링과 동기화하지 않는다 (편집 상태 보존).
     열림/닫힘 전환은 렌더 중에 맞춘다(react.dev '렌더 중 상태 조정' 패턴) — 이펙트로
     미루면 한 프레임 옛 목록이 비치고 cascading render 경고가 붙는다 */
  const [prevOpen, setPrevOpen] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setRows(
        files
          // 양식집(묶음 PDF) 부모는 제외 — 유형·수준은 분할된 자식 페이지가 갖는다
          .filter((f) => f.status !== "split")
          .map((f) => ({
            file: f,
            docTypeId: f.docTypeId,
            digitalLevel: f.digitalLevel,
            isNew: false,
            init: { docTypeId: f.docTypeId, digitalLevel: f.digitalLevel },
          })),
      );
    } else {
      setRows(null);
      setError(null);
    }
  }

  /** 유형이 속한 영역 — 유형을 고르면 영역은 여기서 자동으로 따라온다 */
  const groupOfType = (docTypeId: number | null): DocGroupItem | null => {
    if (docTypeId === null || !groups) return null;
    return groups.find((g) => g.docTypes.some((t) => t.id === docTypeId)) ?? null;
  };

  /* '+ 문서 추가' — 즉시 업로드해 목록에 붙인다. 분류(AI)는 저장 시 새 문서만 */
  const upload = async (list: FileList | null) => {
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
      setRows(
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
              docTypeId: null, // 기본 자동 분류 — 미리 고르면 그 유형으로 확정된다
              digitalLevel: null,
              isNew: true,
              init: { docTypeId: null, digitalLevel: null },
            })),
          ],
      );
    } catch {
      setError("문서를 올리지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  };

  /* 저장 — 사용자가 바꾼 문서는 PATCH로 확정(AI 미작동), 새 문서만 분류를 건다 */
  const save = async () => {
    if (!rows || saving) return;
    const changed = rows.filter((r) => isChanged(r) && !r.isNew);
    const news = rows.filter((r) => r.isNew);
    if (changed.length === 0 && news.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      /* 기존 문서의 유형·수준 변경 — 사용자 확정. 재분류하지 않는다 */
      for (const r of changed) {
        await api(`/api/files/${r.file.id}/doc-type`, {
          method: "PATCH",
          body: JSON.stringify({
            ...(r.docTypeId !== r.init.docTypeId && r.docTypeId !== null
              ? { docTypeId: r.docTypeId }
              : {}),
            ...(r.digitalLevel !== r.init.digitalLevel && r.digitalLevel !== null
              ? { digitalLevel: r.digitalLevel }
              : {}),
          }),
        });
      }
      /* 새 문서 — 유형을 미리 골랐으면 확정부터. 분석(본문 추출·수준 판정)은 분류가 한다 */
      for (const r of news) {
        if (r.docTypeId !== null || r.digitalLevel !== null) {
          await api(`/api/files/${r.file.id}/doc-type`, {
            method: "PATCH",
            body: JSON.stringify({
              ...(r.docTypeId !== null ? { docTypeId: r.docTypeId } : {}),
              ...(r.digitalLevel !== null ? { digitalLevel: r.digitalLevel } : {}),
            }),
          });
        }
      }
      if (news.length > 0) {
        await api(`/api/assessments/${assessmentId}/classify`, {
          method: "POST",
          body: JSON.stringify({ fileIds: news.map((r) => r.file.id) }),
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

  const levelLabel = (lv: number) => DIGITAL_LEVELS[`L${lv}`] ?? `L${lv}`;

  return (
    <Modal open={open} onClose={onClose} title="문서 편집" full>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 [font:var(--text-body3)] tracking-[var(--track-body)] text-ink-3">
          문서 유형을 바꾸면 해당 영역으로 자동 배치돼요 — 새로 올린 문서만 AI가 분류해요
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "올리는 중" : "+ 문서 추가"}
        </Button>
      </div>

      {/* 실제 파일 업로드 input — '+ 문서 추가'가 이 input을 연다 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.xlsx,.xls,.jpg,.jpeg,.png,.hwp,.docx,.doc"
        onChange={(e) => {
          void upload(e.target.files);
          e.target.value = "";
        }}
        style={{ display: "none" }}
        aria-hidden
        tabIndex={-1}
      />

      {rows === null || groups === null ? (
        <div className="flex h-[320px] items-center justify-center">
          <Loader />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-l)] border border-line">
          <div className="min-w-[680px]">
            {/* 헤더 행 */}
            <div className="grid grid-cols-[minmax(0,1fr)_220px_110px_130px] items-center gap-3 border-b border-line bg-surface-2 px-3.5 py-2 [font:var(--text-caption)] text-ink-4">
              <span>문서</span>
              <span>문서 유형</span>
              <span>영역</span>
              <span>디지털화 수준</span>
            </div>
            <div className="ax-scrollbar-none max-h-[min(56vh,640px)] overflow-y-auto">
              {rows.map((r) => {
                const busy = r.file.status === "pending" || r.file.status === "processing";
                const group = groupOfType(r.docTypeId);
                return (
                  <div
                    key={r.file.id}
                    className="grid grid-cols-[minmax(0,1fr)_220px_110px_130px] items-center gap-3 border-b border-line-subtle px-3.5 py-2 last:border-b-0"
                  >
                    {/* 문서명 + 상태 칩 */}
                    <span className="flex min-w-0 items-center gap-2">
                      {isChanged(r) && (
                        <span
                          aria-label="변경됨"
                          className="size-1.5 flex-none rounded-full bg-[var(--fg-brand)]"
                        />
                      )}
                      <span className="flex-none text-ink-4">
                        <Icons.file size={12} />
                      </span>
                      <span className="min-w-0 truncate [font:var(--text-body3)] tracking-[var(--track-body)] text-ink">
                        {r.file.name}
                      </span>
                      {busy && !r.isNew && (
                        <span className="flex flex-none items-center gap-1.5 [font:var(--text-caption)] text-ink-3">
                          <Loader style={{ width: 12, height: 12 }} />
                          분류 중
                        </span>
                      )}
                      {r.isNew && (
                        <span className="flex-none rounded-[var(--radius-xs)] bg-[var(--bg-brand-weak)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--fg-brand)]">
                          새 문서
                        </span>
                      )}
                      {r.file.hitlStatus === "needed" && (
                        <span className="flex-none rounded-[var(--radius-xs)] bg-[var(--bg-warning-weak)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--fg-warning)]">
                          확인 요청
                        </span>
                      )}
                    </span>

                    {/* 문서 유형 — 영역별 optgroup. 고르면 영역이 자동으로 따라온다 */}
                    <select
                      value={r.docTypeId ?? ""}
                      disabled={busy && !r.isNew}
                      onChange={(e) =>
                        setRows(
                          (prev) =>
                            prev?.map((x) =>
                              x.file.id === r.file.id
                                ? {
                                    ...x,
                                    docTypeId:
                                      e.target.value === "" ? null : Number(e.target.value),
                                  }
                                : x,
                            ) ?? null,
                        )
                      }
                      aria-label={`${r.file.name} 문서 유형`}
                      className="w-full rounded-[var(--radius-xs)] border border-line bg-surface px-1.5 py-1.5 [font:var(--text-caption)] text-ink-2"
                    >
                      <option value="">{r.isNew ? "자동 분류" : "미분류"}</option>
                      {groups.map((g) => (
                        <optgroup key={g.id} label={g.name}>
                          {g.docTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    {/* 영역 — 유형에서 자동 결정 (직접 고르지 않는다) */}
                    <span className="truncate [font:var(--text-caption)] text-ink-3">
                      {group?.name ?? "—"}
                    </span>

                    {/* 디지털화 수준 */}
                    <select
                      value={r.digitalLevel ?? ""}
                      disabled={busy && !r.isNew}
                      onChange={(e) =>
                        setRows(
                          (prev) =>
                            prev?.map((x) =>
                              x.file.id === r.file.id
                                ? {
                                    ...x,
                                    digitalLevel:
                                      e.target.value === "" ? null : Number(e.target.value),
                                  }
                                : x,
                            ) ?? null,
                        )
                      }
                      aria-label={`${r.file.name} 디지털화 수준`}
                      className="w-full rounded-[var(--radius-xs)] border border-line bg-surface px-1.5 py-1.5 [font:var(--text-caption)] text-ink-2"
                    >
                      <option value="">{r.isNew ? "자동 판정" : "미정"}</option>
                      {[1, 2, 3, 4].map((lv) => (
                        <option key={lv} value={lv}>
                          {levelLabel(lv)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
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
          disabled={saving || uploading || rows === null}
          onClick={() => void save()}
        >
          저장
        </Button>
      </div>
    </Modal>
  );
}
