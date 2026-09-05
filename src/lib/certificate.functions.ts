import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BYTES = 200 * 1024;

const uploadSchema = z.object({
  boxId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(200).regex(/\.(pfx|p12)$/i, "Somente arquivos .pfx ou .p12"),
  fileBase64: z.string().min(1).max(Math.ceil((MAX_BYTES * 4) / 3) + 8),
  password: z.string().min(1, "Informe a senha do certificado").max(200),
});

async function assertOwner(supabase: { from: (t: "boxes") => any }, boxId: string, userId: string) {
  const { data } = await supabase.from("boxes").select("id, owner_id").eq("id", boxId).maybeSingle();
  if (!data || data.owner_id !== userId) throw new Error("Acesso negado: este box não pertence a você.");
}

/** Recebe o .pfx e a senha por canal cifrado (HTTPS), valida, guarda o arquivo em bucket privado e a senha criptografada. */
export const uploadCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => uploadSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase as never, data.boxId, context.userId);

    const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_BYTES) throw new Error("Arquivo acima de 200 KB.");

    const [{ parsePfx, encryptSecret }, { supabaseAdmin }] = await Promise.all([
      import("./certificate.server"),
      import("@/integrations/supabase/client.server"),
    ]);

    const parsed = parsePfx(bytes, data.password);
    const now = new Date();

    if (!parsed.ok) {
      // Registra a tentativa (sem arquivo/senha) para o card de status exibir "Senha incorreta".
      await supabaseAdmin.from("box_certificates").upsert(
        { box_id: data.boxId, status: parsed.reason, file_name: data.fileName, uploaded_by: context.userId, holder_name: "", holder_tax_id: "", issuer: "", not_before: null, not_after: null },
        { onConflict: "box_id" },
      );
      await supabaseAdmin.from("box_certificate_secrets").delete().eq("box_id", data.boxId);
      return { ok: false as const, reason: parsed.reason, message: parsed.message };
    }

    const expired = parsed.notAfter <= now;
    const storagePath = `${data.boxId}/certificado.pfx`;
    const { error: upErr } = await supabaseAdmin.storage.from("certificates").upload(storagePath, bytes, {
      upsert: true,
      contentType: "application/x-pkcs12",
    });
    if (upErr) throw new Error(`Falha ao guardar o arquivo: ${upErr.message}`);

    const enc = await encryptSecret(data.password);
    const { error: sErr } = await supabaseAdmin.from("box_certificate_secrets").upsert(
      { box_id: data.boxId, storage_path: storagePath, password_ciphertext: enc.ciphertext, password_iv: enc.iv },
      { onConflict: "box_id" },
    );
    if (sErr) throw new Error(sErr.message);

    const { error: cErr } = await supabaseAdmin.from("box_certificates").upsert(
      {
        box_id: data.boxId,
        status: expired ? "expirado" : "valido",
        holder_name: parsed.holderName,
        holder_tax_id: parsed.holderTaxId,
        issuer: parsed.issuer,
        not_before: parsed.notBefore.toISOString(),
        not_after: parsed.notAfter.toISOString(),
        file_name: data.fileName,
        uploaded_by: context.userId,
      },
      { onConflict: "box_id" },
    );
    if (cErr) throw new Error(cErr.message);

    return { ok: true as const, expired, holderName: parsed.holderName, notAfter: parsed.notAfter.toISOString() };
  });

export const removeCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ boxId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase as never, data.boxId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("certificates").remove([`${data.boxId}/certificado.pfx`]);
    await supabaseAdmin.from("box_certificate_secrets").delete().eq("box_id", data.boxId);
    await supabaseAdmin.from("box_certificates").delete().eq("box_id", data.boxId);
    return { ok: true };
  });
