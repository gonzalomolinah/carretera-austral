-- Ruta Austral PWA: sincronizacion operacional local-first.
--
-- El enlace de Vercel es la unica barrera de acceso solicitada. Por eso estas
-- RPC se exponen a anon/authenticated y solo aceptan el UUID fijo del viaje.
-- La migracion normalizada anterior se conserva side-by-side para evolucionar
-- el dominio, mientras esta tabla JSON mantiene paridad exacta con la PWA.

begin;

create table if not exists public.ruta_workspace_documents (
  trip_id uuid primary key,
  workspace_json jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now(),
  constraint ruta_workspace_documents_object
    check (jsonb_typeof(workspace_json) = 'object')
);

create table if not exists public.ruta_workspace_operations (
  operation_id uuid primary key,
  trip_id uuid not null references public.ruta_workspace_documents(trip_id) on delete cascade,
  entity_kind text not null,
  entity_id uuid not null,
  action text not null check (action in ('upsert', 'delete')),
  request_hash text not null,
  revision bigint not null,
  result jsonb not null,
  applied_at timestamptz not null default now()
);

create index if not exists ruta_workspace_operations_trip_revision_idx
  on public.ruta_workspace_operations(trip_id, revision);

alter table public.ruta_workspace_documents enable row level security;
alter table public.ruta_workspace_operations enable row level security;

drop policy if exists ruta_workspace_public_read on public.ruta_workspace_documents;
create policy ruta_workspace_public_read
  on public.ruta_workspace_documents
  for select
  to anon, authenticated
  using (trip_id = '4d1fe1a8-4f21-4d76-9f45-7fa2b1f74d40'::uuid);

revoke all on table public.ruta_workspace_documents from anon, authenticated;
revoke all on table public.ruta_workspace_operations from anon, authenticated;
grant select on table public.ruta_workspace_documents to anon, authenticated;

