CREATE TYPE public.review_status AS ENUM ('aprovada', 'oculta');

ALTER TABLE public.reviews
  ADD COLUMN product_rating integer,
  ADD COLUMN status public.review_status NOT NULL DEFAULT 'aprovada',
  ADD COLUMN reported boolean NOT NULL DEFAULT false,
  ADD COLUMN report_reason text NOT NULL DEFAULT '',
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN reviewed_by uuid;
UPDATE public.reviews SET product_rating = rating WHERE product_rating IS NULL;
ALTER TABLE public.reviews ALTER COLUMN product_rating SET NOT NULL;
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_product_rating_check CHECK (product_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT reviews_comment_len_check CHECK (length(trim(comment)) = 0 OR length(trim(comment)) BETWEEN 10 AND 500);

ALTER TABLE public.boxes ADD COLUMN rating_avg numeric(3,2), ADD COLUMN rating_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN rating_avg numeric(3,2), ADD COLUMN rating_count integer NOT NULL DEFAULT 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT ON public.reviews TO anon;
GRANT ALL ON public.reviews TO service_role;

DROP POLICY IF EXISTS reviews_public_read ON public.reviews;
DROP POLICY IF EXISTS reviews_insert_buyer ON public.reviews;
CREATE POLICY reviews_public_read ON public.reviews FOR SELECT TO anon USING (status = 'aprovada');
CREATE POLICY reviews_auth_read ON public.reviews FOR SELECT TO authenticated
  USING (status = 'aprovada' OR auth.uid() = buyer_id OR public.is_box_owner(box_id) OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY reviews_insert_buyer ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = reviews.order_id AND o.buyer_id = auth.uid() AND o.box_id = reviews.box_id
      AND o.status = 'concluido_liquidado'));
CREATE POLICY reviews_admin_update ON public.reviews FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY reviews_admin_delete ON public.reviews FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Recalcula médias do box e dos produtos do pedido (somente avaliações aprovadas)
CREATE OR REPLACE FUNCTION public.recompute_ratings(_box_id uuid, _order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.boxes b SET
    rating_avg = s.avg, rating_count = s.n
  FROM (SELECT round(avg(rating)::numeric, 2) AS avg, count(*)::int AS n FROM public.reviews WHERE box_id = _box_id AND status = 'aprovada') s
  WHERE b.id = _box_id;

  UPDATE public.products p SET
    rating_avg = s.avg, rating_count = s.n
  FROM (
    SELECT oi.product_id, round(avg(r.product_rating)::numeric, 2) AS avg, count(DISTINCT r.id)::int AS n
    FROM public.order_items oi
    JOIN public.reviews r ON r.order_id = oi.order_id AND r.status = 'aprovada'
    WHERE oi.product_id IN (SELECT product_id FROM public.order_items WHERE order_id = _order_id AND product_id IS NOT NULL)
    GROUP BY oi.product_id
  ) s
  WHERE p.id = s.product_id;

  -- Produtos do pedido sem nenhuma avaliação aprovada restante
  UPDATE public.products p SET rating_avg = NULL, rating_count = 0
  WHERE p.id IN (SELECT product_id FROM public.order_items WHERE order_id = _order_id AND product_id IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM public.order_items oi JOIN public.reviews r ON r.order_id = oi.order_id AND r.status = 'aprovada'
      WHERE oi.product_id = p.id);
END; $$;
REVOKE ALL ON FUNCTION public.recompute_ratings(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reviews_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_ratings(OLD.box_id, OLD.order_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_ratings(NEW.box_id, NEW.order_id);
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.reviews_after_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reviews_recompute AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_after_change();

-- Somente admin altera situação/moderação; comprador não edita a avaliação
CREATE OR REPLACE FUNCTION public.protect_review_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.order_id := OLD.order_id; NEW.box_id := OLD.box_id; NEW.buyer_id := OLD.buyer_id;
  NEW.rating := OLD.rating; NEW.product_rating := OLD.product_rating; NEW.comment := OLD.comment;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.reviewed_at := now(); NEW.reviewed_by := auth.uid();
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.protect_review_fields() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER reviews_protect BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.protect_review_fields();

-- Denúncia de comentário por usuário logado
CREATE OR REPLACE FUNCTION public.report_review(_review_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para denunciar'; END IF;
  IF length(trim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'Descreva o motivo da denúncia'; END IF;
  UPDATE public.reviews SET reported = true, report_reason = left(trim(_reason), 300) WHERE id = _review_id;
END; $$;
REVOKE ALL ON FUNCTION public.report_review(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_review(uuid, text) TO authenticated;

-- Popula médias existentes
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT DISTINCT box_id, order_id FROM public.reviews LOOP
    PERFORM public.recompute_ratings(r.box_id, r.order_id);
  END LOOP;
END $$;