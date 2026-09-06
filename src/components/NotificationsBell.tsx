import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function NotificationsBell() {
  const { user, refresh } = useAuth();
  const qc = useQueryClient();
  const uid = user?.id;

  const q = useQuery({
    queryKey: ["notifications", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notifications-${uid}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (payload) => {
        const n = payload.new as { title: string; body: string };
        toast(n.title, { description: n.body });
        qc.invalidateQueries({ queryKey: ["notifications", uid] });
        // Papel de vendedor pode ter mudado (aprovação/suspensão)
        void refresh();
        qc.invalidateQueries({ queryKey: ["seller"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, qc, refresh]);

  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", uid] }),
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", uid] }),
  });

  if (!uid) return null;
  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notificações</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" onClick={() => markAll.mutate()}>
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Marcar todas como lidas
            </Button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nenhuma notificação por enquanto.</li>}
          {items.map((n) => {
            const inner = (
              <>
                <p className={`text-sm ${n.read_at ? "" : "font-semibold"}`}>{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
              </>
            );
            const cls = `block border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/50 ${n.read_at ? "" : "bg-leaf-light/40"}`;
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link to={n.link} className={cls} onClick={() => !n.read_at && markOne.mutate(n.id)}>{inner}</Link>
                ) : (
                  <button type="button" className={`${cls} w-full text-left`} onClick={() => !n.read_at && markOne.mutate(n.id)}>{inner}</button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="border-t px-3 py-2 text-center">
          <Link to="/notificacoes" className="text-xs font-semibold text-primary hover:underline">Ver todas as notificações</Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
