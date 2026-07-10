"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useCombobox } from "downshift";

/**
 * 자동완성 검색 필드 (수정요청v3 — downshift 기반)
 * 콤보박스 동작(필터링·방향키 탐색·Enter 선택·Esc 닫기·ARIA)은 downshift가 담당하고,
 * 시각은 디자인 시스템 .ax-field 문법을 따른다. 매칭 구간은 하이라이트.
 */

export interface AutocompleteItem {
  /** 선택 시 입력값이 되는 문자열 */
  value: string;
  /** 보조 설명 (우측 회색 표기) */
  description?: string;
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
  ...aria
}: AutocompleteProps) {
  /* 입력값 포함 항목 우선, 매칭 없으면 전체 노출 (빈 드롭다운 금지) */
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return items;
    const matched = items.filter((it) => it.value.toLowerCase().includes(q));
    return matched.length > 0 ? matched : items;
  }, [items, value]);

  const {
    isOpen,
    highlightedIndex,
    getInputProps,
    getMenuProps,
    getItemProps,
    openMenu,
  } = useCombobox({
    items: filtered,
    inputValue: value,
    selectedItem: null,
    itemToString: (it) => it?.value ?? "",
    /* blur·닫힘 시 selectedItem(null) 기준으로 입력값을 비우는 기본 동작 방지 — 입력값 유지 */
    stateReducer: (state, { type, changes }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputBlur:
          return { ...changes, inputValue: state.inputValue };
        default:
          return changes;
      }
    },
    onInputValueChange: ({ inputValue }) => {
      if (inputValue !== value) onValueChange(inputValue ?? "");
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem) onSelect(selectedItem.value);
    },
  });

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div className={`ax-field ${fieldClassName ?? ""}`} style={fieldStyle}>
        {leading && <span className="ax-field__icon">{leading}</span>}
        <input
          {...getInputProps({
            "aria-label": aria["aria-label"],
            placeholder,
            style: inputStyle,
            onFocus: () => {
              openMenu();
              onFocus?.();
            },
          })}
        />
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
            <li key={it.value} {...getItemProps({ item: it, index: i })}>
              <span
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-s)] px-3.5 py-2.5 text-left [font:var(--text-body2)] tracking-[var(--track-body)] text-ink transition-colors duration-[var(--dur-fast)] ${
                  i === highlightedIndex ? "bg-[var(--hover-overlay)]" : ""
                }`}
              >
                <span className="min-w-0 flex-1 truncate">
                  <Highlight text={it.value} query={value} />
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
