# carretera-austral

Planificador interactivo (HTML/CSS/JS) para organizar un viaje por la Carretera Austral.

Base inicial incluida: itinerario referencial de **12 días partiendo desde Puerto Montt** (PMC).

## Funciones

- Agregar atracciones/paradas personalizadas
- Organizar por día
- Mover lugares con drag & drop entre días
- Marcar cada parada con estados:
  - Imprescindible
  - Reservado
  - Completado
- Notas por parada
- Persistencia local en navegador (`localStorage`)

## Uso rápido

1. Abre `index.html` en tu navegador.
2. Crea días y agrega atracciones.
3. Arrastra tarjetas para reordenar o mover entre días.

## Conectar a Supabase (sin mayor seguridad)

La app ya quedó preparada para guardar/cargar estado completo en Supabase.

### 1) Crear tabla en Supabase

En el SQL Editor de Supabase ejecuta:

```sql
create table if not exists public.planner_state (
  id text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default now()
);
```

### 2) Desactivar RLS (modo simple)

```sql
alter table public.planner_state disable row level security;
```

Esto es intencionalmente simple y poco seguro (cualquiera con tu `anon key` podria escribir).

### 3) Pegar credenciales en la app

En `app.js` reemplaza:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

con los valores de tu proyecto (Project Settings > API).

### 4) Probar

1. Abre `index.html`.
2. Crea/edita/mueve paradas.
3. Recarga la pagina: los cambios deberian volver desde Supabase.

Si no configuras las credenciales, la app sigue funcionando con `localStorage` como respaldo.

## Estructura

- `index.html` interfaz principal
- `style.css` estilos
- `app.js` lógica de estado e interacción
