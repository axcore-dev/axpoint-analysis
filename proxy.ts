import { NextResponse, type NextRequest } from "next/server";

/**
 * 어드민 서브도메인 라우팅 — admin.* 호스트로 들어온 요청을 /admin 하위로 리라이트.
 * 접근 권한(role) 검사는 어드민 레이아웃에서 세션으로 수행한다.
 */

/** 어드민 화면을 열어 주는 호스트 — admin.* 서브도메인과 로컬 개발 호스트 (v7) */
const adminHost = (host: string) => {
  const name = host.split(":")[0];
  return name.startsWith("admin.") || name === "localhost" || name === "127.0.0.1";
};

export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;
  /* 어드민 호스트에는 사이트 화면을 노출하지 않는다 — 로그인도 /admin/login 전용 화면을 쓴다
     (예전엔 /auth를 열어 뒀는데, 회원가입·체험하기가 그대로 보이는 사이트 로그인이 떴다) */
  if (host.startsWith("admin.") && !pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }
  /* 반대 방향도 막는다 (v7) — 서비스 도메인의 axcore.io.kr/admin 으로 어드민 화면이 그대로 열렸다.
     로그인 화면까지 노출되면 관리자 진입점이 어디인지 알려 주는 셈이라 이 호스트에서는 없는 경로로 둔다.
     로컬(localhost)은 서브도메인 없이 개발하므로 예외 */
  if (pathname.startsWith("/admin") && !adminHost(host)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // 정적 자산·이미지·파일 요청은 리라이트 대상에서 제외
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
