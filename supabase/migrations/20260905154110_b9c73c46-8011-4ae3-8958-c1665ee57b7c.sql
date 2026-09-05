-- 1. Dados fiscais reutilizáveis do comprador
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tax_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS state_registration text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cep text NOT NULL DEFAULT '';

-- 2. NCM do produto
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ncm text NOT NULL DEFAULT '';

-- 3. Snapshot fiscal do comprador no pedido
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_fiscal jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.freeze_order_buyer_fiscal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_setting('app.bypass_transition', true) = 'on' THEN RETURN NEW; END IF;
  NEW.buyer_fiscal := OLD.buyer_fiscal;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.freeze_order_buyer_fiscal() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS orders_freeze_buyer_fiscal ON public.orders;
CREATE TRIGGER orders_freeze_buyer_fiscal BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.freeze_order_buyer_fiscal();

-- 4. place_order com dados fiscais obrigatórios do comprador
DROP FUNCTION IF EXISTS public.place_order(uuid, text, jsonb);
CREATE OR REPLACE FUNCTION public.place_order(_box_id uuid, _notes text, _items jsonb, _buyer_fiscal jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order_id uuid; _item jsonb; _product products%ROWTYPE; _qty int;
  _total numeric := 0; _rate numeric; _commission numeric;
  _legal text; _tax text; _ie text; _addr text; _cep text; _city text; _uf text; _fiscal jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para finalizar o pedido'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Carrinho vazio'; END IF;

  -- Dados fiscais do comprador (obrigatórios para emissão de NF-e)
  _legal := trim(coalesce(_buyer_fiscal->>'legal_name', ''));
  _tax := regexp_replace(coalesce(_buyer_fiscal->>'tax_id', ''), '\D', '', 'g');
  _ie := regexp_replace(coalesce(_buyer_fiscal->>'state_registration', ''), '\D', '', 'g');
  _addr := trim(coalesce(_buyer_fiscal->>'address', ''));
  _cep := regexp_replace(coalesce(_buyer_fiscal->>'cep', ''), '\D', '', 'g');
  _city := trim(coalesce(_buyer_fiscal->>'city', ''));
  _uf := upper(trim(coalesce(_buyer_fiscal->>'state', '')));
  IF length(_legal) < 3 THEN RAISE EXCEPTION 'Informe o nome completo ou razão social para a nota fiscal'; END IF;
  IF length(_tax) = 11 THEN
    IF NOT public.is_valid_cpf(_tax) THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  ELSIF length(_tax) = 14 THEN
    IF NOT public.is_valid_cnpj(_tax) THEN RAISE EXCEPTION 'CNPJ inválido'; END IF;
  ELSE
    RAISE EXCEPTION 'Informe um CPF ou CNPJ válido para a nota fiscal';
  END IF;
  IF length(_addr) < 5 THEN RAISE EXCEPTION 'Informe o endereço completo de faturamento'; END IF;
  IF length(_cep) <> 8 THEN RAISE EXCEPTION 'Informe um CEP válido (8 dígitos)'; END IF;
  IF length(_city) < 2 OR length(_uf) <> 2 THEN RAISE EXCEPTION 'Informe cidade e UF de faturamento'; END IF;
  IF _ie <> '' AND NOT public.is_valid_ie(_ie, _uf) THEN RAISE EXCEPTION 'Inscrição Estadual inválida para a UF %', _uf; END IF;
  _fiscal := jsonb_build_object('legal_name', _legal, 'tax_id', _tax, 'state_registration', _ie,
                                'address', _addr, 'cep', _cep, 'city', _city, 'state', _uf);

  -- Reaproveita para as próximas compras
  UPDATE profiles SET legal_name = _legal, tax_id = _tax, state_registration = _ie, address = _addr, cep = _cep,
                      city = COALESCE(NULLIF(_city,''), city), state = COALESCE(NULLIF(_uf,''), state)
   WHERE id = auth.uid();

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    IF _qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO _product FROM products WHERE id = (_item->>'product_id')::uuid AND box_id = _box_id AND active = true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto indisponível: %', COALESCE(_item->>'product_name', ''); END IF;
    IF _product.stock < _qty THEN RAISE EXCEPTION 'Estoque insuficiente para "%" (disponível: %)', _product.name, _product.stock; END IF;
    UPDATE products SET stock = stock - _qty WHERE id = _product.id;
    _total := _total + _product.price * _qty;
  END LOOP;

  SELECT public.plan_commission_rate(b.plan) INTO _rate FROM boxes b WHERE b.id = _box_id;
  _rate := COALESCE(_rate, 0.08);
  _commission := round(_total * _rate, 2);

  INSERT INTO orders (buyer_id, box_id, total, notes, commission_rate, commission_amount, net_amount, buyer_fiscal)
  VALUES (auth.uid(), _box_id, _total, COALESCE(_notes, ''), _rate, _commission, _total - _commission, _fiscal)
  RETURNING id INTO _order_id;

  INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, image_url)
  SELECT _order_id, p.id, p.name, p.price, (i->>'quantity')::int, p.images[1]
  FROM jsonb_array_elements(_items) i JOIN products p ON p.id = (i->>'product_id')::uuid;

  RETURN _order_id;
