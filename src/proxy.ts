import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Chequeo optimista: sin cookie de sesión → /login. La verificación real ocurre en cada página/acción.
export function proxy(req: NextRequest) {
  const cookie = getSessionCookie(req, { cookiePrefix: "cobros" });
  if (!cookie) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/panel/:path*", "/superadmin/:path*", "/inicio"],
};
