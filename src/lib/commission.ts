import type { Tables } from "@/integrations/supabase/types";

export type BoxPlan = Tables<"boxes">["plan"];
export type OrderStatus = Tables<"orders">["status"];

export const PLANS: Record<BoxPlan, { name: string; rate: number; description: string }> = {
  basico: { name: "Plano Básico", rate: 0.08, description: "Comissão de 8% por venda fechada no app." },
  intermediario: { name: "Plano Intermediário", rate: 0.05, description: "Comissão de 5% por venda fechada no app." },
  premium: { name: "Plano Premium", rate: 0.03, description: "Comissão de 3% por venda fechada no app." },
};

/** Vendas pagas dentro do app: confirmadas pelo vendedor ou já entregues. */
export function isPaidOrder(status: OrderStatus) {
  return status === "confirmado" || status === "entregue";
}

export function formatRate(rate: number) {
  return `${(rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
