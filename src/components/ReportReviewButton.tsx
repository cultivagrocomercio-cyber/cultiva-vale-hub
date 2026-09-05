import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ReportReviewButton({ reviewId }: { reviewId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const report = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("report_review", { _review_id: reviewId, _reason: reason.trim() });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Denúncia enviada para a moderação."); setOpen(false); setReason(""); },
    onError: (e) => toast.error(e.message),
  });
  if (!user) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
        <Flag className="h-3 w-3" /> Denunciar
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Denunciar comentário</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Descreva o motivo. A equipe do Cultiva Vale irá analisar.</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Ex.: linguagem ofensiva, conteúdo falso..." />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>Voltar</Button>
            <Button variant="destructive" className="rounded-full" disabled={report.isPending || reason.trim().length < 5} onClick={() => report.mutate()}>Enviar denúncia</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
