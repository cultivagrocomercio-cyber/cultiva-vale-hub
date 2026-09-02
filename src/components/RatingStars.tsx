import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({
  value,
  count,
  size = "sm",
  className,
  interactive,
  onChange,
}: {
  value: number | null;
  count?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const px = size === "lg" ? "h-7 w-7" : size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";
  const v = value ?? 0;
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5" role={interactive ? "radiogroup" : undefined} aria-label={value ? `${v.toFixed(1)} de 5` : "Sem avaliações"}>
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = i <= Math.round(v);
          const star = (
            <Star
              className={cn(px, filled ? "fill-accent text-accent" : "text-border", interactive && "transition-transform hover:scale-110")}
            />
          );
          return interactive ? (
            <button type="button" key={i} onClick={() => onChange?.(i)} aria-label={`${i} estrelas`} className="cursor-pointer">
              {star}
            </button>
          ) : (
            <span key={i}>{star}</span>
          );
        })}
      </div>
      {value != null ? (
        <span className={cn("font-semibold tabular-nums", size === "sm" ? "text-xs" : "text-sm")}>{v.toFixed(1)}</span>
      ) : (
        <span className="text-xs text-muted-foreground">Novo</span>
      )}
      {count != null && count > 0 && <span className="text-xs text-muted-foreground">({count})</span>}
    </div>
  );
}
