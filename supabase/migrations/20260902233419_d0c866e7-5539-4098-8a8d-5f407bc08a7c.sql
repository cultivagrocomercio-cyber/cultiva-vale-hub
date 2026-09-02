CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  box_id uuid REFERENCES public.boxes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT favorites_target CHECK ((product_id IS NOT NULL) <> (box_id IS NOT NULL))
);
CREATE UNIQUE INDEX favorites_user_product_uq ON public.favorites(user_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX favorites_user_box_uq ON public.favorites(user_id, box_id) WHERE box_id IS NOT NULL;
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY favorites_read_own ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY favorites_insert_own ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY favorites_delete_own ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);