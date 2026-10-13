-- Atomic partial updates for the booking JSON columns that several requests write at once
-- (the nurse's vitals form saves each field separately; the doctor's report autosaves).
-- A read-merge-write in the app loses updates when two requests overlap; this merges in one
-- statement instead, and only while the booking is in one of `p_statuses`.
create or replace function public.merge_booking_json(
  p_id uuid,
  p_column text,
  p_set jsonb,
  p_unset text[] default '{}',
  p_statuses public.booking_status[] default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_updated int;
begin
  if p_column = 'vitals' then
    update public.bookings
       set vitals = (coalesce(vitals, '{}'::jsonb) || coalesce(p_set, '{}'::jsonb)) - coalesce(p_unset, '{}')
     where id = p_id and (p_statuses is null or status = any (p_statuses));
  elsif p_column = 'report' then
    update public.bookings
       set report = (coalesce(report, '{}'::jsonb) || coalesce(p_set, '{}'::jsonb)) - coalesce(p_unset, '{}')
     where id = p_id and (p_statuses is null or status = any (p_statuses));
  else
    raise exception 'merge_booking_json: unsupported column %', p_column;
  end if;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end $$;

revoke execute on function public.merge_booking_json(uuid, text, jsonb, text[], public.booking_status[]) from public, anon, authenticated;
