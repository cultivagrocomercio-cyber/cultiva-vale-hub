ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS xml_path text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS danfe_path text NOT NULL DEFAULT '';

CREATE TABLE public.fiscal_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  provider text NOT NULL DEFAULT 'focus_nfe' CHECK (provider IN ('focus_nfe', 'tecnospeed', 'brasil_nfe')),
  environment text NOT NULL DEFAULT 'homologacao' CHECK (environment IN ('homologacao', 'producao')),
  api_token text NOT NULL DEFAULT '',
  api_secret text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.fiscal_settings TO authenticated;
GRANT ALL ON public.fiscal_settings TO service_role;
ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY fiscal_settings_admin_read ON public.fiscal_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY fiscal_settings_admin_insert ON public.fiscal_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY fiscal_settings_admin_update ON public.fiscal_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER fiscal_settings_updated_at BEFORE UPDATE ON public.fiscal_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.fiscal_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;