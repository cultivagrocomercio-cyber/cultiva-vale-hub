import { Link } from "@tanstack/react-router";
import { MapPin, Leaf, FlaskConical, Tractor } from "lucide-react";
import type { PublicProduct } from "@/lib/public.functions";
import { CATEGORY_MAP, formatPrice } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { PlanBadge } from "./PlanBadge";
import { RatingStars } from "./RatingStars";

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const c = cn("h-4 w-4", className);
  if (category === "plantas") return <Leaf className={c} />;
  if (category === "insumos") return <FlaskConical className={c} />;
  return <Tractor className={c} />;
}

export function ProductCard({ product, className }: { product: PublicProduct; className?: string }) {
  const img = product.imageUrls[0];
  return (
    <Link
      to="/produto/$id"
      params={{ id: product.id }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-leaf-light">
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/50">
            <CategoryIcon category={product.category} className="h-12 w-12" />
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-bold text-primary backdrop-blur">
          <CategoryIcon category={product.category} className="h-3 w-3" />
          {CATEGORY_MAP[product.category].short}
        </span>
        {product.stock === 0 ? (
          <span className="absolute right-2 top-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-secondary-foreground">
            Esgotado
          </span>
        ) : (
          <PlanBadge plan={product.box.plan} compact className="absolute right-2 top-2" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.subcategory}</p>
        <RatingStars value={product.rating} count={product.reviewCount} />
        <p className="mt-auto pt-1 font-display text-lg font-semibold text-primary">{formatPrice(product.price)}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {product.box.name} · {product.box.city}/{product.box.state}
          </span>
        </p>
      </div>
    </Link>
  );
}
