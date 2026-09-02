import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Store, Truck, ShieldCheck } from "lucide-react";
import { homeQuery } from "@/lib/queries";
import { CATEGORIES } from "@/lib/categories";
import { CategoryIcon, ProductCard } from "@/components/ProductCard";
import { BoxCard } from "@/components/BoxCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cultiva Vale Marketplace — Plantas, insumos e máquinas" },
      { name: "description", content: "O Ceasa digital do Vale do Ribeira: compre plantas, insumos e máquinas agrícolas direto dos boxes de produtores e lojistas." },
      { property: "og:title", content: "Cultiva Vale Marketplace" },
      { property: "og:description", content: "Plantas, insumos e máquinas direto do produtor, para todo o Brasil." },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(homeQuery);
  },
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(homeQuery);

  return (
    <div>
      <section className="bg-field text-primary-foreground">
        <div className="container-page grid gap-10 py-14 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-sun">Vale do Ribeira · SP</p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-6xl">
              O Ceasa digital das plantas, insumos e máquinas.
            </h1>
            <p className="mt-4 max-w-lg text-base text-primary-foreground/80 md:text-lg">
              Produtores e lojistas com seu próprio box, vendendo direto para compradores de todo o Brasil.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full bg-sun text-foreground hover:bg-sun/90">
                <Link to="/buscar" search={{}}>Explorar produtos</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <Link to="/painel">
                  <Store className="mr-2 h-4 w-4" /> Abrir meu box
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3">
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                to="/buscar"
                search={{ categoria: c.slug }}
                className="group flex items-center gap-4 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-4 backdrop-blur transition-colors hover:bg-primary-foreground/20"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sun text-foreground">
                  <CategoryIcon category={c.slug} className="h-6 w-6" />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-xl font-semibold">{c.name}</span>
                  <span className="block text-sm text-primary-foreground/75">{c.description}</span>
                </span>
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page grid gap-4 py-10 sm:grid-cols-3">
        {[
          { icon: Store, t: "Cada vendedor, um box", d: "Loja própria com logo, história e catálogo." },
          { icon: Truck, t: "Entrega combinada", d: "Comprador e vendedor acertam frete e pagamento pelo chat." },
          { icon: ShieldCheck, t: "Avaliações reais", d: "Só quem comprou avalia o box." },
        ].map((f) => (
          <div key={f.t} className="flex gap-3 rounded-2xl border bg-card p-4 shadow-soft">
            <f.icon className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">{f.t}</p>
              <p className="text-sm text-muted-foreground">{f.d}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="container-page py-6">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold md:text-3xl">Boxes em destaque</h2>
          <Link to="/painel" className="text-sm font-semibold text-primary hover:underline">Quero vender</Link>
        </div>
        {data.featuredBoxes.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {data.featuredBoxes.map((b) => <BoxCard key={b.id} box={b} />)}
          </div>
        ) : (
          <EmptyState text="Nenhum box ainda. Seja o primeiro a abrir o seu!" />
        )}
      </section>

      {CATEGORIES.map((c) => {
        const items = data.recentProducts.filter((p) => p.category === c.slug).slice(0, 8);
        return (
          <section key={c.slug} className="container-page py-6">
            <div className="mb-4 flex items-end justify-between">
              <h2 className="flex items-center gap-2 font-display text-2xl font-semibold md:text-3xl">
                <CategoryIcon category={c.slug} className="h-6 w-6 text-primary" /> {c.name}
              </h2>
              <Link to="/buscar" search={{ categoria: c.slug }} className="text-sm font-semibold text-primary hover:underline">
                Ver tudo
              </Link>
            </div>
            {items.length ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {items.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            ) : (
              <EmptyState text={`Ainda não há produtos em ${c.name}.`} />
            )}
          </section>
        );
      })}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
