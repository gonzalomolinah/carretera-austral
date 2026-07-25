# Runbook: corte al modelo normalizado de Ruta Austral

> **Estado:** este modelo queda disponible para una evolución normalizada, pero
> la PWA actual usa el contrato público y completo de
> `202607180002_pwa_workspace_sync.sql`. Para operar o desplegar la aplicación,
> seguir primero `PWA_SYNC_RUNBOOK.md`; no es necesario habilitar Anonymous
> Sign-Ins para ese contrato.

Este documento acompaña `migrations/202607180001_ruta_austral.sql`. La migración crea el modelo nuevo **en paralelo** y conserva `public.planner_state`, sus datos y su contrato de acceso actual. No implementa dual-write: hasta que el cliente nuevo entre en producción, `planner_state` sigue siendo la fuente que modifica la aplicación antigua.

## 1. Alcance y prerrequisitos

- Hacer un respaldo lógico de la base antes del despliegue. El respaldo de Postgres no contiene los binarios de Storage; exportarlos por separado cuando ya existan archivos.
- Confirmar que Anonymous Sign-Ins está habilitado en Supabase Auth. Una sesión `anon` de la API no equivale a un usuario anónimo autenticado: las RPC nuevas requieren `auth.uid()`.
- Confirmar que el proyecto tiene los esquemas administrados `auth`, `realtime` y `storage`, y la función `realtime.broadcast_changes`.
- Usar canales Realtime privados. El topic reservado por este esquema es `trip:<trip_uuid>`.
- La migración presupone Postgres 15 o superior, como los proyectos Supabase actuales.

Comprobación previa desde el SQL Editor:

```sql
select
  current_setting('server_version_num')::integer >= 150000 as postgres_ok,
  to_regclass('public.planner_state') as legacy_table,
  to_regclass('realtime.messages') as realtime_table,
  to_regclass('storage.objects') as storage_table,
  to_regprocedure('realtime.broadcast_changes(text,text,text,text,text,record,record)')
    as broadcast_function;
```

La firma exacta reportada para Broadcast puede variar si Supabase agrega parámetros con valores por defecto. Si `broadcast_function` es `null`, comprobar las firmas disponibles antes de aplicar:

```sql
select oid::regprocedure
from pg_proc
where pronamespace = 'realtime'::regnamespace
  and proname = 'broadcast_changes';
```

## 2. Ensayo local y aplicación

No editar el archivo después de haberlo aplicado en un entorno compartido; cualquier corrección posterior debe ser una migración nueva.

1. Vincular una copia o un proyecto de staging, nunca producción en el primer ensayo.
2. Ejecutar `supabase db reset` en local. En un reset, la migración crea `planner_state` si la baseline aún no existe; luego `seed.sql` siembra las cinco rutas y vuelve a ejecutar el backfill.
3. Revisar el SQL pendiente con `supabase db diff` y `supabase db push --dry-run`.
4. Aplicar en staging con `supabase db push`.
5. Ejecutar todas las validaciones de la sección 6 con datos representativos y dos navegadores.
6. Repetir el procedimiento en producción durante una ventana sin ediciones del cliente antiguo. El backfill toma una instantánea; escrituras posteriores en `planner_state` no se reflejan automáticamente.

La transacción de la migración es atómica. El backfill usa `ON CONFLICT DO NOTHING`: se puede volver a invocar sin sobrescribir filas normalizadas, pero no es un mecanismo de sincronización continua.

## 3. Identidades deterministas y enlace inicial

Cada plan legado recibe siempre el mismo UUID:

```sql
select
  id as legacy_plan_id,
  private.deterministic_uuid('trip', id) as expected_trip_id
from public.planner_state
order by id;
```

Los días e ítems también reciben UUID deterministas a partir del plan, el id legado y su ordinal. `legacy_plan_id`, `legacy_id` y `legacy_ordinal` permiten auditar el mapeo.

La migración no crea secretos recuperables ni membresías por defecto. Para emitir el primer enlace de un viaje, un administrador ejecuta una sola vez el siguiente SQL. El token solo se muestra en el resultado; la base guarda su SHA-256. Se recomienda usar un fragmento `#share=...` para evitar enviarlo como referrer HTTP.

