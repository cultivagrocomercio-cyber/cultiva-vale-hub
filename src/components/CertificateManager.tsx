import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, ShieldAlert, Upload, Eye, EyeOff, Trash2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { uploadCertificate, removeCertificate } from "@/lib/certificate.functions";
import { CERT_SITUATION_LABEL, CERT_SITUATION_STYLE, certDaysLeft, certSituation, useBoxCertificate } from "@/lib/certificate";
import { formatTaxId } from "@/lib/fiscal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const ACCEPT = ".pfx,.p12,application/x-pkcs12";

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    r.readAsDataURL(file);
  });
}

export function CertificateManager({ boxId }: { boxId: string }) {
  const qc = useQueryClient();
  const certQ = useBoxCertificate(boxId);
  const upload = useServerFn(uploadCertificate);
  const remove = useServerFn(removeCertificate);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["seller", "certificate", boxId] });
    qc.invalidateQueries({ queryKey: ["seller", "invoices"] });
  };

  const send = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione o arquivo .pfx ou .p12");
      if (!/\.(pfx|p12)$/i.test(file.name)) throw new Error("Somente arquivos .pfx ou .p12 são aceitos");
      if (file.size > 200 * 1024) throw new Error("Arquivo acima de 200 KB");
      if (!password) throw new Error("Informe a senha do certificado");
      const fileBase64 = await toBase64(file);
      return upload({ data: { boxId, fileName: file.name, fileBase64, password } });
    },
    onSuccess: (r) => {
      invalidate();
      setPassword("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      if (!r.ok) toast.error(r.message);
      else if (r.expired) toast.warning("Certificado carregado, porém já está expirado. Emissão de NF-e bloqueada.");
      else toast.success(`Certificado de ${r.holderName} válido e ativo.`);
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => remove({ data: { boxId } }),
    onSuccess: () => { invalidate(); toast.success("Certificado removido."); },
    onError: (e) => toast.error(e.message),
  });

  const cert = certQ.data ?? null;
  const situation = certSituation(cert);
  const days = certDaysLeft(cert);
  const soon = situation === "valido" && days !== null && days <= 30;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="rounded-2xl border bg-card p-5 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-widest text-secondary">Status operacional</p>
        {certQ.isPending ? (
          <Skeleton className="mt-3 h-32 rounded-xl" />
        ) : (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${situation === "valido" ? "bg-leaf-light text-primary" : "bg-muted text-muted-foreground"}`}>
                {situation === "valido" ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Situação</p>
                <Badge className={`rounded-full ${CERT_SITUATION_STYLE[situation]}`}>{CERT_SITUATION_LABEL[situation]}</Badge>
              </div>
            </div>

            {cert && (situation === "valido" || situation === "expirado") && (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <Item k="Titular (Razão Social / Nome)" v={cert.holder_name || "—"} />
                <Item k={cert.holder_tax_id.length === 11 ? "CPF" : "CNPJ"} v={cert.holder_tax_id ? formatTaxId(cert.holder_tax_id) : "—"} />
                <Item k="Data de emissão" v={cert.not_before ? new Date(cert.not_before).toLocaleDateString("pt-BR") : "—"} />
                <Item k="Válido até" v={cert.not_after ? new Date(cert.not_after).toLocaleDateString("pt-BR") : "—"} />
                <Item k="Autoridade certificadora" v={cert.issuer || "—"} />
                <Item k="Arquivo" v={cert.file_name || "—"} />
              </dl>
            )}

            {situation === "nenhum" && <p className="mt-3 text-sm text-muted-foreground">Envie seu certificado A1 (.pfx ou .p12) para habilitar a assinatura e emissão de NF-e.</p>}
            {situation === "senha_incorreta" && <p className="mt-3 text-sm text-destructive">A senha informada não abre o arquivo. Envie novamente com a senha correta.</p>}
            {situation === "invalido" && <p className="mt-3 text-sm text-destructive">O arquivo enviado não é um certificado A1 válido.</p>}
            {situation === "expirado" && <p className="mt-3 text-sm text-destructive">Certificado vencido. Renove junto à sua autoridade certificadora e envie o novo arquivo.</p>}
            {soon && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-sun/60 bg-sun/15 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Atenção: o certificado vence em <strong>{days} dia{days === 1 ? "" : "s"}</strong>. Providencie a renovação para não interromper a emissão de notas.</span>
              </p>
            )}

            {cert && (
              <Button variant="ghost" size="sm" className="mt-4 rounded-full text-destructive" disabled={del.isPending} onClick={() => { if (confirm("Remover o certificado deste box?")) del.mutate(); }}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Remover certificado
              </Button>
            )}
          </>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-widest text-secondary">{cert ? "Substituir certificado" : "Enviar certificado"}</p>
        <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
          <div className="space-y-1">
            <Label htmlFor="cert-file">Arquivo (.pfx ou .p12)</Label>
            <input ref={fileRef} id="cert-file" type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="outline" className="w-full justify-start rounded-xl" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> <span className="truncate">{file ? file.name : "Selecionar arquivo"}</span>
            </Button>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cert-pass">Senha do certificado</Label>
            <div className="relative">
              <Input id="cert-pass" type={show ? "text" : "password"} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
              <button type="button" aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground" onClick={() => setShow((s) => !s)}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={send.isPending || !file || !password}>
            <Lock className="mr-2 h-4 w-4" /> {send.isPending ? "Validando..." : "Enviar com segurança"}
          </Button>
        </form>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          O arquivo e a senha trafegam por conexão criptografada (TLS). O arquivo fica em armazenamento privado sem acesso direto e a senha é guardada com criptografia AES-256-GCM — ela nunca é devolvida em texto puro, nem para você.
        </p>
      </section>
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-semibold break-words">{v}</dd>
    </div>
  );
}
