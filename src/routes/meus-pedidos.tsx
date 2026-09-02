import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { OrderCard, type OrderWithItems } from "@/components/OrderCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Cultiva Vale" },
      { name: "description", content: "Acompanhe o status dos seus pedidos, converse com o vendedor e avalie o box." },
      { property: "og:title", content: "Meus pedidos — Cultiva Vale" },
      { property: "og:description", content: "Acompanhe seus pedidos no Cultiva Vale." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyOrdersPage,
});

function MyOrdersPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  const { data, isPending } = useQuery({
    queryKey: ["orders", "buyer", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), boxes(name, slug)")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OrderWithItems[];
    },
  });

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Meus pedidos</h1>
          <p className="text-sm text-muted-foreground">Acompanhe o status, converse com o vendedor e avalie após a entrega.</p>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <Link to="/perfil" search={{ aba: "favoritos" }}>Meu perfil e favoritos</Link>
        </Button>
      </div>
      <div className="mt-6 space-y-4">
        {loading || isPending ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)
        ) : data?.length ? (
          data.map((o) => <OrderCard key={o.id} order={o} role="buyer" />)
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed p-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">Você ainda não fez pedidos</p>
            <Button asChild className="mt-4 rounded-full"><Link to="/buscar" search={{}}>Explorar produtos</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}
