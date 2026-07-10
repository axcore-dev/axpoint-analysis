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

/**
 * 가짜 인증 (데모) — 백엔드 없음. 어떤 값이든 통과하며 sessionStorage에 유지.
 * 흐름만 실제 서비스와 동일하게 맞춘다 (수정요청v1 확정 사항).
 */
export interface AuthUser {
  email: string;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  hydrated: boolean;
  login: (email: string) => void;
  signup: (email: string, name: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "axpoint-demo-auth-v1";

/** 데모 기본값 — 로그인 폼에 미리 채워 넣는다 */
export const DEMO_CREDENTIALS = {
  email: "kim.daeho@demo-company.co.kr",
  password: "demo1234!",
  name: "김대호",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw) as AuthUser);
    } catch {
      /* 무시 */
    }
    setHydrated(true);
  }, []);

  const persist = (u: AuthUser | null) => {
    if (u) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else sessionStorage.removeItem(STORAGE_KEY);
  };

  const login = useCallback((email: string) => {
    const u = { email, name: DEMO_CREDENTIALS.name };
    setUser(u);
    persist(u);
  }, []);

  const signup = useCallback((email: string, name: string) => {
    const u = { email, name: name || DEMO_CREDENTIALS.name };
    setUser(u);
    persist(u);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    persist(null);
  }, []);

  const value = useMemo(
    () => ({ user, hydrated, login, signup, logout }),
    [user, hydrated, login, signup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 사용");
  return ctx;
}
