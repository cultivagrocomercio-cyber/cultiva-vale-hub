import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileCheck2, MessageCircle, Send, Truck, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { ORDER_STATUS_LABEL, formatPrice } from "@/lib/categories";
import { PLATFORM_PIX_KEY, formatRate, isPaidOrder, isSettledOrder } from "@/lib/commission";
import { uploadImage, resolveImageUrl } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { StorageImage } from "./StorageImage";
import { RatingStars } from "./RatingStars";
import { OrderTimeline } from "./OrderTimeline";
import { InvoiceDownloads } from "./InvoiceDownloads";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type OrderWithItems = Tables<"orders"> & {
  order_items: Tables<"order_items">[];
  boxes: { name: string; slug: string } | null;
};

export type OrderRole = "buyer" | "seller" | "admin";

const STATUS_STYLE: Record<string, string> = {
  pendente_pagamento: "bg-sun-light text-foreground",
  pago_em_custodia: "bg-leaf-light text-primary",
  enviado: "bg-leaf-light text-primary",
  aguardando_confirmacao: "bg-leaf-light text-primary",
  concluido_liquidado: "bg-primary text-primary-foreground",
  em_disputa: "bg-sun text-foreground",
  cancelado: "bg-muted text-muted-foreground",
};

function invalidateOrders(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ["orders", "seller", "admin", "home", "search"]) qc.invalidateQueries({ queryKey: [k] });
}

