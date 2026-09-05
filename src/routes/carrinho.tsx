import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart, type CartItem } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { STATES, formatPrice } from "@/lib/categories";
import { detectTaxKind, formatTaxId, isValidCNPJ, isValidCPF, isValidIE, onlyDigits } from "@/lib/fiscal";
import { formatCep, type BuyerFiscal } from "@/lib/nfe";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho — Cultiva Vale" },
      { name: "description", content: "Revise seus itens e envie o pedido para o box vendedor." },
      { property: "og:title", content: "Carrinho — Cultiva Vale" },
      { property: "og:description", content: "Revise seus itens e finalize o pedido." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const { user, loading, profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [fiscal, setFiscal] = useState<BuyerFiscal>({ legal_name: "", tax_id: "", state_registration: "", address: "", cep: "", city: "", state: "SP" });

  // Pré-preenche com os dados de faturamento salvos no perfil
  useEffect(() => {
    if (!profile) return;
    setFiscal((f) => ({
      legal_name: f.legal_name || profile.legal_name || profile.full_name || "",
      tax_id: f.tax_id || formatTaxId(profile.tax_id || ""),
      state_registration: f.state_registration || profile.state_registration || "",
      address: f.address || profile.address || "",
      cep: f.cep || formatCep(profile.cep || ""),
      city: f.city || profile.city || "",
      state: f.state !== "SP" ? f.state : profile.state || "SP",
    }));
  }, [profile]);

  const fiscalErrors = validateBuyerFiscal(fiscal);

  const groups = cart.items.reduce<Record<string, CartItem[]>>((acc, i) => {
    (acc[i.boxId] ??= []).push(i);
    return acc;
  }, {});
  const boxIds = Object.keys(groups);

  async function checkout() {
    if (!user) {
      toast.info("Entre na sua conta para finalizar o pedido.");
      navigate({ to: "/auth" });
      return;
    }
    if (fiscalErrors.length) {
      toast.error(fiscalErrors[0]);
      return;
    }
    setBusy(true);
    try {
      for (const boxId of boxIds) {
        const items = groups[boxId]!;
        const { error } = await supabase.rpc("place_order", {
          _box_id: boxId,
          _notes: notes,
          _items: items.map((i) => ({ product_id: i.productId, product_name: i.name, quantity: i.quantity })),
          _buyer_fiscal: { ...fiscal, tax_id: onlyDigits(fiscal.tax_id), cep: onlyDigits(fiscal.cep), state_registration: onlyDigits(fiscal.state_registration) },
        });
        if (error) throw error;
      }
      cart.clear();
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["seller"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["search"] });
      qc.invalidateQueries({ queryKey: ["box"] });
      qc.invalidateQueries({ queryKey: ["product"] });
      toast.success(boxIds.length > 1 ? `${boxIds.length} pedidos enviados!` : "Pedido enviado ao vendedor!");
      navigate({ to: "/meus-pedidos" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o pedido.");
    } finally {
      setBusy(false);
    }
  }

  if (!cart.hydrated) return <div className="container-page py-10" />;

  if (!cart.items.length) {
    return (
      <div className="container-page flex flex-col items-center py-20 text-center">
        <ShoppingBasket className="h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold">Seu carrinho está vazio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Explore as divisões e adicione produtos.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/buscar" search={{}}>Explorar produtos</Link></Button>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="font-display text-3xl font-semibold">Carrinho</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {boxIds.map((boxId) => {
            const items = groups[boxId]!;
            return (
              <div key={boxId} className="rounded-2xl border bg-card p-4 shadow-soft">
                <div className="mb-3 flex items-center justify-between">
                  <Link to="/box/$slug" params={{ slug: items[0]!.boxSlug }} className="font-semibold hover:text-primary">
                    {items[0]!.boxName}
                  </Link>
                  <span className="text-xs text-muted-foreground">1 pedido para este box</span>
                </div>
                <ul className="divide-y">
                  {items.map((i) => (
                    <li key={i.productId} className="flex items-center gap-3 py-3">
                      <Link to="/produto/$id" params={{ id: i.productId }} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-leaf-light">
                        {i.imageUrl && <img src={i.imageUrl} alt={i.name} className="h-full w-full object-cover" />}
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{i.name}</p>
                        <p className="text-xs text-muted-foreground">{formatPrice(i.price)} cada</p>
                        <div className="mt-1 flex items-center rounded-full border w-fit">
                          <button className="p-1.5" onClick={() => cart.setQuantity(i.productId, i.quantity - 1)} aria-label="Diminuir"><Minus className="h-3.5 w-3.5" /></button>
                          <span className="w-7 text-center text-sm font-semibold tabular-nums">{i.quantity}</span>
                          <button className="p-1.5" onClick={() => cart.setQuantity(i.productId, i.quantity + 1)} aria-label="Aumentar"><Plus className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatPrice(i.price * i.quantity)}</p>
                        <button className="mt-1 text-muted-foreground hover:text-destructive" onClick={() => cart.remove(i.productId)} aria-label="Remover">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <aside className="h-fit rounded-2xl border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Resumo</h2>
          <div className="mt-3 flex justify-between text-sm"><span>{cart.count} itens</span><span>{formatPrice(cart.total)}</span></div>
          <div className="mt-1 flex justify-between font-display text-xl font-semibold"><span>Total</span><span className="text-primary">{formatPrice(cart.total)}</span></div>
          {user && (
            <fieldset className="mt-4 space-y-3 rounded-xl border p-3">
              <legend className="px-1 text-xs font-bold uppercase tracking-widest text-secondary">Dados para a nota fiscal</legend>
              <p className="text-xs text-muted-foreground">Obrigatórios para o vendedor emitir a NF-e. Ficam salvos para as próximas compras.</p>
              <Field id="f-name" label="Nome completo / Razão social" value={fiscal.legal_name} onChange={(v) => setFiscal({ ...fiscal, legal_name: v })} maxLength={120} />
              <div className="grid grid-cols-2 gap-2">
                <Field id="f-tax" label="CPF / CNPJ" value={fiscal.tax_id} onChange={(v) => setFiscal({ ...fiscal, tax_id: formatTaxId(v) })} maxLength={18} inputMode="numeric" />
                <Field id="f-ie" label="Inscrição Estadual (se houver)" value={fiscal.state_registration} onChange={(v) => setFiscal({ ...fiscal, state_registration: onlyDigits(v) })} maxLength={14} inputMode="numeric" required={false} />
              </div>
              <Field id="f-addr" label="Endereço completo" value={fiscal.address} onChange={(v) => setFiscal({ ...fiscal, address: v })} maxLength={160} placeholder="Rua, número, complemento, bairro" />
              <div className="grid grid-cols-[1fr_1fr_72px] gap-2">
                <Field id="f-cep" label="CEP" value={fiscal.cep} onChange={(v) => setFiscal({ ...fiscal, cep: formatCep(v) })} maxLength={9} inputMode="numeric" />
                <Field id="f-city" label="Cidade" value={fiscal.city} onChange={(v) => setFiscal({ ...fiscal, city: v })} maxLength={60} />
                <div className="space-y-1">
                  <Label className="text-xs">UF</Label>
                  <Select value={fiscal.state} onValueChange={(v) => setFiscal({ ...fiscal, state: v })}>
                    <SelectTrigger className="h-9" aria-label="UF"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {fiscalErrors.length > 0 && (fiscal.tax_id || fiscal.cep) && (
                <p className="text-xs text-destructive" role="alert">{fiscalErrors[0]}</p>
              )}
            </fieldset>
          )}
          <label className="mt-4 block text-sm font-semibold" htmlFor="notes">Observações para o vendedor</label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Endereço, forma de entrega preferida, dúvidas…" className="mt-1" maxLength={500} />
          <Button className="mt-4 w-full rounded-full" size="lg" onClick={checkout} disabled={busy || loading || (!!user && fiscalErrors.length > 0)}>
            {user ? "Enviar pedido" : "Entrar para finalizar"}
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">
            Sem pagamento online: o vendedor confirma o pedido e vocês combinam entrega e pagamento pelo chat.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, required = true, ...rest }: {
  id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean;
  maxLength?: number; placeholder?: string; inputMode?: "numeric" | "text";
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} className="h-9" value={value} required={required} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function validateBuyerFiscal(f: BuyerFiscal): string[] {
  const errs: string[] = [];
  if (f.legal_name.trim().length < 3) errs.push("Informe o nome completo ou razão social");
  const kind = detectTaxKind(f.tax_id);
  if (!kind) errs.push("Informe um CPF ou CNPJ válido");
  else if (kind === "cpf" && !isValidCPF(f.tax_id)) errs.push("CPF inválido");
  else if (kind === "cnpj" && !isValidCNPJ(f.tax_id)) errs.push("CNPJ inválido");
  if (f.address.trim().length < 5) errs.push("Informe o endereço completo");
  if (onlyDigits(f.cep).length !== 8) errs.push("Informe um CEP válido");
  if (f.city.trim().length < 2) errs.push("Informe a cidade");
  if (onlyDigits(f.state_registration) && !isValidIE(f.state_registration, f.state)) errs.push(`Inscrição Estadual inválida para ${f.state}`);
  return errs;
}
