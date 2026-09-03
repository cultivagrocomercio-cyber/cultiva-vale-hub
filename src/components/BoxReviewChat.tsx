import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Conversa entre administração e vendedor sobre o cadastro do box. */
export function BoxReviewChat({ boxId, emptyText, className }: { boxId: string; emptyText?: string; className?: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["box-review-messages", boxId],
    queryFn: async () => (await supabase.from("box_review_messages").select("*").eq("box_id", boxId).order("created_at")).data ?? [],
    refetchInterval: 8000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`box-review-${boxId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "box_review_messages", filter: `box_id=eq.${boxId}` }, () =>
        qc.invalidateQueries({ queryKey: ["box-review-messages", boxId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [boxId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async () => {
      const content = text.trim();
      if (!content) return;
      const { error } = await supabase.from("box_review_messages").insert({ box_id: boxId, sender_id: user!.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["box-review-messages", boxId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={cn("rounded-2xl border bg-background/60 p-3", className)}>
      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">{emptyText ?? "Nenhuma mensagem ainda."}</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", mine ? "bg-primary text-primary-foreground" : "bg-muted")}>
                <p className="whitespace-pre-line">{m.content}</p>
                <p className={cn("mt-0.5 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {new Date(m.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send.mutate();
        }}
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma mensagem…" maxLength={1000} />
        <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={send.isPending || !text.trim()} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
