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
import { api } from "@/lib/api";
import type { StepId } from "@/lib/types";

/**
 * 진단 플로우 클라이언트 상태 (백엔드 없음)
 * 6단계 단일 흐름의 진입 조건(PRD 시트2)을 이 상태로 판정한다.
 *
 * 새로고침 정책 (수정요청v3):
 * - 저장소 유지 없음 — 새로고침하면 데이터 초기화 (라우트 이동은 Provider가 유지)
 * - 작업 진행 중 새로고침/이탈 시 브라우저 기본 경고(beforeunload)
 */
/** S0 업로드 첨부 파일 메타 — 실제 업로드·데모 자료 공용 (수정요청v6) */
export interface AttachedFileInfo {
  key: string;
  name: string;
  type: string;
}

export interface DiagnosisState {
  /** S0: 기업 식별값 (필수) — 어떤 값이든 데모 시나리오로 진행 */
  companyInput: string;
  /** 서버 기업 id — 국세청 검증 통과 후 채워짐 */
  companyId: string | null;
  /** 서버 진단 세션 id — 기업 확정 시 생성 */
  assessmentId: string | null;
  /** S0: 첨부 파일 목록 — 라우트 이동에도 유지 (수정요청v6) */
  attachedFiles: AttachedFileInfo[];
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
  companyId: null,
  assessmentId: null,
  attachedFiles: [],
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

/** 구버전 저장 상태가 남아 있으면 제거 (새로고침 초기화 정책 전환) */
const LEGACY_STORAGE_KEY = "axpoint-demo-state-v1";

export function DiagnosisProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DiagnosisState>(initialState);

  useEffect(() => {
    try {
      sessionStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* noop */
    }
  }, []);

  /* 작업 진행 중이면 새로고침·창 닫기 전에 브라우저 기본 경고 표시 */
  const inProgress =
    state.companyInput !== "" ||
    state.attachedFiles.length > 0 ||
    state.completedSteps.length > 0 ||
    state.selectedTaskIds.length > 0;

  useEffect(() => {
    if (!inProgress) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // 레거시 브라우저 호환
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inProgress]);

  const update = useCallback((patch: Partial<DiagnosisState>) => {
    setState((s) => ({ ...s, ...patch }));
  }, []);

  const completeStep = useCallback((step: StepId) => {
    setState((s) => {
      if (s.completedSteps.includes(step)) return s;
      const completedSteps = [...s.completedSteps, step];
      /* 서버에도 저장 — 마이페이지 이어하기·재열람이 진행 단계를 복원할 수 있게 (실패해도 화면 진행은 유지) */
      if (s.assessmentId) {
        api(`/api/assessments/${s.assessmentId}`, {
          method: "PATCH",
          body: JSON.stringify({ completedSteps }),
        }).catch(() => {});
      }
      return { ...s, completedSteps };
    });
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
