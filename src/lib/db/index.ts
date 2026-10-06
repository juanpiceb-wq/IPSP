import "server-only";
import { MemoryRepo } from "./memory";
import { SupabaseRepo } from "./supabase";
import type { Repo } from "./repo";

let cached: Repo | null = null;

/**
 * Repositorio de datos exclusivamente de servidor.
 * En producción usa SUPABASE_SERVICE_ROLE_KEY; la clave pública queda reservada
 * para Auth en middleware/login y nunca autoriza CRUD de las tablas de negocio.
 */
export function getRepo(): Repo {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    cached = new SupabaseRepo(url, key);
    return cached;
  }
  if (process.env.NODE_ENV === "production")
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada para el repositorio de producción.");
  cached = new MemoryRepo();
  return cached;
}

export type { Repo } from "./repo";
export { newId, slugify } from "./repo";
