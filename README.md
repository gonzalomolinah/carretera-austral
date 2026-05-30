# carretera-austral

Planificador interactivo (HTML/CSS/JS) para organizar un viaje por la Carretera Austral.

Base inicial incluida: itinerario referencial de **12 días partiendo desde Puerto Montt** (PMC).

## Funciones

- Agregar atracciones/paradas personalizadas
- Organizar por día
- Mover lugares con drag & drop entre días
- Buscar, filtrar y ver carga estimada por día
- Marcar cada parada con estados:
  - Imprescindible
  - Reservado
  - Completado
- Editar cualquier dato de una parada (nombre, lugar, tipo, duración, costo, ruta) desde el botón ✎
- Reordenar dentro de un día con drag & drop o con los botones ▲▼ (compatible con táctil/iOS)
- Costo estimado por parada con totales por día y por viaje
- Notas por parada
- Enlaces opcionales de mapa y reserva
- Modo claro/oscuro (respeta la preferencia del sistema)
- Exportar a PDF / imprimir el itinerario
- Deshacer la última acción destructiva (borrar, reiniciar, importar)
- Persistencia local en navegador (`localStorage`)
- Autosave remoto con detección de conflictos usando `updated_at`
- Sincronización en vivo entre dispositivos con Supabase Realtime

## Uso rápido

1. Abre `index.html` en tu navegador.
2. Crea días y agrega atracciones.
3. Arrastra tarjetas para reordenar o mover entre días.

## Conectar a Supabase

La app ya quedó preparada para guardar/cargar estado completo en Supabase.

### 1) Crear estructura (tabla + permisos + policies)

Ejecuta `supabase/schema.sql` en el SQL Editor.

### 2) Cargar datos iniciales

Ejecuta `supabase/seed.sql` en el SQL Editor.

### 2b) Activar sincronización en vivo (opcional)

Ejecuta `supabase/migration.sql` una vez para habilitar Supabase Realtime. Con esto, los cambios hechos en un navegador aparecen en otros sin recargar. Si hay cambios locales sin guardar, se avisa de conflicto en lugar de pisarlos.

### 3) Pegar credenciales en la app

En `app.js` reemplaza:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

con los valores de tu proyecto (Project Settings > API).

### 4) Probar

1. Abre `index.html`.
2. Crea/edita/mueve paradas.
3. Presiona `Guardar planificación` si quieres forzar el guardado; también hay autosave.
4. Recarga la pagina en otro navegador/usuario: se verá el nuevo estado desde Supabase.

Si no configuras las credenciales, la app sigue funcionando con `localStorage` como respaldo.

## Estructura

- `index.html` interfaz principal
- `style.css` estilos
- `app.js` lógica de estado e interacción
- `supabase/schema.sql` estructura y seguridad mínima de la tabla
- `supabase/seed.sql` estado inicial del itinerario
- `supabase/migration.sql` activa la sincronización en vivo (Realtime)

La base se mantiene simple: cada planificación sigue guardándose como un único `state_json` en `planner_state`.
