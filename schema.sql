-- ═══════════════════════════════════════════════════════════════
-- CAI Circle — Database Schema
-- Paste this entire file into Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────────────────────────
-- One profile per user. Extends Supabase auth with username,
-- optional avatar, and admin flag.
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  username    text unique not null,
  avatar_url  text,
  is_admin    boolean default false,
  created_at  timestamptz default now()
);

-- Auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data->>'username');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── VENDORS ─────────────────────────────────────────────────────
create table public.vendors (
  id              uuid default uuid_generate_v4() primary key,
  name            text not null,
  category        text not null,       -- must match an id in categories.js
  address         text,
  lat             double precision,
  lng             double precision,
  phone           text,
  website         text,
  contact_name    text,
  years_active    integer,
  region          text default 'Puerto Rico',
  payment_terms   text,
  certifications  text,
  notes           text,                -- internal notes, not shown publicly
  flagged         boolean default false,
  flagged_reason  text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz default now()
);

-- ─── REVIEWS ─────────────────────────────────────────────────────
create table public.reviews (
  id                uuid default uuid_generate_v4() primary key,
  vendor_id         uuid references public.vendors(id) on delete cascade not null,
  user_id           uuid references public.profiles(id) on delete set null,
  ratings           jsonb not null,    -- {quality:4, delivery:3, pricing:5, communication:4, ethics:5}
  comment           text,
  recommend         boolean default true,
  transaction_date  date,
  transaction_size  text check (transaction_size in ('small','medium','large')),
  created_at        timestamptz default now()
);

-- ─── REVIEW COMMENTS ────────────────────────────────────────────
create table public.review_comments (
  id         uuid default uuid_generate_v4() primary key,
  review_id  uuid references public.reviews(id) on delete cascade not null,
  user_id    uuid references public.profiles(id) on delete set null,
  comment    text not null,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- All tables are locked down; policies open only what's needed.
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles       enable row level security;
alter table public.vendors        enable row level security;
alter table public.reviews        enable row level security;
alter table public.review_comments enable row level security;

-- PROFILES
create policy "Authenticated users can view all profiles"
  on public.profiles for select using (auth.role() = 'authenticated');

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- VENDORS
create policy "Authenticated users can view all vendors"
  on public.vendors for select using (auth.role() = 'authenticated');

create policy "Authenticated users can add vendors"
  on public.vendors for insert with check (auth.role() = 'authenticated');

create policy "Admins can update vendors"
  on public.vendors for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admins can delete vendors"
  on public.vendors for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- REVIEWS
create policy "Authenticated users can view all reviews"
  on public.reviews for select using (auth.role() = 'authenticated');

create policy "Authenticated users can add their own reviews"
  on public.reviews for insert with check (auth.uid() = user_id);

create policy "Owner or admin can delete a review"
  on public.reviews for delete using (
    auth.uid() = user_id or
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- REVIEW COMMENTS
create policy "Authenticated users can view all comments"
  on public.review_comments for select using (auth.role() = 'authenticated');

create policy "Authenticated users can add their own comments"
  on public.review_comments for insert with check (auth.uid() = user_id);

create policy "Owner or admin can delete a comment"
  on public.review_comments for delete using (
    auth.uid() = user_id or
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ═══════════════════════════════════════════════════════════════
-- MAKE YOURSELF ADMIN
-- After you create your account in the app, run this line with
-- your username to grant yourself admin privileges:
--
--   update public.profiles set is_admin = true where username = 'your_username_here';
--
-- ═══════════════════════════════════════════════════════════════
