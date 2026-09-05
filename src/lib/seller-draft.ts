// Rascunho do pedido de habilitação comercial (preenchido no cadastro "Quero Vender"
// e consumido pelo formulário do box no painel). Fica só no navegador.
export const SELLER_DRAFT_KEY = "cv_seller_draft";

export interface SellerDraft {
  name?: string;
  tax_id?: string;
  city?: string;
  address?: string;
  main_category?: string;
  whatsapp?: string;
}

export function readSellerDraft(): SellerDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SELLER_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as SellerDraft) : null;
  } catch {
    return null;
  }
}

export function clearSellerDraft() {
  if (typeof window !== "undefined") localStorage.removeItem(SELLER_DRAFT_KEY);
}
