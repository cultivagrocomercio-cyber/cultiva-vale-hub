import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Send, Download, CheckCircle2, XCircle, Eye, Upload, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ORDER_STATUS_LABEL, formatPrice } from "@/lib/categories";
import { NFE_ELIGIBLE_ORDER_STATUS, NFE_STATUS_LABEL, NFE_STATUS_STYLE, buildNfePayload, readBuyerFiscal, type NfePayload } from "@/lib/nfe";
import { formatTaxId } from "@/lib/fiscal";
import { useAuth } from "@/lib/auth";
import { uploadImage } from "@/lib/storage";
import { CERT_MISSING_MESSAGE, certDaysLeft, certIsUsable, useBoxCertificate } from "@/lib/certificate";
import { InvoiceDownloads } from "@/components/InvoiceDownloads";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Box = Tables<"boxes">;
type Invoice = Tables<"invoices">;
type OrderRow = Tables<"orders"> & {
  order_items: Array<Tables<"order_items"> & { products: { ncm: string; category: Tables<"products">["category"] } | null }>;
  invoices: Invoice | null;
};

export function InvoicesTab({ box }: { box: Box }) {
  const qc = useQueryClient();
  const [view, setView] = useState<OrderRow | null>(null);

  const q = useQuery({
    queryKey: ["seller", "invoices", box.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*, products(ncm, category)), invoices(*)")
        .eq("box_id", box.id)
        .in("status", [...NFE_ELIGIBLE_ORDER_STATUS])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as OrderRow[];
    },
    refetchOnWindowFocus: true,
  });

  const emit = useMutation({
    mutationFn: async (o: OrderRow) => {
      const payload = buildNfePayload(o, o.order_items, box);
      if (!o.invoices) {
        const { error } = await supabase.from("invoices").insert({ order_id: o.id, box_id: box.id, status: "processando_sefaz", payload: payload as never, cfop: payload.itens[0]?.cfop ?? "5102" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoices").update({ status: "processando_sefaz", payload: payload as never, cfop: payload.itens[0]?.cfop ?? "5102" }).eq("id", o.invoices.id);
        if (error) throw error;
      }
      return payload;
    },
    onSuccess: () => {
      toast.success("NF-e montada e enviada para processamento. Registre o retorno da SEFAZ quando autorizada.");
      qc.invalidateQueries({ queryKey: ["seller", "invoices"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const certQ = useBoxCertificate(box.id);
  const certOk = certIsUsable(certQ.data);
  const certDays = certDaysLeft(certQ.data);
  const sellerReady = !!box.tax_id && !!box.address;
  const canEmit = sellerReady && certOk && !certQ.isPending;
  const orders = q.data ?? [];
  const counts = {
    pend: orders.filter((o) => !o.invoices || o.invoices.status === "pendente_emissao").length,
    proc: orders.filter((o) => o.invoices?.status === "processando_sefaz").length,
    aut: orders.filter((o) => o.invoices?.status === "autorizada").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Pendentes de emissão" value={counts.pend} />
        <Kpi label="Processando SEFAZ" value={counts.proc} />
        <Kpi label="Autorizadas" value={counts.aut} />
      </div>

      {!sellerReady && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Complete os dados fiscais do box (CPF/CNPJ, Inscrição Estadual e endereço) na aba "Meu box" antes de emitir notas.
        </p>
      )}
      {!certQ.isPending && !certOk && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4 shrink-0" /> {CERT_MISSING_MESSAGE}</p>
          <Button asChild size="sm" variant="outline" className="rounded-full"><Link to="/painel-vendedor/certificado">Enviar certificado</Link></Button>
        </div>
      )}
      {certOk && certDays !== null && certDays <= 30 && (
        <p className="rounded-xl border border-sun/60 bg-sun/15 p-3 text-sm">Seu certificado digital vence em {certDays} dia{certDays === 1 ? "" : "s"}. <Link to="/painel-vendedor/certificado" className="font-semibold underline">Renovar agora</Link>.</p>
      )}
      <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
        A nota é montada automaticamente com os dados do seu box (emitente) e do comprador (destinatário). Transmita o arquivo pelo seu emissor/contador e registre aqui o retorno da SEFAZ (chave de acesso e número) para concluir.
      </p>

      {q.isPending ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed py-14 text-center text-muted-foreground">
          <FileText className="h-8 w-8" />
          <p className="mt-3 font-semibold text-foreground">Nenhum pedido a faturar</p>
          <p className="text-sm">Pedidos pagos em custódia ou concluídos aparecem aqui.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Destinatário</th>
                  <th className="px-4 py-3">Pedido</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">NF-e</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => {
                  const buyer = readBuyerFiscal(o.buyer_fiscal);
                  const inv = o.invoices;
                  const st = inv?.status ?? "pendente_emissao";
                  return (
                    <tr key={o.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{buyer.legal_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{buyer.tax_id ? formatTaxId(buyer.tax_id) : "sem documento"}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">{ORDER_STATUS_LABEL[o.status]}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatPrice(o.total)}</td>
                      <td className="px-4 py-3">
                        <Badge className={`rounded-full ${NFE_STATUS_STYLE[st]}`}>{NFE_STATUS_LABEL[st]}</Badge>
                        {inv?.number && <p className="mt-1 text-xs text-muted-foreground">Nº {inv.number} · série {inv.series}</p>}
                        {(st === "rejeitada" || st === "cancelada") && inv?.rejection_reason && <p className="mt-1 text-xs text-destructive">{inv.rejection_reason}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {(st === "pendente_emissao" || st === "rejeitada") && (
                            <Button size="sm" className="rounded-full" title={!certOk ? CERT_MISSING_MESSAGE : undefined} disabled={!canEmit || !buyer.tax_id || emit.isPending} onClick={() => emit.mutate(o)}>
                              <Send className="mr-1.5 h-3.5 w-3.5" /> {st === "rejeitada" ? "Reemitir NF-e" : "Emitir NF-e"}
                            </Button>
                          )}
                          {inv && (
                            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setView(o)}>
                              <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver nota
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {view?.invoices && <InvoiceDetail order={view} invoice={view.invoices} onDone={() => setView(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}

function InvoiceDetail({ order, invoice, onDone }: { order: OrderRow; invoice: Invoice; onDone: () => void }) {
  const qc = useQueryClient();
  const p = invoice.payload as unknown as NfePayload;
  const [key, setKey] = useState(invoice.access_key);
  const [number, setNumber] = useState(invoice.number);
  const [series, setSeries] = useState(invoice.series);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"none" | "reject" | "cancel">("none");

  const update = useMutation({
    mutationFn: async (patch: Partial<Invoice>) => {
      const { error } = await supabase.from("invoices").update(patch).eq("id", invoice.id);
      if (error) throw error;
    },
    onSuccess: (_d, patch) => {
      const fileOnly = !("status" in patch);
      toast.success(fileOnly ? "Arquivo anexado à NF-e" : "Situação da NF-e atualizada");
      qc.invalidateQueries({ queryKey: ["seller", "invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-files", order.id] });
      if (!fileOnly) onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  function download() {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nfe-pedido-${order.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!p?.emitente) return <p className="text-sm text-muted-foreground">Nota ainda não montada.</p>;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          NF-e do pedido #{order.id.slice(0, 8)}
          <Badge className={`rounded-full ${NFE_STATUS_STYLE[invoice.status]}`}>{NFE_STATUS_LABEL[invoice.status]}</Badge>
        </DialogTitle>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <Block title="Emitente">
          <Line k="Nome" v={p.emitente.nome} />
          <Line k={p.emitente.tipo === "cnpj" ? "CNPJ" : "CPF"} v={p.emitente.documento} />
          <Line k="IE" v={p.emitente.inscricao_estadual || "isento"} />
          <Line k="Endereço" v={`${p.emitente.endereco}, ${p.emitente.municipio}/${p.emitente.uf}`} />
        </Block>
        <Block title="Destinatário">
          <Line k="Nome" v={p.destinatario.nome} />
          <Line k={p.destinatario.tipo === "cnpj" ? "CNPJ" : "CPF"} v={p.destinatario.documento} />
          <Line k="IE" v={p.destinatario.inscricao_estadual || "não contribuinte"} />
          <Line k="Endereço" v={`${p.destinatario.endereco}, ${p.destinatario.municipio}/${p.destinatario.uf} · CEP ${p.destinatario.cep}`} />
        </Block>
      </div>

      <Block title="Itens">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground"><tr><th className="py-1">#</th><th>Descrição</th><th>NCM</th><th>CFOP</th><th className="text-right">Qtd</th><th className="text-right">Unit.</th><th className="text-right">Total</th></tr></thead>
          <tbody className="divide-y">
            {p.itens.map((i) => (
              <tr key={i.numero}><td className="py-1">{i.numero}</td><td>{i.descricao}</td><td className="font-mono">{i.ncm || "—"}</td><td className="font-mono">{i.cfop}</td><td className="text-right">{i.quantidade}</td><td className="text-right">{formatPrice(i.valor_unitario)}</td><td className="text-right font-semibold">{formatPrice(i.valor_total)}</td></tr>
            ))}
          </tbody>
        </table>
      </Block>

      <Block title="Totalizadores">
        <div className="grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-4">
          <Line k="Produtos" v={formatPrice(p.totais.valor_produtos)} />
          <Line k="Base de cálculo" v={formatPrice(p.totais.base_calculo)} />
          <Line k="Impostos" v={formatPrice(p.totais.impostos)} />
          <Line k="Total da nota" v={formatPrice(p.totais.valor_total_nota)} strong />
        </div>
      </Block>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-full" onClick={download}><Download className="mr-1.5 h-4 w-4" /> Baixar arquivo da nota</Button>
        {invoice.status === "processando_sefaz" && (
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => update.mutate({ status: "pendente_emissao" })}>Voltar para pendente</Button>
        )}
        {invoice.status === "autorizada" && mode === "none" && (
          <Button variant="ghost" size="sm" className="rounded-full text-destructive" onClick={() => setMode("cancel")}><XCircle className="mr-1.5 h-4 w-4" /> Cancelar nota</Button>
        )}
      </div>

      {invoice.status === "processando_sefaz" && (
        <div className="space-y-3 rounded-xl border p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Registrar retorno da SEFAZ</p>
          {mode !== "reject" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_120px_80px]">
                <div className="space-y-1"><Label htmlFor="nf-key">Chave de acesso (44 dígitos)</Label><Input id="nf-key" inputMode="numeric" maxLength={54} value={key} onChange={(e) => setKey(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="nf-num">Número</Label><Input id="nf-num" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={12} /></div>
                <div className="space-y-1"><Label htmlFor="nf-ser">Série</Label><Input id="nf-ser" value={series} onChange={(e) => setSeries(e.target.value)} maxLength={4} /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="rounded-full" disabled={update.isPending || key.replace(/\D/g, "").length !== 44 || !number.trim()} onClick={() => update.mutate({ status: "autorizada", access_key: key.replace(/\D/g, ""), number: number.trim(), series: series.trim() || "1" })}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Marcar como autorizada
                </Button>
                <Button size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => setMode("reject")}>SEFAZ rejeitou</Button>
              </div>
            </>
          ) : (
            <ReasonBox label="Motivo da rejeição informado pela SEFAZ" reason={reason} setReason={setReason} pending={update.isPending}
              onCancel={() => setMode("none")} onConfirm={() => update.mutate({ status: "rejeitada", rejection_reason: reason.trim() })} confirmLabel="Registrar rejeição" />
          )}
        </div>
      )}

      {invoice.status === "autorizada" && (
        <div className="space-y-3 rounded-xl border bg-leaf-light/40 p-3 text-sm">
          <div>
            <Line k="Chave de acesso" v={invoice.access_key} mono />
            <Line k="Número / série" v={`${invoice.number} / ${invoice.series}`} />
            <Line k="Autorizada em" v={invoice.issued_at ? new Date(invoice.issued_at).toLocaleString("pt-BR") : "—"} />
          </div>
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-bold uppercase tracking-widest text-secondary">Arquivos da nota (XML e DANFE)</p>
            <p className="text-xs text-muted-foreground">Anexe o XML autorizado e o DANFE em PDF. Eles ficam disponíveis para download para você e para o comprador na tela do pedido.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <FileSlot label="XML da NF-e" accept=".xml,text/xml,application/xml" current={invoice.xml_path} onUpload={(path) => update.mutate({ xml_path: path })} pending={update.isPending} />
              <FileSlot label="DANFE (PDF)" accept=".pdf,application/pdf" current={invoice.danfe_path} onUpload={(path) => update.mutate({ danfe_path: path })} pending={update.isPending} />
            </div>
            <InvoiceDownloads orderId={order.id} compact />
          </div>
        </div>
      )}
      {mode === "cancel" && (
        <ReasonBox label="Justificativa do cancelamento" reason={reason} setReason={setReason} pending={update.isPending}
          onCancel={() => setMode("none")} onConfirm={() => update.mutate({ status: "cancelada", rejection_reason: reason.trim() })} confirmLabel="Confirmar cancelamento" />
      )}
    </>
  );
}

function FileSlot({ label, accept, current, onUpload, pending }: { label: string; accept: string; current: string; onUpload: (path: string) => void; pending: boolean }) {
  const { user } = useAuth();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(file: File | undefined) {
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo acima de 5 MB"); return; }
    setBusy(true);
    try {
      const path = await uploadImage(user.id, file, "nfe");
      onUpload(path);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <p className="text-xs font-semibold">{label}</p>
      <p className="mb-2 text-[11px] text-muted-foreground">{current ? "Arquivo anexado" : "Nenhum arquivo anexado"}</p>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={busy || pending} onClick={() => ref.current?.click()}>
        <Upload className="mr-1.5 h-3.5 w-3.5" /> {current ? "Substituir" : "Anexar"}
      </Button>
    </div>
  );
}

function ReasonBox({ label, reason, setReason, pending, onCancel, onConfirm, confirmLabel }: {
  label: string; reason: string; setReason: (v: string) => void; pending: boolean; onCancel: () => void; onConfirm: () => void; confirmLabel: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label} <span className="text-destructive">*</span></Label>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={400} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onCancel}>Voltar</Button>
        <Button variant="destructive" size="sm" className="rounded-full" disabled={pending || reason.trim().length < 5} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Line({ k, v, strong, mono }: { k: string; v: string; strong?: boolean; mono?: boolean }) {
  return (
    <p className="mb-1 text-sm">
      <span className="text-xs text-muted-foreground">{k}: </span>
      <span className={`${strong ? "font-display text-base font-semibold text-primary" : "font-semibold"} ${mono ? "break-all font-mono text-xs" : ""}`}>{v}</span>
    </p>
  );
}
