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

export const STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  entregue: "Entregue",
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
