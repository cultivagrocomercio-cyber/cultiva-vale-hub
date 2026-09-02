import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Cliente público (chave publishable, sem sessão) para leituras anônimas no servidor. */
export function createPublicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const IMAGE_URL_TTL = 60 * 60 * 24 * 7; // 7 dias

/** Converte caminhos do bucket em URLs assinadas. Mantém URLs http(s) e nulos como estão. */
export async function signPaths(
  client: ReturnType<typeof createPublicClient>,
  paths: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const need = Array.from(new Set(paths.filter((p): p is string => !!p && !/^https?:\/\//.test(p))));
  if (need.length === 0) return {};
  const { data } = await client.storage.from("marketplace").createSignedUrls(need, IMAGE_URL_TTL);
  const map: Record<string, string> = {};
  data?.forEach((d, i) => {
    if (d.signedUrl) map[need[i]!] = d.signedUrl;
  });
  return map;
}

export function resolve(map: Record<string, string>, p: string | null | undefined): string | null {
  if (!p) return null;
  if (/^https?:\/\//.test(p)) return p;
  return map[p] ?? null;
}
