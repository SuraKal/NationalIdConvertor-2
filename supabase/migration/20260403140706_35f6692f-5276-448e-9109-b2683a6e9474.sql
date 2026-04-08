
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ETB',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages" ON public.packages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert packages" ON public.packages
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update packages" ON public.packages
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete packages" ON public.packages
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.packages(id);
