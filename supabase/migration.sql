-- Migración: activar sincronización en vivo (Supabase Realtime) para planner_state.
--
-- Ejecuta este archivo en el SQL Editor de Supabase UNA vez, después de haber
-- corrido schema.sql. La app se suscribe a los cambios UPDATE de cada fila de plan
-- y los aplica sin recargar. Realtime respeta las policies RLS de SELECT ya
-- definidas en schema.sql, así que no se exponen filas adicionales.

begin;

-- Agrega la tabla a la publicación que usa Realtime. Es idempotente: si la tabla
-- ya está en la publicación, el bloque DO evita el error "already member".
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'planner_state'
  ) then
    alter publication supabase_realtime add table public.planner_state;
  end if;
end
$$;

-- Asegura que el payload de los eventos incluya la fila completa (state_json y
-- updated_at) para poder aplicar el estado remoto directamente desde el evento.
alter table public.planner_state replica identity full;

commit;
