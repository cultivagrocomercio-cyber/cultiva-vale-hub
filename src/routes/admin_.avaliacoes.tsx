import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, EyeOff, Flag, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { RatingStars } from "@/components/RatingStars";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin_/avaliacoes")({
  head: () => ({
    meta: [
      { title: "Moderação de avaliações — Administração Cultiva Vale" },
      { name: "description", content: "Auditoria de comentários reportados e submetidos no Cultiva Vale Marketplace." },
      { property: "og:title", content: "Moderação de avaliações — Cultiva Vale" },
      { property: "og:description", content: "Aprovar, ocultar ou excluir avaliações de produtos e boxes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Review = Tables<"reviews"> & { boxes: { name: string; slug: string } | null };
type Filter = "reportadas" | "todas" | "ocultas";

function Page() {
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
  if (loading || !user || !isAdmin) return <div className="container-page py-8"><Skeleton className="h-64 rounded-2xl" /></div>;
  return <Moderation />;
}

function Moderation() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("reportadas");

  const q = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*, boxes(name, slug)").order("reported", { ascending: false }).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      const rows = data as unknown as Review[];
      const ids = Array.from(new Set(rows.map((r) => r.buyer_id)));
      const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return rows.map((r) => ({ ...r, buyerName: names.get(r.buyer_id) || "Comprador" }));
    },
    refetchOnWindowFocus: true,
  });

  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "aprovar" | "ocultar" | "excluir" }) => {
      if (action === "excluir") {
        const { error } = await supabase.from("reviews").delete().eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reviews").update({ status: action === "aprovar" ? "aprovada" : "oculta", reported: false }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.action === "excluir" ? "Avaliação excluída e médias recalculadas." : v.action === "ocultar" ? "Avaliação ocultada." : "Avaliação aprovada.");
      qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["box"] });
      qc.invalidateQueries({ queryKey: ["product"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const all = q.data ?? [];
  const list = all.filter((r) => (filter === "reportadas" ? r.reported : filter === "ocultas" ? r.status === "oculta" : true));
  const reported = all.filter((r) => r.reported).length;

  return (
    <div className="container-page py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full"><Link to="/admin"><ArrowLeft className="mr-1.5 h-4 w-4" /> Administração</Link></Button>
      <div className="mt-2 flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sun-light text-foreground"><Star className="h-6 w-6" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Reputação</p>
          <h1 className="font-display text-2xl font-semibold">Moderação de avaliações</h1>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Kpi label="Reportadas" value={reported} />
        <Kpi label="Ocultas" value={all.filter((r) => r.status === "oculta").length} />
        <Kpi label="Total" value={all.length} />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mt-6">
        <TabsList>
          <TabsTrigger value="reportadas">Reportadas{reported > 0 && ` (${reported})`}</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="ocultas">Ocultas</TabsTrigger>
        </TabsList>
      </Tabs>

      {q.isPending ? (
        <Skeleton className="mt-4 h-48 rounded-2xl" />
      ) : list.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhuma avaliação nesta lista.</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {list.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.buyerName}</p>
                  <p className="text-xs text-muted-foreground">
                    Box: {r.boxes ? <Link to="/box/$slug" params={{ slug: r.boxes.slug }} className="underline">{r.boxes.name}</Link> : "—"} · Pedido #{r.order_id.slice(0, 8)} · {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {r.reported && <Badge className="rounded-full bg-destructive/15 text-destructive"><Flag className="mr-1 h-3 w-3" /> Reportada</Badge>}
                  <Badge className={`rounded-full ${r.status === "aprovada" ? "bg-leaf-light text-primary" : "bg-muted text-muted-foreground"}`}>{r.status === "aprovada" ? "Aprovada" : "Oculta"}</Badge>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">Produto <RatingStars value={r.product_rating} /></span>
                <span className="flex items-center gap-1.5">Box <RatingStars value={r.rating} /></span>
              </div>
              <p className="mt-2 text-sm">{r.comment || <span className="italic text-muted-foreground">Sem comentário</span>}</p>
              {r.reported && r.report_reason && <p className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">Motivo da denúncia: {r.report_reason}</p>}
              <div className="mt-3 flex flex-wrap justify-end gap-1.5">
                {r.status !== "aprovada" || r.reported ? (
                  <Button size="sm" className="rounded-full" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "aprovar" })}><Check className="mr-1.5 h-3.5 w-3.5" /> Aprovar</Button>
                ) : null}
                {r.status !== "oculta" && (
                  <Button size="sm" variant="outline" className="rounded-full" disabled={act.isPending} onClick={() => act.mutate({ id: r.id, action: "ocultar" })}><EyeOff className="mr-1.5 h-3.5 w-3.5" /> Ocultar</Button>
                )}
                <Button size="sm" variant="ghost" className="rounded-full text-destructive" disabled={act.isPending} onClick={() => { if (confirm("Excluir definitivamente este comentário abusivo? As médias do box e do produto serão recalculadas.")) act.mutate({ id: r.id, action: "excluir" }); }}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Excluir comentário abusivo
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
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
