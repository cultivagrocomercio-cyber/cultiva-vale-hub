ALTER TABLE public.boxes
  ADD COLUMN IF NOT EXISTS tax_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS main_category public.product_category;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r TEXT;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, city, state)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state'
  ) ON CONFLICT (id) DO NOTHING;
  -- Toda conta nova nasce como CLIENTE (buyer). Vendedor só via aprovação do box.
  r := 'buyer';
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r::public.app_role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $function$;