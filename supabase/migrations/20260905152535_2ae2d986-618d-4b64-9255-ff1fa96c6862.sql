-- 1. Novo estado SUSPENSO
ALTER TYPE public.box_status ADD VALUE IF NOT EXISTS 'suspenso';

-- 2. Auditoria da análise
ALTER TABLE public.boxes
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

-- 3. Tabela de notificações do sistema
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_read_own ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Só o admin altera status/nota/auditoria; o vendedor edita os dados
--    e, se estava rejeitado, reenvia (volta a PENDENTE).
CREATE OR REPLACE FUNCTION public.protect_box_review_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_admin boolean := public.has_role(auth.uid(), 'admin');
BEGIN
  IF _is_admin THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.review_note IS DISTINCT FROM OLD.review_note THEN
      NEW.reviewed_at := now();
      NEW.reviewed_by := auth.uid();
    END IF;
    RETURN NEW;
  END IF;

  -- Não-admin: nunca altera auditoria nem nota
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.review_note := OLD.review_note;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Único caminho permitido ao vendedor: rejeitado -> pendente (reenvio)
    IF NOT (OLD.status = 'rejeitado' AND NEW.status = 'pendente') THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS boxes_protect_review ON public.boxes;
CREATE TRIGGER boxes_protect_review
  BEFORE UPDATE ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION public.protect_box_review_fields();

-- 5. Papel de vendedor: concedido ao aprovar, revogado em qualquer outro estado
CREATE OR REPLACE FUNCTION public.sync_seller_on_box_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aprovado' AND OLD.status IS DISTINCT FROM 'aprovado' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.owner_id, 'seller') ON CONFLICT DO NOTHING;
  ELSIF NEW.status <> 'aprovado' AND OLD.status = 'aprovado' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.boxes
      WHERE owner_id = NEW.owner_id AND status = 'aprovado' AND id <> NEW.id
    ) THEN
      DELETE FROM public.user_roles WHERE user_id = NEW.owner_id AND role = 'seller';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- 6. Notificação ao vendedor a cada decisão do admin
CREATE OR REPLACE FUNCTION public.notify_box_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _title text; _body text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status::text = 'aprovado' THEN
    _title := 'Seu box "' || NEW.name || '" foi aprovado!';
    _body := 'Parabéns! Seu box já está visível no marketplace e você pode cadastrar e vender produtos.';
  ELSIF NEW.status::text = 'rejeitado' THEN
    _title := 'Seu box "' || NEW.name || '" não foi aprovado';
    _body := COALESCE(NULLIF(NEW.review_note, ''), 'Revise os dados enviados e reenvie para nova análise.');
  ELSIF NEW.status::text = 'suspenso' THEN
    _title := 'Seu box "' || NEW.name || '" foi suspenso';
    _body := COALESCE(NULLIF(NEW.review_note, ''), 'Entre em contato com a equipe do Cultiva Vale para regularizar.');
  ELSIF NEW.status::text = 'pendente' AND OLD.status::text <> 'rejeitado' THEN
    _title := 'Seu box "' || NEW.name || '" voltou para análise';
    _body := COALESCE(NULLIF(NEW.review_note, ''), 'A equipe do Cultiva Vale está reavaliando seu cadastro.');
  ELSE
    RETURN NEW; -- reenvio pelo próprio vendedor não gera aviso
  END IF;
  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (NEW.owner_id, _title, _body, '/painel');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS boxes_notify_status ON public.boxes;
CREATE TRIGGER boxes_notify_status
  AFTER UPDATE OF status ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION public.notify_box_status_change();

-- 7. Realtime para o sino de notificações
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;