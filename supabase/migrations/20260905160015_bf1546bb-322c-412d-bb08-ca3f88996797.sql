CREATE TYPE public.cert_status AS ENUM ('valido', 'expirado', 'senha_incorreta', 'invalido');

CREATE TABLE public.box_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL UNIQUE REFERENCES public.boxes(id) ON DELETE CASCADE,
  status public.cert_status NOT NULL,
  holder_name text NOT NULL DEFAULT '',
  holder_tax_id text NOT NULL DEFAULT '',
  issuer text NOT NULL DEFAULT '',
  not_before timestamptz,
  not_after timestamptz,
  file_name text NOT NULL DEFAULT '',
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.box_certificates TO authenticated;
GRANT ALL ON public.box_certificates TO service_role;
ALTER TABLE public.box_certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "box_certificates_read" ON public.box_certificates FOR SELECT TO authenticated
  USING (public.is_box_owner(box_id) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER box_certificates_updated_at BEFORE UPDATE ON public.box_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.box_certificate_secrets (
  box_id uuid PRIMARY KEY REFERENCES public.boxes(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  password_ciphertext text NOT NULL,
  password_iv text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.box_certificate_secrets TO service_role;
ALTER TABLE public.box_certificate_secrets ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER box_certificate_secrets_updated_at BEFORE UPDATE ON public.box_certificate_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_valid_certificate(_box_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.box_certificates
    WHERE box_id = _box_id AND status = 'valido' AND not_after IS NOT NULL AND not_after > now()
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_valid_certificate(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.require_certificate_for_nfe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'processando_sefaz' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT public.has_valid_certificate(NEW.box_id) THEN
      RAISE EXCEPTION 'Certificado Digital A1 Obrigatório para Emissão';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.require_certificate_for_nfe() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER invoices_require_certificate BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.require_certificate_for_nfe();