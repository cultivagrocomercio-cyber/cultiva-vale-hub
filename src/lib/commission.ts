import type { Tables } from "@/integrations/supabase/types";

export type BoxPlan = Tables<"boxes">["plan"];
export type OrderStatus = Tables<"orders">["status"];

export const PLANS: Record<BoxPlan, { name: string; rate: number; description: string }> = {
  basico: { name: "Plano Básico", rate: 0.08, description: "Comissão de 8% por venda fechada no app." },
  intermediario: { name: "Plano Intermediário", rate: 0.05, description: "Comissão de 5% por venda fechada no app." },
  premium: { name: "Plano Premium", rate: 0.03, description: "Comissão de 3% por venda fechada no app." },
};

/** Chave PIX da plataforma exibida no checkout. Preencha com a chave real. */
export const PLATFORM_PIX_KEY = "";

/** Prazo (dias corridos após o envio) para liberação automática ao vendedor. */
export const AUTO_RELEASE_DAYS = 7;

/** Vendas pagas dentro do app (dinheiro já entrou em custódia ou foi liquidado). */
export function isPaidOrder(status: OrderStatus) {
  return status === "pago_em_custodia" || status === "enviado" || status === "aguardando_confirmacao" || status === "concluido_liquidado" || status === "em_disputa";
}

/** Valor já liberado para o saldo do vendedor. */
export function isSettledOrder(status: OrderStatus) {
  return status === "concluido_liquidado";
}

/** Valor retido em custódia pela plataforma. */
export function isInEscrow(status: OrderStatus) {
  return status === "pago_em_custodia" || status === "enviado" || status === "aguardando_confirmacao" || status === "em_disputa";
}

export function formatRate(rate: number) {
  return `${(rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** Etapas da linha do tempo do pedido (fluxo feliz). */
export const ORDER_STEPS: { key: OrderStatus; label: string; buyer: string; seller: string }[] = [
  { key: "pendente_pagamento", label: "Pagamento", buyer: "Faça o PIX e envie o comprovante.", seller: "Aguardando o comprador pagar." },
  { key: "pago_em_custodia", label: "Em custódia", buyer: "Pagamento confirmado e retido pela plataforma.", seller: "Pagamento em custódia. Separe e despache a mercadoria." },
  { key: "enviado", label: "Enviado", buyer: "Mercadoria a caminho.", seller: "Você informou o envio." },
  { key: "aguardando_confirmacao", label: "Entrega", buyer: "Confirme o recebimento ou abra uma disputa.", seller: "Aguardando o comprador confirmar." },
  { key: "concluido_liquidado", label: "Concluído", buyer: "Pedido concluído. Avalie o box!", seller: "Valor líquido liberado no seu saldo." },
];

export function stepIndex(status: OrderStatus) {
  const i = ORDER_STEPS.findIndex((s) => s.key === status);
  return i;
}

/** Data limite de liberação automática. */
export function autoReleaseDate(shippedAt: string | null) {
  if (!shippedAt) return null;
  const d = new Date(shippedAt);
  d.setDate(d.getDate() + AUTO_RELEASE_DAYS);
  return d;
}
