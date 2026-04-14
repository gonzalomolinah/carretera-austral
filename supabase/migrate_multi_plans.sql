begin;

update public.planner_state
set
  id = 'carretera-austral-general',
  updated_at = now()
where id = 'carretera-austral-public'
  and not exists (
    select 1
    from public.planner_state as existing
    where existing.id = 'carretera-austral-general'
  );

with base as (
  select coalesce(
    (select state_json from public.planner_state where id = 'carretera-austral-general' limit 1),
    (select state_json from public.planner_state order by updated_at desc limit 1)
  ) as state_json
),
targets as (
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
  targets.id,
  base.state_json,
  now()
from targets
cross join base
where base.state_json is not null
on conflict (id)
do nothing;

commit;
