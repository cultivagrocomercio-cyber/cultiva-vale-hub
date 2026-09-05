import { AlertTriangle, Check, XCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { ORDER_STEPS, autoReleaseDate, stepIndex } from "@/lib/commission";
import { cn } from "@/lib/utils";

type Order = Tables<"orders">;

/** Linha do tempo visual do pedido (comprador e vendedor). */
export function OrderTimeline({ order, role }: { order: Order; role: "buyer" | "seller" | "admin" }) {
  const cancelled = order.status === "cancelado";
  const disputed = order.status === "em_disputa";
  // Em disputa/cancelado, mostra o progresso até onde chegou
  const reached = disputed
    ? order.delivered_at ? 3 : 2
    : cancelled
      ? order.paid_at ? 1 : 0
      : stepIndex(order.status);
  const release = autoReleaseDate(order.shipped_at);
  const current = ORDER_STEPS[Math.max(reached, 0)];
  const hint = current ? (role === "seller" ? current.seller : current.buyer) : "";

  return (
    <div className="border-t px-4 py-3">
      <ol className="flex items-start gap-1">
        {ORDER_STEPS.map((s, i) => {
          const done = i < reached || (!cancelled && !disputed && i === reached && order.status === "concluido_liquidado");
          const active = i === reached && !done;
          const broken = (disputed || cancelled) && i === reached;
          return (
            <li key={s.key} className="flex flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : i <= reached ? "bg-primary" : "bg-border")} />
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && !broken && "border-primary bg-card text-primary",
                    broken && disputed && "border-secondary bg-sun text-foreground",
                    broken && cancelled && "border-muted-foreground bg-muted text-muted-foreground",
                    !done && !active && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : broken && disputed ? <AlertTriangle className="h-3 w-3" /> : broken && cancelled ? <XCircle className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={cn("h-0.5 flex-1", i === ORDER_STEPS.length - 1 ? "opacity-0" : i < reached ? "bg-primary" : "bg-border")} />
              </div>
              <span className={cn("mt-1 text-[10px] font-semibold leading-tight sm:text-[11px]", active || done ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        {disputed ? (
          <span className="font-semibold text-foreground">Em disputa — o valor fica retido até a mediação da plataforma.</span>
        ) : cancelled ? (
          "Pedido cancelado." + (order.paid_at ? " O valor em custódia é estornado ao comprador." : "")
        ) : (
          hint
        )}
        {!cancelled && !disputed && (order.status === "enviado" || order.status === "aguardando_confirmacao") && release && (
          <> Liberação automática ao vendedor em {release.toLocaleDateString("pt-BR")} se não houver disputa.</>
        )}
      </p>
    </div>
  );
}
