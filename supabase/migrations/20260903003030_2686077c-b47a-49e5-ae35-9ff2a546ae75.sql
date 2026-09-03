CREATE TABLE public.box_review_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL REFERENCES public.boxes(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX box_review_messages_box_idx ON public.box_review_messages(box_id, created_at);
GRANT SELECT, INSERT ON public.box_review_messages TO authenticated;
GRANT ALL ON public.box_review_messages TO service_role;
ALTER TABLE public.box_review_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY brm_read ON public.box_review_messages FOR SELECT TO authenticated
  USING (public.is_box_owner(box_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY brm_insert ON public.box_review_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND (public.is_box_owner(box_id) OR public.has_role(auth.uid(), 'admin')));
ALTER PUBLICATION supabase_realtime ADD TABLE public.box_review_messages;