```sql
with generated as materialized (
  select
    replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', '') as token
), created as (
  insert into public.trip_share_links (trip_id, token_hash, role)
  select
    trip_row.id,
    private.token_hash(generated.token),
    'editor'
  from public.trips as trip_row
  cross join generated
  where trip_row.legacy_plan_id = 'carretera-austral-general'
  returning trip_id
)
select
  created.trip_id,
  generated.token,
  'https://APP_EJEMPLO/#share=' || generated.token as share_url
from created
cross join generated;
```

Para un enlace de solo lectura, cambiar `editor` por `viewer`. Para revocarlo:

```sql
update public.trip_share_links
set revoked_at = now()
where token_hash = private.token_hash('TOKEN_QUE_SE_DESEA_REVOCAR');
```

Flujo del cliente al abrir el enlace:

1. Crear o recuperar una sesión con `supabase.auth.signInAnonymously()`.
2. Leer el token desde el fragmento y llamar `redeem_trip_share(token text)`.
3. Guardar el `trip_id` devuelto, eliminar el token de la URL con `history.replaceState` y no persistirlo en logs ni telemetría.
4. Llamar `get_trip_workspace(trip_id uuid)` y persistir el snapshot en IndexedDB.
5. Suscribirse al canal privado `trip:<trip_id>` y hacer catch-up con `pull_trip_changes`.

El usuario anónimo mantiene acceso mientras conserve su sesión de Auth. Si borra los datos del sitio, puede recuperar membresía volviendo a usar un enlace vigente. Los enlaces migrados otorgan `editor` o `viewer`; si se necesita un propietario, un administrador puede promover el UUID del usuario ya canjeado:

```sql
update public.trip_members
set role = 'owner'
where trip_id = 'UUID_DEL_VIAJE'
  and user_id = 'UUID_DE_AUTH';
```

## 4. Contrato de RPC

Las cuatro firmas expuestas son exactamente:

```text
redeem_trip_share(token text) -> jsonb
get_trip_workspace(trip_id uuid) -> jsonb
apply_normalized_trip_operations(trip_id uuid, operations jsonb) -> jsonb
pull_trip_changes(trip_id uuid, after_seq bigint) -> jsonb
```

`get_trip_workspace` responde:

```json
{
  "trip": {},
  "days": [],
  "items": [],
  "attachments": [],
  "last_seq": 0
}
```

Cada ítem incluye `marks`, `links` y sus `attachments`. El arreglo superior `attachments` incluye además archivos que pertenecen al viaje completo (`item_id = null`).

`apply_normalized_trip_operations` acepta como máximo 100 operaciones y aplica todo el lote en una sola transacción:

```json
[
  {
    "id": "UUID_UNICO_DE_OPERACION",
    "entity": "item",
    "action": "upsert",
    "entity_id": "UUID_ESTABLE_DE_ENTIDAD",
    "base_revision": 3,
    "payload": {
      "title": "Ventisquero Colgante",
      "day_id": "UUID_DEL_DIA",
      "sort_key": "000120"
    }
  }
]
```

- `entity`: `trip`, `day`, `item`, `flag`, `link` o `attachment`.
- `action`: `upsert` o `delete`.
- Para crear una entidad revisable, `base_revision` es `null` o `0`; para actualizarla o borrarla debe ser la revisión actual.
- Un `flag` usa el UUID del ítem como `entity_id` y `payload.flag` con uno de `must`, `booked`, `done`, `lodging` o `dayvisit`. No tiene revisión propia.
- El mismo UUID de operación, con contenido idéntico, devuelve el resultado guardado sin duplicar efectos. Reutilizarlo con otro contenido o viaje es un error.
- Un conflicto de revisión usa SQLSTATE `40001`. Como el lote es atómico, ningún efecto del lote queda aplicado: hacer pull, reconciliar y reintentar con **nuevos** UUID para las operaciones cuyo contenido cambió.

La respuesta tiene la forma `{"results": [...], "last_seq": 123}`. Para días, borrar también mueve sus ítems activos a `Sin asignar`.

Campos de payload reconocidos:

