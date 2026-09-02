import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeafMark } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar ou cadastrar — Cultiva Vale" },
      { name: "description", content: "Crie sua conta de comprador ou vendedor no Cultiva Vale Marketplace." },
      { property: "og:title", content: "Entrar — Cultiva Vale" },
      { property: "og:description", content: "Acesse sua conta ou cadastre-se." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [accountType, setAccountType] = useState<"buyer" | "seller">("buyer");

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
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: String(fd.get("full_name")), account_type: accountType },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already registered") ? "Este e-mail já está cadastrado." : error.message);
      return;
    }
    if (data.session) {
      toast.success("Conta criada!");
      navigate({ to: accountType === "seller" ? "/painel" : "/" });
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
          <p className="text-sm text-muted-foreground">Compre ou venda plantas, insumos e máquinas.</p>
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
            <form onSubmit={signUp} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(["buyer", "seller"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAccountType(t)}
                    className={`rounded-xl border p-3 text-left text-sm transition-colors ${accountType === t ? "border-primary bg-leaf-light" : "hover:bg-muted"}`}
                  >
                    <span className="block font-bold">{t === "buyer" ? "Quero comprar" : "Quero vender"}</span>
                    <span className="text-xs text-muted-foreground">{t === "buyer" ? "Comprador" : "Produtor ou lojista"}</span>
                  </button>
                ))}
              </div>
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
              <Button type="submit" className="w-full rounded-full" disabled={busy}>Criar conta</Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
