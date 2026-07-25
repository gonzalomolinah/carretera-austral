begin;

do $$
declare
  trip_id constant uuid := '4d1fe1a8-4f21-4d76-9f45-7fa2b1f74d40'::uuid;
  seed_participant_id constant uuid := '2d1015f0-aaf1-46b2-9f93-0a10ab4c4f01'::uuid;
  participant_id constant uuid := '2d1015f0-aaf1-46b2-9f93-0a10ab4c4f02'::uuid;
  plan_id constant uuid := 'ff49b2dd-89f5-472d-9676-b828bc85cd11'::uuid;
  operation_id constant uuid := '018f7738-259e-7cd0-ac72-a0008d7340fd'::uuid;
  invalid_full_operation_id constant uuid := '018f7738-259e-7cd0-ac72-a0008d7340f1'::uuid;
  mislabeled_full_operation_id constant uuid := '018f7738-259e-7cd0-ac72-a0008d7340f7'::uuid;
  invalid_delta_operation_id constant uuid := '018f7738-259e-7cd0-ac72-a0008d7340f2'::uuid;
  invalid_trip_operation_id constant uuid := '018f7738-259e-7cd0-ac72-a0008d7340f3'::uuid;
  conflict_operation_id constant uuid := '018f7738-259e-7cd0-ac72-a0008d7340f4'::uuid;
  prior_operation_id constant uuid := '018f7738-259e-7cd0-ac72-a0008d7340f5'::uuid;
  full_operation_id constant uuid := '018f7738-259e-7cd0-ac72-a0008d7340f6'::uuid;
  valid_workspace jsonb;
  invalid_workspace jsonb;
  operation jsonb;
  prior_operation jsonb;
  full_operation jsonb;
  result jsonb;
  snapshot jsonb;
  snapshot_before_rejection jsonb;
