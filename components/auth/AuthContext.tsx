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

/**
 * 인증 — 백엔드(better-auth) 연동. 세션은 httpOnly 쿠키로 유지되고,
 * 마운트 시 /api/me로 복원한다. 이메일 가입은 인증 메일 완료 후 로그인 가능.
 */
export interface AuthUser {
  email: string;
  name: string;
  /** 소속 회사명 (선택, 수정요청v7 — 내 정보) */
  company?: string;
  /** 직책 (선택) */
  title?: string;
  /** 연락처 (선택) */
  phone?: string;
  /** '체험하기' 게스트 계정 여부 */
  isAnonymous?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** 가입 — 성공해도 세션은 없음(이메일 인증 완료 후 로그인) */
  signup: (email: string, password: string, name: string) => Promise<void>;
  /** '체험하기' — 게스트 계정 즉석 발급 + 자동 로그인 */
  loginGuest: () => Promise<void>;
  /** 구글 소셜 로그인 — 동의 화면으로 이동 */
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  /** 프로필 부분 수정 — 서버 반영 후 로컬 병합 (수정요청v7) */
  updateProfile: (patch: Partial<AuthUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

type SessionUser = {
  email: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  isAnonymous?: boolean | null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { user: u, companyName } = await api<{ user: SessionUser; companyName: string | null }>(
        "/api/me",
      );
      setUser({
        email: u.email,
        name: u.name,
        company: companyName ?? undefined,
        title: u.title ?? undefined,
        phone: u.phone ?? undefined,
        isAnonymous: u.isAnonymous ?? undefined,
      });
    } catch {
      setUser(null); // 세션 없음(401 포함)
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setHydrated(true));
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      await api("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await refresh();
    },
    [refresh],
  );

  const signup = useCallback(async (email: string, password: string, name: string) => {
    await api("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
    // 이메일 인증 완료 전에는 세션이 없다 — 화면은 인증 안내를 보여준다
  }, []);

  const loginGuest = useCallback(async () => {
    await api("/api/auth/sign-in/anonymous", { method: "POST", body: JSON.stringify({}) });
    await refresh();
  }, [refresh]);

  const loginGoogle = useCallback(async () => {
    // 구글 동의 화면으로 이동 → 완료 후 콜백이 세션 쿠키를 심고 원래 주소로 복귀
    const { url } = await api<{ url: string }>("/api/auth/sign-in/social", {
      method: "POST",
      body: JSON.stringify({ provider: "google", callbackURL: window.location.origin }),
    });
    window.location.href = url;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/sign-out", { method: "POST", body: JSON.stringify({}) });
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<AuthUser>) => {
      // 서버에 반영되는 항목: 이름·직책·연락처 (회사 연결은 기업 검색 연동 시)
      await api("/api/auth/update-user", {
        method: "POST",
        body: JSON.stringify({
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.phone !== undefined && { phone: patch.phone }),
        }),
      });
      setUser((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [],
  );

  const value = useMemo(
    () => ({ user, hydrated, login, signup, loginGuest, loginGoogle, logout, updateProfile }),
    [user, hydrated, login, signup, loginGuest, loginGoogle, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 사용");
  return ctx;
}
