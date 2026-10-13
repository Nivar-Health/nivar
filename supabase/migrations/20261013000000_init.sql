-- Nivar schema: profiles, catalogue, bookings, leads, plus Realtime authorisation.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'nurse', 'doctor', 'admin');
create type public.booking_status as enum (
  'pending_payment', 'confirmed', 'assigned', 'en_route', 'arrived',
  'testing', 'consult', 'reporting', 'completed', 'cancelled'
);

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  name text not null default '',
  phone text unique,
  email text unique,
  avatar_url text,
  gender text check (gender in ('male', 'female', 'other')),
  dob date,
  addresses jsonb not null default '[]'::jsonb,
  specialization text,
  qualifications text,
  years_experience int,
  registration_no text,
  base_location jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

-- Keep updated_at fresh on every table that has it.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- A profile is created for every auth user. Phone users become customers; the phone is stored
-- without the +91 prefix, matching the API's 10 digit format.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(new.phone, ''), '^\+?91', ''), '');
  v_name text := coalesce(new.raw_user_meta_data ->> 'name', '');
  v_role public.user_role := coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'customer');
begin
  insert into public.profiles (id, role, name, phone, email)
  values (new.id, v_role, v_name, v_phone, lower(new.email))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.services (
  code text primary key,
  name text not null,
  short_name text not null,
  description text not null default '',
  price int not null check (price >= 0),
  duration_min int not null default 5,
  requires_device text,
  icon text,
  sort_order int not null default 0
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  description text not null default '',
  service_codes text[] not null default '{}',
  price int not null check (price >= 0),
  mrp int not null check (mrp >= 0),
  popular boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger packages_updated_at before update on public.packages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create sequence public.booking_code_seq start 1001;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('NV-' || nextval('public.booking_code_seq')),
  customer_id uuid not null references public.profiles (id),
  patient jsonb not null,
  address jsonb not null,
  package_id uuid references public.packages (id),
  service_codes text[] not null default '{}',
  scheduled_date date not null,
  slot text not null,
  amount int not null check (amount >= 0),
  payment jsonb not null default '{"status": "pending"}'::jsonb,
  status public.booking_status not null default 'pending_payment',
  nurse_id uuid references public.profiles (id),
  doctor_id uuid references public.profiles (id),
  timeline jsonb not null default '[]'::jsonb,
  nurse_location jsonb,
  vitals jsonb,
  ecg jsonb,
  stethoscope jsonb,
  report jsonb,
  rating jsonb,
  notes text not null default '',
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_nurse_idx on public.bookings (nurse_id);
create index bookings_doctor_idx on public.bookings (doctor_id);
create index bookings_status_idx on public.bookings (status);
create index bookings_schedule_idx on public.bookings (scheduled_date, slot);
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Leads
-- ---------------------------------------------------------------------------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  city text not null,
  message text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- Route handlers use the service role, so these policies protect direct client access and
-- drive Realtime authorisation.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.packages enable row level security;
alter table public.bookings enable row level security;
alter table public.leads enable row level security;

create or replace function public.current_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.booking_access(p_booking_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and (b.customer_id = auth.uid() or b.nurse_id = auth.uid() or b.doctor_id = auth.uid()
           or public.current_role() = 'admin')
  )
$$;

create policy "profiles: own row" on public.profiles for select to authenticated
  using (id = auth.uid() or public.current_role() = 'admin');
create policy "catalogue: public read" on public.services for select to anon, authenticated using (true);
create policy "packages: public read" on public.packages for select to anon, authenticated using (is_active);
create policy "bookings: participants read" on public.bookings for select to authenticated
  using (public.booking_access(id));
create policy "leads: anyone may submit" on public.leads for insert to anon, authenticated with check (true);

-- ---------------------------------------------------------------------------
-- Realtime: private broadcast channels
--   booking:<id>  participants and admins, both directions
--   user:<uid>    that user
--   admin         admins
-- ---------------------------------------------------------------------------
create or replace function public.realtime_topic_allowed(p_topic text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_prefix text := split_part(p_topic, ':', 1);
  v_rest text := substr(p_topic, length(v_prefix) + 2);
begin
  if auth.uid() is null then return false; end if;
  if p_topic = 'admin' then return public.current_role() = 'admin'; end if;
  if v_prefix = 'user' then return v_rest = auth.uid()::text; end if;
  if v_prefix = 'booking' and v_rest ~ '^[0-9a-f-]{36}$' then return public.booking_access(v_rest::uuid); end if;
  return false;
end $$;

create policy "realtime: receive on allowed topics" on realtime.messages for select to authenticated
  using (public.realtime_topic_allowed(realtime.topic()));
create policy "realtime: send on allowed topics" on realtime.messages for insert to authenticated
  with check (public.realtime_topic_allowed(realtime.topic()));
