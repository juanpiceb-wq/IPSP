import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ACCESS_COOKIE = "ipsp_access_token";
const REFRESH_COOKIE = "ipsp_refresh_token";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isPublic = pathname === "/login" || pathname.startsWith("/_next") || pathname === "/favicon.ico";
  const db = client();

  // En desarrollo sin Supabase se conserva el modo demo.
  if (!db) return NextResponse.next();

  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  if (access) {
    const { data } = await db.auth.getUser(access);
    if (data.user) {
      if (pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
      return NextResponse.next();
    }
  }

  if (refresh) {
    const { data, error } = await db.auth.refreshSession({ refresh_token: refresh });
    if (!error && data.session) {
      const target = pathname === "/login" ? new URL("/", req.url) : null;
      const res = target ? NextResponse.redirect(target) : NextResponse.next();
      const secure = process.env.NODE_ENV === "production";
      res.cookies.set(ACCESS_COOKIE, data.session.access_token, {
        httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: data.session.expires_in,
      });
      res.cookies.set(REFRESH_COOKIE, data.session.refresh_token, {
        httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }
  }

  if (isPublic) return NextResponse.next();

  const login = new URL("/login", req.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
