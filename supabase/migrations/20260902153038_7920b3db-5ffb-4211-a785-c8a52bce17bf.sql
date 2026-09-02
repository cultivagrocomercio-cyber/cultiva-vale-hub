REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_box_owner(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_order(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_box_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_order(UUID) TO authenticated;

DROP POLICY "products_public_read" ON public.products;
CREATE POLICY "products_anon_read_active" ON public.products FOR SELECT TO anon USING (active = true);
CREATE POLICY "products_auth_read" ON public.products FOR SELECT TO authenticated USING (active = true OR public.is_box_owner(box_id));