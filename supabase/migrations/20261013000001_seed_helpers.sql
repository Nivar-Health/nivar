-- Helpers used by `pnpm seed` (apps/web/scripts/seed.ts).

-- Reset the booking code sequence after the seed inserted explicit codes NV-1001 .. NV-(p_next - 1),
-- so the next real booking gets NV-p_next.
create or replace function public.reset_booking_codes(p_next int) returns void
language sql security definer set search_path = public as $$
  select setval('public.booking_code_seq', p_next, false)
$$;

-- Service role only: this is a maintenance helper, never called from the browser.
revoke execute on function public.reset_booking_codes(int) from public, anon, authenticated;
