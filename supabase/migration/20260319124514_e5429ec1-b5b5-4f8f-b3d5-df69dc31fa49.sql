
ALTER TABLE public.profiles
  ADD COLUMN wallet_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN total_downloads integer NOT NULL DEFAULT 0;
