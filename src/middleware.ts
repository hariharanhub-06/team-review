import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "twt_session";
const encoder = new TextEncoder();

async function readSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encoder.encode(process.env.JWT_SECRET));
    return { role: payload.role as string, sub: payload.sub as string };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSession(req);

  const isAuthPage = pathname === "/login";
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  const isAdminArea = pathname.startsWith("/admin");
  const isMemberArea = pathname.startsWith("/dashboard");

  // Already logged in and visiting /login -> send to the right home.
  if (isAuthPage && session) {
    const url = req.nextUrl.clone();
    url.pathname = session.role === "ADMIN" ? "/admin" : "/dashboard";
    return NextResponse.redirect(url);
  }

  if (isProtected && !session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminArea && session && session.role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Admins have no personal member dashboard — send them to the admin home.
  // Matters most for the PWA, whose start_url is /dashboard, so an admin who
  // opens the installed app would otherwise land on the member pages.
  if (isMemberArea && session && session.role === "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*", "/admin/:path*"],
};
