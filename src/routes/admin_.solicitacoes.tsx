import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ClipboardList, FileSearch, MapPin, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CATEGORY_MAP } from "@/lib/categories";
import { PLANS, formatRate } from "@/lib/commission";
import { BoxModerationActions, STATUS_LABEL, STATUS_STYLE, type BoxStatus, type BoxWithOwner } from "@/components/admin/BoxReviewCard";
import { BoxReviewChat } from "@/components/BoxReviewChat";
import { StorageImage } from "@/components/StorageImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin_/solicitacoes")({
  head: () => ({
    meta: [
      { title: "Solicitações de boxes — Administração Cultiva Vale" },
      { name: "description", content: "Auditoria e homologação de novos boxes de venda do Cultiva Vale Marketplace." },
      { property: "og:title", content: "Solicitações de boxes — Cultiva Vale" },
      { property: "og:description", content: "Análise, aprovação, recusa e suspensão de boxes comerciais." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
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
  return <RequestsBoard />;
}

type Filter = "pendente" | "todos" | BoxStatus;

function RequestsBoard() {
  const [filter, setFilter] = useState<Filter>("pendente");
  const [detail, setDetail] = useState<BoxWithOwner | null>(null);

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
    refetchInterval: 20_000,
  });

  const boxes = boxesQ.data ?? [];
  const list = filter === "todos" ? boxes : boxes.filter((b) => b.status === filter);
  const count = (s: BoxStatus) => boxes.filter((b) => b.status === s).length;
  // Mantém o dialog sincronizado após uma ação
  const current = detail ? boxes.find((b) => b.id === detail.id) ?? null : null;

  return (
    <div className="container-page py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full">
        <Link to="/admin"><ArrowLeft className="mr-1.5 h-4 w-4" /> Administração</Link>
      </Button>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-light text-primary"><ClipboardList className="h-6 w-6" /></span>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Auditoria de boxes</p>
          <h1 className="font-display text-2xl font-semibold">Solicitações de habilitação comercial</h1>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pendente">Pendentes {count("pendente") > 0 && <Count n={count("pendente")} />}</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="rejeitado">Recusados</TabsTrigger>
          <TabsTrigger value="suspenso">Suspensos</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 overflow-hidden rounded-2xl border bg-card shadow-soft">
        {boxesQ.isPending ? (
          <Skeleton className="h-48" />
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center text-muted-foreground">
            <Check className="h-8 w-8" />
            <p className="mt-3 font-semibold text-foreground">Nenhuma solicitação {filter === "todos" ? "" : STATUS_LABEL[filter as BoxStatus].toLowerCase()}</p>
            <p className="text-sm">Novos pedidos de habilitação aparecem aqui assim que são enviados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Razão social / Nome</th>
                  <th className="px-4 py-3">Documento fiscal</th>
                  <th className="px-4 py-3">Categoria principal</th>
                  <th className="px-4 py-3">Cidade/UF</th>
                  <th className="px-4 py-3">Envio</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((b) => (
                  <tr key={b.id} className="align-middle hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border bg-card">
                          <StorageImage path={b.logo_url} alt="" className="h-full w-full" fallback={<Store className="h-4 w-4" />} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{b.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{b.owner?.full_name || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{b.tax_id || <span className="text-muted-foreground">não informado</span>}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.main_category ? CATEGORY_MAP[b.main_category].name : "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.city}/{b.state}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(b.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3"><Badge className={`rounded-full ${STATUS_STYLE[b.status]}`}>{STATUS_LABEL[b.status]}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDetail(b)}>
                          <FileSearch className="mr-1.5 h-4 w-4" /> Analisar
                        </Button>
                        <BoxModerationActions box={b} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!current} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {current && <BoxDetail box={current} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[10px] text-secondary-foreground">{n}</span>;
}

function BoxDetail({ box }: { box: BoxWithOwner }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {box.name}
          <Badge className={`rounded-full ${STATUS_STYLE[box.status]}`}>{STATUS_LABEL[box.status]}</Badge>
        </DialogTitle>
      </DialogHeader>

      {box.cover_url && (
        <div className="h-36 overflow-hidden rounded-xl border">
          <StorageImage path={box.cover_url} alt={`Capa de ${box.name}`} className="h-full w-full object-cover" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Section title="Identificação">
          <Field label="Razão social / Nome" value={box.name} />
          <Field label="Documento fiscal (CPF/CNPJ)" value={box.tax_id} mono />
          <Field label="Categoria principal" value={box.main_category ? CATEGORY_MAP[box.main_category].name : ""} />
          <Field label="Plano" value={`${PLANS[box.plan].name} · ${formatRate(PLANS[box.plan].rate)}`} />
        </Section>
        <Section title="Responsável">
          <Field label="Nome" value={box.owner?.full_name} />
          <Field label="Telefone" value={box.owner?.phone} />
          <Field label="WhatsApp do box" value={box.whatsapp} />
        </Section>
        <Section title="Localização">
          <Field label="Endereço da propriedade/loja" value={box.address} />
          <Field label="Cidade/UF" value={`${box.city}/${box.state}`} icon={<MapPin className="h-3 w-3" />} />
          <Field label="Região" value={box.region} />
        </Section>
        <Section title="Processo">
          <Field label="Enviado em" value={new Date(box.created_at).toLocaleString("pt-BR")} />
          <Field label="Última análise" value={box.reviewed_at ? new Date(box.reviewed_at).toLocaleString("pt-BR") : "ainda não analisado"} />
          {box.review_note && <Field label="Motivo registrado" value={box.review_note} />}
        </Section>
      </div>

      <Section title="Documentos e imagens anexados">
        <div className="flex flex-wrap gap-3">
          <Attachment label="Logo" path={box.logo_url} />
          <Attachment label="Capa" path={box.cover_url} />
        </div>
      </Section>

      {(box.description || box.story) && (
        <Section title="Descrição e história">
          {box.description && <p className="text-sm">{box.description}</p>}
          {box.story && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{box.story}</p>}
        </Section>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
        <Button asChild variant="ghost" size="sm" className="rounded-full">
          <Link to="/box/$slug" params={{ slug: box.slug }}>Ver página pública</Link>
        </Button>
        <BoxModerationActions box={box} size="default" />
      </div>

      <Section title={`Conversa com ${box.owner?.full_name || "o vendedor"}`}>
        <BoxReviewChat boxId={box.id} emptyText="Tire dúvidas com o vendedor antes de decidir." />
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value, mono, icon }: { label: string; value?: string | null; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-sm">
      <span className="text-xs text-muted-foreground">{label}: </span>
      <span className={`inline-flex items-center gap-1 font-semibold ${mono ? "font-mono text-xs" : ""} ${!value ? "text-muted-foreground" : ""}`}>
        {icon}{value || "não informado"}
      </span>
    </div>
  );
}

function Attachment({ label, path }: { label: string; path: string | null }) {
  return (
    <div className="w-32">
      <div className="h-24 overflow-hidden rounded-lg border bg-card">
        <StorageImage path={path} alt={label} className="h-full w-full object-cover" fallback={<Store className="h-5 w-5" />} />
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">{label}{!path && " — não enviado"}</p>
    </div>
  );
}
