import { queryOptions } from "@tanstack/react-query";
import { getBoxBySlug, getHomeData, getProductById, searchProducts } from "./public.functions";

export const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHomeData(),
  staleTime: 60_000,
});

export interface SearchParams {
  q?: string | undefined;
  categoria?: "plantas" | "insumos" | "maquinas" | undefined;
  sub?: string | undefined;
  regiao?: string | undefined;
  ordem?: "recentes" | "menor" | "maior" | undefined;
}

export const searchQuery = (params: SearchParams) =>
  queryOptions({
    queryKey: ["search", params],
    queryFn: () => searchProducts({ data: params }),
    staleTime: 30_000,
  });

export const boxQuery = (slug: string) =>
  queryOptions({
    queryKey: ["box", slug],
    queryFn: () => getBoxBySlug({ data: { slug } }),
    staleTime: 30_000,
  });

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: ["product", id],
    queryFn: () => getProductById({ data: { id } }),
    staleTime: 30_000,
  });
