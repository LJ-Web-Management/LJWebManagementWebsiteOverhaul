-- MrPress Automation / LJ Web — backend schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Run).
--
-- Design:
--   - Three tables collect everything submitted on the site: contact form,
--     product-page leads, and appointment bookings.
--   - Row Level Security is ON for all three. There is no INSERT policy for
--     the public/anon role, so the anon key can never write directly —
--     all writes happen inside the Edge Functions using the service-role
--     key, which bypasses RLS. This is what stops randoms from POSTing
--     junk straight into your database via the REST API.
--   - The only SELECT policy allows authenticated users to read everything.
--     Your /admin page signs in with Supabase Auth, so once you create your
--     one admin login (see SETUP.md), that account can read all three
--     tables and nobody else can.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Contact Us submissions
-- ---------------------------------------------------------------------
create table if not exists public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  phone       text,
  email       text not null,
  subject     text not null,
  message     text not null,
  source_url  text
);

alter table public.contact_submissions enable row level security;

create policy "Admin can read contact submissions"
  on public.contact_submissions
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- Product page leads (the 24 pre-made-automations pages)
-- ---------------------------------------------------------------------
create table if not exists public.product_leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  phone       text,
  email       text not null,
  page_url    text not null,
  product     text
);

alter table public.product_leads enable row level security;

create policy "Admin can read product leads"
  on public.product_leads
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- Appointment bookings
-- ---------------------------------------------------------------------
create table if not exists public.appointments (
  id                       uuid primary key default gen_random_uuid(),
  created_at               timestamptz not null default now(),
  appointment_type         text not null,        -- e.g. "quick-chat"
  appointment_label        text not null,        -- e.g. "Quick Chat"
  duration_minutes         integer not null,
  appointment_date         date not null,         -- calendar date in America/Chicago
  start_minutes            integer not null,      -- minutes after midnight, America/Chicago wall time
  appointment_time_label   text not null,          -- e.g. "10:30 AM"
  appointment_datetime_utc timestamptz not null,   -- the actual instant, DST-correct
  timezone                 text not null default 'America/Chicago',
  name                     text not null,
  email                    text not null,
  phone                    text,
  notes                    text
);

alter table public.appointments enable row level security;

create policy "Admin can read appointments"
  on public.appointments
  for select
  to authenticated
  using (true);

-- Helpful for the get-availability function's per-day lookups.
create index if not exists appointments_date_idx on public.appointments (appointment_date);
create index if not exists contact_submissions_created_at_idx on public.contact_submissions (created_at desc);
create index if not exists product_leads_created_at_idx on public.product_leads (created_at desc);
create index if not exists appointments_created_at_idx on public.appointments (created_at desc);
