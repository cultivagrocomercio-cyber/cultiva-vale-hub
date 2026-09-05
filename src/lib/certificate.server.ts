import forge from "node-forge";

export type ParsedCert =
  | { ok: true; holderName: string; holderTaxId: string; issuer: string; notBefore: Date; notAfter: Date }
  | { ok: false; reason: "senha_incorreta" | "invalido"; message: string };

/** Lê um PKCS#12 (.pfx/.p12) e extrai os dados do certificado do titular. Nunca persiste a chave privada. */
export function parsePfx(bytes: Uint8Array, password: string): ParsedCert {
  let p12: forge.pkcs12.Pkcs12Pfx;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(binary, "raw"));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password|MAC|invalid|decrypt/i.test(msg)) {
      return { ok: false, reason: "senha_incorreta", message: "Senha do certificado incorreta." };
    }
    return { ok: false, reason: "invalido", message: "Arquivo não reconhecido como certificado A1 (.pfx/.p12)." };
  }

  const certOid = forge.pki.oids["certBag"] as string;
  const keyOid = forge.pki.oids["pkcs8ShroudedKeyBag"] as string;
  const bags: forge.pkcs12.Bag[] = p12.getBags({ bagType: certOid })[certOid] ?? [];
  const certs = bags.map((b: forge.pkcs12.Bag) => b.cert).filter((c): c is forge.pki.Certificate => !!c);
  if (certs.length === 0) return { ok: false, reason: "invalido", message: "O arquivo não contém certificado." };

  // Certificado do titular: preferir aquele que possui chave privada; senão o de menor validade (folha).
  const keyBags: forge.pkcs12.Bag[] = p12.getBags({ bagType: keyOid })[keyOid] ?? [];
  let leaf: forge.pki.Certificate = certs[0]!;
  const key = keyBags[0]?.key;
  if (key && "n" in key) {
    const match = certs.find((c) => {
      const pk = c.publicKey as forge.pki.rsa.PublicKey;
      return pk && "n" in pk && pk.n.compareTo((key as forge.pki.rsa.PrivateKey).n) === 0;
    });
    if (match) leaf = match;
  } else {
    leaf = certs.reduce((a, c) => (c.validity.notAfter < a.validity.notAfter ? c : a), certs[0]);
  }

  const cn = String(leaf.subject.getField("CN")?.value ?? "");
  const issuerCn = String(leaf.issuer.getField("CN")?.value ?? leaf.issuer.getField("O")?.value ?? "");
  // ICP-Brasil: CN = "RAZAO SOCIAL:CNPJ" (e-CNPJ) ou "NOME:CPF" (e-CPF)
  const [namePart, docPart] = cn.split(":");
  let holderTaxId = (docPart ?? "").replace(/\D/g, "");
  if (!holderTaxId) {
    // Tenta extrair CNPJ do OtherName ICP-Brasil (OID 2.16.76.1.3.3) no SAN
    const san = leaf.getExtension("subjectAltName") as { altNames?: Array<{ type: number; value?: string }> } | null;
    for (const alt of san?.altNames ?? []) {
      const digits = (alt.value ?? "").replace(/[^\d]/g, "");
      if (digits.length === 14 || digits.length === 11) { holderTaxId = digits; break; }
    }
  }

  return {
    ok: true,
    holderName: (namePart ?? cn).trim(),
    holderTaxId,
    issuer: issuerCn,
    notBefore: leaf.validity.notBefore,
    notAfter: leaf.validity.notAfter,
  };
}

async function aesKey() {
  const secret = process.env["CERT_ENCRYPTION_KEY"];
  if (!secret) throw new Error("Chave de criptografia do certificado não configurada.");
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function b64(buf: ArrayBuffer | Uint8Array) {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of u) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/** Criptografa a senha do certificado (AES-256-GCM). Só o servidor consegue reverter. */
export async function encryptSecret(plain: string) {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return { ciphertext: b64(ct), iv: b64(iv) };
}

export async function decryptSecret(ciphertext: string, iv: string) {
  const key = await aesKey();
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, key, unb64(ciphertext));
  return new TextDecoder().decode(pt);
}
