-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'seller', 'buyer');
CREATE TYPE public.product_category AS ENUM ('plantas', 'insumos', 'maquinas');
CREATE TYPE public.order_status AS ENUM ('pendente', 'confirmado', 'entregue', 'cancelado');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  city TEXT,
  state TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_read_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "roles_insert_own_nonadmin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role <> 'admin');

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- New user trigger: profile + role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r TEXT;
BEGIN
  INSERT INTO public.profiles (id, full_name, city, state)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'city',
    NEW.raw_user_meta_data->>'state'
  ) ON CONFLICT (id) DO NOTHING;
  r := COALESCE(NEW.raw_user_meta_data->>'account_type', 'buyer');
  IF r NOT IN ('buyer', 'seller') THEN r := 'buyer'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, r::public.app_role) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- BOXES
CREATE TABLE public.boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  cover_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  story TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'SP',
  region TEXT NOT NULL DEFAULT 'Vale do Ribeira',
  whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.boxes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boxes TO authenticated;
GRANT ALL ON public.boxes TO service_role;
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "boxes_public_read" ON public.boxes FOR SELECT USING (true);
CREATE POLICY "boxes_insert_own" ON public.boxes FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "boxes_update_own" ON public.boxes FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "boxes_delete_own" ON public.boxes FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE TRIGGER boxes_updated_at BEFORE UPDATE ON public.boxes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_box_owner(_box_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.boxes WHERE id = _box_id AND owner_id = auth.uid())
$$;

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category public.product_category NOT NULL,
  subcategory TEXT NOT NULL,
  images TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_box_idx ON public.products(box_id);
CREATE INDEX products_category_idx ON public.products(category);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read" ON public.products FOR SELECT USING (active = true OR public.is_box_owner(box_id));
CREATE POLICY "products_insert_owner" ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_box_owner(box_id));
CREATE POLICY "products_update_owner" ON public.products FOR UPDATE TO authenticated USING (public.is_box_owner(box_id)) WITH CHECK (public.is_box_owner(box_id));
CREATE POLICY "products_delete_owner" ON public.products FOR DELETE TO authenticated USING (public.is_box_owner(box_id));
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL,
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'pendente',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX orders_buyer_idx ON public.orders(buyer_id);
CREATE INDEX orders_box_idx ON public.orders(box_id);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_read_participants" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = buyer_id OR public.is_box_owner(box_id));
CREATE POLICY "orders_insert_buyer" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "orders_update_participants" ON public.orders FOR UPDATE TO authenticated USING (auth.uid() = buyer_id OR public.is_box_owner(box_id)) WITH CHECK (auth.uid() = buyer_id OR public.is_box_owner(box_id));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.can_access_order(_order_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.boxes b ON b.id = o.box_id
    WHERE o.id = _order_id AND (o.buyer_id = auth.uid() OR b.owner_id = auth.uid())
  )
$$;

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  image_url TEXT
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
GRANT SELECT, INSERT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_read" ON public.order_items FOR SELECT TO authenticated USING (public.can_access_order(order_id));
CREATE POLICY "order_items_insert_buyer" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));

-- REVIEWS
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  box_id UUID NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reviews_box_idx ON public.reviews(box_id);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_buyer" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = buyer_id AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid() AND o.box_id = reviews.box_id));

-- MESSAGES (chat por pedido)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_order_idx ON public.messages(order_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_read_participants" ON public.messages FOR SELECT TO authenticated USING (public.can_access_order(order_id));
CREATE POLICY "messages_insert_participants" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND public.can_access_order(order_id));
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- STORAGE policies (bucket 'marketplace', privado; leitura via URLs assinadas)
CREATE POLICY "marketplace_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'marketplace');
CREATE POLICY "marketplace_upload_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'marketplace' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "marketplace_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'marketplace' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "marketplace_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'marketplace' AND (storage.foldername(name))[1] = auth.uid()::text);