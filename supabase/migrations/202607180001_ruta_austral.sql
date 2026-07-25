-- Ruta Austral: modelo normalizado side-by-side para la PWA.
--
-- Esta migración NO elimina ni modifica public.planner_state. Los datos legados
-- se copian de forma idempotente mediante private.backfill_planner_state().

begin;

create schema if not exists private;
revoke all on schema private from public, anon;

-- Mantiene operativo el contrato legado y hace reproducible `supabase db reset`
-- aun si el proyecto todavía no tiene una migración baseline para schema.sql.
create table if not exists public.planner_state (
  id text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);

grant usage on schema public to anon, authenticated;
grant select, insert, update on table public.planner_state to anon, authenticated;
alter table public.planner_state enable row level security;

drop policy if exists planner_state_public_read on public.planner_state;
create policy planner_state_public_read
  on public.planner_state for select to anon, authenticated
  using (id in (
    'carretera-austral-general',
    'carretera-austral-molina',
    'carretera-austral-inaki',
    'carretera-austral-nef',
    'carretera-austral-ross'
  ));

drop policy if exists planner_state_public_insert on public.planner_state;
create policy planner_state_public_insert
  on public.planner_state for insert to anon, authenticated
  with check (id in (
    'carretera-austral-general',
    'carretera-austral-molina',
    'carretera-austral-inaki',
    'carretera-austral-nef',
    'carretera-austral-ross'
  ));

drop policy if exists planner_state_public_update on public.planner_state;
create policy planner_state_public_update
  on public.planner_state for update to anon, authenticated
  using (id in (
    'carretera-austral-general',
    'carretera-austral-molina',
    'carretera-austral-inaki',
    'carretera-austral-nef',
    'carretera-austral-ross'
  ))
  with check (id in (
    'carretera-austral-general',
    'carretera-austral-molina',
    'carretera-austral-inaki',
    'carretera-austral-nef',
    'carretera-austral-ross'
  ));

-- ---------------------------------------------------------------------------
-- Helpers deterministas y de validación
-- ---------------------------------------------------------------------------

create or replace function private.deterministic_uuid(scope text, source_value text)
returns uuid
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  hash_text text;
begin
  hash_text := pg_catalog.md5(scope || chr(31) || source_value);
  -- UUID v5-shaped, determinista. MD5 se usa solo como mapeo, no como secreto.
  return (
    pg_catalog.substr(hash_text, 1, 8) || '-' ||
    pg_catalog.substr(hash_text, 9, 4) || '-' ||
    '5' || pg_catalog.substr(hash_text, 14, 3) || '-' ||
    '8' || pg_catalog.substr(hash_text, 18, 3) || '-' ||
    pg_catalog.substr(hash_text, 21, 12)
  )::uuid;
end;
$$;

create or replace function private.token_hash(token_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to(token_value, 'UTF8')),
    'hex'
  );
$$;

create or replace function private.role_rank(role_value text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case role_value
    when 'owner' then 30
    when 'editor' then 20
    when 'viewer' then 10
    else 0
  end;
$$;

-- ---------------------------------------------------------------------------
-- Tablas normalizadas
-- ---------------------------------------------------------------------------

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  legacy_plan_id text unique,
  name text not null,
  start_date date,
  timezone text not null default 'America/Santiago',
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint trips_name_length check (char_length(name) between 1 and 120),
  constraint trips_timezone_length check (char_length(timezone) between 1 and 64),
  constraint trips_revision_positive check (revision > 0)
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id),
  constraint trip_members_role check (role in ('owner', 'editor', 'viewer'))
);

create table if not exists public.trip_share_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token_hash text not null unique,
  role text not null default 'editor',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  use_count bigint not null default 0,
  constraint trip_share_links_token_hash check (char_length(token_hash) = 64),
  constraint trip_share_links_role check (role in ('editor', 'viewer')),
  constraint trip_share_links_use_count check (use_count >= 0)
);

create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  legacy_id text,
  legacy_ordinal integer,
  sort_key text not null,
  day_date date,
  title text not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (trip_id, id),
  unique (trip_id, legacy_ordinal),
  constraint trip_days_title_length check (char_length(title) between 1 and 120),
  constraint trip_days_sort_key_length check (char_length(sort_key) between 1 and 128),
  constraint trip_days_revision_positive check (revision > 0)
);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_id uuid references public.trip_days(id) on delete set null,
  legacy_id text,
  legacy_ordinal integer,
  sort_key text not null,
  kind text not null,
  title text not null,
  category text not null default 'Logística',
  location_text text,
  origin_text text,
  destination_text text,
  transport_mode text,
  duration_minutes integer not null default 60,
  cost_clp bigint not null default 0,
  notes text not null default '',
  latitude double precision,
  longitude double precision,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (trip_id, id),
  unique (trip_id, legacy_ordinal),
  constraint itinerary_items_kind check (kind in ('place', 'trip')),
  constraint itinerary_items_title_length check (char_length(title) between 1 and 180),
  constraint itinerary_items_category_length check (char_length(category) between 1 and 80),
  constraint itinerary_items_location_length check (char_length(location_text) <= 240),
  constraint itinerary_items_origin_length check (char_length(origin_text) <= 160),
  constraint itinerary_items_destination_length check (char_length(destination_text) <= 160),
  constraint itinerary_items_transport_length check (char_length(transport_mode) <= 80),
  constraint itinerary_items_sort_key_length check (char_length(sort_key) between 1 and 128),
  constraint itinerary_items_duration check (duration_minutes between 1 and 10080),
  constraint itinerary_items_cost check (cost_clp between 0 and 99999999999999),
  constraint itinerary_items_notes_length check (char_length(notes) <= 12000),
  constraint itinerary_items_latitude check (latitude is null or latitude between -90 and 90),
  constraint itinerary_items_longitude check (longitude is null or longitude between -180 and 180),
  constraint itinerary_items_revision_positive check (revision > 0)
);

create table if not exists public.item_flags (
  trip_id uuid not null,
  item_id uuid not null,
  flag text not null,
  created_at timestamptz not null default now(),
  primary key (item_id, flag),
  foreign key (trip_id, item_id)
    references public.itinerary_items(trip_id, id)
    on delete cascade,
  constraint item_flags_flag check (flag in ('must', 'booked', 'done', 'lodging', 'dayvisit'))
);

create table if not exists public.item_links (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  item_id uuid not null,
  kind text not null,
  label text,
  url text not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (trip_id, item_id)
    references public.itinerary_items(trip_id, id)
    on delete cascade,
  constraint item_links_kind check (kind in ('map', 'reservation', 'reference')),
  constraint item_links_url_length check (char_length(url) between 1 and 2048),
  constraint item_links_http_url check (url ~* '^https?://'),
  constraint item_links_label_length check (char_length(label) <= 160),
  constraint item_links_revision_positive check (revision > 0)
);

