ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0 AND low_stock_threshold <= 100000);

CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (_owner, _title, _body, '/painel-vendedor/estoque');
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.notify_low_stock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS products_notify_low_stock ON public.products;
CREATE TRIGGER products_notify_low_stock
  AFTER UPDATE OF stock ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();