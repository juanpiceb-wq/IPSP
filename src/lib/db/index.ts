import { MemoryRepo } from "./memory";
import { SupabaseRepo } from "./supabase";
import type { Repo } from "./repo";

let cached: Repo | null = null;

/**
 * Devuelve el repositorio activo.
 * Con NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY usa Supabase.
 * Sin esas variables arranca en MODO DEMO (almacén en memoria con el seed).
 */
export function getRepo(): Repo {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cached = url && key ? new SupabaseRepo(url, key) : new MemoryRepo();
  return cached;
}

export type { Repo } from "./repo";
export { newId, slugify } from "./repo";