create table if not exists public.trip_attachments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  item_id uuid references public.itinerary_items(id) on delete set null,
  bucket_id text not null default 'trip-files',
  object_path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  status text not null default 'pending',
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (bucket_id, object_path),
  constraint trip_attachments_status check (status in ('pending', 'uploaded', 'failed')),
  constraint trip_attachments_bucket check (bucket_id = 'trip-files'),
  constraint trip_attachments_trip_path check (
    object_path like 'trips/' || trip_id::text || '/%'
  ),
  constraint trip_attachments_size check (size_bytes is null or size_bytes between 0 and 26214400),
  constraint trip_attachments_path_length check (char_length(object_path) between 1 and 1024),
  constraint trip_attachments_filename_length check (char_length(filename) between 1 and 255),
  constraint trip_attachments_revision_positive check (revision > 0)
);

create table if not exists public.applied_operations (
  operation_id uuid primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  request_hash text not null,
  result jsonb,
  applied_at timestamptz not null default now(),
  constraint applied_operations_request_hash check (char_length(request_hash) = 64)
);

create table if not exists public.trip_changes (
  seq bigint generated by default as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  operation text not null,
  revision bigint,
  actor_id uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  row_data jsonb,
  constraint trip_changes_operation check (operation in ('INSERT', 'UPDATE', 'DELETE'))
);

create index if not exists trip_members_user_trip_idx
  on public.trip_members(user_id, trip_id);
create index if not exists trip_share_links_trip_idx
  on public.trip_share_links(trip_id)
  where revoked_at is null;
create index if not exists trip_days_trip_sort_idx
  on public.trip_days(trip_id, sort_key, id)
  where deleted_at is null;
create index if not exists itinerary_items_trip_day_sort_idx
  on public.itinerary_items(trip_id, day_id, sort_key, id)
  where deleted_at is null;
create index if not exists item_flags_trip_item_idx
  on public.item_flags(trip_id, item_id);
create index if not exists item_links_trip_item_idx
  on public.item_links(trip_id, item_id)
  where deleted_at is null;
create index if not exists trip_attachments_trip_item_idx
  on public.trip_attachments(trip_id, item_id)
  where deleted_at is null;
create index if not exists applied_operations_trip_applied_idx
  on public.applied_operations(trip_id, applied_at);
create index if not exists trip_changes_trip_seq_idx
  on public.trip_changes(trip_id, seq);

-- ---------------------------------------------------------------------------
-- Integridad y revisiones server-side
-- ---------------------------------------------------------------------------