begin
  -- Make the test deterministic without leaving any change behind: the outer
  -- transaction is rolled back at the end of the file.
  delete from public.ruta_workspace_documents as document_row
  where document_row.trip_id = '4d1fe1a8-4f21-4d76-9f45-7fa2b1f74d40'::uuid;

  valid_workspace := jsonb_build_object(
    'schemaVersion', 3,
    'trip', jsonb_build_object(
      'id', trip_id,
      'name', 'Ruta Austral',
      'startDate', null,
      'timezone', 'America/Santiago',
      'currency', 'CLP',
      'attachmentLimitBytes', 262144000,
      'createdAt', '2026-07-18T12:00:00.000Z',
      'updatedAt', '2026-07-18T12:00:00.000Z'
    ),
    'participants', jsonb_build_array(jsonb_build_object(
      'id', seed_participant_id,
      'tripId', trip_id,
      'name', 'Inicial',
      'color', '#123456',
      'active', true,
      'order', 0
    )),
    'plans', jsonb_build_array(jsonb_build_object(
      'id', plan_id,
      'tripId', trip_id,
      'key', 'general',
      'name', 'Itinerario final',
      'kind', 'final',
      'ownerParticipantId', null,
      'basedOnPlanId', null,
      'createdAt', '2026-07-18T12:00:00.000Z',
      'updatedAt', '2026-07-18T12:00:00.000Z'
    )),
    'days', '[]'::jsonb,
    'items', '[]'::jsonb,
    'expenses', '[]'::jsonb,
    'tasks', '[]'::jsonb,
    'contacts', '[]'::jsonb,
    'documents', '[]'::jsonb,
    'selectedPlanId', plan_id,
    'profileParticipantId', null,
    'lastServerSequence', 0,
    'updatedAt', '2026-07-18T12:00:00.000Z'
  );

  if not public.ruta_workspace_is_valid(trip_id, valid_workspace) then
    raise exception 'valid workspace fixture was rejected';
  end if;

  perform public.bootstrap_ruta_austral(trip_id, valid_workspace);

  operation := jsonb_build_object(
    'id', operation_id,
    'tripId', trip_id,
    'entityKind', 'participant',
    'entityId', participant_id,
    'action', 'upsert',
    'createdAt', '2026-07-18T12:00:01.000Z',
    'payload', jsonb_build_object(
      'id', participant_id,
      'tripId', trip_id,
      'name', 'Molina',
      'color', '#654321',
      'active', true,
      'order', 1
    )
  );

  result := public.apply_workspace_operations(trip_id, jsonb_build_array(operation));
  if (result ->> 'lastSequence')::bigint <> 1 then
    raise exception 'first operation did not advance revision once';
  end if;

  result := public.apply_workspace_operations(trip_id, jsonb_build_array(operation));
  if (result ->> 'lastSequence')::bigint <> 1 then
    raise exception 'idempotent retry advanced revision';
  end if;

  snapshot := public.get_app_workspace(trip_id);
  if jsonb_array_length(snapshot -> 'participants') <> 2
     or snapshot #>> '{participants,1,name}' <> 'Molina'
     or (snapshot ->> 'lastServerSequence')::bigint <> 1 then
    raise exception 'workspace snapshot does not match applied operation';
  end if;

  begin
    perform public.apply_workspace_operations(
      trip_id,
      jsonb_build_array(jsonb_set(operation, '{payload,name}', '"Otro"'::jsonb, true))
    );
    raise exception 'reusing an operation id with different content should fail';
  exception
    when sqlstate '22023' then null;
  end;

  snapshot_before_rejection := public.get_app_workspace(trip_id);

  -- Bootstrap validates even when the row already exists, and a rejection must
  -- not alter the previously stored document.
  begin
    perform public.bootstrap_ruta_austral(trip_id, valid_workspace - 'documents');
    raise exception 'bootstrap accepted a workspace missing a required collection';
  exception
    when sqlstate '22023' then null;
  end;
  if public.get_app_workspace(trip_id) is distinct from snapshot_before_rejection then
    raise exception 'rejected bootstrap changed the workspace';
  end if;

  -- A structurally invalid full workspace is rejected before it can replace the
  -- shared document or create an idempotency-ledger row.
  invalid_workspace := jsonb_set(
    snapshot_before_rejection,
    '{participants,0,id}',
    '"not-a-uuid"'::jsonb,
    false
  );
  begin
    perform public.apply_workspace_operations(
      trip_id,
      jsonb_build_array(jsonb_build_object(
        'id', invalid_full_operation_id,
        'tripId', trip_id,
        'entityKind', 'trip',
        'entityId', trip_id,
        'action', 'upsert',
        'createdAt', '2026-07-18T12:00:02.000Z',
        'payload', jsonb_build_object(
          'fullWorkspace', invalid_workspace,
          'baseServerSequence', 1
        )
      ))
    );
    raise exception 'fullWorkspace accepted an invalid UUID';
  exception
    when sqlstate '22023' then null;
  end;
  if public.get_app_workspace(trip_id) is distinct from snapshot_before_rejection
     or exists (
       select 1 from public.ruta_workspace_operations as operation_row
       where operation_row.operation_id = invalid_full_operation_id
     ) then
    raise exception 'rejected fullWorkspace changed persisted state';
  end if;

  -- The fullWorkspace envelope cannot bypass entity/action routing by being
  -- labeled as another entity kind or as a delete operation.
  begin
    perform public.apply_workspace_operations(
      trip_id,
      jsonb_build_array(jsonb_build_object(
        'id', mislabeled_full_operation_id,
        'tripId', trip_id,
        'entityKind', 'contact',
        'entityId', participant_id,
        'action', 'delete',
        'createdAt', '2026-07-18T12:00:02.500Z',
        'payload', jsonb_build_object(
          'fullWorkspace', snapshot_before_rejection,
          'baseServerSequence', 1
        )
      ))
    );
    raise exception 'fullWorkspace accepted an invalid entity/action envelope';
  exception
    when sqlstate '22023' then null;
  end;
  if public.get_app_workspace(trip_id) is distinct from snapshot_before_rejection
     or exists (
       select 1 from public.ruta_workspace_operations as operation_row
       where operation_row.operation_id = mislabeled_full_operation_id
     ) then
    raise exception 'mislabeled fullWorkspace changed persisted state';
  end if;

  -- Delta validation catches missing essential fields after applying the merge.
  begin
    perform public.apply_workspace_operations(
      trip_id,
      jsonb_build_array(jsonb_build_object(
        'id', invalid_delta_operation_id,
        'tripId', trip_id,
        'entityKind', 'participant',
        'entityId', participant_id,
        'action', 'upsert',
        'createdAt', '2026-07-18T12:00:03.000Z',
        'payload', jsonb_build_object(
          'id', participant_id,
          'tripId', trip_id,
          'name', 'Sin campos esenciales'
        )
      ))
    );
    raise exception 'delta accepted an incomplete participant';
  exception
    when sqlstate '22023' then null;
  end;
  if public.get_app_workspace(trip_id) is distinct from snapshot_before_rejection
     or exists (
       select 1 from public.ruta_workspace_operations as operation_row
       where operation_row.operation_id = invalid_delta_operation_id
     ) then
    raise exception 'rejected entity delta changed persisted state';
  end if;

  -- Trip deltas are also checked after replacement, not only by entity id.
  begin
    perform public.apply_workspace_operations(
      trip_id,
      jsonb_build_array(jsonb_build_object(
        'id', invalid_trip_operation_id,
        'tripId', trip_id,
        'entityKind', 'trip',
        'entityId', trip_id,
        'action', 'upsert',
        'createdAt', '2026-07-18T12:00:04.000Z',
        'payload', jsonb_build_object('id', trip_id, 'name', 'Viaje incompleto')
      ))
    );
    raise exception 'trip delta accepted an incomplete trip';
  exception
    when sqlstate '22023' then null;
  end;
  if public.get_app_workspace(trip_id) is distinct from snapshot_before_rejection
     or exists (
       select 1 from public.ruta_workspace_operations as operation_row
       where operation_row.operation_id = invalid_trip_operation_id
     ) then
    raise exception 'rejected trip delta changed persisted state';
  end if;

  -- A stale fullWorkspace has a distinct optimistic-conflict SQLSTATE and the
  -- whole RPC transaction, including its ledger insert, remains unchanged.
  begin
    perform public.apply_workspace_operations(
      trip_id,
      jsonb_build_array(jsonb_build_object(
        'id', conflict_operation_id,
        'tripId', trip_id,
        'entityKind', 'trip',
        'entityId', trip_id,
        'action', 'upsert',
        'createdAt', '2026-07-18T12:00:05.000Z',
        'payload', jsonb_build_object(
          'fullWorkspace', snapshot_before_rejection,
          'baseServerSequence', 0
        )
      ))
    );
    raise exception 'stale fullWorkspace did not raise a revision conflict';
  exception
    when sqlstate '40001' then null;
  end;
  if public.get_app_workspace(trip_id) is distinct from snapshot_before_rejection
     or exists (
       select 1 from public.ruta_workspace_operations as operation_row
       where operation_row.operation_id = conflict_operation_id
     ) then
    raise exception 'conflicting fullWorkspace changed persisted state';
  end if;

  -- baseServerSequence is compared with the revision captured before the RPC,
  -- so a preceding operation in this same batch is allowed.
  prior_operation := jsonb_build_object(
    'id', prior_operation_id,
    'tripId', trip_id,
    'entityKind', 'participant',
    'entityId', participant_id,
    'action', 'upsert',
    'createdAt', '2026-07-18T12:00:06.000Z',
    'payload', jsonb_set(
      snapshot_before_rejection #> '{participants,1}',
      '{name}',
      '"Temporal"'::jsonb,
      true
    )
  );
  full_operation := jsonb_build_object(
    'id', full_operation_id,
    'tripId', trip_id,
    'entityKind', 'trip',
    'entityId', trip_id,
    'action', 'upsert',
    'createdAt', '2026-07-18T12:00:07.000Z',
    'payload', jsonb_build_object(
      'fullWorkspace', jsonb_set(
        snapshot_before_rejection,
        '{participants,1,name}',
        '"Final"'::jsonb,
        true
      ),
      'baseServerSequence', 1
    )
  );
  result := public.apply_workspace_operations(
    trip_id,
    jsonb_build_array(prior_operation, full_operation)
  );
  snapshot := public.get_app_workspace(trip_id);
  if (result ->> 'lastSequence')::bigint <> 3
     or (snapshot ->> 'lastServerSequence')::bigint <> 3
     or snapshot #>> '{participants,1,name}' <> 'Final' then
    raise exception 'same-batch operation incorrectly conflicted with fullWorkspace';
  end if;
end
$$;

rollback;
