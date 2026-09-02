import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart, type CartItem } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Cultiva Vale" },
      { name: "description", content: "Revise seus itens e envie o pedido para o box vendedor." },
      { property: "og:title", content: "Carrinho — Cultiva Vale" },
      { property: "og:description", content: "Revise seus itens e finalize o pedido." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const groups = cart.items.reduce<Record<string, CartItem[]>>((acc, i) => {
    (acc[i.boxId] ??= []).push(i);
    return acc;
  }, {});
  const boxIds = Object.keys(groups);

  async function checkout() {
    if (!user) {
      toast.info("Entre na sua conta para finalizar o pedido.");
      navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    try {
      for (const boxId of boxIds) {
        const items = groups[boxId]!;
        const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
        const { data: order, error } = await supabase
          .from("orders")
          .insert({ buyer_id: user.id, box_id: boxId, total, notes })
          .select("id")
          .single();
        if (error) throw error;
        const { error: e2 } = await supabase.from("order_items").insert(
          items.map((i) => ({
            order_id: order.id,
            product_id: i.productId,
            product_name: i.name,
            quantity: i.quantity,
            unit_price: i.price,
            image_url: i.imageUrl,
          })),
        );
        if (e2) throw e2;
      }
      cart.clear();
      toast.success(boxIds.length > 1 ? `${boxIds.length} pedidos enviados!` : "Pedido enviado ao vendedor!");
      navigate({ to: "/meus-pedidos" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o pedido.");
    } finally {
      setBusy(false);
    }
  }

  if (!cart.hydrated) return <div className="container-page py-10" />;

  if (!cart.items.length) {
    return (
      <div className="container-page flex flex-col items-center py-20 text-center">
        <ShoppingBasket className="h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Seu carrinho está vazio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Explore as divisões e adicione produtos.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/buscar" search={{}}>Explorar produtos</Link></Button>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="font-display text-3xl font-semibold">Carrinho</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {boxIds.map((boxId) => {
            const items = groups[boxId]!;
            return (
              <div key={boxId} className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="mb-3 flex items-center justify-between">
                  <Link to="/box/$slug" params={{ slug: items[0]!.boxSlug }} className="font-semibold hover:text-primary">
                    {items[0]!.boxName}
                  </Link>
                  <span className="text-xs text-muted-foreground">1 pedido para este box</span>
                </div>
                <ul className="divide-y">
                  {items.map((i) => (
                    <li key={i.productId} className="flex items-center gap-3 py-3">
                      <Link to="/produto/$id" params={{ id: i.productId }} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-leaf-light">
                        {i.imageUrl && <img src={i.imageUrl} alt={i.name} className="h-full w-full object-cover" />}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{i.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPrice(i.price)} cada</p>
                        <div className="mt-1 flex items-center rounded-full border w-fit">
                          <button className="p-1.5" onClick={() => cart.setQuantity(i.productId, i.quantity - 1)} aria-label="Diminuir"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="w-7 text-center text-sm font-semibold tabular-nums">{i.quantity}</span>
                          <button className="p-1.5" onClick={() => cart.setQuantity(i.productId, i.quantity + 1)} aria-label="Aumentar"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatPrice(i.price * i.quantity)}</p>
                        <button className="mt-1 text-muted-foreground hover:text-destructive" onClick={() => cart.remove(i.productId)} aria-label="Remover">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <aside className="h-fit rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Resumo</h2>
          <div className="mt-3 flex justify-between text-sm"><span>{cart.count} itens</span><span>{formatPrice(cart.total)}</span></div>
          <div className="mt-1 flex justify-between font-display text-xl font-semibold"><span>Total</span><span className="text-primary">{formatPrice(cart.total)}</span></div>
          <label className="mt-4 block text-sm font-semibold" htmlFor="notes">Observações para o vendedor</label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Endereço, forma de entrega preferida, dúvidas…" className="mt-1" maxLength={500} />
          <Button className="mt-4 w-full rounded-full" size="lg" onClick={checkout} disabled={busy || loading}>
            {user ? "Enviar pedido" : "Entrar para finalizar"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Sem pagamento online: o vendedor confirma o pedido e vocês combinam entrega e pagamento pelo chat.
          </p>
        </aside>
      </div>
    </div>
  );
}
