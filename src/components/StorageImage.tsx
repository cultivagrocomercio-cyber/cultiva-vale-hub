import { useEffect, useState } from "react";
import { resolveImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

/** Renderiza uma imagem a partir de um caminho do bucket (resolvendo URL assinada no navegador). */
export function StorageImage({
  path,
  alt,
  className,
  fallback,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (path) resolveImageUrl(path).then((u) => active && setUrl(u));
    return () => {
      active = false;
    };
  }, [path]);

  if (!path || !url) {
    return <div className={cn("flex items-center justify-center bg-leaf-light text-primary/50", className)}>{fallback}</div>;
  }
  return <img src={url} alt={alt} className={cn("object-cover", className)} />;
}
