CREATE TYPE public.box_plan AS ENUM ('basico', 'intermediario', 'premium');

ALTER TABLE public.boxes ADD COLUMN plan public.box_plan NOT NULL DEFAULT 'basico';

CREATE OR REPLACE FUNCTION public.plan_commission_rate(_plan public.box_plan)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan WHEN 'premium' THEN 0.03 WHEN 'intermediario' THEN 0.05 ELSE 0.08 END::numeric
$$;

ALTER TABLE public.orders
  ADD COLUMN commission_rate numeric NOT NULL DEFAULT 0.08,
  ADD COLUMN commission_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN net_amount numeric NOT NULL DEFAULT 0;

UPDATE public.orders o
SET commission_rate = public.plan_commission_rate(b.plan),
    commission_amount = round(o.total * public.plan_commission_rate(b.plan), 2),
    net_amount = o.total - round(o.total * public.plan_commission_rate(b.plan), 2)
FROM public.boxes b WHERE b.id = o.box_id;

-- vendedores não podem alterar o plano do próprio box
CREATE OR REPLACE FUNCTION public.protect_box_plan()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.plan IS DISTINCT FROM OLD.plan AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.plan := OLD.plan;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER boxes_protect_plan BEFORE UPDATE ON public.boxes
FOR EACH ROW EXECUTE FUNCTION public.protect_box_plan();

CREATE OR REPLACE FUNCTION public.place_order(_box_id uuid, _notes text, _items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _order_id uuid;
  _item jsonb;
  _product products%ROWTYPE;
  _qty int;
  _total numeric := 0;
  _rate numeric;
  _commission numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para finalizar o pedido';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := COALESCE((_item->>'quantity')::int, 0);
    IF _qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
    SELECT * INTO _product FROM products
      WHERE id = (_item->>'product_id')::uuid AND box_id = _box_id AND active = true
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto indisponível: %', COALESCE(_item->>'product_name', '');
    END IF;
    IF _product.stock < _qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para "%" (disponível: %)', _product.name, _product.stock;
    END IF;
    UPDATE products SET stock = stock - _qty WHERE id = _product.id;
    _total := _total + _product.price * _qty;
  END LOOP;

  SELECT public.plan_commission_rate(b.plan) INTO _rate FROM boxes b WHERE b.id = _box_id;
  _rate := COALESCE(_rate, 0.08);
  _commission := round(_total * _rate, 2);

  INSERT INTO orders (buyer_id, box_id, total, notes, commission_rate, commission_amount, net_amount)
  VALUES (auth.uid(), _box_id, _total, COALESCE(_notes, ''), _rate, _commission, _total - _commission)
  RETURNING id INTO _order_id;

  INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, image_url)
  SELECT _order_id, p.id, p.name, p.price, (i->>'quantity')::int, p.images[1]
  FROM jsonb_array_elements(_items) i
  JOIN products p ON p.id = (i->>'product_id')::uuid;

  RETURN _order_id;
END;
$function$;