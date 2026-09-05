import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, MessageCircle, Package } from "lucide-react";
import { boxQuery } from "@/lib/queries";
import { ProductCard } from "@/components/ProductCard";
import { RatingStars } from "@/components/RatingStars";
import { LeafMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { FavoriteButton } from "@/components/FavoriteButton";
import { PlanBadge } from "@/components/PlanBadge";

export const Route = createFileRoute("/box/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(boxQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.box.name, description: data.box.description };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Box no Cultiva Vale` },
          { name: "description", content: loaderData.description || `Conheça o box ${loaderData.name} no Cultiva Vale Marketplace.` },
          { property: "og:title", content: `${loaderData.name} — Cultiva Vale` },
          { property: "og:description", content: loaderData.description || "Box no Cultiva Vale Marketplace." },
        ]
      : [{ title: "Box não encontrado — Cultiva Vale" }, { name: "robots", content: "noindex" }],
  }),
  component: BoxPage,
});

function BoxPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(boxQuery(slug));
  if (!data) return null;
  const { box, products, reviews } = data;

  return (
    <div>
      <div className="relative h-44 bg-field md:h-60">
        {box.coverUrl && <img src={box.coverUrl} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="container-page">
        <div className="-mt-12 flex flex-col gap-4 md:flex-row md:items-end">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-background bg-card shadow-lift">
            {box.logoUrl ? (
              <img src={box.logoUrl} alt={`Logo ${box.name}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-leaf-light"><LeafMark className="h-12 w-12" /></div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold md:text-4xl">{box.name}</h1>
              <PlanBadge plan={box.plan} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <RatingStars value={box.rating} count={box.reviewCount} />
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {box.city}/{box.state} · {box.region}</span>
              <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" /> {box.productCount} produtos</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
          <FavoriteButton boxId={box.id} className="h-10" />
          {box.whatsapp && (
            <Button asChild variant="outline" className="rounded-full">
              <a href={`https://wa.me/${box.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
              </a>
            </Button>
          )}
          </div>
        </div>

        {(box.description || box.story) && (
          <section className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <p className="text-base">{box.description}</p>
              {box.story && (
                <div className="mt-4 rounded-2xl bg-soil-grain p-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-secondary">Nossa história</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{box.story}</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Produtos</h2>
          {products.length ? (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Este box ainda não cadastrou produtos.</p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Avaliações</h2>
          {reviews.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {reviews.map((r) => (
                <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{r.buyerName}</p>
                    <RatingStars value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("pt-BR")}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Ainda sem avaliações. Compre e seja o primeiro a avaliar.</p>
          )}
        </section>
      </div>
    </div>
  );
}
