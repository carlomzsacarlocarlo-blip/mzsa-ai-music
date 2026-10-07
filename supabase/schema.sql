create extension if not exists pgcrypto;
create table if not exists public.users (
 id uuid primary key references auth.users(id) on delete cascade,
 email text, name text, plan text not null default 'free',
 free_generations_total integer not null default 3,
 free_generations_used integer not null default 0,
 paid_credits integer not null default 0,
 created_at timestamptz not null default now()
);
create table if not exists public.payments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 razorpay_order_id text not null unique,
 razorpay_payment_id text not null unique,
 amount integer not null, plan text not null, credits integer not null,
 status text not null, created_at timestamptz not null default now()
);
create table if not exists public.songs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 title text not null, genre text, mood text, audio_url text, duration integer,
 created_at timestamptz not null default now()
);
create table if not exists public.generations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.users(id) on delete cascade,
 song_id uuid references public.songs(id) on delete set null,
 credits_used integer not null default 1, source text not null,
 status text not null, created_at timestamptz not null default now()
);
alter table public.users enable row level security;
alter table public.payments enable row level security;
alter table public.songs enable row level security;
alter table public.generations enable row level security;

create or replace function public.reserve_generation(p_user_id uuid)
returns json language plpgsql security definer set search_path=public as $$
declare u public.users;
begin
 select * into u from public.users where id=p_user_id for update;
 if not found then raise exception 'User not found'; end if;
 if u.free_generations_used < u.free_generations_total then
   update public.users set free_generations_used=free_generations_used+1 where id=p_user_id;
   return json_build_object('source','free');
 end if;
 if u.paid_credits>0 then
   update public.users set paid_credits=paid_credits-1 where id=p_user_id;
   return json_build_object('source','paid');
 end if;
 raise exception 'NO_CREDITS';
end; $$;

create or replace function public.restore_generation(p_user_id uuid,p_source text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_source='free' then
   update public.users set free_generations_used=greatest(0,free_generations_used-1) where id=p_user_id;
 elsif p_source='paid' then
   update public.users set paid_credits=paid_credits+1 where id=p_user_id;
 end if;
end; $$;

create or replace function public.add_paid_credits(p_user_id uuid,p_credits integer,p_plan text)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.users set paid_credits=paid_credits+p_credits,plan=p_plan where id=p_user_id;
end; $$;

grant execute on function public.reserve_generation(uuid) to service_role;
grant execute on function public.restore_generation(uuid,text) to service_role;
grant execute on function public.add_paid_credits(uuid,integer,text) to service_role;

create or replace function public.process_verified_payment(
 p_user_id uuid,p_order_id text,p_payment_id text,p_amount integer,p_plan text,p_credits integer
)
returns json
language plpgsql
security definer
set search_path=public
as $$
declare inserted boolean;
begin
 insert into public.payments(user_id,razorpay_order_id,razorpay_payment_id,amount,plan,credits,status)
 values(p_user_id,p_order_id,p_payment_id,p_amount,p_plan,p_credits,'verified')
 on conflict (razorpay_payment_id) do nothing;
 get diagnostics inserted = row_count;
 if inserted then
   update public.users set paid_credits=paid_credits+p_credits,plan=lower(p_plan) where id=p_user_id;
 end if;
 return json_build_object('processed',inserted,'credits',p_credits,'plan',p_plan);
end; $$;
grant execute on function public.process_verified_payment(uuid,text,text,integer,text,integer) to service_role;
