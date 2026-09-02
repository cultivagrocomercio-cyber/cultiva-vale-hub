import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { searchQuery, type SearchParams } from "@/lib/queries";
import { CATEGORIES, CATEGORY_MAP, REGIONS, isCategorySlug } from "@/lib/categories";
import { CategoryIcon, ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const ALL = "__all";

export const Route = createFileRoute("/buscar")({
  validateSearch: (s: Record<string, unknown>): SearchParams => {
    const q = s["q"], categoria = s["categoria"], sub = s["sub"], regiao = s["regiao"], ordem = s["ordem"];
    return {
      q: typeof q === "string" && q ? q.slice(0, 80) : undefined,
      categoria: isCategorySlug(categoria) ? categoria : undefined,
      sub: typeof sub === "string" && sub ? sub : undefined,
      regiao: typeof regiao === "string" && regiao ? regiao : undefined,
      ordem: ordem === "menor" || ordem === "maior" || ordem === "recentes" ? ordem : undefined,
    };
  },
  head: ({ match }) => {
    const c = match.search.categoria ? CATEGORY_MAP[match.search.categoria].name : "Produtos";
    return {
      meta: [
        { title: `${c} — Buscar no Cultiva Vale` },
        { name: "description", content: `Encontre ${c.toLowerCase()} de produtores e lojistas do Vale do Ribeira e de todo o Brasil.` },
        { property: "og:title", content: `${c} — Cultiva Vale` },
        { property: "og:description", content: "Busque plantas, insumos e máquinas por categoria e região." },
      ],
    };
  },
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isPending } = useQuery(searchQuery(search));

  const set = (patch: Partial<SearchParams>) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, ...patch }), replace: true });

  const cat = search.categoria ? CATEGORY_MAP[search.categoria] : null;
  const hasFilters = !!(search.q || search.categoria || search.sub || search.regiao);

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Buscar</p>
          <h1 className="font-display text-3xl font-semibold">
            {search.q ? `Resultados para "${search.q}"` : cat ? cat.name : "Todos os produtos"}
          </h1>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: ".", search: {} })}>
            <X className="mr-1 h-4 w-4" /> Limpar filtros
          </Button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => set({ categoria: undefined, sub: undefined })}
          className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${!search.categoria ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
        >
          Todas
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.slug}
            onClick={() => set({ categoria: c.slug, sub: undefined })}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${search.categoria === c.slug ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
          >
            <CategoryIcon category={c.slug} className="h-3.5 w-3.5" /> {c.short}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 rounded-2xl border bg-card p-3 shadow-soft sm:grid-cols-3">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground sm:col-span-3">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros
        </div>
        <Select value={search.sub ?? ALL} onValueChange={(v) => set({ sub: v === ALL ? undefined : v })} disabled={!cat}>
          <SelectTrigger><SelectValue placeholder="Subcategoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as subcategorias</SelectItem>
            {cat?.subcategories.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={search.regiao ?? ALL} onValueChange={(v) => set({ regiao: v === ALL ? undefined : v })}>
          <SelectTrigger><SelectValue placeholder="Região" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as regiões</SelectItem>
            {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={search.ordem ?? "recentes"} onValueChange={(v) => set({ ordem: v === "recentes" ? undefined : (v as SearchParams["ordem"]) })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recentes">Mais recentes</SelectItem>
            <SelectItem value="menor">Menor preço</SelectItem>
            <SelectItem value="maior">Maior preço</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6">
        {isPending ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
          </div>
        ) : data?.products.length ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">{data.products.length} {data.products.length === 1 ? "produto" : "produtos"}</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {data.products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
            Nenhum produto encontrado com esses filtros.
          </div>
        )}
      </div>
    </div>
  );
}
