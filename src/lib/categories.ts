export type CategorySlug = "plantas" | "insumos" | "maquinas";

export interface CategoryDef {
  slug: CategorySlug;
  name: string;
  short: string;
  description: string;
  subcategories: string[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    slug: "plantas",
    name: "Plantas",
    short: "Plantas",
    description: "Ornamentais, mudas, flores, frutíferas e paisagismo.",
    subcategories: [
      "Plantas ornamentais",
      "Mudas",
      "Flores",
      "Árvores frutíferas",
      "Plantas nativas",
      "Juçara",
      "Jardinagem e paisagismo",
      "Suculentas e cactos",
      "Orquídeas",
      "Palmeiras",
    ],
  },
  {
    slug: "insumos",
    name: "Insumos",
    short: "Insumos",
    description: "Adubos, substratos, sementes, vasos e acessórios de cultivo.",
    subcategories: [
      "Adubos e fertilizantes",
      "Substratos e terra vegetal",
      "Defensivos naturais",
      "Sementes",
      "Vasos e cachepôs",
      "Acessórios de cultivo",
    ],
  },
  {
    slug: "maquinas",
    name: "Máquinas e Ferramentas",
    short: "Máquinas",
    description: "Equipamentos, ferramentas manuais, maquinário e acessórios.",
    subcategories: [
      "Ferramentas manuais",
      "Motorizadas",
      "Equipamentos",
      "Maquinário pequeno e médio",
      "Tratores e implementos",
      "Irrigação",
      "Acessórios e peças",
    ],
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c])) as Record<
  CategorySlug,
  CategoryDef
>;

export function isCategorySlug(v: unknown): v is CategorySlug {
  return v === "plantas" || v === "insumos" || v === "maquinas";
}

export const REGIONS = [
  "Vale do Ribeira",
  "Grande São Paulo",
  "Litoral Sul de SP",
  "Interior de SP",
  "Sul do Brasil",
  "Sudeste (outros)",
  "Centro-Oeste",
  "Nordeste",
  "Norte",
];

export const VALE_REGION = "Vale do Ribeira";

/** Municípios do polo do Vale do Ribeira (filtro geográfico). */
export const VALE_CITIES = [
  "Registro",
  "Pariquera-Açu",
  "Sete Barras",
  "Juquiá",
  "Iguape",
  "Jacupiranga",
  "Cajati",
  "Cananéia",
  "Eldorado",
  "Miracatu",
  "Ilha Comprida",
  "Itariri",
  "Pedro de Toledo",
  "Barra do Turvo",
  "Iporanga",
  "Apiaí",
  "Ribeira",
  "Itaóca",
  "Tapiraí",
  "Juquitiba",
];

export type LogisticsMode = "entrega_regional" | "retirada" | "envio_nacional";
export const LOGISTICS: { value: LogisticsMode; label: string }[] = [
  { value: "entrega_regional", label: "Entrega regional própria" },
  { value: "retirada", label: "Retirada no local" },
  { value: "envio_nacional", label: "Envio nacional" },
];
export const LOGISTICS_LABEL = Object.fromEntries(LOGISTICS.map((l) => [l.value, l.label])) as Record<LogisticsMode, string>;
export function isLogisticsMode(v: unknown): v is LogisticsMode {
  return v === "entrega_regional" || v === "retirada" || v === "envio_nacional";
}

export type SortOrder = "relevancia" | "menor" | "maior" | "avaliados" | "recentes";
export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "relevancia", label: "Mais relevantes" },
  { value: "menor", label: "Menor preço" },
  { value: "maior", label: "Maior preço" },
  { value: "avaliados", label: "Mais bem avaliados" },
  { value: "recentes", label: "Lançamentos" },
];
export function isSortOrder(v: unknown): v is SortOrder {
  return v === "relevancia" || v === "menor" || v === "maior" || v === "avaliados" || v === "recentes";
}


/** Regiões vizinhas, em ordem de proximidade (usado em "próximos da região"). */
export const NEARBY_REGIONS: Record<string, string[]> = {
  "Vale do Ribeira": ["Litoral Sul de SP", "Interior de SP", "Grande São Paulo", "Sul do Brasil"],
  "Grande São Paulo": ["Vale do Ribeira", "Interior de SP", "Litoral Sul de SP", "Sudeste (outros)"],
  "Litoral Sul de SP": ["Vale do Ribeira", "Grande São Paulo", "Interior de SP", "Sul do Brasil"],
  "Interior de SP": ["Vale do Ribeira", "Grande São Paulo", "Litoral Sul de SP", "Sudeste (outros)"],
  "Sul do Brasil": ["Vale do Ribeira", "Litoral Sul de SP", "Interior de SP"],
  "Sudeste (outros)": ["Grande São Paulo", "Interior de SP", "Centro-Oeste"],
  "Centro-Oeste": ["Sudeste (outros)", "Interior de SP", "Norte"],
  "Nordeste": ["Sudeste (outros)", "Norte", "Centro-Oeste"],
  "Norte": ["Centro-Oeste", "Nordeste"],
};

export const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pendente_pagamento: "Aguardando pagamento",
  pago_em_custodia: "Pago · em custódia",
  enviado: "Enviado",
  aguardando_confirmacao: "Aguardando confirmação",
  concluido_liquidado: "Concluído · liquidado",
  em_disputa: "Em disputa",
  cancelado: "Cancelado",
};

export function formatPrice(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