-- Keep the JSON document at the same structural boundary enforced by
-- parseWorkspace() in the PWA. These helpers are private implementation details:
-- callers can mutate the fixed shared trip only through the RPCs below.
create or replace function public.ruta_jsonb_is_text(
  candidate_value jsonb,
  minimum_length integer default 0,
  maximum_length integer default null
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(candidate_value) = 'string'
    and char_length(candidate_value #>> '{}') >= minimum_length
    and (
      maximum_length is null
      or char_length(candidate_value #>> '{}') <= maximum_length
    ),
    false
  );
$$;

create or replace function public.ruta_jsonb_is_uuid(candidate_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(candidate_value) = 'string'
    and (candidate_value #>> '{}') ~* '^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
    false
  );
$$;

create or replace function public.ruta_jsonb_is_nullable_uuid(candidate_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(candidate_value) = 'null'
    or public.ruta_jsonb_is_uuid(candidate_value),
    false
  );
$$;

create or replace function public.ruta_jsonb_is_nullable_text(
  candidate_value jsonb,
  maximum_length integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(candidate_value) = 'null'
    or public.ruta_jsonb_is_text(candidate_value, 0, maximum_length),
    false
  );
$$;

create or replace function public.ruta_jsonb_is_number(candidate_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_typeof(candidate_value) = 'number', false);
$$;

create or replace function public.ruta_jsonb_is_boolean(candidate_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_typeof(candidate_value) = 'boolean', false);
$$;

create or replace function public.ruta_jsonb_is_integer_at_least(
  candidate_value jsonb,
  minimum_value numeric
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(candidate_value) = 'number' then
      trunc((candidate_value #>> '{}')::numeric) = (candidate_value #>> '{}')::numeric
      and (candidate_value #>> '{}')::numeric >= minimum_value
    else false
  end;
$$;

create or replace function public.ruta_workspace_is_valid(
  target_trip_id uuid,
  candidate_workspace jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  entry jsonb;
  nested_entry jsonb;
  coordinates_value jsonb;
begin
  if jsonb_typeof(candidate_workspace) is distinct from 'object' then
    return false;
  end if;

  if not public.ruta_jsonb_is_integer_at_least(candidate_workspace -> 'schemaVersion', 1)
     or not public.ruta_jsonb_is_uuid(candidate_workspace #> '{trip,id}')
     or lower(candidate_workspace #>> '{trip,id}') is distinct from lower(target_trip_id::text)
     or not public.ruta_jsonb_is_uuid(candidate_workspace -> 'selectedPlanId')
     or not public.ruta_jsonb_is_nullable_uuid(candidate_workspace -> 'profileParticipantId')
     or not public.ruta_jsonb_is_integer_at_least(candidate_workspace -> 'lastServerSequence', 0)
     or not public.ruta_jsonb_is_text(candidate_workspace -> 'updatedAt', 1, 100) then
    return false;
  end if;

  if jsonb_typeof(candidate_workspace -> 'trip') is distinct from 'object' then
    return false;
  end if;
  entry := candidate_workspace -> 'trip';
  if not public.ruta_jsonb_is_text(entry -> 'name')
     or not public.ruta_jsonb_is_nullable_text(entry -> 'startDate', 100)
     or not public.ruta_jsonb_is_text(entry -> 'timezone')
     or entry ->> 'currency' is distinct from 'CLP'
     or not public.ruta_jsonb_is_number(entry -> 'attachmentLimitBytes')
     or not public.ruta_jsonb_is_text(entry -> 'createdAt', 1, 100)
     or not public.ruta_jsonb_is_text(entry -> 'updatedAt', 1, 100) then
    return false;
  end if;

  if jsonb_typeof(candidate_workspace -> 'participants') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(candidate_workspace -> 'participants') not between 1 and 100 then
    return false;
  end if;
  for entry in select value from jsonb_array_elements(candidate_workspace -> 'participants') loop
    if jsonb_typeof(entry) is distinct from 'object'
       or not public.ruta_jsonb_is_uuid(entry -> 'id')
       or not public.ruta_jsonb_is_uuid(entry -> 'tripId')
       or lower(entry ->> 'tripId') is distinct from lower(target_trip_id::text)
       or not public.ruta_jsonb_is_text(entry -> 'name')
       or not public.ruta_jsonb_is_text(entry -> 'color')
       or not public.ruta_jsonb_is_boolean(entry -> 'active')
       or not public.ruta_jsonb_is_number(entry -> 'order') then
      return false;
    end if;
  end loop;

  if jsonb_typeof(candidate_workspace -> 'plans') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(candidate_workspace -> 'plans') not between 1 and 100 then
    return false;
  end if;
  for entry in select value from jsonb_array_elements(candidate_workspace -> 'plans') loop
    if jsonb_typeof(entry) is distinct from 'object'
       or not public.ruta_jsonb_is_uuid(entry -> 'id')
       or not public.ruta_jsonb_is_uuid(entry -> 'tripId')
       or lower(entry ->> 'tripId') is distinct from lower(target_trip_id::text)
       or not public.ruta_jsonb_is_text(entry -> 'key')
       or not public.ruta_jsonb_is_text(entry -> 'name')
       or entry ->> 'kind' is null
       or entry ->> 'kind' not in ('final', 'proposal', 'recovery')
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'ownerParticipantId')
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'basedOnPlanId')
       or not public.ruta_jsonb_is_text(entry -> 'createdAt', 1, 100)
       or not public.ruta_jsonb_is_text(entry -> 'updatedAt', 1, 100) then
      return false;
    end if;
  end loop;

  if jsonb_typeof(candidate_workspace -> 'days') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(candidate_workspace -> 'days') > 2000 then
    return false;
  end if;
  for entry in select value from jsonb_array_elements(candidate_workspace -> 'days') loop
    if jsonb_typeof(entry) is distinct from 'object'
       or not public.ruta_jsonb_is_uuid(entry -> 'id')
       or not public.ruta_jsonb_is_uuid(entry -> 'tripId')
       or lower(entry ->> 'tripId') is distinct from lower(target_trip_id::text)
       or not public.ruta_jsonb_is_uuid(entry -> 'planId')
       or not public.ruta_jsonb_is_text(entry -> 'title')
       or not public.ruta_jsonb_is_number(entry -> 'ordinal')
       or not public.ruta_jsonb_is_nullable_text(entry -> 'date', 100)
       or not public.ruta_jsonb_is_text(entry -> 'notes')
       or not public.ruta_jsonb_is_text(entry -> 'updatedAt', 1, 100)
       or not public.ruta_jsonb_is_nullable_text(entry -> 'deletedAt', 100) then
      return false;
    end if;
  end loop;

  if jsonb_typeof(candidate_workspace -> 'items') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(candidate_workspace -> 'items') > 20000 then
    return false;
  end if;
  for entry in select value from jsonb_array_elements(candidate_workspace -> 'items') loop
    if jsonb_typeof(entry) is distinct from 'object'
       or not public.ruta_jsonb_is_uuid(entry -> 'id')
       or not public.ruta_jsonb_is_uuid(entry -> 'tripId')
       or lower(entry ->> 'tripId') is distinct from lower(target_trip_id::text)
       or not public.ruta_jsonb_is_uuid(entry -> 'planId')
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'dayId')
       or entry ->> 'type' is null
       or entry ->> 'type' not in ('activity', 'transit', 'lodging', 'meal', 'fuel', 'other')
       or not public.ruta_jsonb_is_text(entry -> 'title')
       or not public.ruta_jsonb_is_text(entry -> 'location')
       or not public.ruta_jsonb_is_text(entry -> 'origin')
       or not public.ruta_jsonb_is_text(entry -> 'destination')
       or not public.ruta_jsonb_is_nullable_text(entry -> 'startTime', 100)
       or not public.ruta_jsonb_is_nullable_text(entry -> 'endTime', 100)
       or not public.ruta_jsonb_is_number(entry -> 'durationMinutes')
       or not public.ruta_jsonb_is_number(entry -> 'order')
       or entry ->> 'status' is null
       or entry ->> 'status' not in ('idea', 'planned', 'booked', 'done')
       or not public.ruta_jsonb_is_boolean(entry -> 'isMust')
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'assigneeParticipantId')
       or not public.ruta_jsonb_is_number(entry -> 'estimateClp')
       or not public.ruta_jsonb_is_number(entry -> 'actualClp')
       or not public.ruta_jsonb_is_text(entry -> 'notes')
       or not public.ruta_jsonb_is_text(entry -> 'mapUrl')
       or not public.ruta_jsonb_is_text(entry -> 'reservationUrl')
       or not public.ruta_jsonb_is_boolean(entry -> 'locationPending')
       or not public.ruta_jsonb_is_text(entry -> 'updatedAt', 1, 100)
       or not public.ruta_jsonb_is_nullable_text(entry -> 'deletedAt', 100) then
      return false;
    end if;

    coordinates_value := entry -> 'coordinates';
    if jsonb_typeof(coordinates_value) is not distinct from 'null' then
      null;
    elsif jsonb_typeof(coordinates_value) is distinct from 'object'
       or not public.ruta_jsonb_is_number(coordinates_value -> 'latitude')
       or not public.ruta_jsonb_is_number(coordinates_value -> 'longitude') then
      return false;
    elsif (coordinates_value ->> 'latitude')::numeric not between -90 and 90
       or (coordinates_value ->> 'longitude')::numeric not between -180 and 180 then
      return false;
    end if;
  end loop;

  if jsonb_typeof(candidate_workspace -> 'expenses') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(candidate_workspace -> 'expenses') > 20000 then
    return false;
  end if;
  for entry in select value from jsonb_array_elements(candidate_workspace -> 'expenses') loop
    if jsonb_typeof(entry) is distinct from 'object'
       or not public.ruta_jsonb_is_uuid(entry -> 'id')
       or not public.ruta_jsonb_is_uuid(entry -> 'tripId')
       or lower(entry ->> 'tripId') is distinct from lower(target_trip_id::text)
       or not public.ruta_jsonb_is_text(entry -> 'title')
       or not public.ruta_jsonb_is_number(entry -> 'amountClp')
       or entry ->> 'status' is null
       or entry ->> 'status' not in ('estimated', 'actual')
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'payerParticipantId')
       or not public.ruta_jsonb_is_text(entry -> 'date')
       or entry ->> 'category' is null
       or entry ->> 'category' not in ('transport', 'lodging', 'food', 'activity', 'fuel', 'other')
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'linkedItemId')
       or not public.ruta_jsonb_is_text(entry -> 'notes')
       or jsonb_typeof(entry -> 'splits') is distinct from 'array'
       or not public.ruta_jsonb_is_text(entry -> 'updatedAt', 1, 100)
       or not public.ruta_jsonb_is_nullable_text(entry -> 'deletedAt', 100) then
      return false;
    end if;
    if jsonb_array_length(entry -> 'splits') > 100 then
      return false;
    end if;
    for nested_entry in select value from jsonb_array_elements(entry -> 'splits') loop
      if jsonb_typeof(nested_entry) is distinct from 'object'
         or not public.ruta_jsonb_is_uuid(nested_entry -> 'participantId')
         or not public.ruta_jsonb_is_number(nested_entry -> 'amountClp')
         or not public.ruta_jsonb_is_number(nested_entry -> 'percentage')
         or not public.ruta_jsonb_is_boolean(nested_entry -> 'settled') then
        return false;
      end if;
    end loop;
  end loop;

  if jsonb_typeof(candidate_workspace -> 'tasks') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(candidate_workspace -> 'tasks') > 20000 then
    return false;
  end if;
  for entry in select value from jsonb_array_elements(candidate_workspace -> 'tasks') loop
    if jsonb_typeof(entry) is distinct from 'object'
       or not public.ruta_jsonb_is_uuid(entry -> 'id')
       or not public.ruta_jsonb_is_uuid(entry -> 'tripId')
       or lower(entry ->> 'tripId') is distinct from lower(target_trip_id::text)
       or not public.ruta_jsonb_is_text(entry -> 'title')
       or not public.ruta_jsonb_is_text(entry -> 'category')
       or not public.ruta_jsonb_is_boolean(entry -> 'completed')
       or not public.ruta_jsonb_is_nullable_text(entry -> 'dueDate', 100)
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'assigneeParticipantId')
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'linkedDayId')
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'linkedItemId')
       or not public.ruta_jsonb_is_text(entry -> 'updatedAt', 1, 100)
       or not public.ruta_jsonb_is_nullable_text(entry -> 'deletedAt', 100) then
      return false;
    end if;
  end loop;

  if jsonb_typeof(candidate_workspace -> 'contacts') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(candidate_workspace -> 'contacts') > 2000 then
    return false;
  end if;
  for entry in select value from jsonb_array_elements(candidate_workspace -> 'contacts') loop
    if jsonb_typeof(entry) is distinct from 'object'
       or not public.ruta_jsonb_is_uuid(entry -> 'id')
       or not public.ruta_jsonb_is_uuid(entry -> 'tripId')
       or lower(entry ->> 'tripId') is distinct from lower(target_trip_id::text)
       or not public.ruta_jsonb_is_text(entry -> 'name')
       or not public.ruta_jsonb_is_text(entry -> 'role')
       or not public.ruta_jsonb_is_text(entry -> 'phone')
       or not public.ruta_jsonb_is_text(entry -> 'email')
       or not public.ruta_jsonb_is_text(entry -> 'url')
       or not public.ruta_jsonb_is_text(entry -> 'notes')
       or not public.ruta_jsonb_is_text(entry -> 'updatedAt', 1, 100)
       or not public.ruta_jsonb_is_nullable_text(entry -> 'deletedAt', 100) then
      return false;
    end if;
  end loop;

  if jsonb_typeof(candidate_workspace -> 'documents') is distinct from 'array' then
    return false;
  end if;
  if jsonb_array_length(candidate_workspace -> 'documents') > 5000 then
    return false;
  end if;
  for entry in select value from jsonb_array_elements(candidate_workspace -> 'documents') loop
    if jsonb_typeof(entry) is distinct from 'object'
       or not public.ruta_jsonb_is_uuid(entry -> 'id')
       or not public.ruta_jsonb_is_uuid(entry -> 'tripId')
       or lower(entry ->> 'tripId') is distinct from lower(target_trip_id::text)
       or not public.ruta_jsonb_is_text(entry -> 'title')
       or entry ->> 'kind' is null
       or entry ->> 'kind' not in ('link', 'attachment')
       or not public.ruta_jsonb_is_text(entry -> 'url')
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'attachmentId')
       or not public.ruta_jsonb_is_nullable_uuid(entry -> 'linkedItemId')
       or not public.ruta_jsonb_is_text(entry -> 'notes')
       or not public.ruta_jsonb_is_text(entry -> 'updatedAt', 1, 100)
       or not public.ruta_jsonb_is_nullable_text(entry -> 'deletedAt', 100) then
      return false;
    end if;
  end loop;

  return true;