END; $$;
REVOKE ALL ON FUNCTION public.place_order(uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, text, jsonb, jsonb) TO authenticated;

-- 5. Notas fiscais
DO $$ BEGIN
  CREATE TYPE public.nfe_status AS ENUM ('pendente_emissao', 'processando_sefaz', 'autorizada', 'rejeitada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  box_id uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  status public.nfe_status NOT NULL DEFAULT 'pendente_emissao',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  series text NOT NULL DEFAULT '1',
  number text NOT NULL DEFAULT '',
  access_key text NOT NULL DEFAULT '',
  cfop text NOT NULL DEFAULT '5102',
  rejection_reason text NOT NULL DEFAULT '',
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_box_idx ON public.invoices (box_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_read ON public.invoices FOR SELECT TO authenticated
  USING (public.can_access_order(order_id));
CREATE POLICY invoices_insert_owner ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.is_box_owner(box_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY invoices_update_owner ON public.invoices FOR UPDATE TO authenticated
  USING (public.is_box_owner(box_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_box_owner(box_id) OR public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS invoices_updated_at ON public.invoices;
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Regras de estado da NF-e
CREATE OR REPLACE FUNCTION public.validate_invoice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ostatus order_status; _obox uuid;
BEGIN
  SELECT status, box_id INTO _ostatus, _obox FROM orders WHERE id = NEW.order_id;
  IF _obox IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  NEW.box_id := _obox;
  IF TG_OP = 'INSERT' THEN
    IF _ostatus NOT IN ('pago_em_custodia', 'enviado', 'aguardando_confirmacao', 'concluido_liquidado') THEN
      RAISE EXCEPTION 'A NF-e só pode ser emitida para pedidos pagos ou concluídos';
    END IF;
    IF NEW.status NOT IN ('pendente_emissao', 'processando_sefaz') THEN NEW.status := 'pendente_emissao'; END IF;
    RETURN NEW;
  END IF;

  NEW.order_id := OLD.order_id;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF OLD.status IN ('pendente_emissao', 'rejeitada') AND NEW.status = 'processando_sefaz' THEN
    NEW.rejection_reason := '';
  ELSIF OLD.status = 'processando_sefaz' AND NEW.status = 'autorizada' THEN
    NEW.access_key := regexp_replace(coalesce(NEW.access_key, ''), '\D', '', 'g');
    IF length(NEW.access_key) <> 44 THEN RAISE EXCEPTION 'Informe a chave de acesso da NF-e (44 dígitos)'; END IF;
    IF trim(coalesce(NEW.number, '')) = '' THEN RAISE EXCEPTION 'Informe o número da NF-e'; END IF;
    NEW.issued_at := now();
  ELSIF OLD.status = 'processando_sefaz' AND NEW.status = 'rejeitada' THEN
    IF length(trim(coalesce(NEW.rejection_reason, ''))) < 5 THEN RAISE EXCEPTION 'Informe o motivo da rejeição pela SEFAZ'; END IF;
  ELSIF OLD.status = 'processando_sefaz' AND NEW.status = 'pendente_emissao' THEN
    NULL; -- desistiu do envio
  ELSIF OLD.status = 'autorizada' AND NEW.status = 'cancelada' THEN
    IF length(trim(coalesce(NEW.rejection_reason, ''))) < 5 THEN RAISE EXCEPTION 'Informe a justificativa do cancelamento'; END IF;
  ELSE
    RAISE EXCEPTION 'Transição de nota de % para % não permitida', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.validate_invoice() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS invoices_validate ON public.invoices;
CREATE TRIGGER invoices_validate BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.validate_invoice();