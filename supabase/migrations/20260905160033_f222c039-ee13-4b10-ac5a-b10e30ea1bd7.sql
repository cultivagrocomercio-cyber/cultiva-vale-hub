REVOKE ALL ON FUNCTION public.has_valid_certificate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_certificate_for_nfe() FROM PUBLIC, anon, authenticated;