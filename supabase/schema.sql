-- CRM визового центра — схема базы Supabase (PostgreSQL).
-- Выполнить один раз: Supabase → SQL Editor → вставить файл целиком → Run.

-- ── Сотрудники ──────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  full_name text,
  role text check (role in ('director','ads','manager','courier','lawyer','accountant')),
  created_at timestamptz not null default now()
);

-- Профиль создаётся при регистрации без роли; роль назначает директор.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ── Заявки ──────────────────────────────────────────────────
create table if not exists public.deals (
  id bigint generated always as identity primary key,
  client_company text not null,
  client_bin text,
  contact_name text,
  contact_phone text,
  category text not null default 'C3',
  people_count int not null default 1,
  source text,
  request text,
  owner_id uuid references public.profiles(id),
  stage text not null default 'lead',
  stage_started_at timestamptz not null default now(),
  amount_total numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  status text not null default 'active' check (status in ('active','lost','done')),
  lost_reason text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.deal_events (
  id bigint generated always as identity primary key,
  deal_id bigint not null references public.deals on delete cascade,
  kind text not null check (kind in ('stage','return','comment','payment','escalation','created')),
  from_stage text,
  to_stage text,
  text text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id bigint generated always as identity primary key,
  deal_id bigint not null references public.deals on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  kind text not null default 'prepay' check (kind in ('prepay','final','fee')),
  paid_at date not null default current_date,
  note text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists deals_stage_idx on public.deals(stage) where status = 'active';
create index if not exists events_deal_idx on public.deal_events(deal_id, created_at);

-- Сумма оплат клиента (без госпошлин) пересчитывается автоматически.
create or replace function public.sync_paid() returns trigger
language plpgsql security definer set search_path = public as $$
declare d bigint := coalesce(new.deal_id, old.deal_id);
begin
  update public.deals
     set amount_paid = coalesce((select sum(amount) from public.payments
                                 where deal_id = d and kind in ('prepay','final')), 0)
   where id = d;
  return null;
end $$;

drop trigger if exists payments_sync on public.payments;
create trigger payments_sync after insert or update or delete on public.payments
  for each row execute function public.sync_paid();

-- Правила оплаты на уровне базы — обойти через интерфейс нельзя:
-- 1) работа после договора стартует только после предоплаты;
-- 2) без полной оплаты документы клиенту не выдаются.
create or replace function public.guard_deal() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if new.stage is distinct from old.stage then
    new.stage_started_at := now();
    if old.stage = 'prepay' and new.stage = 'checklist' and new.amount_paid <= 0 then
      raise exception 'Нет предоплаты: работу по заявке начинать нельзя';
    end if;
    if old.stage = 'handover' and new.stage = 'act' and new.amount_paid < new.amount_total then
      raise exception 'Оплата не полная: документы клиенту не выдаются';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists deals_guard on public.deals;
create trigger deals_guard before update on public.deals
  for each row execute function public.guard_deal();

-- ── Права доступа (RLS) ─────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.deals enable row level security;
alter table public.deal_events enable row level security;
alter table public.payments enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select
  using (id = auth.uid() or public.my_role() is not null);
drop policy if exists "profiles director update" on public.profiles;
create policy "profiles director update" on public.profiles for update
  using (public.my_role() = 'director');

-- Заявки и история: видит и ведёт вся команда с назначенной ролью.
drop policy if exists "deals team" on public.deals;
create policy "deals team" on public.deals for select using (public.my_role() is not null);
drop policy if exists "deals insert" on public.deals;
create policy "deals insert" on public.deals for insert with check (public.my_role() is not null);
drop policy if exists "deals update" on public.deals;
create policy "deals update" on public.deals for update using (public.my_role() is not null);
drop policy if exists "deals delete" on public.deals;
create policy "deals delete" on public.deals for delete using (public.my_role() = 'director');

drop policy if exists "events team" on public.deal_events;
create policy "events team" on public.deal_events for select using (public.my_role() is not null);
drop policy if exists "events insert" on public.deal_events;
create policy "events insert" on public.deal_events for insert with check (public.my_role() is not null);

-- Оплаты вносят только бухгалтер и директор.
drop policy if exists "payments read" on public.payments;
create policy "payments read" on public.payments for select using (public.my_role() is not null);
drop policy if exists "payments write" on public.payments;
create policy "payments write" on public.payments for all
  using (public.my_role() in ('accountant','director'))
  with check (public.my_role() in ('accountant','director'));

-- Сумму договора тоже меняют только бухгалтер и директор.
create or replace function public.guard_amount() returns trigger
language plpgsql as $$
begin
  if new.amount_total is distinct from old.amount_total
     and public.my_role() not in ('accountant','director') then
    raise exception 'Сумму договора меняет бухгалтер или директор';
  end if;
  return new;
end $$;

drop trigger if exists deals_amount_guard on public.deals;
create trigger deals_amount_guard before update on public.deals
  for each row execute function public.guard_amount();

-- ── Первый директор ─────────────────────────────────────────
-- После регистрации в приложении выполните, подставив свой e-mail:
-- update public.profiles set role = 'director' where email = 'ваш@email';
