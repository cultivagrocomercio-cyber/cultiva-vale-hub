-- 1. Novo tipo de status
CREATE TYPE public.order_status_new AS ENUM (
  'pendente_pagamento', 'pago_em_custodia', 'enviado', 'aguardando_confirmacao', 'concluido_liquidado', 'em_disputa', 'cancelado'
);

ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT;
DROP TRIGGER IF EXISTS orders_restore_stock ON public.orders;
ALTER TABLE public.orders
  ALTER COLUMN status TYPE public.order_status_new
  USING (CASE status::text
    WHEN 'pendente' THEN 'pendente_pagamento'
    WHEN 'confirmado' THEN 'pago_em_custodia'
    WHEN 'entregue' THEN 'concluido_liquidado'
    ELSE 'cancelado' END)::public.order_status_new;
DROP TYPE public.order_status;
ALTER TYPE public.order_status_new RENAME TO order_status;
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'pendente_pagamento';
CREATE TRIGGER orders_restore_stock AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_cancel();

-- 2. Novas colunas
ALTER TABLE public.orders
  ADD COLUMN payment_proof_url text,
  ADD COLUMN paid_at timestamptz,
  ADD COLUMN shipped_at timestamptz,
  ADD COLUMN tracking_code text NOT NULL DEFAULT '',
  ADD COLUMN shipping_note text NOT NULL DEFAULT '',
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN disputed_at timestamptz,
  ADD COLUMN dispute_reason text NOT NULL DEFAULT '',
  ADD COLUMN resolution_note text NOT NULL DEFAULT '';

UPDATE public.orders SET completed_at = updated_at WHERE status = 'concluido_liquidado';
UPDATE public.orders SET paid_at = updated_at WHERE status = 'pago_em_custodia';

-- 3. Admin acessa todos os pedidos
CREATE OR REPLACE FUNCTION public.can_access_order(_order_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.boxes b ON b.id = o.box_id
    WHERE o.id = _order_id AND (o.buyer_id = auth.uid() OR b.owner_id = auth.uid())
  )
$$;

CREATE POLICY orders_admin_read ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY orders_admin_update ON public.orders FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Máquina de estados
CREATE OR REPLACE FUNCTION public.validate_order_transition()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _is_buyer boolean;
  _is_seller boolean;
BEGIN
  IF current_setting('app.bypass_transition', true) = 'on' THEN
    RETURN NEW;
  END IF;

  _is_admin := public.has_role(_uid, 'admin');
  _is_buyer := (_uid = OLD.buyer_id);
  _is_seller := public.is_box_owner(OLD.box_id);

  -- Campos financeiros nunca mudam após a criação
  NEW.total := OLD.total; NEW.commission_rate := OLD.commission_rate;
  NEW.commission_amount := OLD.commission_amount; NEW.net_amount := OLD.net_amount;
  NEW.buyer_id := OLD.buyer_id; NEW.box_id := OLD.box_id;

  IF NEW.status = OLD.status THEN
    IF NEW.payment_proof_url IS DISTINCT FROM OLD.payment_proof_url
       AND NOT (_is_buyer AND OLD.status = 'pendente_pagamento') AND NOT _is_admin THEN
      RAISE EXCEPTION 'Só o comprador pode enviar o comprovante enquanto o pedido aguarda pagamento';
    END IF;
    IF (NEW.tracking_code IS DISTINCT FROM OLD.tracking_code OR NEW.shipping_note IS DISTINCT FROM OLD.shipping_note)
       AND NOT _is_seller AND NOT _is_admin THEN
      RAISE EXCEPTION 'Só o vendedor pode alterar os dados de envio';
    END IF;
    RETURN NEW;
  END IF;

  -- Transições
  IF OLD.status = 'pendente_pagamento' AND NEW.status = 'pago_em_custodia' THEN
    IF NOT _is_admin THEN RAISE EXCEPTION 'Apenas a plataforma confirma o pagamento em custódia'; END IF;
    NEW.paid_at := now();
  ELSIF OLD.status = 'pendente_pagamento' AND NEW.status = 'cancelado' THEN
    IF NOT (_is_buyer OR _is_seller OR _is_admin) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  ELSIF OLD.status = 'pago_em_custodia' AND NEW.status = 'enviado' THEN
    IF NOT (_is_seller OR _is_admin) THEN RAISE EXCEPTION 'Apenas o vendedor informa o envio'; END IF;
    IF coalesce(NEW.tracking_code, '') = '' AND coalesce(NEW.shipping_note, '') = '' THEN
      RAISE EXCEPTION 'Informe o código de rastreio ou como será a entrega';
    END IF;
    NEW.shipped_at := now();
  ELSIF OLD.status = 'enviado' AND NEW.status = 'aguardando_confirmacao' THEN
    IF NOT (_is_seller OR _is_admin) THEN RAISE EXCEPTION 'Apenas o vendedor informa a entrega'; END IF;
    NEW.delivered_at := now();
  ELSIF OLD.status IN ('enviado', 'aguardando_confirmacao') AND NEW.status = 'concluido_liquidado' THEN
    IF NOT (_is_buyer OR _is_admin) THEN RAISE EXCEPTION 'Apenas o comprador confirma o recebimento'; END IF;
    NEW.completed_at := now();
  ELSIF OLD.status IN ('enviado', 'aguardando_confirmacao') AND NEW.status = 'em_disputa' THEN
    IF NOT (_is_buyer OR _is_admin) THEN RAISE EXCEPTION 'Apenas o comprador abre disputa'; END IF;
    IF length(trim(coalesce(NEW.dispute_reason, ''))) < 5 THEN RAISE EXCEPTION 'Descreva o motivo da disputa'; END IF;
    NEW.disputed_at := now();
  ELSIF OLD.status = 'em_disputa' AND NEW.status IN ('concluido_liquidado', 'cancelado') THEN
    IF NOT _is_admin THEN RAISE EXCEPTION 'Apenas a plataforma resolve disputas'; END IF;
    IF NEW.status = 'concluido_liquidado' THEN NEW.completed_at := now(); END IF;
  ELSIF _is_admin AND OLD.status IN ('pago_em_custodia') AND NEW.status = 'cancelado' THEN
    NULL; -- estorno pela plataforma
  ELSE
    RAISE EXCEPTION 'Transição de % para % não permitida', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER orders_validate_transition BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_transition();

-- 5. Liberação automática após 7 dias do envio
CREATE OR REPLACE FUNCTION public.release_due_orders()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _n integer;
BEGIN
  PERFORM set_config('app.bypass_transition', 'on', true);
  UPDATE public.orders
     SET status = 'concluido_liquidado', completed_at = now()
   WHERE status IN ('enviado', 'aguardando_confirmacao')
     AND shipped_at IS NOT NULL AND shipped_at + interval '7 days' <= now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  PERFORM set_config('app.bypass_transition', 'off', true);
  RETURN _n;
END; $$;
REVOKE ALL ON FUNCTION public.release_due_orders() FROM public;
GRANT EXECUTE ON FUNCTION public.release_due_orders() TO authenticated, service_role;