import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Circle, CircleDot, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { NOTIFICATION_KINDS, kindLabel } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Filter = "todas" | "nao_lidas" | "lidas";

export const Route = createFileRoute("/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações — Cultiva Vale" },
      { name: "description", content: "Central de notificações do Cultiva Vale: pedidos, pagamentos, envios, notas fiscais, avaliações e estoque." },
      { property: "og:title", content: "Notificações — Cultiva Vale" },
      { property: "og:description", content: "Acompanhe cada avanço dos seus pedidos e do seu box." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const uid = user?.id;
  const [filter, setFilter] = useState<Filter>("todas");
  const [kind, setKind] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  const q = useQuery({
    queryKey: ["notifications", "all", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["notifications"] });
  const toggle = useMutation({
    mutationFn: async (n: { id: string; read_at: string | null }) => {
      const { error } = await supabase.from("notifications").update({ read_at: n.read_at ? null : new Date().toISOString() }).eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  if (loading || !user) return <div className="container-page py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

  const all = q.data ?? [];
  const unread = all.filter((n) => !n.read_at).length;
  const items = all.filter((n) => (filter === "todas" ? true : filter === "lidas" ? !!n.read_at : !n.read_at)).filter((n) => !kind || n.kind === kind);

  return (
    <div className="container-page max-w-3xl py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Central</p>
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold"><Bell className="h-7 w-7 text-primary" /> Notificações</h1>
          <p className="text-sm text-muted-foreground">{unread ? `${unread} não ${unread === 1 ? "lida" : "lidas"}` : "Tudo lido por aqui."}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/perfil" search={{ aba: "notificacoes" }}><Settings2 className="mr-1.5 h-4 w-4" /> Preferências</Link>
          </Button>
          <Button size="sm" className="rounded-full" disabled={!unread || markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck className="mr-1.5 h-4 w-4" /> Marcar todas como lidas
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(["todas", "nao_lidas", "lidas"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("rounded-full border px-3 py-1 text-xs font-semibold", filter === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            {f === "todas" ? "Todas" : f === "nao_lidas" ? "Não lidas" : "Lidas"}
          </button>
        ))}
        <span className="mx-1 hidden w-px bg-border sm:block" />
        <button onClick={() => setKind("")} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", !kind ? "border-secondary bg-secondary text-secondary-foreground" : "hover:bg-muted")}>
          Todos os tipos
        </button>
        {NOTIFICATION_KINDS.map((k) => (
          <button key={k.value} onClick={() => setKind(k.value)} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", kind === k.value ? "border-secondary bg-secondary text-secondary-foreground" : "hover:bg-muted")}>
            {k.label}
          </button>
        ))}
      </div>

      <ul className="mt-5 divide-y overflow-hidden rounded-2xl border bg-card shadow-soft">
        {q.isPending ? (
          <li className="p-4"><Skeleton className="h-16" /></li>
        ) : items.length === 0 ? (
          <li className="p-12 text-center text-sm text-muted-foreground">Nenhuma notificação neste filtro.</li>
        ) : (
          items.map((n) => (
            <li key={n.id} className={cn("flex gap-3 p-4", !n.read_at && "bg-leaf-light/40")}>
              <button
                type="button"
                onClick={() => toggle.mutate(n)}
                title={n.read_at ? "Marcar como não lida" : "Marcar como lida"}
                aria-label={n.read_at ? "Marcar como não lida" : "Marcar como lida"}
                className="mt-0.5 shrink-0 text-primary"
              >
                {n.read_at ? <Circle className="h-4 w-4 text-muted-foreground" /> : <CircleDot className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{kindLabel(n.kind)}</span>
                  <span className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                  <span className={cn("text-[11px] font-semibold", n.read_at ? "text-muted-foreground" : "text-primary")}>{n.read_at ? "Lida" : "Não lida"}</span>
                </div>
                <p className={cn("mt-1 text-sm", !n.read_at && "font-semibold")}>{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                {n.link && (
                  <Link to={n.link} className="mt-1 inline-block text-xs font-semibold text-primary hover:underline" onClick={() => !n.read_at && toggle.mutate(n)}>
                    Abrir →
                  </Link>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
