import type { CategorySlug } from "@/lib/categories";

/* ---------------- CPF / CNPJ ---------------- */

export const onlyDigits = (v: string) => (v ?? "").replace(/\D/g, "");

export function isValidCPF(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCNPJ(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i]!;
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export type TaxKind = "cpf" | "cnpj";

export function detectTaxKind(value: string): TaxKind | null {
  const d = onlyDigits(value);
  if (d.length === 11) return "cpf";
  if (d.length === 14) return "cnpj";
  return null;
}

export function formatTaxId(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/* ---------------- Inscrição Estadual ---------------- */

/** Quantidade de dígitos aceita para a IE em cada UF (formato numérico). */
export const IE_DIGITS: Record<string, number[]> = {
  AC: [13], AL: [9], AP: [9], AM: [9], BA: [8, 9], CE: [9], DF: [13], ES: [9], GO: [9], MA: [9],
  MT: [11], MS: [9], MG: [13], PA: [9], PB: [9], PR: [10], PE: [9, 14], PI: [9], RJ: [8], RN: [9, 10],
  RS: [10], RO: [9, 14], RR: [9], SC: [9], SP: [12], SE: [9], TO: [9, 11],
};

export function isValidIE(value: string, uf: string): boolean {
  const d = onlyDigits(value);
  const lens = IE_DIGITS[uf.toUpperCase()];
  if (!lens) return d.length >= 8 && d.length <= 14;
  if (!lens.includes(d.length) || /^(\d)\1+$/.test(d)) return false;
  if (uf.toUpperCase() === "SP") return isValidIESP(d);
  return true;
}

/** Dígitos verificadores da IE de São Paulo (CADESP), 12 dígitos: DV nas posições 9 e 12. */
function isValidIESP(d: string): boolean {
  const w1 = [1, 3, 4, 5, 6, 7, 8, 10];
  let s = 0;
  for (let i = 0; i < 8; i++) s += Number(d[i]) * w1[i]!;
  if ((s % 11) % 10 !== Number(d[8])) return false;
  const w2 = [3, 2, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  s = 0;
  for (let i = 0; i < 11; i++) s += Number(d[i]) * w2[i]!;
  return (s % 11) % 10 === Number(d[11]);
}

/* ---------------- Matriz de exigência por categoria ---------------- */

export const FISCAL_RULES: Record<CategorySlug, { allowCpf: boolean; requireIE: boolean; label: string; help: string }> = {
  plantas: {
    allowCpf: true,
    requireIE: true,
    label: "Produtor rural",
    help: "CNPJ rural ou CPF, sempre acompanhado da Inscrição Estadual de Produtor Rural ativa (ex.: CADESP em SP).",
  },
  insumos: {
    allowCpf: false,
    requireIE: false,
    label: "Comércio / distribuição",
    help: "Exige CNPJ ativo (MEI, ME, EPP ou demais regimes). Pessoa física não pode vender insumos.",
  },
  maquinas: {
    allowCpf: false,
    requireIE: false,
    label: "Comércio de máquinas e ferramentas",
    help: "Exige CNPJ ativo. Pessoa física não pode vender máquinas e ferramentas.",
  },
};

export interface FiscalInput {
  category: CategorySlug | null | undefined;
  taxId: string;
  stateRegistration: string;
  uf: string;
}

/** Retorna a lista de erros (vazia = válido). */
export function validateFiscal({ category, taxId, stateRegistration, uf }: FiscalInput): string[] {
  const errors: string[] = [];
  if (!category) return ["Selecione a categoria de atuação"];
  const rule = FISCAL_RULES[category];
  const kind = detectTaxKind(taxId);

  if (!kind) {
    errors.push("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido");
  } else if (kind === "cpf") {
    if (!rule.allowCpf) errors.push(`A categoria ${rule.label.toLowerCase()} exige CNPJ ativo — cadastro com CPF não é permitido`);
    else if (!isValidCPF(taxId)) errors.push("CPF inválido: confira os dígitos verificadores");
  } else if (!isValidCNPJ(taxId)) {
    errors.push("CNPJ inválido: confira os dígitos verificadores");
  }

  if (rule.requireIE) {
    if (!onlyDigits(stateRegistration)) errors.push("A Inscrição Estadual de Produtor Rural é obrigatória para a categoria plantas e mudas");
    else if (!isValidIE(stateRegistration, uf)) {
      const lens = IE_DIGITS[uf];
      errors.push(`Inscrição Estadual inválida para ${uf}${lens ? ` (esperado ${lens.join(" ou ")} dígitos${uf === "SP" ? ", com dígitos verificadores corretos" : ""})` : ""}`);
    }
  } else if (onlyDigits(stateRegistration) && !isValidIE(stateRegistration, uf)) {
    errors.push(`Inscrição Estadual inválida para ${uf}`);
  }

  return errors;
}
