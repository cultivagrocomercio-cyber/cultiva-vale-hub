DROP TRIGGER IF EXISTS boxes_sync_seller ON public.boxes;
CREATE TRIGGER boxes_sync_seller
  AFTER UPDATE OF status ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION public.sync_seller_on_box_status();

CREATE OR REPLACE FUNCTION public.revoke_seller_on_box_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.boxes WHERE owner_id = OLD.owner_id AND status = 'aprovado' AND id <> OLD.id) THEN
    DELETE FROM public.user_roles WHERE user_id = OLD.owner_id AND role = 'seller';
  END IF;
  RETURN OLD;
END; $$;
REVOKE ALL ON FUNCTION public.revoke_seller_on_box_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS boxes_revoke_seller ON public.boxes;
CREATE TRIGGER boxes_revoke_seller
  AFTER DELETE ON public.boxes
  FOR EACH ROW EXECUTE FUNCTION public.revoke_seller_on_box_delete();

DROP POLICY IF EXISTS roles_insert_own_nonadmin ON public.user_roles;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
DROP POLICY IF EXISTS roles_admin_write ON public.user_roles;
CREATE POLICY roles_admin_write ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.user_roles (user_id, role)
SELECT owner_id, 'seller' FROM public.boxes WHERE status = 'aprovado'
ON CONFLICT DO NOTHING;