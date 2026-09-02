CREATE TYPE public.box_status AS ENUM ('pendente', 'aprovado', 'rejeitado');

ALTER TABLE public.boxes
  ADD COLUMN status public.box_status NOT NULL DEFAULT 'pendente',
  ADD COLUMN review_note text NOT NULL DEFAULT '';

UPDATE public.boxes SET status = 'aprovado';

CREATE OR REPLACE FUNCTION public.is_box_approved(_box_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.boxes WHERE id = _box_id AND status = 'aprovado') $$;
REVOKE ALL ON FUNCTION public.is_box_approved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_box_approved(uuid) TO anon, authenticated;

-- Boxes
DROP POLICY IF EXISTS boxes_public_read ON public.boxes;
CREATE POLICY boxes_public_read ON public.boxes FOR SELECT TO anon
  USING (status = 'aprovado');
CREATE POLICY boxes_auth_read ON public.boxes FOR SELECT TO authenticated
  USING (status = 'aprovado' OR auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY boxes_admin_update ON public.boxes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Products
DROP POLICY IF EXISTS products_anon_read_active ON public.products;
DROP POLICY IF EXISTS products_auth_read ON public.products;
CREATE POLICY products_anon_read_active ON public.products FOR SELECT TO anon
  USING (active = true AND public.is_box_approved(box_id));
CREATE POLICY products_auth_read ON public.products FOR SELECT TO authenticated
  USING ((active = true AND public.is_box_approved(box_id)) OR public.is_box_owner(box_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY products_admin_update ON public.products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Roles: admins can read all roles
CREATE POLICY roles_admin_read ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));