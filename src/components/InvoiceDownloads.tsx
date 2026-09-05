import { useQuery } from "@tanstack/react-query";
import { FileText, FileCode2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveImageUrl } from "@/lib/storage";
import { Button } from "@/components/ui/button";

/** Links de download do XML e do DANFE de uma NF-e autorizada (visível para comprador, vendedor e admin). */
export function InvoiceDownloads({ orderId, compact }: { orderId: string; compact?: boolean }) {
  const q = useQuery({
    queryKey: ["invoice-files", orderId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("status, number, series, access_key, xml_path, danfe_path")
        .eq("order_id", orderId)
        .maybeSingle();
      if (!data || data.status !== "autorizada") return null;
      const [xml, danfe] = await Promise.all([resolveImageUrl(data.xml_path || null), resolveImageUrl(data.danfe_path || null)]);
      return { ...data, xml, danfe };
    },
    staleTime: 60_000,
  });

  const inv = q.data;
  if (!inv) return null;

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "flex flex-wrap items-center gap-2 border-t px-4 py-3"}>
      <span className="text-xs text-muted-foreground">
        NF-e nº {inv.number}/{inv.series} autorizada
      </span>
      {inv.xml ? (
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <a href={inv.xml} download={`nfe-${inv.access_key || inv.number}.xml`} target="_blank" rel="noreferrer"><FileCode2 className="mr-1.5 h-4 w-4" /> Baixar XML</a>
        </Button>
      ) : null}
      {inv.danfe ? (
        <Button asChild size="sm" variant="outline" className="rounded-full">
          <a href={inv.danfe} download={`danfe-${inv.access_key || inv.number}.pdf`} target="_blank" rel="noreferrer"><FileText className="mr-1.5 h-4 w-4" /> Baixar DANFE (PDF)</a>
        </Button>
      ) : null}
      {!inv.xml && !inv.danfe && <span className="text-xs text-muted-foreground">Arquivos XML/DANFE ainda não anexados pelo vendedor.</span>}
    </div>
  );
}
