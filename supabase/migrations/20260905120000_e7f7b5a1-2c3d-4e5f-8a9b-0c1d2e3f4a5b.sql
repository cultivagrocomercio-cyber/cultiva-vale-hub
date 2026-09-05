-- =============================================================
-- NÍVEIS DE ACESSO (ADMIN / VENDEDOR / COMPRADOR)
-- -------------------------------------------------------------
-- 1. Toda conta nova nasce como COMPRADOR (buyer).
-- 2. Alguém vira VENDEDOR (seller) somente quando o ADMINISTRADOR
--    aprova o box dele (trigger em boxes.status).
-- 3. O ADMINISTRADOR é definido manualmente pelo e-mail cadastrado
--    na tabela public.admin_emails.
-- 4. Nenhum usuário pode auto-atribuir papéis pela API (RLS).
-- =============================================================

-- -------------------------------------------------------------
-- 1. E-mails autorizados a serem administradores
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.admin_emails (email) VALUES ('cultivagrocomercio@gmail.com')
ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE public.admin_emails IS
  'E-mails que recebem o papel de administrador. Para definir o seu, execute: INSERT INTO public.admin_emails (email) VALUES (''voce@exemplo.com'');';

GRANT SELECT ON public.admin_emails TO authenticated;
GRANT ALL ON public.admin_emails TO service_role;

ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_emails_admin_read ON public.admin_emails
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY admin_emails_admin_all ON public.admin_emails
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------
-- 2. Novas contas sempre nascem como COMPRADOR (buyer).
--    Se o e-mail estiver em admin_emails, também ganha 'admin'.
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, city, state)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buyer') ON CONFLICT DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;

-- -------------------------------------------------------------
-- 3. Aprovar um box pelo admin concede o papel de VENDEDOR.
--    Rejeitar/voltar para pendente revoga (a menos que o usuário
--    possua outro box aprovado).
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_seller_on_box_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aprovado' AND OLD.status IS DISTINCT FROM 'aprovado' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.owner_id, 'seller') ON CONFLICT DO NOTHING;
  ELSIF NEW.status IN ('pendente', 'rejeitado') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.boxes
      WHERE owner_id = NEW.owner_id AND status = 'aprovado' AND id <> NEW.id
    ) THEN
      DELETE FROM public.user_roles WHERE user_id = NEW.owner_id AND role = 'seller';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS boxes_sync_seller ON public.boxes;
CREATE TRIGGER boxes_sync_seller
  AFTER UPDATE OF status ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION public.sync_seller_on_box_status();

-- Excluir um box aprovado também revoga o papel de vendedor
-- (a menos que o usuário tenha outro box aprovado).
CREATE OR REPLACE FUNCTION public.revoke_seller_on_box_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.boxes
    WHERE owner_id = OLD.owner_id AND status = 'aprovado' AND id <> OLD.id
  ) THEN
    DELETE FROM public.user_roles WHERE user_id = OLD.owner_id AND role = 'seller';
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS boxes_revoke_seller ON public.boxes;
CREATE TRIGGER boxes_revoke_seller
  AFTER DELETE ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION public.revoke_seller_on_box_delete();

-- -------------------------------------------------------------
-- 4. RLS: ninguém se auto-promove via API.
--    Só o sistema (triggers, service_role) ou ADMINISTRADORES
--    podem criar/alterar/remover papéis.
-- -------------------------------------------------------------
DROP POLICY IF EXISTS roles_insert_own_nonadmin ON public.user_roles;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY roles_admin_write ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- -------------------------------------------------------------
-- 5. Backfill para contas existentes
-- -------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'buyer' FROM auth.users
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT owner_id, 'seller' FROM public.boxes WHERE status = 'aprovado'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'admin' FROM auth.users au
JOIN public.admin_emails ae ON lower(ae.email) = lower(au.email)
ON CONFLICT DO NOTHING;