create or replace function private.bump_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function private.validate_item_day_trip()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.day_id is not null and not exists (
    select 1
    from public.trip_days as day_row
    where day_row.id = new.day_id
      and day_row.trip_id = new.trip_id
      and day_row.deleted_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'day_id does not belong to trip_id or the day is deleted';
  end if;
  return new;
end;
$$;

create or replace function private.validate_attachment_item_trip()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.item_id is not null and not exists (
    select 1
    from public.itinerary_items as item_row
    where item_row.id = new.item_id
      and item_row.trip_id = new.trip_id
      and item_row.deleted_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'item_id does not belong to trip_id or the item is deleted';
  end if;
  return new;
end;
$$;

drop trigger if exists itinerary_items_validate_day_trip on public.itinerary_items;
create trigger itinerary_items_validate_day_trip
  before insert or update of trip_id, day_id
  on public.itinerary_items
  for each row execute function private.validate_item_day_trip();

drop trigger if exists trip_attachments_validate_item_trip on public.trip_attachments;
create trigger trip_attachments_validate_item_trip
  before insert or update of trip_id, item_id
  on public.trip_attachments
  for each row execute function private.validate_attachment_item_trip();

-- ---------------------------------------------------------------------------
-- Backfill idempotente desde planner_state
-- ---------------------------------------------------------------------------

create or replace function private.backfill_planner_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_trips integer := 0;
  inserted_days integer := 0;
  inserted_items integer := 0;
  inserted_flags integer := 0;
  inserted_links integer := 0;
begin
  if pg_catalog.to_regclass('public.planner_state') is null then
    raise exception using
      errcode = '42P01',
      message = 'public.planner_state must exist before running the normalized migration';
  end if;

  insert into public.trips (id, legacy_plan_id, name, timezone, created_at, updated_at)
  select
    private.deterministic_uuid('trip', state_row.id),
    state_row.id,
    case state_row.id
      when 'carretera-austral-general' then 'General'
      when 'carretera-austral-molina' then 'Molina'
      when 'carretera-austral-inaki' then 'Iñaki'
      when 'carretera-austral-nef' then 'Nef'
      when 'carretera-austral-ross' then 'Ross'
      else pg_catalog.initcap(pg_catalog.replace(
        pg_catalog.regexp_replace(state_row.id, '^carretera-austral-', ''),
        '-',
        ' '
      ))
    end,
    'America/Santiago',
    state_row.updated_at,
    state_row.updated_at
  from public.planner_state as state_row
  where pg_catalog.jsonb_typeof(state_row.state_json) = 'object'
  on conflict do nothing;
  get diagnostics inserted_trips = row_count;

  with source_days as (
    select
      state_row.id as legacy_plan_id,
      trip_row.id as trip_id,
      day_entry.value as day_json,
      day_entry.ordinality::integer as legacy_ordinal
    from public.planner_state as state_row
    join public.trips as trip_row
      on trip_row.legacy_plan_id = state_row.id
    cross join lateral pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(state_row.state_json -> 'days') = 'array'
          then state_row.state_json -> 'days'
        else '[]'::jsonb
      end
    ) with ordinality as day_entry(value, ordinality)
  )
  insert into public.trip_days (
    id,
    trip_id,
    legacy_id,
    legacy_ordinal,
    sort_key,
    title
  )
  select
    private.deterministic_uuid(
      'day',
      source_days.legacy_plan_id || ':' ||
      coalesce(source_days.day_json ->> 'id', '') || ':' ||
      source_days.legacy_ordinal::text
    ),
    source_days.trip_id,
    nullif(source_days.day_json ->> 'id', ''),
    source_days.legacy_ordinal,
    pg_catalog.lpad(source_days.legacy_ordinal::text, 12, '0'),
    pg_catalog.left(
      coalesce(nullif(pg_catalog.btrim(source_days.day_json ->> 'name'), ''), 'Día ' || source_days.legacy_ordinal),
      120
    )
  from source_days
  on conflict do nothing;
  get diagnostics inserted_days = row_count;

  with source_items as (
    select
      state_row.id as legacy_plan_id,
      trip_row.id as trip_id,
      item_entry.value as item_json,
      item_entry.ordinality::integer as legacy_ordinal
    from public.planner_state as state_row
    join public.trips as trip_row
      on trip_row.legacy_plan_id = state_row.id
    cross join lateral pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(state_row.state_json -> 'items') = 'array'
          then state_row.state_json -> 'items'
        else '[]'::jsonb
      end
    ) with ordinality as item_entry(value, ordinality)
  ),
  prepared_items as (
    select
      source_items.*,
      private.deterministic_uuid(
        'item',
        source_items.legacy_plan_id || ':' ||
        coalesce(source_items.item_json ->> 'id', '') || ':' ||
        source_items.legacy_ordinal::text
      ) as normalized_item_id,
      day_match.id as normalized_day_id
    from source_items
    left join lateral (
      select day_row.id
      from public.trip_days as day_row
      where day_row.trip_id = source_items.trip_id
        and day_row.legacy_id = source_items.item_json ->> 'dayId'
      order by day_row.legacy_ordinal, day_row.id
      limit 1
    ) as day_match on true
  )
  insert into public.itinerary_items (
    id,
    trip_id,
    day_id,
    legacy_id,
    legacy_ordinal,
    sort_key,
    kind,
    title,
    category,
    location_text,
    origin_text,
    destination_text,
    transport_mode,
    duration_minutes,
    cost_clp,
    notes
  )
  select
    prepared_items.normalized_item_id,
    prepared_items.trip_id,
    prepared_items.normalized_day_id,
    nullif(prepared_items.item_json ->> 'id', ''),
    prepared_items.legacy_ordinal,
    pg_catalog.lpad(
      case
        when coalesce(prepared_items.item_json ->> 'order', '') ~ '^[0-9]+$'
          then (prepared_items.item_json ->> 'order')::bigint
        else prepared_items.legacy_ordinal - 1
      end::text,
      12,
      '0'
    ) || ':' || pg_catalog.lpad(prepared_items.legacy_ordinal::text, 12, '0'),
    case
      when prepared_items.item_json ->> 'kind' in ('place', 'trip')
        then prepared_items.item_json ->> 'kind'
      when prepared_items.item_json ->> 'type' in ('Traslado', 'Ferry')
        then 'trip'
      else 'place'
    end,
    pg_catalog.left(
      coalesce(nullif(pg_catalog.btrim(prepared_items.item_json ->> 'name'), ''), 'Parada sin nombre'),
      180
    ),
    pg_catalog.left(coalesce(nullif(prepared_items.item_json ->> 'type', ''), 'Logística'), 80),
    nullif(pg_catalog.left(coalesce(prepared_items.item_json ->> 'location', ''), 240), ''),
    nullif(pg_catalog.left(coalesce(prepared_items.item_json ->> 'start', ''), 160), ''),
    nullif(pg_catalog.left(coalesce(prepared_items.item_json ->> 'end', ''), 160), ''),
    case
      when prepared_items.item_json ->> 'type' in ('Traslado', 'Ferry')
        then prepared_items.item_json ->> 'type'
      else null
    end,
    case
      when coalesce(prepared_items.item_json ->> 'duration', '') ~ '^[0-9]+([.][0-9]+)?$'
        then pg_catalog.greatest(
          1,
          pg_catalog.least(
            10080,
            pg_catalog.round((prepared_items.item_json ->> 'duration')::numeric * 60)::integer
          )
        )
      else 60
    end,
    case
      when coalesce(prepared_items.item_json ->> 'cost', '') ~ '^[0-9]+([.][0-9]+)?$'
        then pg_catalog.least(
          99999999999999::numeric,
          pg_catalog.round((prepared_items.item_json ->> 'cost')::numeric)
        )::bigint
      else 0
    end,
    pg_catalog.left(coalesce(prepared_items.item_json ->> 'notes', ''), 12000)
  from prepared_items
  on conflict do nothing;
  get diagnostics inserted_items = row_count;

  with source_items as (
    select
      state_row.id as legacy_plan_id,
      trip_row.id as trip_id,
      item_entry.value as item_json,
      item_entry.ordinality::integer as legacy_ordinal
    from public.planner_state as state_row
    join public.trips as trip_row
      on trip_row.legacy_plan_id = state_row.id
    cross join lateral pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(state_row.state_json -> 'items') = 'array'
          then state_row.state_json -> 'items'
        else '[]'::jsonb
      end
    ) with ordinality as item_entry(value, ordinality)
  ),
  normalized_items as (
    select
      source_items.*,
      private.deterministic_uuid(
        'item',
        source_items.legacy_plan_id || ':' ||
        coalesce(source_items.item_json ->> 'id', '') || ':' ||
        source_items.legacy_ordinal::text
      ) as item_id
    from source_items
  )
  insert into public.item_flags (trip_id, item_id, flag)
  select
    normalized_items.trip_id,
    normalized_items.item_id,
    flag_entry.flag
  from normalized_items
  cross join lateral (
    values
      ('must', normalized_items.item_json #>> '{marks,must}'),
      ('booked', normalized_items.item_json #>> '{marks,booked}'),
      ('done', normalized_items.item_json #>> '{marks,done}'),
      ('lodging', normalized_items.item_json #>> '{marks,lodging}'),
      ('dayvisit', normalized_items.item_json #>> '{marks,dayvisit}')
  ) as flag_entry(flag, enabled)
  where pg_catalog.lower(coalesce(flag_entry.enabled, 'false')) = 'true'
  on conflict do nothing;
  get diagnostics inserted_flags = row_count;

  with source_items as (
    select
      state_row.id as legacy_plan_id,
      trip_row.id as trip_id,
      item_entry.value as item_json,
      item_entry.ordinality::integer as legacy_ordinal
    from public.planner_state as state_row
    join public.trips as trip_row
      on trip_row.legacy_plan_id = state_row.id
    cross join lateral pg_catalog.jsonb_array_elements(
      case
        when pg_catalog.jsonb_typeof(state_row.state_json -> 'items') = 'array'
          then state_row.state_json -> 'items'
        else '[]'::jsonb
      end
    ) with ordinality as item_entry(value, ordinality)
  ),
  normalized_items as (
    select
      source_items.*,
      private.deterministic_uuid(
        'item',
        source_items.legacy_plan_id || ':' ||
        coalesce(source_items.item_json ->> 'id', '') || ':' ||
        source_items.legacy_ordinal::text
      ) as item_id
    from source_items
  )
  insert into public.item_links (id, trip_id, item_id, kind, label, url)
  select
    private.deterministic_uuid('item-link', normalized_items.item_id::text || ':' || link_entry.kind),
    normalized_items.trip_id,
    normalized_items.item_id,
    link_entry.kind,
    link_entry.label,
    pg_catalog.left(link_entry.url, 2048)
  from normalized_items
  cross join lateral (
    values
      ('map', 'Mapa', normalized_items.item_json ->> 'mapUrl'),
      (
        'reservation',
        'Reserva',
        coalesce(
          normalized_items.item_json ->> 'reservationUrl',
          normalized_items.item_json ->> 'bookingUrl'
        )
      )
  ) as link_entry(kind, label, url)
  where link_entry.url ~* '^https?://'
  on conflict do nothing;
  get diagnostics inserted_links = row_count;

  return pg_catalog.jsonb_build_object(
    'trips', inserted_trips,
    'days', inserted_days,
    'items', inserted_items,
    'flags', inserted_flags,
    'links', inserted_links
  );
end;
$$;

-- El backfill inicial no sobrescribe filas ya normalizadas. seed.sql vuelve a
-- invocarlo después de insertar los datos legados durante `supabase db reset`.
select private.backfill_planner_state();

-- ---------------------------------------------------------------------------
-- Membresía y autorización compartida por Data API, Realtime y Storage
-- ---------------------------------------------------------------------------

create or replace function private.has_trip_role(target_trip_id uuid, required_role text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members as member_row
    where member_row.trip_id = target_trip_id
      and member_row.user_id = (select auth.uid())
      and private.role_rank(member_row.role) >= private.role_rank(required_role)
  );
$$;

create or replace function private.can_access_trip_topic(topic_value text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members as member_row
    where member_row.user_id = (select auth.uid())
      and topic_value = 'trip:' || member_row.trip_id::text
  );
$$;

create or replace function private.can_access_storage_object(object_name text, required_role text default 'viewer')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.trip_members as member_row
    where member_row.user_id = (select auth.uid())
      and private.role_rank(member_row.role) >= private.role_rank(required_role)
      and object_name like 'trips/' || member_row.trip_id::text || '/%'
  );
$$;

-- ---------------------------------------------------------------------------
-- Auditoría durable + Broadcast. Realtime es señal; trip_changes es el cursor.
-- ---------------------------------------------------------------------------

create or replace function private.log_and_broadcast_trip_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_json jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  old_json jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  target_trip_id uuid;
  target_entity_id uuid;
  target_revision bigint;
begin
  target_trip_id := coalesce(
    nullif(new_json ->> 'trip_id', '')::uuid,
    nullif(old_json ->> 'trip_id', '')::uuid,
    nullif(new_json ->> 'id', '')::uuid,
    nullif(old_json ->> 'id', '')::uuid
  );

  target_entity_id := coalesce(
    nullif(new_json ->> 'id', '')::uuid,
    nullif(old_json ->> 'id', '')::uuid,
    nullif(new_json ->> 'item_id', '')::uuid,
    nullif(old_json ->> 'item_id', '')::uuid
  );

  target_revision := coalesce(
    nullif(new_json ->> 'revision', '')::bigint,
    nullif(old_json ->> 'revision', '')::bigint
  );

  insert into public.trip_changes (
    trip_id,
    entity_type,
    entity_id,
    operation,
    revision,
    actor_id,
    row_data
  ) values (
    target_trip_id,
    tg_table_name,
    target_entity_id,
    tg_op,
    target_revision,
    auth.uid(),
    coalesce(new_json, old_json)
  );

  perform realtime.broadcast_changes(
    'trip:' || target_trip_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Las revisiones comienzan a avanzar después del backfill.
drop trigger if exists trips_bump_revision on public.trips;
create trigger trips_bump_revision
  before update on public.trips
  for each row execute function private.bump_revision();

drop trigger if exists trip_days_bump_revision on public.trip_days;
create trigger trip_days_bump_revision
  before update on public.trip_days
  for each row execute function private.bump_revision();

drop trigger if exists itinerary_items_bump_revision on public.itinerary_items;
create trigger itinerary_items_bump_revision
  before update on public.itinerary_items
  for each row execute function private.bump_revision();

drop trigger if exists item_links_bump_revision on public.item_links;
create trigger item_links_bump_revision
  before update on public.item_links
  for each row execute function private.bump_revision();

drop trigger if exists trip_attachments_bump_revision on public.trip_attachments;
create trigger trip_attachments_bump_revision
  before update on public.trip_attachments
  for each row execute function private.bump_revision();

drop trigger if exists trips_log_change on public.trips;
create trigger trips_log_change
  after insert or update or delete on public.trips
  for each row execute function private.log_and_broadcast_trip_change();

drop trigger if exists trip_days_log_change on public.trip_days;
create trigger trip_days_log_change
  after insert or update or delete on public.trip_days
  for each row execute function private.log_and_broadcast_trip_change();

drop trigger if exists itinerary_items_log_change on public.itinerary_items;
create trigger itinerary_items_log_change
  after insert or update or delete on public.itinerary_items
  for each row execute function private.log_and_broadcast_trip_change();

drop trigger if exists item_flags_log_change on public.item_flags;
create trigger item_flags_log_change
  after insert or update or delete on public.item_flags
  for each row execute function private.log_and_broadcast_trip_change();

drop trigger if exists item_links_log_change on public.item_links;
create trigger item_links_log_change
  after insert or update or delete on public.item_links
  for each row execute function private.log_and_broadcast_trip_change();

drop trigger if exists trip_attachments_log_change on public.trip_attachments;
create trigger trip_attachments_log_change
  after insert or update or delete on public.trip_attachments
  for each row execute function private.log_and_broadcast_trip_change();

-- ---------------------------------------------------------------------------
-- RPC pública 1/4: canjear enlace después de signInAnonymously()
-- Signature: redeem_trip_share(token text) -> jsonb
-- ---------------------------------------------------------------------------

create or replace function public.redeem_trip_share(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  share_row public.trip_share_links%rowtype;
  effective_role text;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'anonymous Auth session required';
  end if;

  if token is null or char_length(token) < 32 or char_length(token) > 512 then
    raise exception using errcode = '22023', message = 'invalid share token';
  end if;

  select link_row.*
  into share_row
  from public.trip_share_links as link_row
  where link_row.token_hash = private.token_hash(token)
    and link_row.revoked_at is null
    and (link_row.expires_at is null or link_row.expires_at > pg_catalog.now())
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'share token not found, expired, or revoked';
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (share_row.trip_id, current_user_id, share_row.role)
  on conflict (trip_id, user_id) do update
  set role = case
    when private.role_rank(public.trip_members.role) >= private.role_rank(excluded.role)
      then public.trip_members.role
    else excluded.role
  end
  returning role into effective_role;

  update public.trip_share_links
  set
    last_used_at = pg_catalog.now(),
    use_count = use_count + 1
  where id = share_row.id;

  return pg_catalog.jsonb_build_object(
    'trip_id', share_row.trip_id,
    'role', effective_role
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC pública 2/4: snapshot actual para hidratar IndexedDB
-- Signature: get_trip_workspace(trip_id uuid) -> jsonb
-- ---------------------------------------------------------------------------

create or replace function public.get_trip_workspace(trip_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_trip_id uuid := trip_id;
  target_trip public.trips%rowtype;
  days_json jsonb;
  items_json jsonb;
  attachments_json jsonb;
  last_change_seq bigint;
begin
  if not private.has_trip_role(target_trip_id, 'viewer') then
    raise exception using errcode = '42501', message = 'trip membership required';
  end if;

  select trip_row.*
  into target_trip
  from public.trips as trip_row
  where trip_row.id = target_trip_id
    and trip_row.deleted_at is null;

  if not found then
    raise exception using errcode = 'P0002', message = 'trip not found';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(to_jsonb(day_row) order by day_row.sort_key, day_row.id),
    '[]'::jsonb
  )
  into days_json
  from public.trip_days as day_row
  where day_row.trip_id = target_trip_id
    and day_row.deleted_at is null;

  select coalesce(
    pg_catalog.jsonb_agg(
      to_jsonb(item_row) || pg_catalog.jsonb_build_object(
        'marks', pg_catalog.jsonb_build_object(
          'must', exists (
            select 1 from public.item_flags as flag_row
            where flag_row.item_id = item_row.id and flag_row.flag = 'must'
          ),
          'booked', exists (
            select 1 from public.item_flags as flag_row
            where flag_row.item_id = item_row.id and flag_row.flag = 'booked'
          ),
          'done', exists (
            select 1 from public.item_flags as flag_row
            where flag_row.item_id = item_row.id and flag_row.flag = 'done'
          ),
          'lodging', exists (
            select 1 from public.item_flags as flag_row
            where flag_row.item_id = item_row.id and flag_row.flag = 'lodging'
          ),
          'dayvisit', exists (
            select 1 from public.item_flags as flag_row
            where flag_row.item_id = item_row.id and flag_row.flag = 'dayvisit'
          )
        ),
        'links', coalesce((
          select pg_catalog.jsonb_agg(to_jsonb(link_row) order by link_row.created_at, link_row.id)
          from public.item_links as link_row
          where link_row.item_id = item_row.id
            and link_row.deleted_at is null
        ), '[]'::jsonb),
        'attachments', coalesce((
          select pg_catalog.jsonb_agg(to_jsonb(file_row) order by file_row.created_at, file_row.id)
          from public.trip_attachments as file_row
          where file_row.item_id = item_row.id
            and file_row.deleted_at is null
        ), '[]'::jsonb)
      )
      order by item_row.day_id nulls first, item_row.sort_key, item_row.id
    ),
    '[]'::jsonb
  )
  into items_json
  from public.itinerary_items as item_row
  where item_row.trip_id = target_trip_id
    and item_row.deleted_at is null;

  select coalesce(
    pg_catalog.jsonb_agg(to_jsonb(file_row) order by file_row.created_at, file_row.id),
    '[]'::jsonb
  )
  into attachments_json
  from public.trip_attachments as file_row
  where file_row.trip_id = target_trip_id
    and file_row.deleted_at is null;

  select coalesce(pg_catalog.max(change_row.seq), 0)
  into last_change_seq
  from public.trip_changes as change_row
  where change_row.trip_id = target_trip_id;

  return pg_catalog.jsonb_build_object(
    'trip', to_jsonb(target_trip),
    'days', days_json,
    'items', items_json,
    'attachments', attachments_json,
    'last_seq', last_change_seq
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC normalizada: lote atómico e idempotente para las tablas relacionales.
-- La PWA usa apply_workspace_operations(); esta función queda para una futura
-- transición desde el documento JSON al modelo relacional.
-- Signature: apply_normalized_trip_operations(trip_id uuid, operations jsonb)
-- ---------------------------------------------------------------------------

create or replace function public.apply_normalized_trip_operations(trip_id uuid, operations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_trip_id uuid := trip_id;
  operation_row jsonb;
  operation_id uuid;
  operation_entity text;
  operation_action text;
  entity_id uuid;
  base_revision bigint;
  payload jsonb;
  request_hash text;
  claimed_operation uuid;
  stored_hash text;
  stored_result jsonb;
  stored_trip_id uuid;
  current_revision bigint;
  next_revision bigint;
  result_row jsonb;
  results_json jsonb := '[]'::jsonb;
  last_change_seq bigint;
begin
  if not private.has_trip_role(target_trip_id, 'editor') then
    raise exception using errcode = '42501', message = 'trip editor membership required';
  end if;

  if pg_catalog.jsonb_typeof(operations) <> 'array' then
    raise exception using errcode = '22023', message = 'operations must be a JSON array';
  end if;

  if pg_catalog.jsonb_array_length(operations) > 100 then
    raise exception using errcode = '22023', message = 'a batch may contain at most 100 operations';
  end if;

  for operation_row in
    select array_entry.value
    from pg_catalog.jsonb_array_elements(operations) as array_entry(value)
  loop
    if pg_catalog.jsonb_typeof(operation_row) <> 'object' then
      raise exception using errcode = '22023', message = 'each operation must be a JSON object';
    end if;

    begin
      operation_id := (operation_row ->> 'id')::uuid;
      operation_entity := operation_row ->> 'entity';
      operation_action := operation_row ->> 'action';
      entity_id := (operation_row ->> 'entity_id')::uuid;
      base_revision := nullif(operation_row ->> 'base_revision', '')::bigint;
      payload := coalesce(operation_row -> 'payload', '{}'::jsonb);
    exception when others then
      raise exception using errcode = '22023', message = 'operation id/entity_id/base_revision is invalid';
    end;

    if operation_id is null or entity_id is null then
      raise exception using errcode = '22023', message = 'operation id and entity_id are required';
    end if;

    if pg_catalog.jsonb_typeof(payload) <> 'object' then
      raise exception using errcode = '22023', message = 'operation payload must be a JSON object';
    end if;

    if operation_entity is null
       or operation_entity not in ('trip', 'day', 'item', 'flag', 'link', 'attachment')
       or operation_action is null
       or operation_action not in ('upsert', 'delete') then
      raise exception using errcode = '22023', message = 'unsupported operation entity or action';
    end if;

    request_hash := private.token_hash(operation_row::text);
    claimed_operation := null;

    insert into public.applied_operations (
      operation_id,
      trip_id,
      actor_id,
      request_hash,
      result
    ) values (
      operation_id,
      target_trip_id,
      auth.uid(),
      request_hash,
      null
    )
    on conflict (operation_id) do nothing
    returning public.applied_operations.operation_id into claimed_operation;

    if claimed_operation is null then
      select applied_row.trip_id, applied_row.request_hash, applied_row.result
      into stored_trip_id, stored_hash, stored_result
      from public.applied_operations as applied_row
      where applied_row.operation_id = operation_id;

      if stored_trip_id is distinct from target_trip_id then
        raise exception using errcode = '22023', message = 'operation id belongs to another trip';
      end if;

      if stored_hash is distinct from request_hash then
        raise exception using errcode = '22023', message = 'operation id was reused with different content';
      end if;

      if stored_result is null then
        raise exception using errcode = '40001', message = 'operation is still being applied; retry';
      end if;

      results_json := results_json || pg_catalog.jsonb_build_array(stored_result);
      continue;
    end if;

    current_revision := null;
    next_revision := null;

    if operation_entity = 'trip' then
      if entity_id <> target_trip_id then
        raise exception using errcode = '22023', message = 'trip entity_id must equal trip_id';
      end if;

      select trip_row.revision
      into current_revision
      from public.trips as trip_row
      where trip_row.id = target_trip_id
        and trip_row.deleted_at is null
      for update;

      if not found or base_revision is distinct from current_revision then
        raise exception using errcode = '40001', message = 'trip revision conflict';
      end if;

      if operation_action = 'delete' then
        if not private.has_trip_role(target_trip_id, 'owner') then
          raise exception using errcode = '42501', message = 'trip owner membership required to delete';
        end if;
        update public.trips
        set deleted_at = pg_catalog.now()
        where id = target_trip_id
        returning revision into next_revision;
      else
        update public.trips
        set
          name = case when payload ? 'name' then payload ->> 'name' else name end,
          start_date = case
            when payload ? 'start_date' then nullif(payload ->> 'start_date', '')::date
            else start_date
          end,
          timezone = case when payload ? 'timezone' then payload ->> 'timezone' else timezone end,
          deleted_at = null
        where id = target_trip_id
        returning revision into next_revision;
      end if;

    elsif operation_entity = 'day' then
      select day_row.revision
      into current_revision
      from public.trip_days as day_row
      where day_row.id = entity_id
        and day_row.trip_id = target_trip_id
      for update;

      if found then
        if base_revision is distinct from current_revision then
          raise exception using errcode = '40001', message = 'day revision conflict';
        end if;

        if operation_action = 'delete' then
          -- Igual que el modelo legado: al borrar un día, sus elementos quedan
          -- disponibles en "Sin asignar" en vez de apuntar a un día oculto.
          update public.itinerary_items
          set day_id = null
          where trip_id = target_trip_id
            and day_id = entity_id
            and deleted_at is null;

          update public.trip_days
          set deleted_at = pg_catalog.now()
          where id = entity_id and trip_id = target_trip_id
          returning revision into next_revision;
        else
          update public.trip_days
          set
            sort_key = case when payload ? 'sort_key' then payload ->> 'sort_key' else sort_key end,
            day_date = case
              when payload ? 'date' then nullif(payload ->> 'date', '')::date
              else day_date
            end,
            title = case when payload ? 'title' then payload ->> 'title' else title end,
            deleted_at = null
          where id = entity_id and trip_id = target_trip_id
          returning revision into next_revision;
        end if;
      else
        if operation_action = 'delete' then
          raise exception using errcode = 'P0002', message = 'day not found';
        end if;
        if base_revision is not null and base_revision <> 0 then
          raise exception using errcode = '40001', message = 'new day base_revision must be null or zero';
        end if;
        insert into public.trip_days (id, trip_id, sort_key, day_date, title)
        values (
          entity_id,
          target_trip_id,
          coalesce(nullif(payload ->> 'sort_key', ''), entity_id::text),
          nullif(payload ->> 'date', '')::date,
          coalesce(nullif(payload ->> 'title', ''), 'Día')
        )
        returning revision into next_revision;
      end if;

    elsif operation_entity = 'item' then
      select item_row.revision
      into current_revision
      from public.itinerary_items as item_row
      where item_row.id = entity_id
        and item_row.trip_id = target_trip_id
      for update;

      if found then
        if base_revision is distinct from current_revision then
          raise exception using errcode = '40001', message = 'item revision conflict';
        end if;

        if operation_action = 'delete' then
          update public.itinerary_items
          set deleted_at = pg_catalog.now()
          where id = entity_id and trip_id = target_trip_id
          returning revision into next_revision;
        else
          update public.itinerary_items
          set
            day_id = case
              when payload ? 'day_id' then nullif(payload ->> 'day_id', '')::uuid
              else day_id
            end,
            sort_key = case when payload ? 'sort_key' then payload ->> 'sort_key' else sort_key end,
            kind = case when payload ? 'kind' then payload ->> 'kind' else kind end,
            title = case when payload ? 'title' then payload ->> 'title' else title end,
            category = case when payload ? 'category' then payload ->> 'category' else category end,
            location_text = case when payload ? 'location' then nullif(payload ->> 'location', '') else location_text end,
            origin_text = case when payload ? 'origin' then nullif(payload ->> 'origin', '') else origin_text end,
            destination_text = case when payload ? 'destination' then nullif(payload ->> 'destination', '') else destination_text end,
            transport_mode = case when payload ? 'transport_mode' then nullif(payload ->> 'transport_mode', '') else transport_mode end,
            duration_minutes = case when payload ? 'duration_minutes' then (payload ->> 'duration_minutes')::integer else duration_minutes end,
            cost_clp = case when payload ? 'cost_clp' then (payload ->> 'cost_clp')::bigint else cost_clp end,
            notes = case when payload ? 'notes' then coalesce(payload ->> 'notes', '') else notes end,
            latitude = case when payload ? 'latitude' then nullif(payload ->> 'latitude', '')::double precision else latitude end,
            longitude = case when payload ? 'longitude' then nullif(payload ->> 'longitude', '')::double precision else longitude end,
            deleted_at = null
          where id = entity_id and trip_id = target_trip_id
          returning revision into next_revision;
        end if;
      else
        if operation_action = 'delete' then
          raise exception using errcode = 'P0002', message = 'item not found';
        end if;
        if base_revision is not null and base_revision <> 0 then
          raise exception using errcode = '40001', message = 'new item base_revision must be null or zero';
        end if;
        insert into public.itinerary_items (
          id,
          trip_id,
          day_id,
          sort_key,
          kind,
          title,
          category,
          location_text,
          origin_text,
          destination_text,
          transport_mode,
          duration_minutes,
          cost_clp,
          notes,
          latitude,
          longitude
        ) values (
          entity_id,
          target_trip_id,
          nullif(payload ->> 'day_id', '')::uuid,
          coalesce(nullif(payload ->> 'sort_key', ''), entity_id::text),
          coalesce(nullif(payload ->> 'kind', ''), 'place'),
          coalesce(nullif(payload ->> 'title', ''), 'Parada sin nombre'),
          coalesce(nullif(payload ->> 'category', ''), 'Logística'),
          nullif(payload ->> 'location', ''),
          nullif(payload ->> 'origin', ''),
          nullif(payload ->> 'destination', ''),
          nullif(payload ->> 'transport_mode', ''),
          coalesce(nullif(payload ->> 'duration_minutes', '')::integer, 60),
          coalesce(nullif(payload ->> 'cost_clp', '')::bigint, 0),
          coalesce(payload ->> 'notes', ''),
          nullif(payload ->> 'latitude', '')::double precision,
          nullif(payload ->> 'longitude', '')::double precision
        )
        returning revision into next_revision;
      end if;

    elsif operation_entity = 'flag' then
      if payload ->> 'flag' is null
         or payload ->> 'flag' not in ('must', 'booked', 'done', 'lodging', 'dayvisit') then
        raise exception using errcode = '22023', message = 'unsupported item flag';
      end if;

      if not exists (
        select 1 from public.itinerary_items as item_row
        where item_row.id = entity_id
          and item_row.trip_id = target_trip_id
          and item_row.deleted_at is null
      ) then
        raise exception using errcode = 'P0002', message = 'flag item not found';
      end if;

      if operation_action = 'delete' or coalesce((payload ->> 'enabled')::boolean, true) is false then
        delete from public.item_flags
        where item_id = entity_id
          and trip_id = target_trip_id
          and flag = payload ->> 'flag';
      else
        insert into public.item_flags (trip_id, item_id, flag)
        values (target_trip_id, entity_id, payload ->> 'flag')
        on conflict (item_id, flag) do nothing;
      end if;

    elsif operation_entity = 'link' then
      select link_row.revision
      into current_revision
      from public.item_links as link_row
      where link_row.id = entity_id
        and link_row.trip_id = target_trip_id
      for update;

      if found then
        if base_revision is distinct from current_revision then
          raise exception using errcode = '40001', message = 'link revision conflict';
        end if;
        if operation_action = 'delete' then
          update public.item_links
          set deleted_at = pg_catalog.now()
          where id = entity_id and trip_id = target_trip_id
          returning revision into next_revision;
        else
          update public.item_links
          set
            item_id = case when payload ? 'item_id' then (payload ->> 'item_id')::uuid else item_id end,
            kind = case when payload ? 'kind' then payload ->> 'kind' else kind end,
            label = case when payload ? 'label' then nullif(payload ->> 'label', '') else label end,
            url = case when payload ? 'url' then payload ->> 'url' else url end,
            deleted_at = null
          where id = entity_id and trip_id = target_trip_id
          returning revision into next_revision;
        end if;
      else
        if operation_action = 'delete' then
          raise exception using errcode = 'P0002', message = 'link not found';
        end if;
        if base_revision is not null and base_revision <> 0 then
          raise exception using errcode = '40001', message = 'new link base_revision must be null or zero';
        end if;
        insert into public.item_links (id, trip_id, item_id, kind, label, url)
        values (
          entity_id,
          target_trip_id,
          (payload ->> 'item_id')::uuid,
          payload ->> 'kind',
          nullif(payload ->> 'label', ''),
          payload ->> 'url'
        )
        returning revision into next_revision;
      end if;

    elsif operation_entity = 'attachment' then
      select file_row.revision
      into current_revision
      from public.trip_attachments as file_row
      where file_row.id = entity_id
        and file_row.trip_id = target_trip_id
      for update;

      if found then
        if base_revision is distinct from current_revision then
          raise exception using errcode = '40001', message = 'attachment revision conflict';
        end if;
        if operation_action = 'delete' then
          update public.trip_attachments
          set deleted_at = pg_catalog.now()
          where id = entity_id and trip_id = target_trip_id
          returning revision into next_revision;
        else
          update public.trip_attachments
          set
            item_id = case when payload ? 'item_id' then nullif(payload ->> 'item_id', '')::uuid else item_id end,
            bucket_id = case when payload ? 'bucket_id' then payload ->> 'bucket_id' else bucket_id end,
            object_path = case when payload ? 'object_path' then payload ->> 'object_path' else object_path end,
            filename = case when payload ? 'filename' then payload ->> 'filename' else filename end,
            mime_type = case when payload ? 'mime_type' then nullif(payload ->> 'mime_type', '') else mime_type end,
            size_bytes = case when payload ? 'size_bytes' then nullif(payload ->> 'size_bytes', '')::bigint else size_bytes end,
            status = case when payload ? 'status' then payload ->> 'status' else status end,
            deleted_at = null
          where id = entity_id and trip_id = target_trip_id
          returning revision into next_revision;
        end if;
      else
        if operation_action = 'delete' then
          raise exception using errcode = 'P0002', message = 'attachment not found';
        end if;
        if base_revision is not null and base_revision <> 0 then
          raise exception using errcode = '40001', message = 'new attachment base_revision must be null or zero';
        end if;
        insert into public.trip_attachments (
          id,
          trip_id,
          item_id,
          bucket_id,
          object_path,
          filename,
          mime_type,
          size_bytes,
          status
        ) values (
          entity_id,
          target_trip_id,
          nullif(payload ->> 'item_id', '')::uuid,
          coalesce(nullif(payload ->> 'bucket_id', ''), 'trip-files'),
          payload ->> 'object_path',
          payload ->> 'filename',
          nullif(payload ->> 'mime_type', ''),
          nullif(payload ->> 'size_bytes', '')::bigint,
          coalesce(nullif(payload ->> 'status', ''), 'pending')
        )
        returning revision into next_revision;
      end if;
    end if;

    result_row := pg_catalog.jsonb_build_object(
      'id', operation_id,
      'entity', operation_entity,
      'entity_id', entity_id,
      'status', 'applied',
      'revision', next_revision
    );

    update public.applied_operations
    set result = result_row, applied_at = pg_catalog.now()
    where public.applied_operations.operation_id = operation_id;

    results_json := results_json || pg_catalog.jsonb_build_array(result_row);
  end loop;

  select coalesce(pg_catalog.max(change_row.seq), 0)
  into last_change_seq
  from public.trip_changes as change_row
  where change_row.trip_id = target_trip_id;

  return pg_catalog.jsonb_build_object(
    'results', results_json,
    'last_seq', last_change_seq
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC pública 4/4: catch-up durable por cursor, máximo 500 cambios por página
-- Signature: pull_trip_changes(trip_id uuid, after_seq bigint) -> jsonb
-- ---------------------------------------------------------------------------

create or replace function public.pull_trip_changes(trip_id uuid, after_seq bigint)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_trip_id uuid := trip_id;
  cursor_seq bigint := pg_catalog.greatest(coalesce(after_seq, 0), 0);
  changes_json jsonb;
  next_seq bigint;
  has_more boolean;
begin
  if not private.has_trip_role(target_trip_id, 'viewer') then
    raise exception using errcode = '42501', message = 'trip membership required';
  end if;

  with page as (
    select change_row.*
    from public.trip_changes as change_row
    where change_row.trip_id = target_trip_id
      and change_row.seq > cursor_seq
    order by change_row.seq
    limit 500
  )
  select
    coalesce(pg_catalog.jsonb_agg(to_jsonb(page) order by page.seq), '[]'::jsonb),
    coalesce(pg_catalog.max(page.seq), cursor_seq)
  into changes_json, next_seq
  from page;

  select exists (
    select 1
    from public.trip_changes as change_row
    where change_row.trip_id = target_trip_id
      and change_row.seq > next_seq
  ) into has_more;

  return pg_catalog.jsonb_build_object(
    'changes', changes_json,
    'next_seq', next_seq,
    'has_more', has_more
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS y privilegios de Data API
-- ---------------------------------------------------------------------------

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_share_links enable row level security;
alter table public.trip_days enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.item_flags enable row level security;
alter table public.item_links enable row level security;
alter table public.trip_attachments enable row level security;
alter table public.applied_operations enable row level security;
alter table public.trip_changes enable row level security;

drop policy if exists trips_member_select on public.trips;
create policy trips_member_select on public.trips
  for select to authenticated
  using (private.has_trip_role(id, 'viewer'));

drop policy if exists trip_days_member_select on public.trip_days;
create policy trip_days_member_select on public.trip_days
  for select to authenticated
  using (private.has_trip_role(trip_id, 'viewer'));

drop policy if exists itinerary_items_member_select on public.itinerary_items;
create policy itinerary_items_member_select on public.itinerary_items
  for select to authenticated
  using (private.has_trip_role(trip_id, 'viewer'));

drop policy if exists item_flags_member_select on public.item_flags;
create policy item_flags_member_select on public.item_flags
  for select to authenticated
  using (private.has_trip_role(trip_id, 'viewer'));

drop policy if exists item_links_member_select on public.item_links;
create policy item_links_member_select on public.item_links
  for select to authenticated
  using (private.has_trip_role(trip_id, 'viewer'));

drop policy if exists trip_attachments_member_select on public.trip_attachments;
create policy trip_attachments_member_select on public.trip_attachments
  for select to authenticated
  using (private.has_trip_role(trip_id, 'viewer'));

drop policy if exists trip_changes_member_select on public.trip_changes;
create policy trip_changes_member_select on public.trip_changes
  for select to authenticated
  using (private.has_trip_role(trip_id, 'viewer'));

-- Las mutaciones del modelo relacional pasan exclusivamente por
-- apply_normalized_trip_operations().
revoke all on table
  public.trips,
  public.trip_members,
  public.trip_share_links,
  public.trip_days,
  public.itinerary_items,
  public.item_flags,
  public.item_links,
  public.trip_attachments,
  public.applied_operations,
  public.trip_changes
from anon, authenticated;

grant select on table
  public.trips,
  public.trip_days,
  public.itinerary_items,
  public.item_flags,
  public.item_links,
  public.trip_attachments,
  public.trip_changes
to authenticated;

grant usage on schema private to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_trip_role(uuid, text) to authenticated;
grant execute on function private.can_access_trip_topic(text) to authenticated;
grant execute on function private.can_access_storage_object(text, text) to authenticated;

revoke execute on function public.redeem_trip_share(text) from public, anon;
revoke execute on function public.get_trip_workspace(uuid) from public, anon;
revoke execute on function public.apply_normalized_trip_operations(uuid, jsonb) from public, anon;
revoke execute on function public.pull_trip_changes(uuid, bigint) from public, anon;
grant execute on function public.redeem_trip_share(text) to authenticated;
grant execute on function public.get_trip_workspace(uuid) to authenticated;
grant execute on function public.apply_normalized_trip_operations(uuid, jsonb) to authenticated;
grant execute on function public.pull_trip_changes(uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime Broadcast + Presence privados por topic trip:<uuid>
-- ---------------------------------------------------------------------------

alter table realtime.messages enable row level security;

drop policy if exists ruta_austral_trip_topic_receive on realtime.messages;
create policy ruta_austral_trip_topic_receive
  on realtime.messages
  for select
  to authenticated
  using (private.can_access_trip_topic(realtime.topic()));

drop policy if exists ruta_austral_trip_topic_send on realtime.messages;
create policy ruta_austral_trip_topic_send
  on realtime.messages
  for insert
  to authenticated
  with check (private.can_access_trip_topic(realtime.topic()));

-- ---------------------------------------------------------------------------
-- Storage privado. Los objetos viven en trips/<trip_uuid>/<uuid>/<filename>.
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'trip-files',
  'trip-files',
  false,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists ruta_austral_trip_files_select on storage.objects;
create policy ruta_austral_trip_files_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'trip-files'
    and private.can_access_storage_object(name, 'viewer')
  );

drop policy if exists ruta_austral_trip_files_insert on storage.objects;
create policy ruta_austral_trip_files_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'trip-files'
    and private.can_access_storage_object(name, 'editor')
  );

drop policy if exists ruta_austral_trip_files_update on storage.objects;
create policy ruta_austral_trip_files_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'trip-files'
    and private.can_access_storage_object(name, 'editor')
  )
  with check (
    bucket_id = 'trip-files'
    and private.can_access_storage_object(name, 'editor')
  );

drop policy if exists ruta_austral_trip_files_delete on storage.objects;
create policy ruta_austral_trip_files_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'trip-files'
    and private.can_access_storage_object(name, 'editor')
  );

commit;
