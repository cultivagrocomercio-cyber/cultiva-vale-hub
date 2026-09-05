import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Package, Pencil, Plus, Store, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { CATEGORIES, CATEGORY_MAP, ORDER_STATUS_LABEL, REGIONS, STATES, formatPrice, slugify, type CategorySlug } from "@/lib/categories";
import { PLANS, formatRate, isInEscrow, isPaidOrder, isSettledOrder } from "@/lib/commission";
import { ImageUploader } from "@/components/ImageUploader";
import { BoxReviewChat } from "@/components/BoxReviewChat";
import { PlanCard } from "@/components/PlanCard";
import { StorageImage } from "@/components/StorageImage";
import { OrderCard, type OrderWithItems } from "@/components/OrderCard";
import { CategoryIcon } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Painel do vendedor — Cultiva Vale" },
      { name: "description", content: "Crie seu box, cadastre produtos e gerencie pedidos no Cultiva Vale Marketplace." },
      { property: "og:title", content: "Painel do vendedor — Cultiva Vale" },
      { property: "og:description", content: "Gerencie seu box, produtos e pedidos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PanelPage,
});

type Box = Tables<"boxes">;
type Product = Tables<"products">;

function PanelPage() {
  const { user, loading, boxId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const boxQ = useQuery({
    queryKey: ["seller", "box", boxId],
    enabled: !!boxId,
    queryFn: async () => (await supabase.from("boxes").select("*").eq("id", boxId!).single()).data,
  });

  if (loading || !user || (boxId && boxQ.isPending)) {
    return <div className="container-page py-8"><Skeleton className="h-64 rounded-2xl" /></div>;
  }

  if (!boxId || !boxQ.data) {
    return (
      <div className="container-page py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-leaf-light text-primary"><Store className="h-7 w-7" /></span>
            <h1 className="mt-3 font-display text-3xl font-semibold">Tornar-se um Produtor/Vendedor</h1>
            <p className="text-sm text-muted-foreground">
              Preencha o pedido de habilitação comercial. Sua conta continua como cliente até a equipe do Cultiva Vale analisar e aprovar seu box.
            </p>
          </div>
          <BoxForm userId={user.id} />
        </div>
      </div>
    );
  }

  if (boxQ.data.status !== "aprovado") {
    return <UnderReview box={boxQ.data} userId={user.id} />;
  }

  return <Dashboard box={boxQ.data} userId={user.id} />;
}

/* Conta em análise: sem acesso ao painel de vendas até a deliberação do administrador */
function UnderReview({ box, userId }: { box: Box; userId: string }) {
  const rejected = box.status === "rejeitado";
  return (
    <div className="container-page py-8">
      <div className="mx-auto max-w-2xl">
        <div className={`rounded-2xl border p-5 text-sm ${rejected ? "border-destructive/40 bg-destructive/10" : "border-secondary/40 bg-sun/20"}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Habilitação comercial</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">
            {rejected ? "Pedido de habilitação não aprovado" : "Seu pedido está em análise"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {rejected
              ? "Sua conta segue como cliente. Ajuste as informações abaixo e reenvie para uma nova análise."
              : "Recebemos o cadastro do seu box. Enquanto a equipe analisa, sua conta continua como cliente e o painel de vendas fica bloqueado. Você será liberado assim que o administrador aprovar."}
          </p>
          {box.review_note && <p className="mt-2 rounded-lg bg-background/70 p-2 text-xs">Observação da equipe: {box.review_note}</p>}
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Conversa com a equipe</p>
          <BoxReviewChat className="mt-2" boxId={box.id} emptyText="Tire dúvidas com a equipe do Cultiva Vale sobre a análise do seu cadastro." />
        </div>
        <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Dados enviados</h2>
        <BoxForm userId={userId} box={box} />
      </div>
    </div>
  );
}

function Dashboard({ box, userId }: { box: Box; userId: string }) {
  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-14 w-14 overflow-hidden rounded-xl border bg-card">
          <StorageImage path={box.logo_url} alt="" className="h-full w-full" fallback={<Store className="h-6 w-6" />} />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Painel do box</p>
          <h1 className="font-display text-2xl font-semibold">{box.name}</h1>
        </div>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/box/$slug" params={{ slug: box.slug }}><ExternalLink className="mr-2 h-4 w-4" /> Ver página pública</Link>
        </Button>
      </div>

      <Tabs defaultValue="produtos" className="mt-6">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="ganhos">Meus ganhos</TabsTrigger>
          <TabsTrigger value="box">Meu box</TabsTrigger>
        </TabsList>
        <TabsContent value="produtos" className="mt-4"><ProductsTab box={box} userId={userId} /></TabsContent>
        <TabsContent value="pedidos" className="mt-4"><OrdersTab boxId={box.id} /></TabsContent>
        <TabsContent value="ganhos" className="mt-4"><EarningsTab box={box} /></TabsContent>
        <TabsContent value="box" className="mt-4"><div className="max-w-2xl"><BoxForm userId={userId} box={box} /></div></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- BOX FORM ---------------- */

function BoxForm({ userId, box }: { userId: string; box?: Box }) {
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const [logo, setLogo] = useState<string[]>(box?.logo_url ? [box.logo_url] : []);
  const [cover, setCover] = useState<string[]>(box?.cover_url ? [box.cover_url] : []);
  const [state, setState] = useState(box?.state ?? "SP");
  const [region, setRegion] = useState(box?.region ?? REGIONS[0]!);

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      const name = String(fd.get("name")).trim();
      const payload = {
        name,
        description: String(fd.get("description")).trim(),
        story: String(fd.get("story")).trim(),
        city: String(fd.get("city")).trim(),
        state,
        region,
        whatsapp: String(fd.get("whatsapp")).trim() || null,
        logo_url: logo[0] ?? null,
        cover_url: cover[0] ?? null,
      };
      if (box) {
        const { error } = await supabase.from("boxes").update(payload).eq("id", box.id);
        if (error) throw error;
      } else {
        const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
        const { error } = await supabase.from("boxes").insert({ ...payload, slug, owner_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      toast.success(box ? "Box atualizado" : "Box criado! Enviamos para análise. Você poderá vender após a aprovação da equipe.");
      await refresh();
      qc.invalidateQueries({ queryKey: ["seller"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-5 rounded-2xl border bg-card p-5 shadow-soft"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <ImageUploader userId={userId} folder="box" value={cover} onChange={setCover} label="Capa do box (opcional)" aspect="wide" />
      <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
        <ImageUploader userId={userId} folder="box" value={logo} onChange={setLogo} label="Logo" />
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="b-name">Nome do box</Label>
            <Input id="b-name" name="name" required minLength={2} maxLength={60} defaultValue={box?.name} placeholder="Ex.: Sítio Flor do Vale" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-desc">Descrição curta</Label>
            <Input id="b-desc" name="description" maxLength={160} defaultValue={box?.description} placeholder="O que você vende, em uma frase" />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-story">História do produtor / loja</Label>
        <Textarea id="b-story" name="story" rows={4} maxLength={2000} defaultValue={box?.story} placeholder="Conte de onde vem sua produção, há quanto tempo cultiva…" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="b-city">Cidade</Label>
          <Input id="b-city" name="city" required maxLength={60} defaultValue={box?.city} placeholder="Registro" />
        </div>
        <div className="space-y-1.5">
          <Label>Estado</Label>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Região</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="b-wa">WhatsApp (opcional)</Label>
        <Input id="b-wa" name="whatsapp" maxLength={20} defaultValue={box?.whatsapp ?? ""} placeholder="5513999999999" />
      </div>
      <Button type="submit" className="rounded-full" disabled={save.isPending}>{box ? "Salvar alterações" : "Criar meu box"}</Button>
    </form>
  );
}

/* ---------------- PRODUCTS ---------------- */

function ProductsTab({ box, userId }: { box: Box; userId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | null | "new">(null);

  const { data: products = [], isPending } = useQuery({
    queryKey: ["seller", "products", box.id],
    queryFn: async () => (await supabase.from("products").select("*").eq("box_id", box.id).order("created_at", { ascending: false })).data ?? [],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["seller", "products"] });
    qc.invalidateQueries({ queryKey: ["home"] });
    qc.invalidateQueries({ queryKey: ["search"] });
    qc.invalidateQueries({ queryKey: ["box", box.slug] });
  };

  const toggle = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto removido");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const activeCount = products.filter((p) => p.active).length;
  const limit = PLANS[box.plan].productLimit;
  const atLimit = limit !== null && activeCount >= limit;

  return (
    <div>
      <PlanCard plan={box.plan} boxName={box.name} activeCount={activeCount} />
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {products.length} {products.length === 1 ? "produto" : "produtos"}
          {limit !== null && <> · {activeCount}/{limit} ativos</>}
        </p>
        <Button
          className="rounded-full"
          onClick={() => (atLimit ? toast.error(`O Plano Básico permite até ${limit} produtos ativos. Oculte um produto ou faça upgrade.`) : setEditing("new"))}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Novo produto
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {isPending ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Nenhum produto ainda. Clique em "Novo produto" para começar.
          </div>
        ) : (
          products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-soft">
              <StorageImage path={p.images[0]} alt="" className="h-16 w-16 shrink-0 rounded-xl" fallback={<CategoryIcon category={p.category} />} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="text-xs text-muted-foreground">{CATEGORY_MAP[p.category].short} · {p.subcategory}</p>
                <p className="text-sm">
                  <span className="font-semibold text-primary">{formatPrice(p.price)}</span>
                  <span className={`ml-2 text-xs ${p.stock === 0 ? "text-destructive" : "text-muted-foreground"}`}>estoque: {p.stock}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <div className="mr-2 hidden items-center gap-1.5 sm:flex">
                  <Switch checked={p.active} onCheckedChange={() => toggle.mutate(p)} aria-label="Ativo" />
                  <span className="text-xs text-muted-foreground">{p.active ? "Ativo" : "Oculto"}</span>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(p)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Remover este produto?") && remove.mutate(p.id)} aria-label="Remover"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))
        )}
      </div>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing === "new" ? "Novo produto" : "Editar produto"}</DialogTitle></DialogHeader>
          {editing !== null && (
            <ProductForm
              boxId={box.id}
              userId={userId}
              product={editing === "new" ? undefined : editing}
              onDone={() => {
                setEditing(null);
                invalidate();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({ boxId, userId, product, onDone }: { boxId: string; userId: string; product?: Product | undefined; onDone: () => void }) {
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [category, setCategory] = useState<CategorySlug>(product?.category ?? "plantas");
  const [sub, setSub] = useState(product?.subcategory ?? CATEGORY_MAP[product?.category ?? "plantas"].subcategories[0]!);

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      const payload = {
        name: String(fd.get("name")).trim(),
        description: String(fd.get("description")).trim(),
        price: Number(String(fd.get("price")).replace(",", ".")),
        stock: Number(fd.get("stock")),
        category,
        subcategory: sub,
        images,
      };
      if (!Number.isFinite(payload.price) || payload.price < 0) throw new Error("Preço inválido");
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, box_id: boxId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(product ? "Produto atualizado" : "Produto cadastrado");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(new FormData(e.currentTarget));
      }}
    >
      <ImageUploader userId={userId} folder="produtos" value={images} onChange={setImages} max={5} label="Fotos (até 5)" />
      <div className="space-y-1.5">
        <Label htmlFor="p-name">Nome</Label>
        <Input id="p-name" name="name" required minLength={2} maxLength={100} defaultValue={product?.name} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Divisão</Label>
          <Select
            value={category}
            onValueChange={(v) => {
              const c = v as CategorySlug;
              setCategory(c);
              setSub(CATEGORY_MAP[c].subcategories[0]!);
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Subcategoria</Label>
          <Select value={sub} onValueChange={setSub}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORY_MAP[category].subcategories.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="p-price">Preço (R$)</Label>
          <Input id="p-price" name="price" type="number" step="0.01" min="0" required defaultValue={product?.price} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-stock">Estoque</Label>
          <Input id="p-stock" name="stock" type="number" min="0" step="1" required defaultValue={product?.stock ?? 1} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="p-desc">Descrição</Label>
        <Textarea id="p-desc" name="description" rows={4} maxLength={2000} defaultValue={product?.description} />
      </div>
      <Button type="submit" className="w-full rounded-full" disabled={save.isPending}>{product ? "Salvar" : "Cadastrar produto"}</Button>
    </form>
  );
}

/* ---------------- GANHOS ---------------- */

function EarningsTab({ box }: { box: Box }) {
  const plan = PLANS[box.plan];
  const { data, isPending } = useQuery({
    queryKey: ["seller", "earnings", box.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total, commission_rate, commission_amount, net_amount, created_at, paid_at")
        .eq("box_id", box.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const paid = data.filter((o) => isPaidOrder(o.status));
      const sum = (rows: typeof data, key: "total" | "commission_amount" | "net_amount") =>
        rows.reduce((acc, r) => acc + Number(r[key]), 0);
      return {
        rows: paid,
        count: paid.length,
        pendingCount: data.length - paid.length,
        pendingTotal: sum(data.filter((o) => o.status === "pendente_pagamento"), "total"),
        total: sum(paid, "total"),
        commission: sum(paid, "commission_amount"),
        net: sum(paid, "net_amount"),
        settled: sum(paid.filter((o) => isSettledOrder(o.status)), "net_amount"),
        escrow: sum(paid.filter((o) => isInEscrow(o.status)), "net_amount"),
      };
    },
    refetchOnWindowFocus: true,
  });

  if (isPending || !data) return <Skeleton className="h-40 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-leaf-light/60 p-4 text-sm">
        <p className="font-semibold">{plan.name} · comissão de {formatRate(plan.rate)}</p>
        <p className="mt-1 text-muted-foreground">
          A cada venda fechada e paga dentro do Cultiva Vale, a plataforma retém {formatRate(plan.rate)} do valor do pedido.
          A taxa é gravada no pedido na data da compra e não muda depois. Quer pagar menos? Use "Fazer upgrade" na aba Produtos para conhecer os planos Intermediário (5%) e Premium (3%).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EarningCard label="Total bruto acumulado" value={formatPrice(data.total)} hint={`${data.count} ${data.count === 1 ? "venda paga" : "vendas pagas"}`} />
        <EarningCard label="Comissões retidas" value={formatPrice(data.commission)} hint={`Taxa do ${plan.name.toLowerCase()}`} />
        <EarningCard label="Saldo líquido disponível" value={formatPrice(data.settled)} hint="Pedidos concluídos e liquidados" highlight />
        <EarningCard label="Em custódia" value={formatPrice(data.escrow)} hint="Liberado após a entrega confirmada" />
      </div>

      {data.pendingCount > 0 && (
        <p className="rounded-xl bg-sun-light px-4 py-3 text-sm">
          {data.pendingCount} {data.pendingCount === 1 ? "pedido ainda não foi confirmado" : "pedidos ainda não foram confirmados"}
          {data.pendingTotal > 0 && <> ({formatPrice(data.pendingTotal)} aguardando)</>}. A comissão só é calculada nas vendas fechadas e pagas.
        </p>
      )}

      {data.count === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Wallet className="h-8 w-8" />
          <p className="mt-2">Nenhuma venda paga ainda. Confirme os pedidos recebidos para começar a somar seus ganhos.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-bold">Pedido</th>
                <th className="px-4 py-3 font-bold">Data</th>
                <th className="px-4 py-3 font-bold">Situação</th>
                <th className="px-4 py-3 text-right font-bold">Bruto</th>
                <th className="px-4 py-3 text-right font-bold">Taxa</th>
                <th className="px-4 py-3 text-right font-bold">Retenção</th>
                <th className="px-4 py-3 text-right font-bold">Líquido</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">#{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(o.paid_at ?? o.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{ORDER_STATUS_LABEL[o.status]}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatPrice(Number(o.total))}</td>
                  <td className="px-4 py-3 text-right">{formatRate(Number(o.commission_rate))}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-destructive">− {formatPrice(Number(o.commission_amount))}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-primary">{formatPrice(Number(o.net_amount))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t bg-muted/30 font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={3}>Total</td>
                <td className="px-4 py-3 text-right">{formatPrice(data.total)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right text-destructive">− {formatPrice(data.commission)}</td>
                <td className="px-4 py-3 text-right text-primary">{formatPrice(data.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function EarningCard({ label, value, hint, highlight }: { label: string; value: string; hint: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-card p-4 shadow-soft ${highlight ? "border-primary/40" : ""}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold ${highlight ? "text-primary" : ""}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/* ---------------- ORDERS ---------------- */

function OrdersTab({ boxId }: { boxId: string }) {
  const { data, isPending } = useQuery({
    queryKey: ["orders", "seller", boxId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), boxes(name, slug)")
        .eq("box_id", boxId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const orders = data as OrderWithItems[];
      const ids = Array.from(new Set(orders.map((o) => o.buyer_id)));
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return { orders, names };
    },
    // Novos pedidos aparecem no painel sem recarregar a página
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  if (isPending) return <Skeleton className="h-40 rounded-2xl" />;
  if (!data?.orders.length) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        <Package className="h-8 w-8" />
        <p className="mt-2">Nenhum pedido recebido ainda.</p>
      </div>
    );
  }
  const pending = data.orders.filter((o) => o.status === "pendente_pagamento").length;
  return (
    <div className="space-y-4">
      {pending > 0 && <p className="rounded-xl bg-sun-light px-4 py-2 text-sm font-semibold">{pending} {pending === 1 ? "pedido aguarda" : "pedidos aguardam"} sua confirmação.</p>}
      {data.orders.map((o) => <OrderCard key={o.id} order={o} role="seller" counterpartName={data.names.get(o.buyer_id)} />)}
    </div>
  );
}
