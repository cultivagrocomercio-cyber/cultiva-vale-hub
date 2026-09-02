import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/storage";
import { StorageImage } from "./StorageImage";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  folder: string;
  value: string[];
  onChange: (paths: string[]) => void;
  max?: number;
  label?: string;
  aspect?: "square" | "wide";
}

export function ImageUploader({ userId, folder, value, onChange, max = 1, label, aspect = "square" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = max - value.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (!list.length) {
      toast.error(`Máximo de ${max} ${max === 1 ? "imagem" : "imagens"}.`);
      return;
    }
    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of list) {
        if (f.size > 5 * 1024 * 1024) {
          toast.error(`${f.name} passa de 5MB.`);
          continue;
        }
        paths.push(await uploadImage(userId, f, folder));
      }
      onChange([...value, ...paths]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar imagem");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const shape = aspect === "wide" ? "aspect-[3/1]" : "aspect-square";

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-semibold">{label}</p>}
      <div className={cn("grid gap-3", max > 1 ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-1")}>
        {value.map((p) => (
          <div key={p} className={cn("relative overflow-hidden rounded-xl border", shape)}>
            <StorageImage path={p} alt="" className="h-full w-full" />
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== p))}
              className="absolute right-1.5 top-1.5 rounded-full bg-card/90 p-1 text-foreground shadow-soft hover:bg-destructive hover:text-destructive-foreground"
              aria-label="Remover imagem"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-muted/40 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary",
              shape,
            )}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {busy ? "Enviando…" : "Adicionar foto"}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
