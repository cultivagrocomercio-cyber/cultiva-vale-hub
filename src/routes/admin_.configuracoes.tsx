import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, KeyRound, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin_/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Administração Cultiva Vale" },
      { name: "description", content: "Credenciais da integradora fiscal (NF-e) do Cultiva Vale Marketplace." },
      { property: "og:title", content: "Configurações — Administração Cultiva Vale" },
      { property: "og:description", content: "Integração fiscal: Focus NFe, TecnoSpeed ou Brasil NFe." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

type Settings = Tables<"fiscal_settings">;

const PROVIDERS: Record<Settings["provider"] | string, { label: string; tokenLabel: string; secretLabel: string | null; hint: string }> = {
  focus_nfe: { label: "Focus NFe", tokenLabel: "Token da API", secretLabel: null, hint: "Gere o token em Painel Focus NFe → Configurações → Tokens (um para homologação e outro para produção)." },
  tecnospeed: { label: "TecnoSpeed (PlugNotas)", tokenLabel: "X-API-Key", secretLabel: null, hint: "Chave disponível no painel PlugNotas → Configurações → Chaves de API." },
  brasil_nfe: { label: "Brasil NFe", tokenLabel: "Token", secretLabel: "Chave secreta", hint: "Credenciais fornecidas pela Brasil NFe na área do desenvolvedor." },
};

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
  return <SettingsForm />;
}

function SettingsForm() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["admin", "fiscal-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("fiscal_settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<Pick<Settings, "provider" | "environment" | "api_token" | "api_secret" | "notes"> | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (q.data && !form) {
      const { provider, environment, api_token, api_secret, notes } = q.data;
      setForm({ provider, environment, api_token, api_secret, notes });
    }
  }, [q.data, form]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const { error } = await supabase.from("fiscal_settings").upsert({ id: 1, ...form, updated_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credenciais da integradora salvas");
      qc.invalidateQueries({ queryKey: ["admin", "fiscal-settings"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (q.isPending || !form) return <div className="container-page py-8"><Skeleton className="h-64 rounded-2xl" /></div>;
  const meta = PROVIDERS[form.provider] ?? PROVIDERS["focus_nfe"]!;
  const configured = !!form.api_token.trim();

  return (
    <div className="container-page max-w-3xl py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 rounded-full"><Link to="/admin"><ArrowLeft className="mr-1.5 h-4 w-4" /> Administração</Link></Button>
      <p className="text-xs font-bold uppercase tracking-widest text-secondary">Configurações</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Integradora fiscal (NF-e)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Credenciais usadas para transmitir as notas fiscais dos vendedores à SEFAZ por meio de uma integradora. Visíveis apenas para administradores.
      </p>

      <form
        className="mt-6 space-y-5 rounded-2xl border bg-card p-5 shadow-soft"
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Integradora</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PROVIDERS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Ambiente</Label>
            <Select value={form.environment} onValueChange={(v) => setForm({ ...form, environment: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                <SelectItem value="producao">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tok">{meta.tokenLabel}</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="tok" className="pl-9 pr-10 font-mono" type={show ? "text" : "password"} autoComplete="off" value={form.api_token} onChange={(e) => setForm({ ...form, api_token: e.target.value })} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar" : "Mostrar"}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{meta.hint}</p>
        </div>

        {meta.secretLabel && (
          <div className="space-y-1.5">
            <Label htmlFor="sec">{meta.secretLabel}</Label>
            <Input id="sec" className="font-mono" type={show ? "text" : "password"} autoComplete="off" value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="notes">Observações internas</Label>
          <Textarea id="notes" rows={3} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex.: conta em nome da Cultiva Agro, certificado A1 válido até…" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className={`h-4 w-4 ${configured ? "text-primary" : ""}`} />
            {configured ? `${meta.label} configurada em ${form.environment === "producao" ? "produção" : "homologação"}` : "Nenhuma credencial cadastrada — a emissão segue manual (vendedor transmite pelo próprio emissor)."}
            {q.data?.updated_at && configured && <span> · atualizado em {new Date(q.data.updated_at).toLocaleString("pt-BR")}</span>}
          </p>
          <Button type="submit" className="rounded-full" disabled={save.isPending}><Save className="mr-1.5 h-4 w-4" /> Salvar</Button>
        </div>
      </form>
    </div>
  );
}
