"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { StepId } from "@/lib/types";

/**
 * 진단 플로우 클라이언트 상태 (백엔드 없음 — sessionStorage 유지)
 * 6단계 단일 흐름의 진입 조건(PRD 시트2)을 이 상태로 판정한다.
 */
export interface DiagnosisState {
  /** S0: 기업 식별값 (필수) — 어떤 값이든 데모 시나리오로 진행 */
  companyInput: string;
  /** S0: 자료 업로드(선택) — 데모에서는 시나리오 12건으로 시뮬레이션 */
  uploadSimulated: boolean;
  /** S0: 8대 기능 관심영역(선택) */
  interestAreas: string[];
  /** S0: 시스템 현황(선택) */
  systems: string[];
  /** S1: HITL 원탭 확인 완료된 문서 id */
  confirmedDocIds: string[];
  /** S1: 설문 응답 완료 여부 */
  surveyDone: boolean;
  /** S3: 담은 과제 */
  selectedTaskIds: string[];
  /** 완료한 단계 */
  completedSteps: StepId[];
}

const initialState: DiagnosisState = {
  companyInput: "",
  uploadSimulated: false,
  interestAreas: [],
  systems: [],
  confirmedDocIds: [],
  surveyDone: false,
  selectedTaskIds: [],
  completedSteps: [],
};

interface DiagnosisContextValue extends DiagnosisState {
  update: (patch: Partial<DiagnosisState>) => void;
  completeStep: (step: StepId) => void;
  toggleTask: (taskId: string) => void;
  addTask: (taskId: string) => void;
  removeTask: (taskId: string) => void;
  reset: () => void;
}

const DiagnosisContext = createContext<DiagnosisContextValue | null>(null);

const STORAGE_KEY = "axpoint-demo-state-v1";

export function DiagnosisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DiagnosisState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initialState, ...(JSON.parse(raw) as DiagnosisState) });
    } catch {
      /* 손상된 상태는 초기화 */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const update = useCallback((patch: Partial<DiagnosisState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const completeStep = useCallback((step: StepId) => {
    setState((s) =>
      s.completedSteps.includes(step)
        ? s
        : { ...s, completedSteps: [...s.completedSteps, step] },
    );
  }, []);

  const addTask = useCallback((taskId: string) => {
    setState((s) =>
      s.selectedTaskIds.includes(taskId)
        ? s
        : { ...s, selectedTaskIds: [...s.selectedTaskIds, taskId] },
    );
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setState((s) => ({
      ...s,
      selectedTaskIds: s.selectedTaskIds.filter((id) => id !== taskId),
    }));
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setState((s) =>
      s.selectedTaskIds.includes(taskId)
        ? { ...s, selectedTaskIds: s.selectedTaskIds.filter((id) => id !== taskId) }
        : { ...s, selectedTaskIds: [...s.selectedTaskIds, taskId] },
    );
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ ...state, update, completeStep, toggleTask, addTask, removeTask, reset }),
    [state, update, completeStep, toggleTask, addTask, removeTask, reset],
  );

  return <DiagnosisContext.Provider value={value}>{children}</DiagnosisContext.Provider>;
}

export function useDiagnosis(): DiagnosisContextValue {
  const ctx = useContext(DiagnosisContext);
  if (!ctx) throw new Error("useDiagnosis는 DiagnosisProvider 안에서만 사용");
  return ctx;
}
