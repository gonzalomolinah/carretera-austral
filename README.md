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

## Conectar a Supabase

La app ya quedó preparada para guardar/cargar estado completo en Supabase.

### 1) Crear estructura (tabla + permisos + policies)

Ejecuta `supabase/schema.sql` en el SQL Editor.

### 2) Cargar datos iniciales

Ejecuta `supabase/seed.sql` en el SQL Editor.

### 3) Pegar credenciales en la app

En `app.js` reemplaza:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

con los valores de tu proyecto (Project Settings > API).

### 4) Probar

1. Abre `index.html`.
2. Crea/edita/mueve paradas.
3. Presiona `Guardar planificación` (también hay autosave).
4. Recarga la pagina en otro navegador/usuario: se verá el nuevo estado desde Supabase.

Si no configuras las credenciales, la app sigue funcionando con `localStorage` como respaldo.

## Estructura

- `index.html` interfaz principal
- `style.css` estilos
- `app.js` lógica de estado e interacción
- `supabase/schema.sql` estructura y seguridad mínima de la tabla
- `supabase/seed.sql` estado inicial del itinerario
