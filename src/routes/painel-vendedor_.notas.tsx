import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { InvoicesTab } from "@/components/InvoicesTab";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/painel-vendedor_/notas")({
  head: () => ({
    meta: [
      { title: "Notas Fiscais — Painel do vendedor | Cultiva Vale" },
      { name: "description", content: "Emissão de NF-e dos pedidos pagos e concluídos do seu box no Cultiva Vale Marketplace." },
      { property: "og:title", content: "Notas Fiscais — Cultiva Vale" },
      { property: "og:description", content: "Emita a NF-e de cada venda com os dados do comprador já preenchidos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const { user, loading, boxId, isSeller } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth", replace: true });
    else if (!isSeller || !boxId) {
      toast.error("Acesso negado: área exclusiva de vendedores com box aprovado.");
      navigate({ to: "/painel", replace: true });
    }
  }, [user, loading, isSeller, boxId, navigate]);

  const boxQ = useQuery({
    queryKey: ["seller", "box", boxId],
    enabled: !!boxId && isSeller,
    queryFn: async () => (await supabase.from("boxes").select("*").eq("id", boxId!).single()).data,
  });

  if (loading || !user || !boxQ.data) return <div className="container-page py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

  return (
    <div className="container-page py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full">
        <Link to="/painel"><ArrowLeft className="mr-1.5 h-4 w-4" /> Painel do box</Link>
      </Button>
      <div className="mt-2 flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-light text-primary"><FileText className="h-6 w-6" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">{boxQ.data.name}</p>
          <h1 className="font-display text-2xl font-semibold">Notas Fiscais</h1>
        </div>
      </div>
      <div className="mt-6"><InvoicesTab box={boxQ.data} /></div>
    </div>
  );
}
