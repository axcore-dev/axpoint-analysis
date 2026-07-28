/** 백엔드 API 호출 공통 — 쿠키 세션이라 credentials 필수 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** API 오류 — 서버가 준 오류 코드(better-auth code 등)를 함께 보존 */
export class ApiError extends Error {
  code?: string;
  status: number;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const b = body as { error?: string; message?: string; code?: string };
    throw new ApiError(b.error ?? b.message ?? "잠시 후 다시 시도해 주세요.", res.status, b.code);
  }
  return body as T;
}
