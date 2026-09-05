import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import type { SearchParams } from "@/lib/queries";
import { CATEGORIES, CATEGORY_MAP, LOGISTICS, REGIONS, VALE_CITIES, formatPrice } from "@/lib/categories";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryIcon } from "./ProductCard";
import { cn } from "@/lib/utils";

const ALL = "__all";
export const PRICE_MAX = 5000;

export function countActiveFilters(s: SearchParams) {
  let n = 0;
  if (s.categoria) n++;
  if (s.sub) n++;
  if (s.regiao) n++;
  if (s.cidade) n++;
  if (s.vale) n++;
  if (s.pmin != null || s.pmax != null) n++;
  if (s.nota) n++;
  if (s.log?.length) n++;
  return n;
}

/** Painel de filtros multicritério (usado na barra lateral e na gaveta mobile). */
export function SearchFilters({ search, set }: { search: SearchParams; set: (patch: Partial<SearchParams>) => void }) {
  const cat = search.categoria ? CATEGORY_MAP[search.categoria] : null;
  const [price, setPrice] = useState<[number, number]>([search.pmin ?? 0, search.pmax ?? PRICE_MAX]);
  useEffect(() => setPrice([search.pmin ?? 0, search.pmax ?? PRICE_MAX]), [search.pmin, search.pmax]);

  const toggleLog = (v: NonNullable<SearchParams["log"]>[number], on: boolean) => {
    const cur = new Set(search.log ?? []);
    if (on) cur.add(v); else cur.delete(v);
    set({ log: cur.size ? Array.from(cur) : undefined });
  };

  return (
    <Accordion type="multiple" defaultValue={["cat", "geo", "preco", "nota", "log"]} className="w-full">
      <AccordionItem value="cat">
        <AccordionTrigger className="text-sm font-bold">Categoria</AccordionTrigger>
        <AccordionContent className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!search.categoria} onClick={() => set({ categoria: undefined, sub: undefined })}>Todas</Chip>
            {CATEGORIES.map((c) => (
              <Chip key={c.slug} active={search.categoria === c.slug} onClick={() => set({ categoria: c.slug, sub: undefined })}>
                <CategoryIcon category={c.slug} className="h-3.5 w-3.5" /> {c.short}
              </Chip>
            ))}
          </div>
          {cat && (
            <div className="grid gap-1 pt-1">
              <button
                onClick={() => set({ sub: undefined })}
                className={cn("rounded-md px-2 py-1 text-left text-sm hover:bg-muted", !search.sub && "bg-muted font-semibold")}
              >
                Todas as subcategorias
              </button>
              {cat.subcategories.map((s) => (
                <button
                  key={s}
                  onClick={() => set({ sub: s })}
                  className={cn("rounded-md px-2 py-1 text-left text-sm hover:bg-muted", search.sub === s && "bg-muted font-semibold")}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="geo">
        <AccordionTrigger className="text-sm font-bold">Localização</AccordionTrigger>
        <AccordionContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={!!search.vale} onCheckedChange={(v) => set({ vale: v ? true : undefined, regiao: v ? undefined : search.regiao })} />
            Apenas origem: Vale do Ribeira
          </label>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Município do Vale do Ribeira</Label>
            <Select value={search.cidade ?? ALL} onValueChange={(v) => set({ cidade: v === ALL ? undefined : v })}>
              <SelectTrigger><SelectValue placeholder="Cidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as cidades</SelectItem>
                {VALE_CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Região</Label>
            <Select
              value={search.regiao ?? ALL}
              onValueChange={(v) => set({ regiao: v === ALL ? undefined : v })}
              disabled={!!search.vale || !!search.cidade}
            >
              <SelectTrigger><SelectValue placeholder="Região" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as regiões</SelectItem>
                {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="preco">
        <AccordionTrigger className="text-sm font-bold">Faixa de preço</AccordionTrigger>
        <AccordionContent className="space-y-3 px-1">
          <Slider
            min={0}
            max={PRICE_MAX}
            step={10}
            value={price}
            onValueChange={(v) => setPrice([v[0] ?? 0, v[1] ?? PRICE_MAX])}
            onValueCommit={(v) =>
              set({ pmin: v[0] && v[0] > 0 ? v[0] : undefined, pmax: v[1] != null && v[1] < PRICE_MAX ? v[1] : undefined })
            }
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatPrice(price[0])}</span>
            <span>{price[1] >= PRICE_MAX ? `${formatPrice(PRICE_MAX)}+` : formatPrice(price[1])}</span>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="nota">
        <AccordionTrigger className="text-sm font-bold">Avaliação mínima</AccordionTrigger>
        <AccordionContent className="flex flex-wrap gap-1.5">
          <Chip active={!search.nota} onClick={() => set({ nota: undefined })}>Qualquer</Chip>
          {[4, 3].map((n) => (
            <Chip key={n} active={search.nota === n} onClick={() => set({ nota: n })}>
              <Star className="h-3.5 w-3.5 fill-current" /> {n}+ estrelas
            </Chip>
          ))}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="log">
        <AccordionTrigger className="text-sm font-bold">Modalidade de logística</AccordionTrigger>
        <AccordionContent className="space-y-2">
          {LOGISTICS.map((l) => (
            <label key={l.value} className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!search.log?.includes(l.value)} onCheckedChange={(v) => toggleLog(l.value, !!v)} />
              {l.label}
            </label>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
