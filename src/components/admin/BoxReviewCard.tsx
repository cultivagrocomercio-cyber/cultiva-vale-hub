import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, ExternalLink, MessageCircle, RotateCcw, Store, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CATEGORY_MAP } from "@/lib/categories";
import { PLANS, formatRate, type BoxPlan } from "@/lib/commission";
import { BoxReviewChat } from "@/components/BoxReviewChat";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type Box = Tables<"boxes">;
export type BoxStatus = Box["status"];
export type BoxWithOwner = Box & { owner: { id: string; full_name: string; phone: string | null } | null };

export const STATUS_LABEL: Record<BoxStatus, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Recusado",
  suspenso: "Suspenso",
};
export const STATUS_STYLE: Record<BoxStatus, string> = {
  pendente: "bg-sun/40 text-foreground hover:bg-sun/40",
  aprovado: "bg-leaf-light text-primary hover:bg-leaf-light",
  rejeitado: "bg-destructive/15 text-destructive hover:bg-destructive/15",
  suspenso: "bg-muted text-muted-foreground hover:bg-muted",
};

const MIN_REASON = 10;

/** Mutation compartilhada de mudança de status com auditoria e notificação automática (gatilhos no banco). */
export function useBoxStatusMutation(box: Box, onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ status, review_note }: { status: BoxStatus; review_note?: string }) => {
      const { error } = await supabase.from("boxes").update({ status, review_note: review_note ?? "" }).eq("id", box.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      const msg: Record<BoxStatus, string> = {
        aprovado: `Box "${box.name}" aprovado — o vendedor foi notificado e liberado para vender`,
        rejeitado: `Box "${box.name}" recusado — o vendedor recebeu o motivo`,
        suspenso: `Box "${box.name}" suspenso`,
        pendente: `Box "${box.name}" voltou para análise`,
      };
      toast.success(msg[v.status]);
      onDone?.();
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["search"] });
      qc.invalidateQueries({ queryKey: ["box"] });
      qc.invalidateQueries({ queryKey: ["seller"] });
    },
    onError: (e) => toast.error(e.message),
  });
}