exception
  when others then
    return false;
end;
$$;

create or replace function public.bootstrap_ruta_austral(
  target_trip_id uuid,
  seed_workspace jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_row public.ruta_workspace_documents%rowtype;
begin
  if target_trip_id is distinct from '4d1fe1a8-4f21-4d76-9f45-7fa2b1f74d40'::uuid then
    raise exception using errcode = '22023', message = 'unsupported trip id';
  end if;

  if jsonb_typeof(seed_workspace) is distinct from 'object'
     or pg_column_size(seed_workspace) > 8388608
     or not public.ruta_workspace_is_valid(target_trip_id, seed_workspace) then
    raise exception using errcode = '22023', message = 'invalid seed workspace';
  end if;

  seed_workspace := jsonb_set(seed_workspace, '{lastServerSequence}', '0'::jsonb, true);

  insert into public.ruta_workspace_documents (trip_id, workspace_json)
  values (target_trip_id, seed_workspace)
  on conflict (trip_id) do nothing;

  select document_row.*
  into workspace_row
  from public.ruta_workspace_documents as document_row
  where document_row.trip_id = target_trip_id;

  return jsonb_set(
    workspace_row.workspace_json,
    '{lastServerSequence}',
    to_jsonb(workspace_row.revision),
    true
  );
end;
$$;

create or replace function public.get_app_workspace(target_trip_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  workspace_row public.ruta_workspace_documents%rowtype;
begin
  if target_trip_id is distinct from '4d1fe1a8-4f21-4d76-9f45-7fa2b1f74d40'::uuid then
    raise exception using errcode = '22023', message = 'unsupported trip id';
  end if;

  select document_row.*
  into workspace_row
  from public.ruta_workspace_documents as document_row
  where document_row.trip_id = target_trip_id;

  if not found then
    return null;
  end if;

  return jsonb_set(
    workspace_row.workspace_json,
    '{lastServerSequence}',
    to_jsonb(workspace_row.revision),
    true
  );
end;
$$;

create or replace function public.apply_workspace_operations(
  target_trip_id uuid,
  operations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_row public.ruta_workspace_documents%rowtype;
  current_workspace jsonb;
  current_revision bigint;
  initial_revision bigint;
  operation_row jsonb;
  current_operation_id uuid;
  operation_trip_id uuid;
  operation_entity_id uuid;
  operation_kind text;
  operation_action text;
  operation_payload jsonb;
  operation_hash text;
  existing_operation public.ruta_workspace_operations%rowtype;
  collection_name text;
  current_collection jsonb;
  next_collection jsonb;
  entity_found boolean;
  result_row jsonb;
  results_json jsonb := '[]'::jsonb;
  applied_count integer := 0;
begin
  if target_trip_id is distinct from '4d1fe1a8-4f21-4d76-9f45-7fa2b1f74d40'::uuid then
    raise exception using errcode = '22023', message = 'unsupported trip id';
  end if;

  if operations is null
     or jsonb_typeof(operations) <> 'array'
     or jsonb_array_length(operations) > 200
     or pg_column_size(operations) > 8388608 then
    raise exception using errcode = '22023', message = 'operations must be an array of at most 200 entries';
  end if;

  select document_row.*
  into workspace_row
  from public.ruta_workspace_documents as document_row
  where document_row.trip_id = target_trip_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'workspace not bootstrapped';
  end if;

  current_workspace := workspace_row.workspace_json;
  current_revision := workspace_row.revision;
  initial_revision := current_revision;

  for operation_row in
    select entry.value
    from jsonb_array_elements(operations) as entry(value)
  loop
    begin
      current_operation_id := (operation_row ->> 'id')::uuid;
      operation_trip_id := (operation_row ->> 'tripId')::uuid;
      operation_entity_id := (operation_row ->> 'entityId')::uuid;
    exception when others then
      raise exception using errcode = '22023', message = 'operation ids must be UUIDs';
    end;

    operation_kind := operation_row ->> 'entityKind';
    operation_action := operation_row ->> 'action';
    operation_payload := coalesce(operation_row -> 'payload', '{}'::jsonb);

    if current_operation_id is null
       or operation_trip_id is distinct from target_trip_id
       or operation_entity_id is null
       or operation_kind is null
       or operation_kind not in (
         'trip', 'participant', 'plan', 'day', 'item',
         'expense', 'task', 'contact', 'document'
       )
       or operation_action is null
       or operation_action not in ('upsert', 'delete')
       or jsonb_typeof(operation_payload) <> 'object' then
      raise exception using errcode = '22023', message = 'invalid workspace operation';
    end if;

    operation_hash := md5(operation_row::text);
    existing_operation := null;

    select applied_row.*
    into existing_operation
    from public.ruta_workspace_operations as applied_row
    where applied_row.operation_id = current_operation_id;

    if found then
      if existing_operation.trip_id is distinct from target_trip_id
         or existing_operation.request_hash is distinct from operation_hash then
        raise exception using errcode = '22023', message = 'operation id reused with different content';
      end if;
      results_json := results_json || jsonb_build_array(existing_operation.result);
      continue;
    end if;

    if operation_payload ? 'fullWorkspace' then
      if operation_kind is distinct from 'trip'
         or operation_action is distinct from 'upsert'
         or operation_entity_id is distinct from target_trip_id
         or jsonb_typeof(operation_payload -> 'fullWorkspace') <> 'object'
         or operation_payload #>> '{fullWorkspace,trip,id}' is distinct from target_trip_id::text
         or not public.ruta_jsonb_is_integer_at_least(operation_payload -> 'baseServerSequence', 0) then
        raise exception using errcode = '22023', message = 'invalid full workspace operation';
      end if;
      if not public.ruta_workspace_is_valid(target_trip_id, operation_payload -> 'fullWorkspace') then
        raise exception using errcode = '22023', message = 'invalid full workspace operation';
      end if;
      if (operation_payload ->> 'baseServerSequence')::numeric is distinct from initial_revision::numeric then
        raise exception using
          errcode = '40001',
          message = 'full workspace revision conflict',
          detail = format(
            'Expected baseServerSequence %s but received %s',
            initial_revision,
            operation_payload ->> 'baseServerSequence'
          );
      end if;
      current_workspace := operation_payload -> 'fullWorkspace';
    elsif operation_kind = 'trip' then
      if operation_entity_id is distinct from target_trip_id then
        raise exception using errcode = '22023', message = 'trip entity id mismatch';
      end if;
      current_workspace := jsonb_set(current_workspace, '{trip}', operation_payload, true);
    else
      collection_name := case operation_kind
        when 'participant' then 'participants'
        when 'plan' then 'plans'
        when 'day' then 'days'
        when 'item' then 'items'
        when 'expense' then 'expenses'
        when 'task' then 'tasks'
        when 'contact' then 'contacts'
        when 'document' then 'documents'
      end;

      current_collection := coalesce(current_workspace -> collection_name, '[]'::jsonb);
      if jsonb_typeof(current_collection) <> 'array' then
        current_collection := '[]'::jsonb;
      end if;

      if operation_payload = '{}'::jsonb and operation_action = 'delete' then
        select coalesce(jsonb_agg(entry.value order by entry.ordinality), '[]'::jsonb)
        into next_collection
        from jsonb_array_elements(current_collection) with ordinality as entry(value, ordinality)
        where entry.value ->> 'id' is distinct from operation_entity_id::text;
      else
        operation_payload := jsonb_set(
          operation_payload,
          '{id}',
          to_jsonb(operation_entity_id::text),
          true
        );

        select
          coalesce(
            jsonb_agg(
              case
                when entry.value ->> 'id' = operation_entity_id::text then operation_payload
                else entry.value
              end
              order by entry.ordinality
            ),
            '[]'::jsonb
          ),
          coalesce(bool_or(entry.value ->> 'id' = operation_entity_id::text), false)
        into next_collection, entity_found
        from jsonb_array_elements(current_collection) with ordinality as entry(value, ordinality);

        if not entity_found then
          next_collection := next_collection || jsonb_build_array(operation_payload);
        end if;
      end if;

      current_workspace := jsonb_set(
        current_workspace,
        array[collection_name],
        next_collection,
        true
      );
    end if;

    current_revision := current_revision + 1;
    applied_count := applied_count + 1;
    result_row := jsonb_build_object(
      'id', current_operation_id,
      'entityKind', operation_kind,
      'entityId', operation_entity_id,
      'status', 'applied',
      'revision', current_revision
    );

    insert into public.ruta_workspace_operations (
      operation_id,
      trip_id,
      entity_kind,
      entity_id,
      action,
      request_hash,
      revision,
      result
    ) values (
      current_operation_id,
      target_trip_id,
      operation_kind,
      operation_entity_id,
      operation_action,
      operation_hash,
      current_revision,
      result_row
    );

    results_json := results_json || jsonb_build_array(result_row);
  end loop;

  current_workspace := jsonb_set(
    current_workspace,
    '{lastServerSequence}',
    to_jsonb(current_revision),
    true
  );

  if not public.ruta_workspace_is_valid(target_trip_id, current_workspace) then
    raise exception using errcode = '22023', message = 'operation produced an invalid workspace';
  end if;

  if applied_count > 0 then
    update public.ruta_workspace_documents
    set
      workspace_json = current_workspace,
      revision = current_revision,
      updated_at = now()
    where trip_id = target_trip_id;
  end if;

  return jsonb_build_object(
    'workspace', current_workspace,
    'lastSequence', current_revision,
    'results', results_json
  );
end;
$$;

revoke execute on function public.bootstrap_ruta_austral(uuid, jsonb) from public;
revoke execute on function public.get_app_workspace(uuid) from public;
revoke execute on function public.apply_workspace_operations(uuid, jsonb) from public;
revoke execute on function public.ruta_jsonb_is_text(jsonb, integer, integer) from public, anon, authenticated;
revoke execute on function public.ruta_jsonb_is_uuid(jsonb) from public, anon, authenticated;
revoke execute on function public.ruta_jsonb_is_nullable_uuid(jsonb) from public, anon, authenticated;
revoke execute on function public.ruta_jsonb_is_nullable_text(jsonb, integer) from public, anon, authenticated;
revoke execute on function public.ruta_jsonb_is_number(jsonb) from public, anon, authenticated;
revoke execute on function public.ruta_jsonb_is_boolean(jsonb) from public, anon, authenticated;
revoke execute on function public.ruta_jsonb_is_integer_at_least(jsonb, numeric) from public, anon, authenticated;
revoke execute on function public.ruta_workspace_is_valid(uuid, jsonb) from public, anon, authenticated;

grant execute on function public.bootstrap_ruta_austral(uuid, jsonb) to anon, authenticated;
grant execute on function public.get_app_workspace(uuid) to anon, authenticated;
grant execute on function public.apply_workspace_operations(uuid, jsonb) to anon, authenticated;

alter table public.ruta_workspace_documents replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ruta_workspace_documents'
  ) then
    alter publication supabase_realtime add table public.ruta_workspace_documents;
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
