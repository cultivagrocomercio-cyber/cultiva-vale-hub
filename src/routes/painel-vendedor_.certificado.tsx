import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { CertificateManager } from "@/components/CertificateManager";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/painel-vendedor_/certificado")({
  head: () => ({
    meta: [
      { title: "Certificado Digital A1 — Painel do vendedor | Cultiva Vale" },
      { name: "description", content: "Envie e gerencie com segurança o certificado digital A1 (.pfx/.p12) usado na assinatura das NF-e do seu box." },
      { property: "og:title", content: "Certificado Digital A1 — Cultiva Vale" },
      { property: "og:description", content: "Gestão segura do certificado ICP-Brasil A1 para emissão de NF-e." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CertificatePage,
});

function CertificatePage() {
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

  if (loading || !user || !boxId) return <div className="container-page py-8"><Skeleton className="h-64 rounded-2xl" /></div>;

  return (
    <div className="container-page py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full">
        <Link to="/painel"><ArrowLeft className="mr-1.5 h-4 w-4" /> Painel do box</Link>
      </Button>
      <div className="mt-2 flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-light text-primary"><ShieldCheck className="h-6 w-6" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-secondary">Assinatura das NF-e</p>
          <h1 className="font-display text-2xl font-semibold">Certificado Digital A1</h1>
        </div>
      </div>
      <div className="mt-6"><CertificateManager boxId={boxId} /></div>
    </div>
  );
}
