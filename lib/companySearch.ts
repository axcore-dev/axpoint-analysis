"use client";

import { useEffect, useState } from "react";
import type { AutocompleteItem } from "@/components/ui";
import { api } from "@/lib/api";

/** 기업 검색 결과 한 건 — GET /api/companies/search 응답 (디렉터리 + 비즈노 병합) */
export type CompanyHit = {
  id: string | null;
  name: string;
  bizNo: string | null;
  region: string | null;
  industry: string | null;
  estDate: string | null;
  address: string | null;
  source: string;
};

/** 사업자번호 표기 — 000-00-00000 */
export const fmtBizNo = (b: string) => `${b.slice(0, 3)}-${b.slice(3, 5)}-${b.slice(5)}`;

/**
 * 입력 중 사업자번호 형식 맞추기 (수정요청v9) — 숫자·하이픈만 입력했을 때 000-00-00000으로.
 * 기업명(한글·영문)이 섞이면 그대로 둔다.
 */
export function fmtBizNoInput(raw: string): string {
  if (!/^[\d-]+$/.test(raw)) return raw;
  const d = raw.replace(/\D/g, "").slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 5), d.slice(5)].filter(Boolean).join("-");
}

/** 항목 펼침 줄 — 지역·업종·설립연도, 없으면 주소 */
export function hitDetail(it: CompanyHit): string {
  const parts = [
    it.region,
    it.industry,
    it.estDate ? `설립 ${it.estDate.slice(0, 4)}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : (it.address ?? "");
}

/**
 * 기업 검색 자동완성 — 입력 후 300ms 디바운스로 백엔드 검색.
 * 검색 API는 공개이고, 오류는 빈 목록으로 흘려 화면을 막지 않는다.
 * 첫 화면과 내 정보(회사 선택)가 같은 로직을 쓴다 (수정요청v9).
 */
export function useCompanySuggestions(query: string, enabled = true) {
  const [hits, setHits] = useState<CompanyHit[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!enabled || !q) {
      setHits([]);
      return;
    }
    /* 디바운스를 지나도 응답 순서는 보장되지 않는다 — 지난 질의 결과가 최신을 덮지 않게 막는다 */
    let stale = false;
    const timer = setTimeout(async () => {
      try {
        const { items } = await api<{ items: CompanyHit[] }>(
          `/api/companies/search?q=${encodeURIComponent(q)}`,
        );
        if (!stale) setHits(items);
      } catch {
        if (!stale) setHits([]);
      }
    }, 300);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, enabled]);

  const items: AutocompleteItem[] = hits.map((it) => ({
    value: it.name,
    badge: it.bizNo ? fmtBizNo(it.bizNo) : undefined,
    /* 지역은 맨 우측에 (수정요청v9) */
    description: it.region ?? undefined,
    detail: hitDetail(it),
  }));

  return { hits, items };
}
