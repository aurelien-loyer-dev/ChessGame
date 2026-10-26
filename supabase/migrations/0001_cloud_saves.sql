-- Cloud saves for EpiChess: one row per signed-in player, readable and
-- writable only by its owner (row level security).
--
-- The anon key and project URL ship in the frontend bundle by design; this
-- file is what keeps data private. Never expose the service_role key.
-- The script is idempotent: it can be run again to apply updates.

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  -- Keep saves small: a profile with hundreds of games stays well under this.
  constraint saves_size check (pg_column_size(data) < 2000000)
);

alter table public.saves enable row level security;
-- Also apply RLS to the table owner, so no role reaches rows by accident.
alter table public.saves force row level security;

-- Anonymous visitors get no access at all (not even empty reads);
-- signed-in players get exactly the operations the policies allow.
revoke all on table public.saves from anon, public;
grant select, insert, update, delete on table public.saves to authenticated;

drop policy if exists "saves_select_own" on public.saves;
drop policy if exists "saves_insert_own" on public.saves;
drop policy if exists "saves_update_own" on public.saves;
drop policy if exists "saves_delete_own" on public.saves;

-- (select auth.uid()) is evaluated once per query instead of once per row.
create policy "saves_select_own" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "saves_insert_own" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "saves_update_own" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "saves_delete_own" on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);

-- The server, not the client, decides when a save was written.
create or replace function public.saves_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch before insert or update on public.saves
  for each row execute function public.saves_touch();

-- Lets a player delete their own account (GDPR erasure). The save row goes
-- with it through the foreign key cascade.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
-- Empty search_path: every object below is schema-qualified, nothing can be shadowed.
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
