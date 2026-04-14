create table if not exists public.planner_state (
  id text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select, insert, update on table public.planner_state to anon, authenticated;

alter table public.planner_state enable row level security;

drop policy if exists planner_state_public_read on public.planner_state;
drop policy if exists planner_state_public_insert on public.planner_state;
drop policy if exists planner_state_public_update on public.planner_state;

create policy planner_state_public_read
  on public.planner_state
  for select
  to anon, authenticated
  using (id = 'carretera-austral-public');

create policy planner_state_public_insert
  on public.planner_state
  for insert
  to anon, authenticated
  with check (id = 'carretera-austral-public');

create policy planner_state_public_update
  on public.planner_state
  for update
  to anon, authenticated
  using (id = 'carretera-austral-public')
  with check (id = 'carretera-austral-public');
