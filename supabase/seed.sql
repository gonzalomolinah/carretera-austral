begin;

with empty_state as (
  select jsonb_build_object(
    'days',
    (
      select jsonb_agg(
        jsonb_build_object('id', 'day-' || gs.n, 'name', 'Día ' || gs.n)
        order by gs.n
      )
      from generate_series(1, 12) as gs(n)
    ),
    'items',
    '[]'::jsonb
  ) as state_json
),
plan_ids as (
  select id
  from (
    values
      ('carretera-austral-general'),
      ('carretera-austral-molina'),
      ('carretera-austral-inaki'),
      ('carretera-austral-nef'),
      ('carretera-austral-ross')
  ) as rows(id)
)
insert into public.planner_state (id, state_json, updated_at)
select
  plan_ids.id,
  empty_state.state_json,
  now()
from plan_ids
cross join empty_state
on conflict (id)
do update
set
  state_json = excluded.state_json,
  updated_at = excluded.updated_at;

delete from public.planner_state where id = 'carretera-austral-public';

commit;