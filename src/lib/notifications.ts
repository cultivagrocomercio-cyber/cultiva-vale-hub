/** Tipos de notificação gravados em `notifications.kind`. */
export const NOTIFICATION_KINDS: { value: string; label: string }[] = [
  { value: "pedido", label: "Pedidos" },
  { value: "pagamento", label: "Pagamentos" },
  { value: "envio", label: "Envios" },
  { value: "nfe", label: "Notas fiscais" },
  { value: "avaliacao", label: "Avaliações" },
  { value: "estoque", label: "Estoque" },
  { value: "saldo", label: "Financeiro" },
  { value: "box", label: "Meu box" },
];

export function kindLabel(kind: string) {
  return NOTIFICATION_KINDS.find((k) => k.value === kind)?.label ?? "Geral";
}

/** Preferências de canais secundários (e-mail / WhatsApp) por grupo de eventos. */
export const PREFERENCE_FIELDS = [
  { key: "email_orders", label: "Pedidos por e-mail", hint: "Pedido realizado, pagamento confirmado, envio, entrega e conclusão." },
  { key: "email_invoices", label: "Notas fiscais por e-mail", hint: "Aviso com links para DANFE (PDF) e XML quando a NF-e for autorizada." },
  { key: "email_reviews", label: "Avaliações por e-mail", hint: "Nova avaliação recebida no seu box (vendedores)." },
  { key: "email_stock_finance", label: "Estoque e financeiro por e-mail", hint: "Estoque crítico, saldo liberado e aprovação do box (vendedores)." },
  { key: "whatsapp_updates", label: "Resumo por WhatsApp", hint: "Canal secundário: avisos importantes no seu WhatsApp cadastrado." },
] as const;
export type PreferenceKey = (typeof PREFERENCE_FIELDS)[number]["key"];
