"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const ACCESS_COOKIE = "ipsp_access_token";
const REFRESH_COOKIE = "ipsp_refresh_token";

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase no está configurado.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function userToEmail(value: string) {
  const clean = value.trim().toLowerCase();
  if (!clean) return "";
  return clean.includes("@") ? clean : `${clean.replace(/\s+/g, "")}@ipsp.local`;
}

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const email = userToEmail(username);

  if (!email || !password) redirect("/login?error=Ingrese%20usuario%20y%20contrase%C3%B1a.");

  const { data, error } = await supabase().auth.signInWithPassword({ email, password });
  if (error || !data.session) redirect("/login?error=Usuario%20o%20contrase%C3%B1a%20incorrectos.");

  const jar = cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(ACCESS_COOKIE, data.session.access_token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: data.session.expires_in,
  });
  jar.set(REFRESH_COOKIE, data.session.refresh_token, {
    httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/");
}

export async function logout() {
  const jar = cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect("/login");
}
