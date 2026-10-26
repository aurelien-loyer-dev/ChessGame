-- Cloud saves for Chess Arena: one row per signed-in player, readable and
-- writable only by its owner (row level security).

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  -- Keep saves small: a profile with hundreds of games stays well under this.
  constraint saves_size check (pg_column_size(data) < 2000000)
);

alter table public.saves enable row level security;

drop policy if exists "saves_select_own" on public.saves;
drop policy if exists "saves_insert_own" on public.saves;
drop policy if exists "saves_update_own" on public.saves;
drop policy if exists "saves_delete_own" on public.saves;

create policy "saves_select_own" on public.saves for select using (auth.uid() = user_id);
create policy "saves_insert_own" on public.saves for insert with check (auth.uid() = user_id);
create policy "saves_update_own" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saves_delete_own" on public.saves for delete using (auth.uid() = user_id);

-- Lets a player delete their own account (GDPR erasure). The save row goes
-- with it through the foreign key cascade.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
