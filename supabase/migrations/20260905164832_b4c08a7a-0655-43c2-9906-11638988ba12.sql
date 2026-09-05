ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'geral';
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY,
  email_orders boolean NOT NULL DEFAULT true,
  email_invoices boolean NOT NULL DEFAULT true,
  email_reviews boolean NOT NULL DEFAULT true,
  email_stock_finance boolean NOT NULL DEFAULT true,
  whatsapp_updates boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs_own_select" ON public.notification_preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "prefs_own_insert" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "prefs_own_update" ON public.notification_preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "prefs_own_delete" ON public.notification_preferences FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;

-- Helper interno
CREATE OR REPLACE FUNCTION public.push_notification(_user uuid, _kind text, _title text, _body text, _link text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, kind, title, body, link) VALUES (_user, _kind, _title, _body, coalesce(_link, ''));
$$;
REVOKE ALL ON FUNCTION public.push_notification(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Pedido criado: comprador + vendedor
CREATE OR REPLACE FUNCTION public.notify_order_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _box text; _short text := left(NEW.id::text, 8);
BEGIN
  SELECT owner_id, name INTO _owner, _box FROM public.boxes WHERE id = NEW.box_id;
  PERFORM public.push_notification(NEW.buyer_id, 'pedido',
    'Pedido #' || _short || ' realizado',
    'Seu pedido no box ' || coalesce(_box,'') || ' foi aberto. Combine o pagamento pelo chat do pedido e envie o comprovante para seguir.',
    '/meus-pedidos');
  IF _owner IS NOT NULL THEN
    PERFORM public.push_notification(_owner, 'pedido',
      'Novo pedido recebido #' || _short,
      'Você recebeu um novo pedido no valor de R$ ' || to_char(NEW.total, 'FM999G999G990D00') || '. Inicie a separação da mercadoria.',
      '/painel');
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_order_created() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS orders_notify_created ON public.orders;
CREATE TRIGGER orders_notify_created AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_created();

-- Transições de status do pedido
CREATE OR REPLACE FUNCTION public.notify_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _short text := left(NEW.id::text, 8);
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT owner_id INTO _owner FROM public.boxes WHERE id = NEW.box_id;
  IF NEW.status = 'pago_em_custodia' THEN
    PERFORM public.push_notification(NEW.buyer_id, 'pagamento', 'Pagamento confirmado — pedido #' || _short,
      'Seu pagamento foi recebido em custódia. O vendedor já pode iniciar a separação.', '/meus-pedidos');
    IF _owner IS NOT NULL THEN
      PERFORM public.push_notification(_owner, 'pagamento', 'Pagamento em custódia — pedido #' || _short,
        'O valor foi confirmado pela plataforma. Separe a mercadoria e informe o envio.', '/painel');
    END IF;
  ELSIF NEW.status = 'enviado' THEN
    PERFORM public.push_notification(NEW.buyer_id, 'envio', 'Pedido #' || _short || ' enviado / pronto para retirada',
      CASE WHEN coalesce(NEW.tracking_code,'') <> '' THEN 'Código de rastreio: ' || NEW.tracking_code
           ELSE coalesce(NULLIF(NEW.shipping_note,''), 'Combine os detalhes da entrega com o vendedor.') END,
      '/meus-pedidos');
  ELSIF NEW.status = 'aguardando_confirmacao' THEN
    PERFORM public.push_notification(NEW.buyer_id, 'envio', 'Pedido #' || _short || ' entregue?',
      'O vendedor informou a entrega. Confirme o recebimento para liberar o pagamento.', '/meus-pedidos');
  ELSIF NEW.status = 'concluido_liquidado' THEN
    PERFORM public.push_notification(NEW.buyer_id, 'pedido', 'Pedido #' || _short || ' concluído — avalie sua compra',
      'Obrigado! Conte como foi: avalie o produto e o atendimento do box.', '/meus-pedidos');
    IF _owner IS NOT NULL THEN
      PERFORM public.push_notification(_owner, 'saldo', 'Saldo liberado — pedido #' || _short,
        'R$ ' || to_char(NEW.net_amount, 'FM999G999G990D00') || ' saíram da custódia para o seu saldo disponível.', '/painel');
    END IF;
  ELSIF NEW.status = 'em_disputa' AND _owner IS NOT NULL THEN
    PERFORM public.push_notification(_owner, 'pedido', 'Disputa aberta — pedido #' || _short,
      coalesce(NULLIF(NEW.dispute_reason,''), 'O comprador abriu uma disputa. A plataforma fará a mediação.'), '/painel');
  ELSIF NEW.status = 'cancelado' THEN
    PERFORM public.push_notification(NEW.buyer_id, 'pedido', 'Pedido #' || _short || ' cancelado',
      'O pedido foi cancelado e o estoque devolvido ao vendedor.', '/meus-pedidos');
    IF _owner IS NOT NULL THEN
      PERFORM public.push_notification(_owner, 'pedido', 'Pedido #' || _short || ' cancelado', 'O estoque dos itens foi devolvido automaticamente.', '/painel');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_order_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS orders_notify_status ON public.orders;
CREATE TRIGGER orders_notify_status AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_status();

-- NF-e autorizada: comprador
CREATE OR REPLACE FUNCTION public.notify_invoice_authorized()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _buyer uuid;
BEGIN
  IF NEW.status <> 'autorizada' OR OLD.status = 'autorizada' THEN RETURN NEW; END IF;
  SELECT buyer_id INTO _buyer FROM public.orders WHERE id = NEW.order_id;
  IF _buyer IS NOT NULL THEN
    PERFORM public.push_notification(_buyer, 'nfe', 'NF-e disponível — nº ' || coalesce(NEW.number,''),
      'A nota fiscal do seu pedido foi autorizada. Baixe o DANFE (PDF) e o XML na tela do pedido.', '/meus-pedidos');
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_invoice_authorized() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS invoices_notify_authorized ON public.invoices;
CREATE TRIGGER invoices_notify_authorized AFTER UPDATE OF status ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.notify_invoice_authorized();

-- Nova avaliação: vendedor
CREATE OR REPLACE FUNCTION public.notify_review_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT owner_id INTO _owner FROM public.boxes WHERE id = NEW.box_id;
  IF _owner IS NOT NULL THEN
    PERFORM public.push_notification(_owner, 'avaliacao', 'Nova avaliação recebida: ' || repeat('★', NEW.rating),
      CASE WHEN coalesce(NEW.comment,'') <> '' THEN left(NEW.comment, 140) ELSE 'Um comprador avaliou o seu box e o produto.' END,
      '/painel');
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_review_created() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS reviews_notify_created ON public.reviews;
CREATE TRIGGER reviews_notify_created AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.notify_review_created();

-- Tipos nos avisos já existentes
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid; _title text; _body text;
BEGIN
  IF NEW.stock >= OLD.stock THEN RETURN NEW; END IF;
  SELECT owner_id INTO _owner FROM public.boxes WHERE id = NEW.box_id;
  IF _owner IS NULL THEN RETURN NEW; END IF;
  IF NEW.stock = 0 AND OLD.stock > 0 THEN
    _title := 'Produto esgotado: ' || NEW.name;
    _body := 'O estoque chegou a zero e o produto foi marcado como Esgotado. Reponha o saldo para voltar a vender.';
  ELSIF NEW.low_stock_threshold > 0 AND NEW.stock > 0 AND NEW.stock <= NEW.low_stock_threshold AND OLD.stock > NEW.low_stock_threshold THEN
    _title := 'Estoque baixo: ' || NEW.name;
    _body := 'Restam apenas ' || NEW.stock || ' unidade(s), abaixo do alerta mínimo de ' || NEW.low_stock_threshold || '.';
  ELSE
    RETURN NEW;
  END IF;
  PERFORM public.push_notification(_owner, 'estoque', _title, _body, '/painel-vendedor/estoque');
  RETURN NEW;
END; $$;

UPDATE public.notifications SET kind = 'box' WHERE kind = 'geral' AND link = '/painel' AND title LIKE 'Seu box%';
UPDATE public.notifications SET kind = 'estoque' WHERE kind = 'geral' AND link = '/painel-vendedor/estoque';