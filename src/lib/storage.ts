import { supabase } from "@/integrations/supabase/client";

const TTL = 60 * 60 * 24 * 7;
const cache = new Map<string, string>();

/** Faz upload de um arquivo para a pasta do usuário e retorna o caminho no bucket. */
export async function uploadImage(userId: string, file: File, folder: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("marketplace").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    ...(file.type ? { contentType: file.type } : {}),
  });
  if (error) throw error;
  return path;
}

/** Resolve caminhos do bucket para URLs assinadas (lado do navegador), com cache em memória. */
export async function resolveImageUrls(paths: (string | null | undefined)[]) {
  const out: Record<string, string> = {};
  const need: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    if (/^https?:\/\//.test(p)) {
      out[p] = p;
    } else if (cache.has(p)) {
      out[p] = cache.get(p)!;
    } else {
      need.push(p);
    }
  }
  const uniq = Array.from(new Set(need));
  if (uniq.length) {
    const { data } = await supabase.storage.from("marketplace").createSignedUrls(uniq, TTL);
    data?.forEach((d, i) => {
      if (d.signedUrl) {
        cache.set(uniq[i]!, d.signedUrl);
        out[uniq[i]!] = d.signedUrl;
      }
    });
  }
  return out;
}

export async function resolveImageUrl(path: string | null | undefined) {
  if (!path) return null;
  const m = await resolveImageUrls([path]);
  return m[path] ?? null;
}
