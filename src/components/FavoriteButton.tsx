import { Heart } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Target = { productId: string; boxId?: never } | { boxId: string; productId?: never };

export function FavoriteButton({ className, label = true, ...target }: Target & { className?: string; label?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const col = target.productId ? "product_id" : "box_id";
  const id = (target.productId ?? target.boxId)!;

  const { data: fav } = useQuery({
    queryKey: ["favorite", user?.id, col, id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("favorites").select("id").eq("user_id", user!.id).eq(col, id).maybeSingle()).data,
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (fav) {
        const { error } = await supabase.from("favorites").delete().eq("id", fav.id);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from("favorites").insert({ user_id: user!.id, [col]: id });
      if (error) throw error;
      return true;
    },
    onSuccess: (added) => {
      qc.invalidateQueries({ queryKey: ["favorite"] });
      qc.invalidateQueries({ queryKey: ["favorites"] });
      toast.success(added ? "Adicionado aos favoritos" : "Removido dos favoritos");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = !!fav;
  return (
    <Button
      type="button"
      variant="outline"
      size={label ? "lg" : "icon"}
      aria-pressed={active}
      aria-label={active ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className={cn("rounded-full", active && "border-secondary text-secondary", className)}
      disabled={toggle.isPending}
      onClick={() => (user ? toggle.mutate() : navigate({ to: "/auth" }))}
    >
      <Heart className={cn("h-4 w-4", label && "mr-2", active && "fill-current")} />
      {label && (active ? "Favoritado" : "Favoritar")}
    </Button>
  );
}
