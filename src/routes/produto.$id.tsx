import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, Minus, Plus, ShoppingBasket, Store } from "lucide-react";
import { toast } from "sonner";
import { productQuery } from "@/lib/queries";
import { CATEGORY_MAP, formatPrice } from "@/lib/categories";
import { useCart } from "@/lib/cart";
import { CategoryIcon, ProductCard } from "@/components/ProductCard";
import { RatingStars } from "@/components/RatingStars";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/produto/$id")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productQuery(params.id));
    if (!data) throw notFound();
    return { name: data.product.name, description: data.product.description, image: data.product.imageUrls[0] ?? null };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} — Cultiva Vale` },
          { name: "description", content: (loaderData.description || `Compre ${loaderData.name} no Cultiva Vale Marketplace.`).slice(0, 155) },
          { property: "og:title", content: loaderData.name },
          { property: "og:description", content: (loaderData.description || "Produto no Cultiva Vale Marketplace.").slice(0, 155) },
          ...(loaderData.image ? [{ property: "og:image", content: loaderData.image }, { name: "twitter:image", content: loaderData.image }] : []),
        ]
      : [{ title: "Produto não encontrado — Cultiva Vale" }, { name: "robots", content: "noindex" }],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(productQuery(id));
  const cart = useCart();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  if (!data) return null;
  const { product, relatedProducts } = data;
  const cat = CATEGORY_MAP[product.category];
  const out = product.stock <= 0;

  function addToCart(goToCart: boolean) {
    cart.add(
      {
        productId: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrls[0] ?? null,
        boxId: product.box.id,
        boxName: product.box.name,
        boxSlug: product.box.slug,
        stock: product.stock,
      },
      qty,
    );
    if (goToCart) navigate({ to: "/carrinho" });
    else toast.success("Adicionado ao carrinho");
  }

  return (
    <div className="container-page py-8">
      <nav className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-primary">Início</Link> /
        <Link to="/buscar" search={{ categoria: product.category }} className="hover:text-primary">{cat.name}</Link> /
        <Link to="/buscar" search={{ categoria: product.category, sub: product.subcategory }} className="hover:text-primary">{product.subcategory}</Link>
      </nav>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-3xl border bg-leaf-light">
            {product.imageUrls[img] ? (
              <img src={product.imageUrls[img]} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-primary/40"><CategoryIcon category={product.category} className="h-20 w-20" /></div>
            )}
          </div>
          {product.imageUrls.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {product.imageUrls.map((u, i) => (
                <button key={u} onClick={() => setImg(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${i === img ? "border-primary" : "border-transparent"}`}>
                  <img src={u} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-leaf-light px-2.5 py-1 text-xs font-bold text-primary">
            <CategoryIcon category={product.category} className="h-3 w-3" /> {cat.name} · {product.subcategory}
          </span>
          <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{product.name}</h1>
          <p className="mt-3 font-display text-4xl font-semibold text-primary">{formatPrice(product.price)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{out ? "Esgotado" : `${product.stock} em estoque`}</p>

          {!out && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-full border">
                <button className="p-2.5" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Diminuir"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
                <button className="p-2.5" onClick={() => setQty((q) => Math.min(product.stock, q + 1))} aria-label="Aumentar"><Plus className="h-4 w-4" /></button>
              </div>
              <Button className="rounded-full" size="lg" onClick={() => addToCart(true)}>Comprar agora</Button>
              <Button className="rounded-full" size="lg" variant="outline" onClick={() => addToCart(false)}>
                <ShoppingBasket className="mr-2 h-4 w-4" /> Adicionar
              </Button>
            </div>
          )}

          <Link to="/box/$slug" params={{ slug: product.box.slug }} className="mt-6 flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-soft transition-colors hover:bg-muted/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-light text-primary"><Store className="h-5 w-5" /></span>
            <span className="flex-1">
              <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">Vendido por</span>
              <span className="block font-semibold">{product.box.name}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {product.box.city}/{product.box.state} · {product.box.region}</span>
            </span>
            <RatingStars value={product.boxRating} count={product.boxReviewCount} />
          </Link>

          <div className="mt-6">
            <h2 className="font-semibold">Descrição</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{product.description || "Sem descrição."}</p>
          </div>
          <p className="mt-4 rounded-xl bg-soil-grain p-3 text-xs text-muted-foreground">
            Entrega e pagamento são combinados diretamente com o vendedor após o pedido.
          </p>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-semibold">Mais deste box</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {relatedProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
