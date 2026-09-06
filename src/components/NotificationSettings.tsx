import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PREFERENCE_FIELDS, type PreferenceKey } from "@/lib/notifications";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Prefs = Record<PreferenceKey, boolean>;
const DEFAULTS: Prefs = { email_orders: true, email_invoices: true, email_reviews: true, email_stock_finance: true, whatsapp_updates: false };

/** Aba de preferências: opt-in/opt-out por canal + consentimento LGPD. */
export function NotificationSettings({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const prefsQ = useQuery({
    queryKey: ["notification_prefs", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const consentQ = useQuery({
    queryKey: ["consent", userId],
    queryFn: async () => (await supabase.from("profiles").select("terms_accepted_at, privacy_accepted_at").eq("id", userId).maybeSingle()).data,
  });

  const prefs: Prefs = prefsQ.data
    ? {
        email_orders: prefsQ.data.email_orders,
        email_invoices: prefsQ.data.email_invoices,
        email_reviews: prefsQ.data.email_reviews,
        email_stock_finance: prefsQ.data.email_stock_finance,
        whatsapp_updates: prefsQ.data.whatsapp_updates,
      }
    : DEFAULTS;

  const save = useMutation({
    mutationFn: async (patch: Partial<Prefs>) => {
      const { error } = await supabase.from("notification_preferences").upsert({ user_id: userId, ...prefs, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification_prefs", userId] });
      toast.success("Preferências salvas");
    },
    onError: (e) => toast.error(e.message),
  });

  const consent = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const { error } = await supabase.from("profiles").update({ terms_accepted_at: now, privacy_accepted_at: now }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consent", userId] });
      toast.success("Consentimento registrado");
    },
    onError: (e) => toast.error(e.message),
  });

  if (prefsQ.isPending) return <Skeleton className="h-64 rounded-2xl" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="rounded-2xl border bg-card p-5 shadow-soft">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Mail className="h-5 w-5 text-primary" /> Canais de notificação</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Os avisos no sino do aplicativo estão sempre ativos. Aqui você escolhe o que também quer receber por e-mail ou WhatsApp.
        </p>
        <ul className="mt-4 divide-y">
          {PREFERENCE_FIELDS.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-semibold">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.hint}</p>
              </div>
              <Switch checked={prefs[f.key]} onCheckedChange={(v) => save.mutate({ [f.key]: v } as Partial<Prefs>)} aria-label={f.label} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          E-mails de segurança da conta (confirmação e recuperação de senha) são sempre enviados. Nunca enviamos promoções.
        </p>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Privacidade (LGPD)</h3>
          {consentQ.data?.terms_accepted_at ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Termos e Política de Privacidade aceitos em {new Date(consentQ.data.terms_accepted_at).toLocaleDateString("pt-BR")}.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">Ainda não há registro do seu aceite dos Termos de Uso e da Política de Privacidade.</p>
              <Button size="sm" className="mt-3 rounded-full" disabled={consent.isPending} onClick={() => consent.mutate()}>Aceitar agora</Button>
            </>
          )}
          <ul className="mt-3 space-y-1 text-sm">
            <li><Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link></li>
            <li><Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link></li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Para exercer seus direitos (acesso, correção, portabilidade ou exclusão), fale com o Encarregado (DPO) pelo canal indicado na política.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="flex items-center gap-2 font-semibold"><Bell className="h-4 w-4 text-primary" /> Central de notificações</h3>
          <p className="mt-1 text-sm text-muted-foreground">Veja o histórico completo com marcação de lida / não lida.</p>
          <Button asChild variant="outline" size="sm" className="mt-3 rounded-full"><Link to="/notificacoes">Abrir central</Link></Button>
        </div>
      </aside>
    </div>
  );
}