/** Ações de moderação (aprovar / recusar com motivo obrigatório / suspender / reativar). */
export function BoxModerationActions({ box, size = "sm" }: { box: Box; size?: "sm" | "default" }) {
  const [dialog, setDialog] = useState<null | "rejeitado" | "suspenso">(null);
  const [note, setNote] = useState("");
  const setStatus = useBoxStatusMutation(box, () => setDialog(null));
  const reasonOk = note.trim().length >= MIN_REASON;

  return (
    <>
      {box.status !== "aprovado" && (
        <Button size={size} className="rounded-full" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ status: "aprovado" })}>
          <Check className="mr-1.5 h-4 w-4" /> Aprovar Box
        </Button>
      )}
      {(box.status === "pendente" || box.status === "suspenso") && (
        <Button size={size} variant="outline" className="rounded-full text-destructive hover:text-destructive" disabled={setStatus.isPending} onClick={() => { setNote(""); setDialog("rejeitado"); }}>
          <X className="mr-1.5 h-4 w-4" /> Recusar Box
        </Button>
      )}
      {box.status === "aprovado" && (
        <Button size={size} variant="outline" className="rounded-full text-destructive hover:text-destructive" disabled={setStatus.isPending} onClick={() => { setNote(""); setDialog("suspenso"); }}>
          <Ban className="mr-1.5 h-4 w-4" /> Suspender
        </Button>
      )}
      {(box.status === "rejeitado" || box.status === "suspenso") && (
        <Button size={size} variant="ghost" className="rounded-full" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ status: "pendente", review_note: "" })}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> Reabrir análise
        </Button>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "suspenso" ? `Suspender "${box.name}"` : `Recusar "${box.name}"`}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {dialog === "suspenso"
              ? "O box e seus produtos saem do marketplace e o vendedor perde o acesso de venda até a reativação. Informe o motivo (infração contratual, disputa pendente etc.)."
              : "O vendedor receberá uma notificação com o apontamento das correções necessárias e poderá reenviar o cadastro."}
          </p>
          <Label htmlFor={`note-${box.id}`}>{dialog === "suspenso" ? "Motivo da suspensão" : "Motivo da recusa"} <span className="text-destructive">*</span></Label>
          <Textarea
            id={`note-${box.id}`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={600}
            required
            placeholder={dialog === "suspenso" ? "Ex.: disputa em aberto no pedido #1234 sem resposta do vendedor." : "Ex.: CNPJ não confere com a razão social informada; envie o cartão CNPJ atualizado."}
          />
          <p className="text-xs text-muted-foreground">Obrigatório — mínimo de {MIN_REASON} caracteres. {note.trim().length}/600</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={setStatus.isPending || !reasonOk}
              onClick={() => dialog && setStatus.mutate({ status: dialog, review_note: note.trim() })}
            >
              {dialog === "suspenso" ? "Confirmar suspensão" : "Confirmar recusa"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BoxReviewCard({ box }: { box: BoxWithOwner }) {
  const qc = useQueryClient();
  const [chatOpen, setChatOpen] = useState(box.status === "pendente");

  const countQ = useQuery({
    queryKey: ["admin", "box-products-count", box.id],
    queryFn: async () => (await supabase.from("products").select("id", { count: "exact", head: true }).eq("box_id", box.id)).count ?? 0,
  });

  const setPlan = useMutation({
    mutationFn: async (plan: BoxPlan) => {
      const { error } = await supabase.from("boxes").update({ plan }).eq("id", box.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plano de comissão atualizado");
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["seller"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex flex-wrap items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-card">
          <StorageImage path={box.logo_url} alt="" className="h-full w-full" fallback={<Store className="h-6 w-6" />} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{box.name}</h3>
            <Badge className={`rounded-full ${STATUS_STYLE[box.status]}`}>{STATUS_LABEL[box.status]}</Badge>
            <Badge variant="outline" className="rounded-full">{PLANS[box.plan].name} · {formatRate(PLANS[box.plan].rate)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {box.city}/{box.state} · {box.region} · {countQ.data ?? "…"} produto(s)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Responsável: <span className="font-semibold text-foreground">{box.owner?.full_name || "—"}</span>
            {box.owner?.phone && ` · ${box.owner.phone}`}
            {box.whatsapp && ` · WhatsApp ${box.whatsapp}`}
            {" · "}enviado em {new Date(box.created_at).toLocaleDateString("pt-BR")}
            {box.reviewed_at && ` · analisado em ${new Date(box.reviewed_at).toLocaleDateString("pt-BR")}`}
          </p>
          {(box.tax_id || box.address || box.main_category) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {box.tax_id && <>CPF/CNPJ: <span className="font-semibold text-foreground">{box.tax_id}</span></>}
              {box.main_category && <> · Atuação: {CATEGORY_MAP[box.main_category].name}</>}
              {box.address && <> · Endereço: {box.address}</>}
            </p>
          )}
          {box.description && <p className="mt-2 line-clamp-2 text-sm">{box.description}</p>}
          {(box.status === "rejeitado" || box.status === "suspenso") && box.review_note && (
            <p className="mt-2 text-xs text-destructive">Motivo: {box.review_note}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={box.plan} onValueChange={(v) => setPlan.mutate(v as BoxPlan)}>
            <SelectTrigger className="h-9 w-[190px] rounded-full" aria-label="Plano de comissão"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PLANS) as BoxPlan[]).map((k) => (
                <SelectItem key={k} value={k}>{PLANS[k].name} — {formatRate(PLANS[k].rate)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild size="sm" variant="ghost" className="rounded-full">
            <Link to="/box/$slug" params={{ slug: box.slug }}><ExternalLink className="mr-1.5 h-4 w-4" /> Ver</Link>
          </Button>
          <Button size="sm" variant={chatOpen ? "secondary" : "outline"} className="rounded-full" onClick={() => setChatOpen((v) => !v)} aria-expanded={chatOpen}>
            <MessageCircle className="mr-1.5 h-4 w-4" /> {chatOpen ? "Ocultar conversa" : "Conversar"}
          </Button>
          <BoxModerationActions box={box} />
        </div>
      </div>

      {chatOpen && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Conversa com {box.owner?.full_name || "o vendedor"}
          </p>
          <BoxReviewChat boxId={box.id} emptyText="Envie uma mensagem ao vendedor para tirar dúvidas antes de aprovar ou recusar." />
        </div>
      )}
    </div>
  );
}