| Entidad | Campos |
| --- | --- |
| `trip` | `name`, `start_date`, `timezone` |
| `day` | `sort_key`, `date`, `title` |
| `item` | `day_id`, `sort_key`, `kind`, `title`, `category`, `location`, `origin`, `destination`, `transport_mode`, `duration_minutes`, `cost_clp`, `notes`, `latitude`, `longitude` |
| `flag` | `flag`, `enabled` |
| `link` | `item_id`, `kind`, `label`, `url` |
| `attachment` | `item_id`, `bucket_id`, `object_path`, `filename`, `mime_type`, `size_bytes`, `status` |

`pull_trip_changes` devuelve hasta 500 filas por página:

```json
{"changes": [], "next_seq": 123, "has_more": false}
```

Mientras `has_more` sea verdadero, repetir usando `next_seq` como `after_seq`. Broadcast es solo una señal de baja latencia: ante cada evento, reconexión o vuelta desde background, hacer pull desde el cursor local. Esto evita depender de que Realtime entregue cada evento exactamente una vez.

## 5. Storage

El bucket privado es `trip-files`, con límite de 25 MiB y MIME permitidos JPEG, PNG, WebP y PDF. La ruta debe ser:

```text
trips/<trip_uuid>/<uuid_del_archivo>/<nombre_sanitizado>
```

Un `viewer` puede descargar; un `editor` puede subir, actualizar y borrar. `trip_attachments` guarda metadata de dominio y estado (`pending`, `uploaded`, `failed`), no el binario.

Carga recomendada:

1. Encolar una operación `attachment/upsert` con estado `pending` y la ruta definitiva.
2. Subir el objeto al bucket.
3. Encolar otra operación con estado `uploaded` y la revisión retornada.
4. Si la carga falla, marcar `failed`; un proceso de mantenimiento puede eliminar objetos o metadatos huérfanos.

La base y Storage no comparten una transacción; esa reconciliación es obligatoria.

## 6. Validación posterior

### Estructura, RLS y funciones

```sql
select to_regclass(name) as relation
from unnest(array[
  'public.trips',
  'public.trip_days',
  'public.itinerary_items',
  'public.item_flags',
  'public.item_links',
  'public.trip_attachments',
  'public.applied_operations',
  'public.trip_changes'
]) as names(name);

select oid::regprocedure
from pg_proc
where oid in (
  'public.redeem_trip_share(text)'::regprocedure,
  'public.get_trip_workspace(uuid)'::regprocedure,
  'public.apply_normalized_trip_operations(uuid,jsonb)'::regprocedure,
  'public.pull_trip_changes(uuid,bigint)'::regprocedure
);

select schemaname, tablename, policyname, roles, cmd
from pg_policies
where (schemaname, tablename) in (
  ('public', 'trips'),
  ('public', 'trip_days'),
  ('public', 'itinerary_items'),
  ('realtime', 'messages'),
  ('storage', 'objects')
)
order by schemaname, tablename, policyname;
```

### Paridad del backfill

```sql
with legacy as (
  select
    id,
    jsonb_array_length(coalesce(state_json -> 'days', '[]'::jsonb)) as days,
    jsonb_array_length(coalesce(state_json -> 'items', '[]'::jsonb)) as items
  from public.planner_state
), normalized as (
  select
    trip_row.legacy_plan_id as id,
    count(distinct day_row.id) filter (where day_row.legacy_ordinal is not null) as days,
    count(distinct item_row.id) filter (where item_row.legacy_ordinal is not null) as items
  from public.trips as trip_row
  left join public.trip_days as day_row on day_row.trip_id = trip_row.id
  left join public.itinerary_items as item_row on item_row.trip_id = trip_row.id
  where trip_row.legacy_plan_id is not null
  group by trip_row.legacy_plan_id
)
select legacy.*, normalized.days as normalized_days, normalized.items as normalized_items
from legacy
left join normalized using (id)
where (legacy.days, legacy.items) is distinct from (normalized.days, normalized.items);
```

La consulta debe devolver cero filas. Verificar también los UUID del viaje y referencias cruzadas:

```sql
select legacy_plan_id, id, private.deterministic_uuid('trip', legacy_plan_id) as expected
from public.trips
where legacy_plan_id is not null
  and id <> private.deterministic_uuid('trip', legacy_plan_id);

select item_row.id, item_row.trip_id, item_row.day_id, day_row.trip_id as day_trip_id
from public.itinerary_items as item_row
join public.trip_days as day_row on day_row.id = item_row.day_id
where item_row.trip_id <> day_row.trip_id;
```

