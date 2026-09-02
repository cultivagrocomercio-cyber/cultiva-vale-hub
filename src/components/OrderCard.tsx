import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ORDER_STATUS_LABEL, formatPrice } from "@/lib/categories";
import { useAuth } from "@/lib/auth";
import { StorageImage } from "./StorageImage";
import { RatingStars } from "./RatingStars";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type OrderWithItems = Tables<"orders"> & {
  order_items: Tables<"order_items">[];
  boxes: { name: string; slug: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  pendente: "bg-sun-light text-foreground",
  confirmado: "bg-leaf-light text-primary",
  entregue: "bg-primary text-primary-foreground",
  cancelado: "bg-muted text-muted-foreground",
};

export function OrderCard({
  order,
  role,
  counterpartName,
}: {
  order: OrderWithItems;
  role: "buyer" | "seller";
  counterpartName?: string;
}) {
  const qc = useQueryClient();
  const [chatOpen, setChatOpen] = useState(false);

  const setStatus = useMutation({
    mutationFn: async (status: Tables<"orders">["status"]) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
      if (error) throw error;
      // Baixa de estoque quando o vendedor confirma
      if (status === "confirmado" && role === "seller") {
        for (const it of order.order_items) {
          if (!it.product_id) continue;
          const { data: p } = await supabase.from("products").select("stock").eq("id", it.product_id).maybeSingle();
          if (p) await supabase.from("products").update({ stock: Math.max(0, p.stock - it.quantity) }).eq("id", it.product_id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["seller"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">
            Pedido #{order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleString("pt-BR")}
          </p>
          {role === "buyer" && order.boxes ? (
            <Link to="/box/$slug" params={{ slug: order.boxes.slug }} className="font-semibold hover:text-primary">{order.boxes.name}</Link>
          ) : (
            <p className="font-semibold">{counterpartName ?? "Comprador"}</p>
          )}
        </div>
        <Badge className={cn("rounded-full", STATUS_STYLE[order.status])}>{ORDER_STATUS_LABEL[order.status]}</Badge>
      </div>
      <ul className="divide-y px-4">
        {order.order_items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-2.5 text-sm">
            <StorageImage path={it.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg" />
            <span className="flex-1 truncate">{it.quantity}× {it.product_name}</span>
            <span className="font-semibold">{formatPrice(Number(it.unit_price) * it.quantity)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2 border-t p-4">
        <p className="font-display text-lg font-semibold">
          Total: <span className="text-primary">{formatPrice(Number(order.total))}</span>
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setChatOpen((v) => !v)}>
            <MessageCircle className="mr-1.5 h-4 w-4" /> Chat
          </Button>
          {role === "seller" && order.status === "pendente" && (
            <>
              <Button size="sm" className="rounded-full" onClick={() => setStatus.mutate("confirmado")} disabled={setStatus.isPending}>Confirmar</Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setStatus.mutate("cancelado")} disabled={setStatus.isPending}>Cancelar</Button>
            </>
          )}
          {role === "seller" && order.status === "confirmado" && (
            <Button size="sm" className="rounded-full" onClick={() => setStatus.mutate("entregue")} disabled={setStatus.isPending}>Marcar entregue</Button>
          )}
          {role === "buyer" && order.status === "pendente" && (
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setStatus.mutate("cancelado")} disabled={setStatus.isPending}>Cancelar pedido</Button>
          )}
        </div>
      </div>
      {order.notes && <p className="border-t px-4 py-3 text-xs text-muted-foreground">Observações: {order.notes}</p>}
      {role === "buyer" && order.status === "entregue" && <ReviewBlock order={order} />}
      {chatOpen && <OrderChat orderId={order.id} />}
    </div>
  );
}

function ReviewBlock({ order }: { order: OrderWithItems }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const { data: existing } = useQuery({
    queryKey: ["review", order.id],
    queryFn: async () => (await supabase.from("reviews").select("rating, comment").eq("order_id", order.id).maybeSingle()).data,
  });
  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reviews").insert({ order_id: order.id, box_id: order.box_id, buyer_id: user!.id, rating, comment });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avaliação enviada. Obrigado!");
      qc.invalidateQueries({ queryKey: ["review", order.id] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (existing) {
    return (
      <div className="border-t px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Sua avaliação</p>
        <RatingStars value={existing.rating} className="mt-1" />
        {existing.comment && <p className="mt-1 text-sm text-muted-foreground">{existing.comment}</p>}
      </div>
    );
  }
  return (
    <div className="border-t bg-soil-grain px-4 py-3">
      <p className="text-sm font-semibold">Como foi sua experiência com este box?</p>
      <RatingStars value={rating} interactive onChange={setRating} size="md" className="mt-2" />
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Conte como foi (opcional)" className="mt-2 bg-card" maxLength={400} />
      <Button size="sm" className="mt-2 rounded-full" onClick={() => send.mutate()} disabled={send.isPending}>Enviar avaliação</Button>
    </div>
  );
}

function OrderChat({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", orderId],
    queryFn: async () => (await supabase.from("messages").select("*").eq("order_id", orderId).order("created_at")).data ?? [],
    refetchInterval: 5000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`order-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${orderId}` }, () =>
        qc.invalidateQueries({ queryKey: ["messages", orderId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [orderId, qc]);

  const send = useMutation({
    mutationFn: async () => {
      const content = text.trim();
      if (!content) return;
      const { error } = await supabase.from("messages").insert({ order_id: orderId, sender_id: user!.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", orderId] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="border-t p-4">
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="text-center text-xs text-muted-foreground">Nenhuma mensagem ainda. Combine entrega e pagamento por aqui.</p>}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <p className="whitespace-pre-line">{m.content}</p>
                <p className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem…" maxLength={1000} />
        <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={send.isPending || !text.trim()} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
