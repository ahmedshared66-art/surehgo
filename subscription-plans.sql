-- Run once in Supabase SQL Editor.
-- Adds admin-managed plans and lets the admin assign one to a customer for N days.

create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0 check (price >= 0),
  duration_days integer not null default 30 check (duration_days between 1 and 3650),
  max_sites integer not null default 1 check (max_sites >= -1),
  max_products integer not null default 0 check (max_products >= -1),
  ai_uses_monthly integer not null default 0 check (ai_uses_monthly >= -1),
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists subscription_plan_id uuid
  references public.subscription_plans(id) on delete set null;

drop policy if exists "Admins manage all sites" on public.sites;
create policy "Admins manage all sites" on public.sites
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'));

alter table public.subscription_plans enable row level security;
grant select on public.subscription_plans to anon, authenticated;
grant insert, update, delete on public.subscription_plans to authenticated;

drop policy if exists "Anyone can view active plans" on public.subscription_plans;
create policy "Anyone can view active plans"
on public.subscription_plans for select to anon, authenticated
using (
  active = true or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  )
);

drop policy if exists "Admins manage plans" on public.subscription_plans;
create policy "Admins manage plans"
on public.subscription_plans for all to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role = 'super_admin'
))
with check (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role = 'super_admin'
));

create or replace function public.admin_assign_subscription(
  p_target uuid,
  p_plan uuid,
  p_days integer
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.subscription_plans%rowtype;
  v_end timestamptz;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  ) then
    raise exception 'admin_required';
  end if;

  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'invalid_days';
  end if;

  select * into v_plan
  from public.subscription_plans
  where id = p_plan and active = true;

  if not found then
    raise exception 'plan_not_available';
  end if;

  v_end := now() + make_interval(days => p_days);

  update public.profiles
  set subscription_plan_id = v_plan.id,
      plan = v_plan.code,
      plan_ends_at = v_end
  where id = p_target;

  if not found then
    raise exception 'customer_not_found';
  end if;

  return v_end;
end;
$$;

revoke all on function public.admin_assign_subscription(uuid, uuid, integer) from public;
grant execute on function public.admin_assign_subscription(uuid, uuid, integer) to authenticated;

create or replace function public.admin_clear_subscription(p_target uuid, p_days integer default 3)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare v_end timestamptz;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin') then
    raise exception 'admin_required';
  end if;
  if p_days is null or p_days < 1 or p_days > 365 then raise exception 'invalid_days'; end if;
  v_end := now() + make_interval(days => p_days);
  update public.profiles
  set subscription_plan_id = null, plan = 'trial', trial_ends_at = v_end, plan_ends_at = null
  where id = p_target;
  if not found then raise exception 'customer_not_found'; end if;
  return v_end;
end;
$$;
revoke all on function public.admin_clear_subscription(uuid, integer) from public;
grant execute on function public.admin_clear_subscription(uuid, integer) to authenticated;

-- Keep requests for newly-created plans separate from legacy fixed-plan requests.
create table if not exists public.subscription_plan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id) on delete restrict,
  plan_name text not null,
  amount numeric(10,2) not null,
  sender_phone text not null,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
alter table public.subscription_plan_requests enable row level security;
grant select, update on public.subscription_plan_requests to authenticated;
drop policy if exists "Users view own plan requests" on public.subscription_plan_requests;
create policy "Users view own plan requests" on public.subscription_plan_requests
for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admins handle custom plan requests" on public.subscription_plan_requests;
create policy "Admins handle custom plan requests" on public.subscription_plan_requests
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'));