export function OrderCard({
  order,
  role,
  counterpartName,
}: {
  order: OrderWithItems;
  role: OrderRole;
  counterpartName?: string | undefined;
}) {
  const qc = useQueryClient();
  const [chatOpen, setChatOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);

  const update = useMutation({
    mutationFn: async (patch: TablesUpdate<"orders">) => {
      // Transições validadas no banco (máquina de estados); estoque devolvido ao cancelar (gatilho)
      const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedido atualizado");
      setShipOpen(false);
      setDisputeOpen(false);
      setResolveOpen(false);
      invalidateOrders(qc);
    },
    onError: (e) => toast.error(e.message),
  });

  const s = order.status;
  const canOpenDispute = role === "buyer" && (s === "enviado" || s === "aguardando_confirmacao");

  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">
            Pedido #{order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleString("pt-BR")}
          </p>
          {role !== "seller" && order.boxes ? (
            <Link to="/box/$slug" params={{ slug: order.boxes.slug }} className="font-semibold hover:text-primary">{order.boxes.name}</Link>
          ) : (
            <p className="font-semibold">{counterpartName ?? "Comprador"}</p>
          )}
          {role === "admin" && counterpartName && <p className="text-xs text-muted-foreground">Comprador: {counterpartName}</p>}
        </div>
        <Badge className={cn("rounded-full", STATUS_STYLE[s])}>{ORDER_STATUS_LABEL[s]}</Badge>
      </div>

      <OrderTimeline order={order} role={role} />

      <ul className="divide-y border-t px-4">
        {order.order_items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-2.5 text-sm">
            <StorageImage path={it.image_url} alt="" className="h-10 w-10 shrink-0 rounded-lg" />
            <span className="flex-1 truncate">{it.quantity}× {it.product_name}</span>
            <span className="font-semibold">{formatPrice(Number(it.unit_price) * it.quantity)}</span>
          </li>
        ))}
      </ul>

      {(order.tracking_code || order.shipping_note) && (
        <p className="flex items-start gap-2 border-t px-4 py-3 text-xs">
          <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            {order.tracking_code && <>Rastreio: <span className="font-semibold">{order.tracking_code}</span>. </>}
            {order.shipping_note}
            {order.shipped_at && <span className="text-muted-foreground"> · enviado em {new Date(order.shipped_at).toLocaleDateString("pt-BR")}</span>}
          </span>
        </p>
      )}

      {s === "em_disputa" && (
        <p className="flex items-start gap-2 border-t bg-sun/20 px-4 py-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span><span className="font-semibold">Motivo da disputa:</span> {order.dispute_reason}</span>
        </p>
      )}
      {order.resolution_note && (
        <p className="border-t px-4 py-3 text-xs"><span className="font-semibold">Decisão da plataforma:</span> {order.resolution_note}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t p-4">
        <div>
          <p className="font-display text-lg font-semibold">
            Total: <span className="text-primary">{formatPrice(Number(order.total))}</span>
          </p>
          {role !== "buyer" && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Comissão da plataforma ({formatRate(Number(order.commission_rate))}): {formatPrice(Number(order.commission_amount))} ·{" "}
              <span className="font-semibold text-foreground">
                {role === "seller" ? "Você recebe" : "Vendedor recebe"} {formatPrice(Number(order.net_amount))}
              </span>
              {isSettledOrder(s) ? <span> (liberado)</span> : isPaidOrder(s) ? <span> (em custódia)</span> : s === "cancelado" ? null : <span> (após o pagamento)</span>}
            </p>
          )}
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setChatOpen((v) => !v)}>
            <MessageCircle className="mr-1.5 h-4 w-4" /> Chat
          </Button>

          {/* Pagamento pendente */}
          {s === "pendente_pagamento" && role === "admin" && (
            <Button size="sm" className="rounded-full" onClick={() => update.mutate({ status: "pago_em_custodia" })} disabled={update.isPending}>
              <FileCheck2 className="mr-1.5 h-4 w-4" /> Confirmar pagamento
            </Button>
          )}
          {s === "pendente_pagamento" && (
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => update.mutate({ status: "cancelado" })} disabled={update.isPending}>
              Cancelar pedido
            </Button>
          )}

          {/* Vendedor: envio e entrega */}
          {s === "pago_em_custodia" && role === "seller" && (
            <Button size="sm" className="rounded-full" onClick={() => setShipOpen(true)}>
              <Truck className="mr-1.5 h-4 w-4" /> Informar envio
            </Button>
          )}
          {s === "enviado" && role === "seller" && (
            <Button size="sm" className="rounded-full" onClick={() => update.mutate({ status: "aguardando_confirmacao" })} disabled={update.isPending}>
              Marcar como entregue
            </Button>
          )}

          {/* Comprador: confirmar ou disputar */}
          {canOpenDispute && (
            <>
              <Button size="sm" className="rounded-full" onClick={() => update.mutate({ status: "concluido_liquidado" })} disabled={update.isPending}>
                Confirmar recebimento
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDisputeOpen(true)}>
                <AlertTriangle className="mr-1.5 h-4 w-4" /> Abrir disputa
              </Button>
            </>
          )}

          {/* Admin: mediação */}
          {s === "em_disputa" && role === "admin" && (
            <Button size="sm" className="rounded-full" onClick={() => setResolveOpen(true)}>Resolver disputa</Button>
          )}
          {s === "pago_em_custodia" && role === "admin" && (
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => update.mutate({ status: "cancelado" })} disabled={update.isPending}>
              Cancelar e estornar
            </Button>
          )}
        </div>
      </div>

      {s === "pendente_pagamento" && <PaymentBlock order={order} role={role} />}
      {isPaidOrder(s) && <InvoiceDownloads orderId={order.id} />}
      {order.notes && <p className="border-t px-4 py-3 text-xs text-muted-foreground">Observações: {order.notes}</p>}
      {role === "buyer" && s === "concluido_liquidado" && <ReviewBlock order={order} />}
      {chatOpen && <OrderChat orderId={order.id} />}

      <ShipDialog open={shipOpen} onOpenChange={setShipOpen} pending={update.isPending} onSubmit={(v) => update.mutate({ status: "enviado", ...v })} />
      <DisputeDialog open={disputeOpen} onOpenChange={setDisputeOpen} pending={update.isPending} onSubmit={(reason) => update.mutate({ status: "em_disputa", dispute_reason: reason })} />
      <ResolveDialog open={resolveOpen} onOpenChange={setResolveOpen} pending={update.isPending} onSubmit={(status, note) => update.mutate({ status, resolution_note: note })} />
    </div>
  );
}

/* ---------------- PAGAMENTO PIX ---------------- */

