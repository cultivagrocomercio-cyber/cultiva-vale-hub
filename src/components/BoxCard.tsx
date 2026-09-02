import { Link } from "@tanstack/react-router";
import { MapPin, Package } from "lucide-react";
import type { PublicBox } from "@/lib/public.functions";
import { RatingStars } from "./RatingStars";
import { LeafMark } from "./Logo";

export function BoxCard({ box }: { box: PublicBox }) {
  return (
    <Link
      to="/box/$slug"
      params={{ slug: box.slug }}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative h-24 bg-field">
        {box.coverUrl && <img src={box.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
        <div className="absolute -bottom-6 left-4 h-14 w-14 overflow-hidden rounded-xl border-2 border-card bg-card shadow-soft">
          {box.logoUrl ? (
            <img src={box.logoUrl} alt={`Logo ${box.name}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-leaf-light">
              <LeafMark className="h-8 w-8" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-8">
        <h3 className="font-display text-lg font-semibold leading-tight group-hover:text-primary">{box.name}</h3>
        <RatingStars value={box.rating} count={box.reviewCount} />
        <p className="line-clamp-2 text-sm text-muted-foreground">{box.description || "Box do Cultiva Vale."}</p>
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {box.city}/{box.state}
          </span>
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3" /> {box.productCount} {box.productCount === 1 ? "produto" : "produtos"}
          </span>
        </div>
      </div>
    </Link>
  );
}
