import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Package, Store, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getPublicByIds } from "@/lib/public.functions";
import { STATES, formatPrice } from "@/lib/categories";
import { OrderCard, type OrderWithItems } from "@/components/OrderCard";
import { ProductCard } from "@/components/ProductCard";
import { BoxCard } from "@/components/BoxCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotificationSettings } from "@/components/NotificationSettings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/perfil")({
  validateSearch: (s: Record<string, unknown>): { aba?: "pedidos" | "favoritos" | "dados" | "notificacoes" | undefined } => ({
    aba: s["aba"] === "favoritos" || s["aba"] === "dados" || s["aba"] === "notificacoes" ? s["aba"] : s["aba"] === "pedidos" ? "pedidos" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Meu perfil — Cultiva Vale" },
      { name: "description", content: "Seus dados, histórico de pedidos e produtos e boxes favoritos no Cultiva Vale Marketplace." },
      { property: "og:title", content: "Meu perfil — Cultiva Vale" },
      { property: "og:description", content: "Histórico de pedidos e favoritos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading, refresh, isSeller, boxId } = useAuth();
  const navigate = useNavigate();
  const { aba } = Route.useSearch();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const orders = useQuery({
    queryKey: ["orders", "buyer", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), boxes(name, slug)")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OrderWithItems[];
    },
  });

  const favorites = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("product_id, box_id").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      const productIds = data.map((f) => f.product_id).filter((x): x is string => !!x);
      const boxIds = data.map((f) => f.box_id).filter((x): x is string => !!x);
      if (!productIds.length && !boxIds.length) return { products: [], boxes: [] };
      return getPublicByIds({ data: { productIds, boxIds } });
    },
  });

  const totalSpent = (orders.data ?? []).filter((o) => o.status !== "cancelado").reduce((s, o) => s + Number(o.total), 0);
  const favCount = (favorites.data?.products.length ?? 0) + (favorites.data?.boxes.length ?? 0);

  if (loading || !user) {
    return <div className="container-page py-8"><Skeleton className="h-40 rounded-2xl" /></div>;
  }

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5 shadow-soft">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-leaf-light text-primary">
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" /> : <UserRound className="h-8 w-8" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Meu perfil</p>
          <h1 className="truncate font-display text-2xl font-semibold">{profile?.full_name || user.email}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {user.email}{profile?.city ? ` · ${profile.city}${profile.state ? `/${profile.state}` : ""}` : ""}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <Stat label="Pedidos" value={String(orders.data?.length ?? 0)} />
          <Stat label="Favoritos" value={String(favCount)} />
          <Stat label="Total comprado" value={formatPrice(totalSpent)} />
        </div>
        {!isSeller && (
          <Button asChild variant={boxId ? "outline" : "secondary"} className="w-full rounded-full sm:w-auto">
            <Link to="/painel"><Store className="mr-2 h-4 w-4" /> {boxId ? "Minha habilitação comercial" : "Tornar-se um Produtor/Vendedor"}</Link>
          </Button>
        )}
      </div>

      <Tabs value={aba ?? "pedidos"} onValueChange={(v) => navigate({ to: ".", search: { aba: v as "pedidos" | "favoritos" | "dados" | "notificacoes" }, replace: true })} className="mt-6">
        <TabsList className="h-auto flex-wrap rounded-full">
          <TabsTrigger value="pedidos" className="rounded-full"><Package className="mr-1.5 h-4 w-4" /> Pedidos</TabsTrigger>
          <TabsTrigger value="favoritos" className="rounded-full"><Heart className="mr-1.5 h-4 w-4" /> Favoritos</TabsTrigger>
          <TabsTrigger value="dados" className="rounded-full"><UserRound className="mr-1.5 h-4 w-4" /> Meus dados</TabsTrigger>
          <TabsTrigger value="notificacoes" className="rounded-full"><Bell className="mr-1.5 h-4 w-4" /> Notificações</TabsTrigger>
        </TabsList>

        <TabsContent value="pedidos" className="mt-5 space-y-4">
          {orders.isPending ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)
          ) : orders.data?.length ? (
            orders.data.map((o) => <OrderCard key={o.id} order={o} role="buyer" />)
          ) : (
            <Empty icon={Package} title="Você ainda não fez pedidos" cta="Explorar produtos" />
          )}
        </TabsContent>

        <TabsContent value="favoritos" className="mt-5 space-y-8">
          {favorites.isPending ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
            </div>
          ) : favCount === 0 ? (
            <Empty icon={Heart} title="Nenhum favorito ainda" description="Toque no coração em um produto ou box para salvá-lo aqui." cta="Descobrir produtos" />
          ) : (
            <>
              {favorites.data!.boxes.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold"><Store className="h-4 w-4 text-secondary" /> Boxes favoritos</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {favorites.data!.boxes.map((b) => <BoxCard key={b.id} box={b} />)}
                  </div>
                </section>
              )}
              {favorites.data!.products.length > 0 && (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold"><Heart className="h-4 w-4 text-secondary" /> Produtos favoritos</h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {favorites.data!.products.map((p) => <ProductCard key={p.id} product={p} />)}
                  </div>
                </section>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="dados" className="mt-5">
          <ProfileForm
            key={profile?.updated_at ?? "new"}
            initial={{ full_name: profile?.full_name ?? "", phone: profile?.phone ?? "", city: profile?.city ?? "", state: profile?.state ?? "SP" }}
            userId={user.id}
            onSaved={refresh}
          />
        </TabsContent>

        <TabsContent value="notificacoes" className="mt-5">
          <NotificationSettings userId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-display text-lg font-semibold text-primary">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function Empty({ icon: Icon, title, description, cta }: { icon: typeof Package; title: string; description?: string; cta: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed p-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground" />
      <p className="mt-3 font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      <Button asChild className="mt-4 rounded-full"><Link to="/buscar" search={{}}>{cta}</Link></Button>
    </div>
  );
}

function ProfileForm({ initial, userId, onSaved }: { initial: { full_name: string; phone: string; city: string; state: string }; userId: string; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(initial);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").upsert({ id: userId, ...form, full_name: form.full_name.trim() });
      if (error) throw error;
    },
    onSuccess: async () => {
      await onSaved();
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Dados atualizados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      className="grid max-w-xl gap-4 rounded-2xl border bg-card p-5 shadow-soft"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="phone">WhatsApp / telefone</Label>
        <Input id="phone" placeholder="(13) 99999-9999" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <p className="text-xs text-muted-foreground">Usado pelo vendedor para combinar entrega e pagamento.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
        <div className="grid gap-1.5">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <div className="grid gap-1.5">
          <Label>Estado</Label>
          <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-fit rounded-full" disabled={save.isPending}>
        {save.isPending ? "Salvando…" : "Salvar dados"}
      </Button>
    </form>
  );
}