function PaymentBlock({ order, role }: { order: OrderWithItems; role: OrderRole }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setProofUrl(null);
    if (order.payment_proof_url) resolveImageUrl(order.payment_proof_url).then((u) => active && setProofUrl(u));
    return () => {
      active = false;
    };
  }, [order.payment_proof_url]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadImage(user!.id, file, "comprovantes");
      const { error } = await supabase.from("orders").update({ payment_proof_url: path }).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comprovante enviado! A plataforma vai confirmar o pagamento.");
      invalidateOrders(qc);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="border-t bg-soil-grain px-4 py-3 text-sm">
      {role === "buyer" && (
        <>
          <p className="font-semibold">Pague {formatPrice(Number(order.total))} via PIX para a plataforma</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {PLATFORM_PIX_KEY ? <>Chave PIX: <span className="select-all font-semibold text-foreground">{PLATFORM_PIX_KEY}</span>. </> : null}
            O valor fica em custódia e só é liberado ao vendedor depois que você confirmar o recebimento.
          </p>
        </>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {order.payment_proof_url ? (
          <>
            <Badge variant="outline" className="rounded-full"><FileCheck2 className="mr-1 h-3.5 w-3.5" /> Comprovante enviado</Badge>
            {proofUrl && <a href={proofUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary underline">Ver comprovante</a>}
            {role !== "buyer" && <span className="text-xs text-muted-foreground">{role === "admin" ? "Confira e confirme o pagamento." : "Aguardando a plataforma confirmar."}</span>}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{role === "buyer" ? "Nenhum comprovante enviado ainda." : "O comprador ainda não enviou o comprovante."}</span>
        )}
        {role === "buyer" && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
              <Upload className="mr-1.5 h-4 w-4" /> {order.payment_proof_url ? "Trocar comprovante" : "Enviar comprovante PIX"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- DIÁLOGOS ---------------- */

function ShipDialog({ open, onOpenChange, pending, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; pending: boolean; onSubmit: (v: { tracking_code: string; shipping_note: string }) => void }) {
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Informar envio</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Informe o código de rastreio ou descreva o despacho próprio/entrega local combinada. A partir do envio, o valor é liberado em 7 dias se o comprador não abrir disputa.</p>
        <Label htmlFor="tracking">Código de rastreio (opcional)</Label>
        <Input id="tracking" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Ex.: BR123456789BR" maxLength={60} />
        <Label htmlFor="shipnote">Como será a entrega</Label>
        <Textarea id="shipnote" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: entrega própria agendada para sábado de manhã." maxLength={300} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button className="rounded-full" disabled={pending || (!tracking.trim() && !note.trim())} onClick={() => onSubmit({ tracking_code: tracking.trim(), shipping_note: note.trim() })}>
            Confirmar envio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DisputeDialog({ open, onOpenChange, pending, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; pending: boolean; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Abrir disputa</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Conte o que aconteceu (avaria, não recebimento, produto diferente). O valor fica retido até a mediação da plataforma.</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o problema…" maxLength={600} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button variant="destructive" className="rounded-full" disabled={pending || reason.trim().length < 5} onClick={() => onSubmit(reason.trim())}>Abrir disputa</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResolveDialog({ open, onOpenChange, pending, onSubmit }: { open: boolean; onOpenChange: (v: boolean) => void; pending: boolean; onSubmit: (status: "concluido_liquidado" | "cancelado", note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Mediação da disputa</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Converse com as partes pelo chat do pedido e registre a decisão.</p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Decisão e justificativa (visível para ambos)" maxLength={600} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button variant="outline" className="rounded-full" disabled={pending} onClick={() => onSubmit("cancelado", note.trim())}>Estornar ao comprador</Button>
          <Button className="rounded-full" disabled={pending} onClick={() => onSubmit("concluido_liquidado", note.trim())}>Liberar ao vendedor</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- AVALIAÇÃO ---------------- */

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

/* ---------------- CHAT ---------------- */

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
        {messages.length === 0 && <p className="text-center text-xs text-muted-foreground">Nenhuma mensagem ainda. Combine entrega e detalhes por aqui.</p>}
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
