import { BadgeCheck } from "lucide-react";
import { PLANS, type BoxPlan } from "@/lib/commission";
import { cn } from "@/lib/utils";

/** Selo "Vendedor Verificado / Premium" exibido ao lado do nome do box. */
export function PlanBadge({ plan, className, compact }: { plan: BoxPlan; className?: string; compact?: boolean }) {
  if (!PLANS[plan].badge) return null;
  return (
    <span
      title="Vendedor Verificado / Premium"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-sun px-2 py-0.5 text-[11px] font-bold text-foreground",
        className,
      )}
    >
      <BadgeCheck className="h-3.5 w-3.5" />
      {compact ? "Premium" : "Vendedor Verificado / Premium"}
    </span>
  );
}
