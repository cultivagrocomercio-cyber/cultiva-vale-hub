import { useState } from "react";
import { ArrowUpRight, Check, Crown, MessageCircle } from "lucide-react";
import { PLANS, PLAN_ORDER, PLATFORM_WHATSAPP, formatRate, type BoxPlan } from "@/lib/commission";
import { formatPrice } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function planPriceLabel(price: number) {
  return price === 0 ? "Grátis" : `${formatPrice(price)}/mês`;
}

/** Card do plano atual do box com a opção "Fazer upgrade" (ativação manual pelo administrador). */
export function PlanCard({ plan, boxName, activeCount }: { plan: BoxPlan; boxName: string; activeCount: number }) {
  const [open, setOpen] = useState(false);
  const info = PLANS[plan];
  const isTop = plan === "premium";
  const limit = info.productLimit;
  const nearLimit = limit !== null && activeCount >= limit - 2;

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Seu plano</p>
          <p className="mt-0.5 flex items-center gap-2 font-display text-xl font-semibold">
            {isTop && <Crown className="h-5 w-5 text-sun" />} {info.name}
            <span className="text-sm font-normal text-muted-foreground">· {planPriceLabel(info.price)}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comissão de {formatRate(info.rate)} por venda ·{" "}
            {limit === null ? "produtos ilimitados" : `${activeCount}/${limit} produtos ativos`}
          </p>
          {nearLimit && (
            <p className="mt-1 text-xs font-semibold text-secondary">
              {activeCount >= limit! ? "Você atingiu o limite do Plano Básico." : "Você está perto do limite do Plano Básico."} Faça upgrade para cadastrar sem limite.
            </p>
          )}
        </div>
        {!isTop && (
          <Button className="rounded-full" onClick={() => setOpen(true)}>
            <ArrowUpRight className="mr-1.5 h-4 w-4" /> Fazer upgrade
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Planos do Cultiva Vale</DialogTitle>
            <DialogDescription>
              O pagamento é feito por PIX combinado com a equipe. Depois da confirmação, o administrador ativa o novo plano no seu box.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-3">
            {PLAN_ORDER.map((k) => {
              const p = PLANS[k];
              const current = k === plan;
              const upgrade = p.weight > info.weight;
              const msg = encodeURIComponent(`Olá! Quero fazer upgrade do box "${boxName}" para o ${p.name} (${planPriceLabel(p.price)}). Como faço o PIX?`);
              return (
                <div key={k} className={cn("flex flex-col rounded-2xl border p-4", current && "border-primary bg-leaf-light/40", k === "premium" && !current && "border-sun")}>
                  <p className="font-display text-lg font-semibold">{p.short}</p>
                  <p className="text-sm text-muted-foreground">{planPriceLabel(p.price)}</p>
                  <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                    {p.perks.map((perk) => (
                      <li key={perk} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {perk}</li>
                    ))}
                  </ul>
                  {current ? (
                    <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-primary">Plano atual</p>
                  ) : upgrade ? (
                    PLATFORM_WHATSAPP ? (
                      <Button asChild size="sm" className="mt-4 rounded-full">
                        <a href={`https://wa.me/${PLATFORM_WHATSAPP}?text=${msg}`} target="_blank" rel="noreferrer">
                          <MessageCircle className="mr-1.5 h-4 w-4" /> Contratar via WhatsApp
                        </a>
                      </Button>
                    ) : (
                      <p className="mt-4 rounded-lg bg-muted p-2 text-center text-xs text-muted-foreground">
                        Fale com a equipe do Cultiva Vale para contratar este plano.
                      </p>
                    )
                  ) : (
                    <p className="mt-4 text-center text-xs text-muted-foreground">Plano inferior ao atual</p>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
