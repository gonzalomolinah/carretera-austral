# Sincronización pública de la PWA

La PWA usa `migrations/202607180002_pwa_workspace_sync.sql`. El enlace de la
aplicación es el acceso compartido: no hay cuentas, contraseñas ni autenticación
anónima que habilitar. El UUID permitido corresponde al único viaje Ruta Austral.

## Contrato usado por el frontend

```text
bootstrap_ruta_austral(target_trip_id uuid, seed_workspace jsonb) -> jsonb
get_app_workspace(target_trip_id uuid) -> jsonb
apply_workspace_operations(target_trip_id uuid, operations jsonb) -> jsonb
```

`bootstrap_ruta_austral` crea el documento remoto solo la primera vez. Si ya
existe, devuelve el remoto y no reemplaza datos. `apply_workspace_operations`
acepta directamente el tipo `PendingOperation` de TypeScript (`entityKind`,
`entityId`, `tripId`, `action`, `payload`). Cada UUID de operación se aplica una
sola vez. Entidades distintas se combinan sobre el documento remoto bajo un
bloqueo transaccional; para una misma entidad gana la última operación recibida.

La tabla `ruta_workspace_documents` está en `supabase_realtime`; el cliente usa
`postgres_changes` como señal y siempre vuelve a leer el snapshot canónico. Los
cambios siguen guardándose primero en IndexedDB, por lo que una caída de red no
interrumpe la edición.

## Aplicación y comprobación

Aplicar `202607180002_pwa_workspace_sync.sql`. Es autónoma, idempotente y no
borra `planner_state` ni las tablas normalizadas. La migración `001` es opcional:
prepara el modelo normalizado futuro, pero la PWA no depende de ella.

Comprobar desde SQL Editor:

```sql
select to_regclass('public.ruta_workspace_documents');
select to_regclass('public.ruta_workspace_operations');
select oid::regprocedure
from pg_proc
where oid in (
  'public.bootstrap_ruta_austral(uuid,jsonb)'::regprocedure,
  'public.get_app_workspace(uuid)'::regprocedure,
  'public.apply_workspace_operations(uuid,jsonb)'::regprocedure
);
```

La primera apertura online crea la fila. Después se puede verificar con:

```sql
select trip_id, revision, updated_at,
       jsonb_array_length(workspace_json -> 'items') as items
from public.ruta_workspace_documents;
```

No se debe colocar una `service_role` en Vercel ni en el navegador. La clave
publicable de Supabase es suficiente.
