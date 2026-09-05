ALTER TABLE public.boxes
  ADD COLUMN IF NOT EXISTS logistics text[] NOT NULL DEFAULT ARRAY['retirada']::text[];

ALTER TABLE public.boxes
  ADD CONSTRAINT boxes_logistics_valid
  CHECK (
    cardinality(logistics) >= 1
    AND logistics <@ ARRAY['entrega_regional','retirada','envio_nacional']::text[]
  );

CREATE INDEX IF NOT EXISTS boxes_logistics_gin ON public.boxes USING gin (logistics);
CREATE INDEX IF NOT EXISTS boxes_city_idx ON public.boxes (city);
CREATE INDEX IF NOT EXISTS products_price_idx ON public.products (price);
CREATE INDEX IF NOT EXISTS products_rating_idx ON public.products (rating_avg DESC NULLS LAST);