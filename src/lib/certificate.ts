import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type BoxCertificate = Tables<"box_certificates">;
export type CertSituation = "nenhum" | "valido" | "expirado" | "senha_incorreta" | "invalido";

export const CERT_SITUATION_LABEL: Record<CertSituation, string> = {
  nenhum: "Nenhum Certificado",
  valido: "Válido e Ativo",
  expirado: "Expirado",
  senha_incorreta: "Senha Incorreta",
  invalido: "Arquivo Inválido",
};

export const CERT_SITUATION_STYLE: Record<CertSituation, string> = {
  nenhum: "bg-muted text-muted-foreground",
  valido: "bg-leaf-light text-primary",
  expirado: "bg-destructive/15 text-destructive",
  senha_incorreta: "bg-destructive/15 text-destructive",
  invalido: "bg-destructive/15 text-destructive",
};

export const CERT_MISSING_MESSAGE = "Certificado Digital A1 Obrigatório para Emissão";

/** Situação efetiva (a validade é recalculada na leitura, pois um certificado válido pode expirar depois do upload). */
export function certSituation(c: BoxCertificate | null | undefined): CertSituation {
  if (!c) return "nenhum";
  if (c.status === "valido" && c.not_after && new Date(c.not_after) <= new Date()) return "expirado";
  return c.status;
}

export function certDaysLeft(c: BoxCertificate | null | undefined): number | null {
  if (!c?.not_after) return null;
  return Math.ceil((new Date(c.not_after).getTime() - Date.now()) / 86_400_000);
}

export function certIsUsable(c: BoxCertificate | null | undefined) {
  return certSituation(c) === "valido";
}

export function useBoxCertificate(boxId: string | null | undefined) {
  return useQuery({
    queryKey: ["seller", "certificate", boxId],
    enabled: !!boxId,
    queryFn: async () => {
      const { data, error } = await supabase.from("box_certificates").select("*").eq("box_id", boxId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
