CREATE OR REPLACE FUNCTION public.plan_product_limit(_plan box_plan)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _plan WHEN 'basico' THEN 10 ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.enforce_product_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _limit integer; _count integer; _plan box_plan;
BEGIN
  IF NEW.active IS DISTINCT FROM true THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.active = true AND OLD.box_id = NEW.box_id THEN RETURN NEW; END IF;
  SELECT plan INTO _plan FROM boxes WHERE id = NEW.box_id;
  _limit := public.plan_product_limit(_plan);
  IF _limit IS NULL THEN RETURN NEW; END IF;
  SELECT count(*) INTO _count FROM products WHERE box_id = NEW.box_id AND active = true AND id <> NEW.id;
  IF _count >= _limit THEN
    RAISE EXCEPTION 'O Plano Básico permite até % produtos ativos. Oculte um produto ou faça upgrade do plano.', _limit;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS products_enforce_limit ON public.products;
CREATE TRIGGER products_enforce_limit BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_product_limit();