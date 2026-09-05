import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, PackageX, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_MAP, formatPrice } from "@/lib/categories";
import { StorageImage } from "./StorageImage";
import { CategoryIcon } from "./ProductCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Level = "normal" | "baixo" | "esgotado";

export function stockLevel(stock: number, threshold: number): Level {
  if (stock <= 0) return "esgotado";
  if (threshold > 0 && stock <= threshold) return "baixo";
  return "normal";
}

const LEVEL = {
  normal: { label: "Estoque normal", cls: "bg-leaf-light text-primary", dot: "bg-primary", Icon: CheckCircle2 },
  baixo: { label: "Estoque baixo", cls: "bg-sun/30 text-foreground", dot: "bg-sun", Icon: AlertTriangle },
  esgotado: { label: "Esgotado", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", Icon: PackageX },
} as const;

export function StockBadge({ stock, threshold, className }: { stock: number; threshold: number; className?: string }) {
  const l = LEVEL[stockLevel(stock, threshold)];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", l.cls, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", l.dot)} /> {l.label}
    </span>
  );
}

/** Painel de estoque do vendedor: saldo, alerta mínimo e ajustes rápidos. */
export function StockTab({ boxId }: { boxId: string }) {
  const qc = useQueryClient();
  const { data: products = [], isPending } = useQuery({
    queryKey: ["seller", "products", boxId],
    queryFn: async () => (await supabase.from("products").select("*").eq("box_id", boxId).order("stock", { ascending: true })).data ?? [],
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["seller", "products"] });
    qc.invalidateQueries({ queryKey: ["home"] });
    qc.invalidateQueries({ queryKey: ["search"] });
    qc.invalidateQueries({ queryKey: ["product"] });
  };

  const update = useMutation({
    mutationFn: async (v: { id: string; stock: number; low_stock_threshold: number }) => {
      if (!Number.isInteger(v.stock) || v.stock < 0) throw new Error("Estoque inválido");
      if (!Number.isInteger(v.low_stock_threshold) || v.low_stock_threshold < 0) throw new Error("Alerta mínimo inválido");
      const { error } = await supabase.from("products").update({ stock: v.stock, low_stock_threshold: v.low_stock_threshold }).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estoque atualizado");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const counts = { normal: 0, baixo: 0, esgotado: 0 };
  for (const p of products) counts[stockLevel(p.stock, p.low_stock_threshold)]++;
  const sorted = [...products].sort((a, b) => {
    const order = { esgotado: 0, baixo: 1, normal: 2 };
    return order[stockLevel(a.stock, a.low_stock_threshold)] - order[stockLevel(b.stock, b.low_stock_threshold)] || a.stock - b.stock;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {(["normal", "baixo", "esgotado"] as const).map((k) => {
          const l = LEVEL[k];
          return (
            <div key={k} className={cn("flex items-center gap-3 rounded-2xl border p-4 shadow-soft", l.cls)}>
              <l.Icon className="h-6 w-6 shrink-0" />
              <div>
                <p className="text-2xl font-semibold tabular-nums">{counts[k]}</p>
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">{l.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-soft">
        <p className="flex items-center gap-2 font-semibold text-foreground"><Bell className="h-4 w-4 text-secondary" /> Como funciona</p>
        <p className="mt-1">
          O saldo é reservado automaticamente quando o comprador finaliza o pedido e devolvido se o pedido for cancelado antes do envio.
          Ao chegar a zero o produto fica <strong>Esgotado</strong> e a compra é bloqueada. Configure o <strong>alerta mínimo</strong> por produto
          para receber um aviso no sino quando o estoque ficar baixo (0 = sem alerta).
        </p>
      </div>

      {isPending ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhum produto cadastrado.</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((p) => (
            <StockRow key={p.id} product={p} onSave={(v) => update.mutate({ id: p.id, ...v })} saving={update.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function StockRow({
  product: p,
  onSave,
  saving,
}: {
  product: { id: string; name: string; images: string[]; category: "plantas" | "insumos" | "maquinas"; subcategory: string; price: number | string; stock: number; low_stock_threshold: number; active: boolean };
  onSave: (v: { stock: number; low_stock_threshold: number }) => void;
  saving: boolean;
}) {
  const [stock, setStock] = useState(String(p.stock));
  const [thr, setThr] = useState(String(p.low_stock_threshold));
  const dirty = Number(stock) !== p.stock || Number(thr) !== p.low_stock_threshold;

  return (
    <div className="grid items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft sm:grid-cols-[auto_1fr_auto_auto_auto]">
      <StorageImage path={p.images[0]} alt="" className="h-14 w-14 shrink-0 rounded-xl" fallback={<CategoryIcon category={p.category} />} />
      <div className="min-w-0">
        <p className="truncate font-semibold">{p.name}</p>
        <p className="text-xs text-muted-foreground">{CATEGORY_MAP[p.category].short} · {p.subcategory} · {formatPrice(p.price)}{!p.active && " · oculto"}</p>
        <StockBadge stock={p.stock} threshold={p.low_stock_threshold} className="mt-1" />
      </div>
      <label className="text-xs text-muted-foreground">
        Saldo
        <Input type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} className="mt-0.5 h-9 w-24" />
      </label>
      <label className="text-xs text-muted-foreground">
        Alerta mínimo
        <Input type="number" min={0} step={1} value={thr} onChange={(e) => setThr(e.target.value)} className="mt-0.5 h-9 w-24" />
      </label>
      <Button
        size="sm"
        className="rounded-full"
        disabled={!dirty || saving}
        onClick={() => onSave({ stock: Number(stock), low_stock_threshold: Number(thr) })}
      >
        <Save className="mr-1 h-3.5 w-3.5" /> Salvar
      </Button>
    </div>
  );
}
