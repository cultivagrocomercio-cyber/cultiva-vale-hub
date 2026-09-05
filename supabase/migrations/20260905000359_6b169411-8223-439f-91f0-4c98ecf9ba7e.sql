REVOKE ALL ON FUNCTION public.validate_order_transition() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.restore_stock_on_cancel() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_box_plan() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;