Ambas deben devolver cero filas. Ejecutar dos veces:

```sql
select private.backfill_planner_state();
```

Con una fuente legado sin cambios, el resultado debe ser `{"trips":0,"days":0,"items":0,"flags":0,"links":0}` en ambas ejecuciones.

### Pruebas de extremo a extremo

1. Sin iniciar sesión, comprobar que las cuatro RPC fallan o no tienen permiso.
2. En navegador A, iniciar sesión anónima, canjear un enlace `viewer` y comprobar que el snapshot funciona pero las operaciones y cargas fallan.
3. En navegador B, canjear un enlace `editor`, aplicar un lote y repetir exactamente el mismo lote. Comparar la respuesta y confirmar que revisiones y `trip_changes` solo avanzaron una vez.
4. Reutilizar el mismo UUID de operación con contenido distinto: debe fallar.
5. Enviar una revisión obsoleta: debe devolver conflicto y no aplicar ninguna operación del lote.
6. Suscribir A al topic privado, modificar en B y confirmar Broadcast. Desconectar A, hacer varios cambios en B, reconectar y comprobar que `pull_trip_changes` recupera todos por secuencia.
7. Intentar suscribirse a otro `trip:<uuid>` y leer/subir a otra carpeta de Storage: RLS debe denegarlo.
8. Subir un archivo permitido menor de 25 MiB; comprobar metadata, descarga como viewer y rechazo de MIME/tamaño/ruta inválidos.

## 7. Rollback

El rollback de aplicación más seguro es volver a desplegar el cliente que usa `planner_state`. Esa tabla nunca se elimina ni recibe escrituras desde el modelo nuevo, por lo que el cambio de cliente no requiere DDL. Antes de volver, detener ediciones en el cliente nuevo: no existe reverse-sync desde las tablas normalizadas hacia el JSON legado.

Si es imprescindible retirar el esquema nuevo, primero exportar los datos creados tras el corte. Luego aplicar **una migración de rollback nueva**; no borrar el archivo ya registrado. El orden de desmontaje es:

1. Revocar enlaces y detener clientes nuevos.
2. Exportar tablas normalizadas, `trip_changes` y objetos del bucket.
3. Eliminar las políticas `ruta_austral_*` de `realtime.messages` y `storage.objects`.
4. Eliminar las cuatro RPC públicas.
5. Eliminar, en orden, `trip_changes`, `applied_operations`, `trip_attachments`, `item_links`, `item_flags`, `itinerary_items`, `trip_days`, `trip_share_links`, `trip_members` y `trips`. Usar `CASCADE` solo después de inspeccionar las dependencias.
6. Eliminar las funciones `private.*` creadas por esta migración y, si queda vacío, el esquema `private`.

No borrar filas de `storage.objects` directamente con SQL. Vaciar y eliminar el bucket con la API de Storage o el Dashboard después de exportar los binarios. En todo rollback, conservar `public.planner_state`, sus tres políticas legadas y las cinco filas permitidas.

## 8. Riesgos conocidos y tareas posteriores

- Durante la convivencia, `planner_state` mantiene el acceso anónimo abierto del cliente antiguo. El aislamiento por enlace solo protege las tablas nuevas.
- El backfill no detecta ni replica cambios posteriores del JSON. Programar una ventana de corte o una última ejecución controlada antes de cambiar el cliente; como no sobrescribe, si la fuente cambió después del primer backfill hay que reconciliar manualmente.
- Ningún propietario ni enlace se genera automáticamente; es intencional para no almacenar tokens en texto plano. El bootstrap es una acción administrativa.
- `applied_operations` y `trip_changes` crecen sin límite. Definir retención solo cuando todos los clientes garanticen un cursor mínimo y exista un snapshot recuperable.
- Un conflicto aborta el lote completo. Mantener lotes pequeños reduce reconciliaciones y contención.
- Perder la sesión anónima cambia `auth.uid()`; un enlace no revocado permite recuperar acceso, pero la identidad anterior queda como miembro hasta una limpieza administrativa.
- Fechas, coordenadas y adjuntos no existen en el estado legado y quedan vacíos hasta que el cliente nuevo los capture.
- Broadcast puede perderse durante suspensión o desconexión; `trip_changes` y el cursor son la fuente durable de sincronización.
