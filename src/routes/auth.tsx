import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeafMark } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou cadastrar — Cultiva Vale" },
      { name: "description", content: "Crie sua conta de comprador no Cultiva Vale Marketplace. Vendedores são aprovados pela equipe." },
      { property: "og:title", content: "Entrar — Cultiva Vale" },
      { property: "og:description", content: "Acesse sua conta ou cadastre-se." },
    ],
  }),
  component: AuthPage,
});

type Intent = "comprar" | "vender";

export const SELLER_DRAFT_KEY = "cv_seller_draft";

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<Intent>("comprar");

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [user, loading, navigate]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setBusy(false);
    if (error) toast.error(error.message === "Invalid login credentials" ? "E-mail ou senha inválidos." : error.message);
    else navigate({ to: "/" });
  }

  async function signUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = String(fd.get("phone") ?? "").trim();
    const isSeller = intent === "vender";
    if (isSeller) {
      // Guarda o rascunho da habilitação comercial para o formulário do box (status PENDENTE)
      localStorage.setItem(
        SELLER_DRAFT_KEY,
        JSON.stringify({
          name: String(fd.get("business_name") ?? "").trim(),
          tax_id: String(fd.get("tax_id") ?? "").trim(),
          city: String(fd.get("city") ?? "").trim(),
          address: String(fd.get("address") ?? "").trim(),
          main_category: String(fd.get("main_category") ?? ""),
          whatsapp: phone,
        }),
      );
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: `${window.location.origin}${isSeller ? "/painel" : "/"}`,
        data: { full_name: String(fd.get("full_name")), phone, account_intent: intent },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already registered") ? "Este e-mail já está cadastrado." : error.message);
      return;
    }
    if (data.session) {
      toast.success(isSeller ? "Conta criada! Agora complete o pedido de habilitação do seu box." : "Conta criada! Bem-vindo ao Cultiva Vale.");
      navigate({ to: isSeller ? "/painel" : "/", replace: true });
    } else {
      toast.success("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
    }
  }

  return (
    <div className="container-page flex justify-center py-10">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-lift sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <LeafMark className="h-12 w-12" />
          <h1 className="mt-3 font-display text-2xl font-semibold">Bem-vindo ao Cultiva Vale</h1>
          <p className="text-sm text-muted-foreground">Compre plantas, insumos e máquinas direto do produtor.</p>
        </div>
        <Tabs defaultValue="entrar">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="entrar">Entrar</TabsTrigger>
            <TabsTrigger value="cadastrar">Cadastrar</TabsTrigger>
          </TabsList>
          <TabsContent value="entrar">
            <form onSubmit={signIn} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="li-email">E-mail</Label>
                <Input id="li-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="li-pass">Senha</Label>
                <Input id="li-pass" name="password" type="password" required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full rounded-full" disabled={busy}>Entrar</Button>
            </form>
          </TabsContent>
          <TabsContent value="cadastrar">
            <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tipo de cadastro">
              <IntentCard active={intent === "comprar"} onClick={() => setIntent("comprar")} icon={ShoppingBag} title="Quero Comprar" hint="Cadastro rápido" />
              <IntentCard active={intent === "vender"} onClick={() => setIntent("vender")} icon={Store} title="Quero Vender" hint="Abrir um box" />
            </div>
            <form key={intent} onSubmit={signUp} className="mt-4 space-y-4">
              {intent === "vender" ? (
                <p className="rounded-xl bg-sun/30 p-3 text-xs text-foreground">
                  Sua conta nasce como <strong>cliente</strong> e o box entra em <strong>análise</strong>. A venda só é liberada após a aprovação da equipe.
                </p>
              ) : (
                <p className="rounded-xl bg-leaf-light p-3 text-xs text-primary">
                  Conta de <strong>cliente</strong>: compre de qualquer box do Brasil. Se quiser vender depois, é só pedir a habilitação no seu perfil.
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="su-name">Nome completo</Label>
                <Input id="su-name" name="full_name" required minLength={2} maxLength={80} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-email">E-mail</Label>
                <Input id="su-email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-pass">Senha</Label>
                <Input id="su-pass" name="password" type="password" required minLength={6} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-phone">Telefone / WhatsApp</Label>
                <Input id="su-phone" name="phone" type="tel" required maxLength={20} placeholder="(13) 99999-9999" autoComplete="tel" />
              </div>
              {intent === "vender" && (
                <fieldset className="space-y-4 rounded-2xl border p-4">
                  <legend className="px-1 text-xs font-bold uppercase tracking-widest text-secondary">Dados da empresa / produtor</legend>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-biz">Nome do box / propriedade</Label>
                    <Input id="su-biz" name="business_name" required minLength={2} maxLength={60} placeholder="Ex.: Sítio Flor do Vale" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-tax">CPF ou CNPJ</Label>
                    <Input id="su-tax" name="tax_id" required minLength={11} maxLength={20} placeholder="000.000.000-00" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="su-city">Cidade</Label>
                      <Input id="su-city" name="city" required maxLength={60} placeholder="Registro" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="su-cat">Categoria de atuação</Label>
                      <select id="su-cat" name="main_category" required defaultValue="" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                        <option value="" disabled>Selecione</option>
                        {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-addr">Endereço da propriedade / loja</Label>
                    <Input id="su-addr" name="address" required maxLength={160} placeholder="Rua, número, bairro" />
                  </div>
                </fieldset>
              )}
              <Button type="submit" className="w-full rounded-full" disabled={busy}>
                {intent === "vender" ? "Criar conta e pedir habilitação" : "Criar conta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function IntentCard({ active, onClick, icon: Icon, title, hint }: { active: boolean; onClick: () => void; icon: typeof Store; title: string; hint: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center transition ${active ? "border-primary bg-leaf-light text-primary" : "border-border hover:border-primary/40"}`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-sm font-bold">{title}</span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}
