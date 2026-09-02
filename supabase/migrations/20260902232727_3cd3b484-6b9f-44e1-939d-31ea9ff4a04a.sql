CREATE OR REPLACE FUNCTION public.place_order(_box_id uuid, _notes text, _items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order_id uuid;
  _item jsonb;
  _product products%ROWTYPE;
  _qty int;
  _total numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para finalizar o pedido';
  END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio';
  END IF;

  -- Valida e reserva estoque
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

  INSERT INTO orders (buyer_id, box_id, total, notes)
  VALUES (auth.uid(), _box_id, _total, COALESCE(_notes, ''))
  RETURNING id INTO _order_id;

  INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, image_url)
  SELECT _order_id, p.id, p.name, p.price, (i->>'quantity')::int, p.images[1]
  FROM jsonb_array_elements(_items) i
  JOIN products p ON p.id = (i->>'product_id')::uuid;

  RETURN _order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, text, jsonb) TO authenticated;

-- Devolve o estoque quando um pedido é cancelado
CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelado' AND OLD.status <> 'cancelado' THEN
    UPDATE products p SET stock = p.stock + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_restore_stock ON public.orders;
CREATE TRIGGER orders_restore_stock
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_cancel();