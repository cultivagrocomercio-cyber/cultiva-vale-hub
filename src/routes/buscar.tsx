import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Search, SlidersHorizontal, Store, X } from "lucide-react";
import { searchQuery, type SearchParams } from "@/lib/queries";
import { CATEGORY_MAP, SORT_OPTIONS, isCategorySlug, isLogisticsMode, isSortOrder } from "@/lib/categories";
import { ProductCard } from "@/components/ProductCard";
import { BoxCard } from "@/components/BoxCard";
import { SearchFilters, countActiveFilters } from "@/components/SearchFilters";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";

const numOr = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);

export const Route = createFileRoute("/buscar")({
  validateSearch: (s: Record<string, unknown>): SearchParams => {
    const q = s["q"], categoria = s["categoria"], sub = s["sub"], regiao = s["regiao"], ordem = s["ordem"];
    const cidade = s["cidade"], nota = s["nota"], log = s["log"];
    const logs = Array.isArray(log) ? log.filter(isLogisticsMode) : isLogisticsMode(log) ? [log] : [];
    return {
      q: typeof q === "string" && q ? q.slice(0, 80) : undefined,
      categoria: isCategorySlug(categoria) ? categoria : undefined,
      sub: typeof sub === "string" && sub ? sub : undefined,
      regiao: typeof regiao === "string" && regiao ? regiao : undefined,
      cidade: typeof cidade === "string" && cidade ? cidade : undefined,
      vale: s["vale"] === true ? true : undefined,
      pmin: numOr(s["pmin"]),
      pmax: numOr(s["pmax"]),
      nota: nota === 3 || nota === 4 || nota === 5 ? nota : undefined,
      log: logs.length ? logs : undefined,
      ordem: isSortOrder(ordem) && ordem !== "relevancia" ? ordem : undefined,
    };
  },
  head: ({ match }) => {
    const c = match.search.categoria ? CATEGORY_MAP[match.search.categoria].name : "Produtos";
    return {
      meta: [
        { title: `${c} — Buscar no Cultiva Vale` },
        { name: "description", content: `Encontre ${c.toLowerCase()} de produtores e lojistas do Vale do Ribeira e de todo o Brasil.` },
        { property: "og:title", content: `${c} — Cultiva Vale` },
        { property: "og:description", content: "Busque plantas, insumos e máquinas por categoria, cidade, preço, avaliação e logística." },
      ],
    };
  },
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isPending, isFetching } = useQuery({ ...searchQuery(search), placeholderData: (prev) => prev });

  const set = (patch: Partial<SearchParams>) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, ...patch }), replace: true });

  // Busca textual em tempo real (debounce de 300ms)
  const [text, setText] = useState(search.q ?? "");
  useEffect(() => setText(search.q ?? ""), [search.q]);
  useEffect(() => {
    const v = text.trim() || undefined;
    if (v === search.q) return;
    const t = setTimeout(() => set({ q: v }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const cat = search.categoria ? CATEGORY_MAP[search.categoria] : null;
  const activeCount = countActiveFilters(search);
  const hasFilters = activeCount > 0 || !!search.q;
  const total = data?.total ?? 0;

  const clearAll = () => navigate({ to: ".", search: {} });

  return (
    <div className="container-page py-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Buscar</p>
          <h1 className="font-display text-3xl font-semibold">
            {search.q ? `Resultados para "${search.q}"` : cat ? cat.name : "Todos os produtos"}
          </h1>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="mr-1 h-4 w-4" /> Limpar filtros
          </Button>
        )}
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Buscar por produto, variedade, marca ou nome do box…"
          className="h-11 rounded-full pl-9"
          aria-label="Buscar"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Barra lateral (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border bg-card p-4 shadow-soft">
            <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Filtros {activeCount ? `(${activeCount})` : ""}
            </div>
            <SearchFilters search={search} set={set} />
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {isPending ? "Buscando…" : `${total} ${total === 1 ? "produto encontrado" : "produtos encontrados"}`}
              {isFetching && !isPending ? " · atualizando…" : ""}
            </p>
            <Select value={search.ordem ?? "relevancia"} onValueChange={(v) => set({ ordem: v === "relevancia" ? undefined : (v as SearchParams["ordem"]) })}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 space-y-10">
            {isPending ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
              </div>
            ) : (
              <>
                {data?.boxes.length ? (
                  <section>
                    <div className="mb-3 flex items-center gap-2">
                      <Store className="h-4 w-4 text-secondary" />
                      <h2 className="font-display text-xl font-semibold">
                        {search.cidade ? `Boxes em ${search.cidade}` : search.vale ? "Boxes do Vale do Ribeira" : search.regiao ? `Boxes em ${search.regiao}` : "Boxes"}
                      </h2>
                      <span className="text-sm text-muted-foreground">({data.boxes.length})</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {data.boxes.slice(0, 6).map((b) => <BoxCard key={b.id} box={b} />)}
                    </div>
                  </section>
                ) : null}

                <section>
                  <h2 className="mb-3 font-display text-xl font-semibold">Produtos</h2>
                  {data?.products.length ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                      {data.products.map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground">
                      Nenhum produto encontrado com esses filtros.
                      {hasFilters && (
                        <div className="mt-3">
                          <Button variant="outline" size="sm" className="rounded-full" onClick={clearAll}>Limpar filtros</Button>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                {data?.nearbyProducts.length ? (
                  <section>
                    <div className="mb-1 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-secondary" />
                      <h2 className="font-display text-xl font-semibold">Próximos da região</h2>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Produtores de regiões vizinhas: {data.nearbyRegions.join(", ")}.
                    </p>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                      {data.nearbyProducts.map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                  </section>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Botão flutuante + gaveta inferior (mobile) */}
      <Drawer>
        <DrawerTrigger asChild>
          <Button className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full shadow-lift lg:hidden" size="lg">
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtros{activeCount ? ` (${activeCount})` : ""}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filtros</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-2">
            <SearchFilters search={search} set={set} />
          </div>
          <DrawerFooter className="flex-row gap-2 border-t">
            <Button variant="outline" className="flex-1 rounded-full" onClick={clearAll} disabled={!hasFilters}>Limpar</Button>
            <DrawerClose asChild>
              <Button className="flex-1 rounded-full">
                {isFetching ? "Buscando…" : `Ver ${total} ${total === 1 ? "resultado" : "resultados"}`}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
