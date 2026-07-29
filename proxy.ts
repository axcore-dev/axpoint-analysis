import { NextResponse, type NextRequest } from "next/server";

/**
 * 어드민 서브도메인 라우팅 — admin.* 호스트로 들어온 요청을 /admin 하위로 리라이트.
 * 접근 권한(role) 검사는 어드민 레이아웃에서 세션으로 수행한다.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;
  if (host.startsWith("admin.") && !pathname.startsWith("/admin")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === "/" ? "/admin" : `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = {
  // 정적 자산·이미지·파일 요청은 리라이트 대상에서 제외
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
