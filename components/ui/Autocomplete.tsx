"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useCombobox } from "downshift";

/**
 * 자동완성 검색 필드 (수정요청v3 — downshift 기반)
 * 콤보박스 동작(필터링·방향키 탐색·Enter 선택·Esc 닫기·ARIA)은 downshift가 담당하고,
 * 시각은 디자인 시스템 .ax-field 문법을 따른다. 매칭 구간은 하이라이트.
 *
 * 한글 IME 대응 (수정요청v7): 입력을 React 제어(controlled)로 두면 조합(composition)
 * 중 재렌더가 input.value를 덮어써 조합이 취소되고 글자가 중복·깨짐.
 * → 입력 DOM은 완전 비제어로 두고(React가 value를 쓰지 않음), 필터링·하이라이트용
 *   query 상태만 input 이벤트에서 미러링한다. 외부 값 반영(재방문 복원 등)은
 *   포커스가 없을 때만 ref로 직접 쓴다.
 */

export interface AutocompleteItem {
  /** 선택 시 입력값이 되는 문자열 */
  value: string;
  /** 보조 설명 (우측 회색 표기) */
  description?: string;
  /** 이름 옆 코드 배지 (모노 칩 — 사업자번호 등) */
  badge?: string;
  /** 포커스(하이라이트) 시 아래 줄에 펼치는 상세 정보 */
  detail?: string;
}

interface AutocompleteProps {
  value: string;
  onValueChange: (value: string) => void;
  /** 항목 선택(클릭·Enter) 시 — 선택 확정 흐름 */
  onSelect: (value: string) => void;
  items: AutocompleteItem[];
  placeholder?: string;
  "aria-label": string;
  /** 입력 앞 아이콘 */
  leading?: ReactNode;
  /** 입력 뒤 요소 (제출 버튼 등) */
  trailing?: ReactNode;
  onFocus?: () => void;
  fieldClassName?: string;
  fieldStyle?: CSSProperties;
  inputStyle?: CSSProperties;
  /** 각 항목 앞 아이콘 (기업 검색의 건물 아이콘 등) */
  itemIcon?: ReactNode;
}

/** 매칭 구간 하이라이트 */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <b style={{ fontWeight: 700, color: "var(--fg-brand)" }}>
        {text.slice(idx, idx + q.length)}
      </b>
      {text.slice(idx + q.length)}
    </>
  );
}

export function Autocomplete({
  value,
  onValueChange,
  onSelect,
  items,
  placeholder,
  leading,
  trailing,
  onFocus,
  fieldClassName,
  fieldStyle,
  inputStyle,
  itemIcon,
  ...aria
}: AutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  /* 필터링·하이라이트용 미러 — 렌더에만 쓰고 input DOM에는 절대 쓰지 않는다 */
  const [query, setQuery] = useState(value);

  /* 외부 값 반영(재방문 복원 등) — 사용자가 입력 중(포커스)이면 건드리지 않음 */
  useEffect(() => {
    const el = inputRef.current;
    if (!el || document.activeElement === el) return;
    if (el.value !== value) el.value = value;
    setQuery((prev) => (prev === value ? prev : value));
  }, [value]);

  /* 입력값 포함 항목 우선, 매칭 없으면 전체 노출 (빈 드롭다운 금지) */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const matched = items.filter((it) => it.value.toLowerCase().includes(q));
    return matched.length > 0 ? matched : items;
  }, [items, query]);

  const {
    isOpen,
    highlightedIndex,
    getInputProps,
    getMenuProps,
    getItemProps,
    openMenu,
  } = useCombobox({
    items: filtered,
    inputValue: query,
    selectedItem: null,
    itemToString: (it) => it?.value ?? "",
    /* 입력값 보존 가드 (v7 버그 수정) — controlled selectedItem(null) 탓에 blur·Esc·
       항목 선택·모달 오픈 등 여러 내부 전이가 inputValue를 ""로 리셋한다.
       직접 타이핑(InputChange) 외에는 입력값 변경을 불허하고, 선택 전이는 선택 항목
       문자열로만 바꾼다. */
    stateReducer: (state, { type, changes }) => {
      if (
        type !== useCombobox.stateChangeTypes.InputChange &&
        changes.inputValue !== undefined &&
        changes.inputValue !== state.inputValue
      ) {
        return {
          ...changes,
          inputValue: changes.selectedItem ? changes.selectedItem.value : state.inputValue,
        };
      }
      return changes;
    },
    onInputValueChange: ({ inputValue }) => {
      const next = inputValue ?? "";
      setQuery(next);
      if (next !== value) onValueChange(next);
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) onSelect(selectedItem.value);
    },
  });

  /* downshift가 주는 value prop을 버려 입력을 비제어로 유지 (IME 보호) */
  const { value: _controlledValue, ...inputProps } = getInputProps({
    ref: inputRef,
    "aria-label": aria["aria-label"],
    placeholder,
    style: inputStyle,
    onFocus: () => {
      openMenu();
      onFocus?.();
    },
  });
  void _controlledValue;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div className={`ax-field ${fieldClassName ?? ""}`} style={fieldStyle}>
        {leading && <span className="ax-field__icon">{leading}</span>}
        <input {...inputProps} defaultValue={value} />
        {trailing}
      </div>

      <ul
        {...getMenuProps({ "aria-label": "예상 검색어" })}
        className={`absolute inset-x-2 top-full z-10 mt-2 list-none flex-col gap-0.5 rounded-[var(--radius-l)] border border-line bg-surface p-1.5 text-left shadow-[var(--shadow-2)] ${
          isOpen && filtered.length > 0 ? "flex" : "hidden"
        }`}
        style={{ animation: "ax-step-in var(--dur-base) var(--ease-out)" }}
      >
        {isOpen &&
          filtered.map((it, i) => (
            <li key={`${it.value}|${it.badge ?? ""}`} {...getItemProps({ item: it, index: i })}>
              <span
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-s)] px-3.5 py-2.5 text-left [font:var(--text-body2)] tracking-[var(--track-body)] text-ink transition-colors duration-[var(--dur-fast)] ${
                  i === highlightedIndex ? "bg-[var(--hover-overlay)]" : ""
                }`}
              >
                {itemIcon && (
                  <span className="flex-none text-[var(--fg-brand)]">{itemIcon}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate font-semibold">
                      <Highlight text={it.value} query={query} />
                    </span>
                    {it.badge && (
                      <span
                        className="flex-none rounded-full bg-[var(--bg-brand-weak)] px-2 py-0.5 text-[var(--fg-brand)]"
                        style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 0 }}
                      >
                        {it.badge}
                      </span>
                    )}
                  </span>
                  {/* 상세줄 — 포커스된 항목만 펼침 (지역·업종·설립 등) */}
                  {i === highlightedIndex && it.detail && (
                    <span className="mt-0.5 block truncate [font:var(--text-caption)] text-ink-4">
                      {it.detail}
                    </span>
                  )}
                </span>
                {it.description && (
                  <span className="flex-none [font:var(--text-caption)] text-ink-4">
                    {it.description}
                  </span>
                )}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
