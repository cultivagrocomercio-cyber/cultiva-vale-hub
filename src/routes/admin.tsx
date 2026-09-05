import { useEffect, useState } from "react";
import { BoxReviewCard, STATUS_LABEL, type BoxWithOwner } from "@/components/admin/BoxReviewCard";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardList, Package, Settings, ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { CATEGORY_MAP, formatPrice } from "@/lib/categories";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      return data.map((b) => ({ ...b, owner: ownerMap.get(b.owner_id) ?? null })) as BoxWithOwner[];
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
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/admin/configuracoes"><Settings className="mr-2 h-4 w-4" /> Configurações</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link to="/admin/solicitacoes"><ClipboardList className="mr-2 h-4 w-4" /> Solicitações de boxes{pending.length > 0 && ` (${pending.length})`}</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Boxes cadastrados" value={boxes.length} />
        <Stat label="Aguardando aprovação" value={pending.length} highlight={pending.length > 0} />
        <Stat label="Boxes aprovados" value={boxes.filter((b) => b.status === "aprovado").length} />
        <Stat label="Suspensos" value={boxes.filter((b) => b.status === "suspenso").length} />
      </div>

      <Tabs defaultValue={pending.length ? "pendentes" : "boxes"} className="mt-6">
        <TabsList>
          <TabsTrigger value="pendentes">Aprovações {pending.length > 0 && <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[10px] text-secondary-foreground">{pending.length}</span>}</TabsTrigger>
          <TabsTrigger value="boxes">Todos os boxes</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes" className="mt-4">
          {boxesQ.isPending ? <Skeleton className="h-40 rounded-2xl" /> : pending.length ? (
            <div className="grid gap-3">{pending.map((b) => <BoxReviewCard key={b.id} box={b} />)}</div>
          ) : (
            <Empty icon={<Check className="h-8 w-8" />} title="Nenhum cadastro pendente" text="Novos boxes aparecerão aqui para análise." />
          )}
        </TabsContent>
        <TabsContent value="boxes" className="mt-4">
          {boxesQ.isPending ? <Skeleton className="h-40 rounded-2xl" /> : boxes.length ? (
            <div className="grid gap-3">{boxes.map((b) => <BoxReviewCard key={b.id} box={b} />)}</div>
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
