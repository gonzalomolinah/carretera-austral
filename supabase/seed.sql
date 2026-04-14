insert into public.planner_state (id, state_json, updated_at)
values (
  'carretera-austral-public',
  $${
    "days": [
      { "id": "day-1", "name": "Día 1" },
      { "id": "day-2", "name": "Día 2" },
      { "id": "day-3", "name": "Día 3" },
      { "id": "day-4", "name": "Día 4" },
      { "id": "day-5", "name": "Día 5" },
      { "id": "day-6", "name": "Día 6" },
      { "id": "day-7", "name": "Día 7" },
      { "id": "day-8", "name": "Día 8" },
      { "id": "day-9", "name": "Día 9" },
      { "id": "day-10", "name": "Día 10" },
      { "id": "day-11", "name": "Día 11" },
      { "id": "day-12", "name": "Día 12" }
    ],
    "items": [
      {
        "id": "item-1",
        "dayId": "day-1",
        "order": 0,
        "name": "Llegada a Puerto Montt + compra de provisiones",
        "location": "Puerto Montt",
        "type": "Logística",
        "duration": 3,
        "marks": { "must": true, "booked": false, "done": false, "lodging": true, "dayvisit": false },
        "notes": "Base sugerida para salida temprano al día siguiente."
      },
      {
        "id": "item-2",
        "dayId": "day-2",
        "order": 0,
        "name": "Navegación Hornopirén → Caleta Gonzalo",
        "location": "Hornopirén / Caleta Gonzalo",
        "type": "Logística",
        "duration": 5,
        "marks": { "must": true, "booked": true, "done": false, "lodging": false, "dayvisit": true },
        "notes": "Reservar tramo bimodal con anticipación."
      },
      {
        "id": "item-3",
        "dayId": "day-2",
        "order": 1,
        "name": "Parque Pumalín",
        "location": "Chaitén - Caleta Gonzalo",
        "type": "Naturaleza",
        "duration": 4,
        "marks": { "must": true, "booked": false, "done": false, "lodging": false, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-4",
        "dayId": "day-3",
        "order": 0,
        "name": "Ruta a Futaleufú / opción cruce a Esquel-Bariloche",
        "location": "Futaleufú",
        "type": "Aventura",
        "duration": 6,
        "marks": { "must": false, "booked": false, "done": false, "lodging": true, "dayvisit": false },
        "notes": "Opcional según clima y papeles para Argentina."
      },
      {
        "id": "item-5",
        "dayId": "day-4",
        "order": 0,
        "name": "Raúl Marín Balmaceda / entorno Queulat",
        "location": "La Junta",
        "type": "Naturaleza",
        "duration": 4,
        "marks": { "must": false, "booked": false, "done": false, "lodging": true, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-6",
        "dayId": "day-5",
        "order": 0,
        "name": "Isla Magdalena",
        "location": "Puerto Cisnes",
        "type": "Cultura",
        "duration": 3,
        "marks": { "must": false, "booked": false, "done": false, "lodging": false, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-7",
        "dayId": "day-6",
        "order": 0,
        "name": "Parque Queulat + Termas",
        "location": "Puyuhuapi",
        "type": "Naturaleza",
        "duration": 6,
        "marks": { "must": true, "booked": false, "done": false, "lodging": true, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-8",
        "dayId": "day-7",
        "order": 0,
        "name": "Reserva Nacional Río Simpson",
        "location": "Coyhaique",
        "type": "Naturaleza",
        "duration": 3,
        "marks": { "must": false, "booked": false, "done": false, "lodging": true, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-9",
        "dayId": "day-7",
        "order": 1,
        "name": "Capilla Redonda",
        "location": "Coyhaique",
        "type": "Cultura",
        "duration": 1,
        "marks": { "must": false, "booked": false, "done": false, "lodging": false, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-10",
        "dayId": "day-8",
        "order": 0,
        "name": "Capillas de Mármol",
        "location": "Puerto Río Tranquilo",
        "type": "Naturaleza",
        "duration": 3,
        "marks": { "must": true, "booked": false, "done": false, "lodging": true, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-11",
        "dayId": "day-8",
        "order": 1,
        "name": "Laguna San Rafael (excursión larga)",
        "location": "Puerto Río Tranquilo",
        "type": "Aventura",
        "duration": 12,
        "marks": { "must": false, "booked": false, "done": false, "lodging": false, "dayvisit": true },
        "notes": "Alternativa: Glaciar Exploradores."
      },
      {
        "id": "item-12",
        "dayId": "day-9",
        "order": 0,
        "name": "Río Baker + kayak/rafting",
        "location": "Puerto Bertrand",
        "type": "Aventura",
        "duration": 4,
        "marks": { "must": false, "booked": false, "done": false, "lodging": false, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-13",
        "dayId": "day-9",
        "order": 1,
        "name": "Campo de Hielo Norte / fósiles",
        "location": "Puerto Guadal",
        "type": "Naturaleza",
        "duration": 4,
        "marks": { "must": false, "booked": false, "done": false, "lodging": true, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-14",
        "dayId": "day-10",
        "order": 0,
        "name": "Reserva Nacional Jeinimeni",
        "location": "Chile Chico",
        "type": "Naturaleza",
        "duration": 5,
        "marks": { "must": false, "booked": false, "done": false, "lodging": true, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-15",
        "dayId": "day-11",
        "order": 0,
        "name": "Parque Patagonia + RN Tamango + Glaciar Calluqueo",
        "location": "Cochrane",
        "type": "Naturaleza",
        "duration": 6,
        "marks": { "must": true, "booked": false, "done": false, "lodging": true, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-16",
        "dayId": "day-12",
        "order": 0,
        "name": "Pasarelas de Caleta Tortel + Isla de los Muertos",
        "location": "Caleta Tortel",
        "type": "Cultura",
        "duration": 5,
        "marks": { "must": true, "booked": false, "done": false, "lodging": false, "dayvisit": true },
        "notes": ""
      },
      {
        "id": "item-17",
        "dayId": "day-12",
        "order": 1,
        "name": "Puerto Yungay / Cerro Santiago / conexión a Villa O'Higgins",
        "location": "Villa O'Higgins",
        "type": "Logística",
        "duration": 5,
        "marks": { "must": false, "booked": false, "done": false, "lodging": false, "dayvisit": true },
        "notes": "Usar como cierre o extensión de itinerario."
      }
    ]
  }$$::jsonb,
  now()
)
on conflict (id)
do update
set
  state_json = excluded.state_json,
  updated_at = excluded.updated_at;