create or replace function public.admin_delete_subscription_plan(p_plan uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin') then
    raise exception 'admin_required';
  end if;
  if exists (select 1 from public.profiles where subscription_plan_id = p_plan)
     or exists (select 1 from public.subscription_plan_requests where plan_id = p_plan) then
    raise exception 'plan_in_use_hide_instead';
  end if;
  delete from public.subscription_plans where id = p_plan;
  if not found then raise exception 'plan_not_found'; end if;
end;
$$;
revoke all on function public.admin_delete_subscription_plan(uuid) from public;
grant execute on function public.admin_delete_subscription_plan(uuid) to authenticated;

-- Let customers request any active plan from the public subscription catalog.
create or replace function public.request_custom_subscription(
  p_plan uuid,
  p_sender text,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.subscription_plans%rowtype;
  v_request uuid;
begin
  if auth.uid() is null then raise exception 'login_required'; end if;
  if length(regexp_replace(coalesce(p_sender, ''), '[^0-9]', '', 'g')) not between 8 and 15 then
    raise exception 'invalid_sender_phone';
  end if;
  select * into v_plan from public.subscription_plans where id = p_plan and active = true;
  if not found then raise exception 'plan_not_available'; end if;
  if exists (select 1 from public.subscription_plan_requests where user_id = auth.uid() and status = 'pending')
     or exists (select 1 from public.payment_requests where user_id = auth.uid() and status = 'pending') then
    raise exception 'too_many_pending';
  end if;
  insert into public.subscription_plan_requests (user_id, plan_id, plan_name, amount, sender_phone, note)
  values (auth.uid(), v_plan.id, v_plan.name, v_plan.price,
          regexp_replace(p_sender, '[^0-9]', '', 'g'), left(coalesce(p_note, ''), 200))
  returning id into v_request;
  return v_request;
end;
$$;
revoke all on function public.request_custom_subscription(uuid, text, text) from public;
grant execute on function public.request_custom_subscription(uuid, text, text) to authenticated;

-- Enforce the plan's site limit in the database as well as in the screen.
create or replace function public.enforce_site_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan_id uuid;
  v_current_plan text;
  v_ends timestamptz;
  v_trial_ends timestamptz;
  v_limit integer := 3;
  v_count integer;
begin
  v_owner := coalesce(new.owner_id, auth.uid());
  if v_owner is null then return new; end if;

  select subscription_plan_id, plan, plan_ends_at, trial_ends_at
    into v_plan_id, v_current_plan, v_ends, v_trial_ends
  from public.profiles where id = v_owner;

  if v_plan_id is not null then
    if v_ends is null or v_ends <= now() then
      raise exception 'subscription_expired';
    end if;
    select max_sites into v_limit
    from public.subscription_plans
    where id = v_plan_id;
    if v_limit is null then v_limit := 0; end if;
  elsif v_current_plan = 'trial' then
    if v_trial_ends is null or v_trial_ends <= now() then
      raise exception 'subscription_expired';
    end if;
  elsif v_ends is null or v_ends <= now() then
    raise exception 'subscription_expired';
  end if;

  if v_limit = -1 then return new; end if;
  select count(*) into v_count from public.sites where owner_id = v_owner;
  if v_count >= v_limit then raise exception 'site_limit_reached'; end if;
  return new;
end;
$$;

drop trigger if exists enforce_site_plan_limit_before_insert on public.sites;
create trigger enforce_site_plan_limit_before_insert
before insert on public.sites
for each row execute function public.enforce_site_plan_limit();

create or replace function public.enforce_product_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_plan_id uuid;
  v_ends timestamptz;
  v_limit integer := -1;
  v_count integer;
begin
  select owner_id into v_owner from public.sites where id = new.site_id;
  if v_owner is null then raise exception 'site_not_found'; end if;
  select subscription_plan_id, plan_ends_at into v_plan_id, v_ends
    from public.profiles where id = v_owner;
  if v_plan_id is null then return new; end if;
  if v_ends is null or v_ends <= now() then raise exception 'subscription_expired'; end if;
  select max_products into v_limit from public.subscription_plans where id = v_plan_id;
  if v_limit is null then v_limit := 0; end if;
  if v_limit = -1 then return new; end if;
  select count(*) into v_count from public.products where site_id = new.site_id;
  if v_count >= v_limit then raise exception 'product_limit_reached'; end if;
  return new;
end;
$$;
drop trigger if exists enforce_product_plan_limit_before_insert on public.products;
create trigger enforce_product_plan_limit_before_insert
before insert on public.products
for each row execute function public.enforce_product_plan_limit();

-- Admin-only customer deletion and site ownership transfer.
create or replace function public.admin_delete_customer(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin') then
    raise exception 'admin_required';
  end if;
  if p_target = auth.uid() then raise exception 'cannot_delete_self'; end if;
  -- Remove the customer's sites first; site-owned products/orders follow the
  -- same cascade rules as the app's existing delete-site action.
  delete from public.sites where owner_id = p_target;
  delete from auth.users where id = p_target;
  if not found then raise exception 'customer_not_found'; end if;
end;
$$;
revoke all on function public.admin_delete_customer(uuid) from public;
grant execute on function public.admin_delete_customer(uuid) to authenticated;

create or replace function public.admin_transfer_site(p_site uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin') then
    raise exception 'admin_required';
  end if;
  if not exists (select 1 from public.profiles where id = p_new_owner) then
    raise exception 'new_owner_not_found';
  end if;
  update public.sites set owner_id = p_new_owner where id = p_site;
  if not found then raise exception 'site_not_found'; end if;
end;
$$;
revoke all on function public.admin_transfer_site(uuid, uuid) from public;
grant execute on function public.admin_transfer_site(uuid, uuid) to authenticated;

-- Shared image library managed by the platform admin and selectable in the builder.
create table if not exists public.site_asset_library (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default '',
  url text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.site_asset_library enable row level security;
grant select on public.site_asset_library to anon, authenticated;
grant insert, update, delete on public.site_asset_library to authenticated;
drop policy if exists "View active library images" on public.site_asset_library;
create policy "View active library images" on public.site_asset_library
for select to anon, authenticated using (active or exists (
  select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'
));
drop policy if exists "Admins manage image library" on public.site_asset_library;
create policy "Admins manage image library" on public.site_asset_library
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'super_admin'));

insert into public.subscription_plans
  (code, name, description, price, duration_days, max_sites, max_products, ai_uses_monthly, features, sort_order)
values
  ('monthly', 'الباقة الشهرية', 'اشتراك شهري للمواقع', 199, 30, 3, 50, 0,
   '["إنشاء مواقع","متجر إلكتروني"]'::jsonb, 1),
  ('yearly', 'الباقة السنوية', 'اشتراك سنوي ومميزات إضافية', 1499, 365, 10, 500, 10,
   '["إنشاء مواقع","متجر إلكتروني","الذكاء الاصطناعي","دومين خاص"]'::jsonb, 2)
on conflict (code) do nothing;
