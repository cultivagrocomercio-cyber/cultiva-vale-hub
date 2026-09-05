import type { Tables } from "@/integrations/supabase/types";
import type { CategorySlug } from "@/lib/categories";
import { detectTaxKind, formatTaxId, onlyDigits } from "@/lib/fiscal";

export type NfeStatus = Tables<"invoices">["status"];

export const NFE_STATUS_LABEL: Record<NfeStatus, string> = {
  pendente_emissao: "Pendente de Emissão",
  processando_sefaz: "Processando SEFAZ",
  autorizada: "Emitida / Autorizada",
  rejeitada: "Rejeitada pela SEFAZ",
  cancelada: "Cancelada",
};

export const NFE_STATUS_STYLE: Record<NfeStatus, string> = {
  pendente_emissao: "bg-sun/40 text-foreground hover:bg-sun/40",
  processando_sefaz: "bg-secondary/20 text-secondary-foreground hover:bg-secondary/20",
  autorizada: "bg-leaf-light text-primary hover:bg-leaf-light",
  rejeitada: "bg-destructive/15 text-destructive hover:bg-destructive/15",
  cancelada: "bg-muted text-muted-foreground hover:bg-muted",
};

/** Pedidos aptos a faturamento (pagamento confirmado ou concluído). */
export const NFE_ELIGIBLE_ORDER_STATUS = ["pago_em_custodia", "enviado", "aguardando_confirmacao", "concluido_liquidado"] as const;

/** NCM padrão por categoria quando o produto não informa o seu. */
export const DEFAULT_NCM: Record<CategorySlug, string> = {
  plantas: "0602.90.90", // outras plantas vivas / mudas
  insumos: "3105.90.90", // adubos e fertilizantes (genérico)
  maquinas: "8201.90.00", // ferramentas manuais agrícolas (genérico)
};

/** CFOP padrão: venda de mercadoria dentro do estado (5102) ou interestadual (6102). */
export function defaultCfop(sellerUf: string, buyerUf: string) {
  return sellerUf.toUpperCase() === buyerUf.toUpperCase() ? "5102" : "6102";
}

export interface BuyerFiscal {
  legal_name: string;
  tax_id: string;
  state_registration: string;
  address: string;
  cep: string;
  city: string;
  state: string;
}

export function readBuyerFiscal(v: unknown): BuyerFiscal {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const s = (k: string) => String(o[k] ?? "");
  return {
    legal_name: s("legal_name"),
    tax_id: s("tax_id"),
    state_registration: s("state_registration"),
    address: s("address"),
    cep: s("cep"),
    city: s("city"),
    state: s("state"),
  };
}

export function formatCep(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

type OrderRow = Tables<"orders">;
type ItemRow = Tables<"order_items"> & { products?: { ncm: string; category: CategorySlug } | null };
type BoxRow = Tables<"boxes">;

export interface NfePayload {
  modelo: "55";
  natureza_operacao: string;
  emitente: {
    nome: string; documento: string; tipo: "cpf" | "cnpj" | null; inscricao_estadual: string;
    endereco: string; municipio: string; uf: string;
  };
  destinatario: {
    nome: string; documento: string; tipo: "cpf" | "cnpj" | null; inscricao_estadual: string;
    endereco: string; cep: string; municipio: string; uf: string; indicador_ie: "1" | "9";
  };
  itens: Array<{
    numero: number; descricao: string; ncm: string; cfop: string; unidade: "UN";
    quantidade: number; valor_unitario: number; valor_total: number;
  }>;
  totais: {
    valor_produtos: number; base_calculo: number; impostos: number; valor_total_nota: number;
  };
  referencia: { pedido_id: string; emitido_em: string };
}

/** Monta o payload da NF-e a partir do pedido, dos itens e dos dados do box emitente. */
export function buildNfePayload(order: OrderRow, items: ItemRow[], box: BoxRow, cfopOverride?: string): NfePayload {
  const buyer = readBuyerFiscal(order.buyer_fiscal);
  const cfop = cfopOverride || defaultCfop(box.state, buyer.state || box.state);
  const itens = items.map((it, i) => {
    const qty = Number(it.quantity);
    const unit = Number(it.unit_price);
    const ncm = it.products?.ncm || (it.products?.category ? DEFAULT_NCM[it.products.category] : "");
    return {
      numero: i + 1,
      descricao: it.product_name,
      ncm,
      cfop,
      unidade: "UN" as const,
      quantidade: qty,
      valor_unitario: round2(unit),
      valor_total: round2(unit * qty),
    };
  });
  const produtos = round2(itens.reduce((s, i) => s + i.valor_total, 0));
  return {
    modelo: "55",
    natureza_operacao: "Venda de mercadoria",
    emitente: {
      nome: box.name,
      documento: formatTaxId(box.tax_id),
      tipo: detectTaxKind(box.tax_id),
      inscricao_estadual: box.state_registration,
      endereco: box.address,
      municipio: box.city,
      uf: box.state,
    },
    destinatario: {
      nome: buyer.legal_name,
      documento: formatTaxId(buyer.tax_id),
      tipo: detectTaxKind(buyer.tax_id),
      inscricao_estadual: buyer.state_registration,
      endereco: buyer.address,
      cep: formatCep(buyer.cep),
      municipio: buyer.city,
      uf: buyer.state,
      indicador_ie: buyer.state_registration ? "1" : "9",
    },
    itens,
    totais: {
      valor_produtos: produtos,
      base_calculo: produtos,
      // Regime tributário e alíquotas são definidos pelo contador/emissor; sem destaque automático.
      impostos: 0,
      valor_total_nota: produtos,
    },
    referencia: { pedido_id: order.id, emitido_em: new Date().toISOString() },
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
