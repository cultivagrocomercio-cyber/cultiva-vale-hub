import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, MessageCircle, Package, ShieldCheck, Store, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { CATEGORY_MAP, formatPrice } from "@/lib/categories";
import { PLANS, formatRate, type BoxPlan } from "@/lib/commission";
import { BoxReviewChat } from "@/components/BoxReviewChat";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administração — Cultiva Vale" },
      { name: "description", content: "Painel de administração do Cultiva Vale Marketplace: boxes, produtos e aprovações." },
      { property: "og:title", content: "Administração — Cultiva Vale" },
      { property: "og:description", content: "Gerencie boxes, produtos e aprovações de vendedores." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type Box = Tables<"boxes">;
type Product = Tables<"products">;
type BoxStatus = Box["status"];

const STATUS_LABEL: Record<BoxStatus, string> = { pendente: "Pendente", aprovado: "Aprovado", rejeitado: "Rejeitado" };
const STATUS_STYLE: Record<BoxStatus, string> = {
  pendente: "bg-sun/40 text-foreground hover:bg-sun/40",
  aprovado: "bg-leaf-light text-primary hover:bg-leaf-light",
  rejeitado: "bg-destructive/15 text-destructive hover:bg-destructive/15",
};

function AdminPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", replace: true });
    else if (!isAdmin) {
      toast.error("Acesso negado: esta área é exclusiva para administradores.");
      navigate({ to: "/", replace: true });
    }
  }, [user, loading, isAdmin, navigate]);

  if (loading || !user) return <div className="container-page py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

  if (!isAdmin) {
    return (
      <div className="container-page flex flex-col items-center py-20 text-center">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Acesso restrito</h1>
        <p className="mt-1 text-sm text-muted-foreground">Esta área é exclusiva para administradores do marketplace.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/">Voltar ao início</Link></Button>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const boxesQ = useQuery({
    queryKey: ["admin", "boxes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("boxes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const owners = Array.from(new Set(data.map((b) => b.owner_id)));
      const { data: profiles } = owners.length ? await supabase.from("profiles").select("id, full_name, phone").in("id", owners) : { data: [] };
      const ownerMap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return data.map((b) => ({ ...b, owner: ownerMap.get(b.owner_id) ?? null }));
    },
  });

  const boxes = boxesQ.data ?? [];
  const pending = boxes.filter((b) => b.status === "pendente");

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-light text-primary"><ShieldCheck className="h-6 w-6" /></span>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Administração</p>
          <h1 className="font-display text-2xl font-semibold">Cultiva Vale Marketplace</h1>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Boxes cadastrados" value={boxes.length} />
        <Stat label="Aguardando aprovação" value={pending.length} highlight={pending.length > 0} />
        <Stat label="Boxes aprovados" value={boxes.filter((b) => b.status === "aprovado").length} />
      </div>

      <Tabs defaultValue={pending.length ? "pendentes" : "boxes"} className="mt-6">
        <TabsList>
          <TabsTrigger value="pendentes">Aprovações {pending.length > 0 && <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[10px] text-secondary-foreground">{pending.length}</span>}</TabsTrigger>
          <TabsTrigger value="boxes">Todos os boxes</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes" className="mt-4">
          {boxesQ.isPending ? <Skeleton className="h-40 rounded-2xl" /> : pending.length ? (
            <div className="grid gap-3">{pending.map((b) => <BoxRow key={b.id} box={b} />)}</div>
          ) : (
            <Empty icon={<Check className="h-8 w-8" />} title="Nenhum cadastro pendente" text="Novos boxes aparecerão aqui para análise." />
          )}
        </TabsContent>
        <TabsContent value="boxes" className="mt-4">
          {boxesQ.isPending ? <Skeleton className="h-40 rounded-2xl" /> : boxes.length ? (
            <div className="grid gap-3">{boxes.map((b) => <BoxRow key={b.id} box={b} />)}</div>
          ) : (
            <Empty icon={<Store className="h-8 w-8" />} title="Nenhum box cadastrado" text="Os boxes criados pelos vendedores aparecerão aqui." />
          )}
        </TabsContent>
        <TabsContent value="produtos" className="mt-4"><ProductsAdmin boxes={boxes} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-soft ${highlight ? "border-secondary/50 bg-sun/20" : "bg-card"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}

function Empty({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed py-14 text-center text-muted-foreground">
      {icon}
      <p className="mt-3 font-semibold text-foreground">{title}</p>
      <p className="text-sm">{text}</p>
    </div>
  );
}

/* ---------------- BOX ROW ---------------- */

type BoxWithOwner = Box & { owner: { id: string; full_name: string; phone: string | null } | null };

function BoxRow({ box }: { box: BoxWithOwner }) {
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState(box.review_note ?? "");
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

  const setStatus = useMutation({
    mutationFn: async ({ status, review_note }: { status: BoxStatus; review_note?: string }) => {
      const { error } = await supabase.from("boxes").update({ status, review_note: review_note ?? "" }).eq("id", box.id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.status === "aprovado" ? `Box "${box.name}" aprovado` : v.status === "rejeitado" ? `Box "${box.name}" rejeitado` : "Status atualizado");
      setRejectOpen(false);
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["search"] });
      qc.invalidateQueries({ queryKey: ["box"] });
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
            {" · "}cadastrado em {new Date(box.created_at).toLocaleDateString("pt-BR")}
          </p>
          {(box.tax_id || box.address || box.main_category) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {box.tax_id && <>CPF/CNPJ: <span className="font-semibold text-foreground">{box.tax_id}</span></>}
              {box.main_category && <> · Atuação: {CATEGORY_MAP[box.main_category].name}</>}
              {box.address && <> · Endereço: {box.address}</>}
            </p>
          )}
          {box.description && <p className="mt-2 line-clamp-2 text-sm">{box.description}</p>}
          {box.status === "rejeitado" && box.review_note && <p className="mt-2 text-xs text-destructive">Motivo: {box.review_note}</p>}
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
          {box.status !== "aprovado" && (
            <Button size="sm" className="rounded-full" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ status: "aprovado" })}>
              <Check className="mr-1.5 h-4 w-4" /> Aprovar
            </Button>
          )}
          {box.status !== "rejeitado" && (
            <Button size="sm" variant="outline" className="rounded-full text-destructive hover:text-destructive" disabled={setStatus.isPending} onClick={() => setRejectOpen(true)}>
              <X className="mr-1.5 h-4 w-4" /> Rejeitar
            </Button>
          )}
        </div>
      </div>

      {chatOpen && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Conversa com {box.owner?.full_name || "o vendedor"}
          </p>
          <BoxReviewChat boxId={box.id} emptyText="Envie uma mensagem ao vendedor para tirar dúvidas antes de aprovar ou rejeitar." />
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar "{box.name}"</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">O box e seus produtos deixam de aparecer no marketplace. O vendedor verá a observação no painel dele.</p>
          <Label htmlFor={`note-${box.id}`}>Observação para o vendedor (opcional)</Label>
          <Textarea id={`note-${box.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} placeholder="Ex.: complete a descrição e adicione uma logo." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" className="rounded-full" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ status: "rejeitado", review_note: note.trim() })}>
              Confirmar rejeição
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- PRODUCTS ---------------- */

function ProductsAdmin({ boxes }: { boxes: BoxWithOwner[] }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const boxMap = new Map(boxes.map((b) => [b.id, b]));

  const productsQ = useQuery({
    queryKey: ["admin", "products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("products").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "products"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["search"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (productsQ.isPending) return <Skeleton className="h-40 rounded-2xl" />;
  const term = q.trim().toLowerCase();
  const list = (productsQ.data ?? []).filter((p) => !term || p.name.toLowerCase().includes(term) || boxMap.get(p.box_id)?.name.toLowerCase().includes(term));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por produto ou box…" className="max-w-sm rounded-full" />
        <span className="text-sm text-muted-foreground">{list.length} de {productsQ.data?.length ?? 0} produtos</span>
      </div>
      {list.length ? (
        <ul className="grid gap-2">
          {list.map((p) => {
            const b = boxMap.get(p.box_id);
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                  <StorageImage path={p.images[0]} alt="" className="h-full w-full" fallback={<Package className="h-5 w-5" />} />
                </div>
                <div className="min-w-0 flex-1">
                  <Link to="/produto/$id" params={{ id: p.id }} className="truncate font-semibold hover:text-primary">{p.name}</Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {CATEGORY_MAP[p.category]?.name ?? p.category} · {p.subcategory} · {b?.name ?? "—"}
                    {b && b.status !== "aprovado" && <span className="ml-1 text-destructive">(box {STATUS_LABEL[b.status].toLowerCase()})</span>}
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold text-primary">{formatPrice(Number(p.price))}</span>
                    <span className={`ml-2 text-xs ${p.stock === 0 ? "text-destructive" : "text-muted-foreground"}`}>estoque: {p.stock}</span>
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  {p.active ? "Visível" : "Oculto"}
                  <Switch checked={p.active} onCheckedChange={(v) => toggle.mutate({ id: p.id, active: v })} aria-label="Visibilidade do produto" />
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty icon={<Package className="h-8 w-8" />} title="Nenhum produto encontrado" text="Ajuste o filtro ou aguarde novos cadastros." />
      )}
    </div>
  );
}
