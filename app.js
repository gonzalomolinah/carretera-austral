const STORAGE_KEY = 'carretera-austral-planner-v2';

const baseDays = Array.from({ length: 12 }, (_, i) => ({
  id: crypto.randomUUID(),
  name: `Día ${i + 1}`
}));

const dayId = (n) => baseDays[n - 1].id;

const defaultData = {
  days: baseDays,
  items: [
    { id: crypto.randomUUID(), dayId: dayId(1), name: 'Llegada a Puerto Montt + compra de provisiones', location: 'Puerto Montt', type: 'Logística', duration: 3, marks: { must: true, booked: false, done: false, lodging: true, dayvisit: false }, notes: 'Base sugerida para salida temprano al día siguiente.' },
    { id: crypto.randomUUID(), dayId: dayId(2), name: 'Navegación Hornopirén → Caleta Gonzalo', location: 'Hornopirén / Caleta Gonzalo', type: 'Logística', duration: 5, marks: { must: true, booked: true, done: false, lodging: false, dayvisit: true }, notes: 'Reservar tramo bimodal con anticipación.' },
    { id: crypto.randomUUID(), dayId: dayId(2), name: 'Parque Pumalín', location: 'Chaitén - Caleta Gonzalo', type: 'Naturaleza', duration: 4, marks: { must: true, booked: false, done: false, lodging: false, dayvisit: true }, notes: '' },

    { id: crypto.randomUUID(), dayId: dayId(3), name: 'Ruta a Futaleufú / opción cruce a Esquel-Bariloche', location: 'Futaleufú', type: 'Aventura', duration: 6, marks: { must: false, booked: false, done: false, lodging: true, dayvisit: false }, notes: 'Opcional según clima y papeles para Argentina.' },

    { id: crypto.randomUUID(), dayId: dayId(4), name: 'Raúl Marín Balmaceda / entorno Queulat', location: 'La Junta', type: 'Naturaleza', duration: 4, marks: { must: false, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },
    { id: crypto.randomUUID(), dayId: dayId(5), name: 'Isla Magdalena', location: 'Puerto Cisnes', type: 'Cultura', duration: 3, marks: { must: false, booked: false, done: false, lodging: false, dayvisit: true }, notes: '' },

    { id: crypto.randomUUID(), dayId: dayId(6), name: 'Parque Queulat + Termas', location: 'Puyuhuapi', type: 'Naturaleza', duration: 6, marks: { must: true, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },

    { id: crypto.randomUUID(), dayId: dayId(7), name: 'Reserva Nacional Río Simpson', location: 'Coyhaique', type: 'Naturaleza', duration: 3, marks: { must: false, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },
    { id: crypto.randomUUID(), dayId: dayId(7), name: 'Capilla Redonda', location: 'Coyhaique', type: 'Cultura', duration: 1, marks: { must: false, booked: false, done: false, lodging: false, dayvisit: true }, notes: '' },

    { id: crypto.randomUUID(), dayId: dayId(8), name: 'Capillas de Mármol', location: 'Puerto Río Tranquilo', type: 'Naturaleza', duration: 3, marks: { must: true, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },
    { id: crypto.randomUUID(), dayId: dayId(8), name: 'Laguna San Rafael (excursión larga)', location: 'Puerto Río Tranquilo', type: 'Aventura', duration: 12, marks: { must: false, booked: false, done: false, lodging: false, dayvisit: true }, notes: 'Alternativa: Glaciar Exploradores.' },

    { id: crypto.randomUUID(), dayId: dayId(9), name: 'Río Baker + kayak/rafting', location: 'Puerto Bertrand', type: 'Aventura', duration: 4, marks: { must: false, booked: false, done: false, lodging: false, dayvisit: true }, notes: '' },
    { id: crypto.randomUUID(), dayId: dayId(9), name: 'Campo de Hielo Norte / fósiles', location: 'Puerto Guadal', type: 'Naturaleza', duration: 4, marks: { must: false, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },

    { id: crypto.randomUUID(), dayId: dayId(10), name: 'Reserva Nacional Jeinimeni', location: 'Chile Chico', type: 'Naturaleza', duration: 5, marks: { must: false, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },

    { id: crypto.randomUUID(), dayId: dayId(11), name: 'Parque Patagonia + RN Tamango + Glaciar Calluqueo', location: 'Cochrane', type: 'Naturaleza', duration: 6, marks: { must: true, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },

    { id: crypto.randomUUID(), dayId: dayId(12), name: 'Pasarelas de Caleta Tortel + Isla de los Muertos', location: 'Caleta Tortel', type: 'Cultura', duration: 5, marks: { must: true, booked: false, done: false, lodging: false, dayvisit: true }, notes: '' },
    { id: crypto.randomUUID(), dayId: dayId(12), name: 'Puerto Yungay / Cerro Santiago / conexión a Villa O’Higgins', location: 'Villa O’Higgins', type: 'Logística', duration: 5, marks: { must: false, booked: false, done: false, lodging: false, dayvisit: true }, notes: 'Usar como cierre o extensión de itinerario.' }
  ]
};

let state = load();
let draggedId = null;

const typeStyles = {
  'Naturaleza': { cls: 'type-naturaleza', label: '🌲 Naturaleza' },
  'Aventura': { cls: 'type-aventura', label: '🧗 Aventura' },
  'Cultura': { cls: 'type-cultura', label: '🏛️ Cultura' },
  'Gastronomía': { cls: 'type-gastronomia', label: '🍲 Gastronomía' },
  'Logística': { cls: 'type-logistica', label: '🛳️ Logística' }
};

const markLabels = {
  must: '⭐ Imprescindible',
  booked: '🎟️ Reservado',
  done: '✅ Completado',
  lodging: '🛏️ Alojamiento',
  dayvisit: '📍 Visita día'
};

const itineraryEl = document.getElementById('itinerary');
const daySelectEl = document.getElementById('daySelect');
const form = document.getElementById('attractionForm');
const cardTemplate = document.getElementById('cardTemplate');
const statStopsEl = document.getElementById('statStops');
const statHoursEl = document.getElementById('statHours');
const statDoneEl = document.getElementById('statDone');

function load() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : structuredClone(defaultData);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function refreshDaySelect() {
  daySelectEl.innerHTML = '<option value="">Sin asignar</option>';
  state.days.forEach(day => {
    const opt = document.createElement('option');
    opt.value = day.id;
    opt.textContent = day.name;
    daySelectEl.appendChild(opt);
  });
}

function buildCard(item) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  card.dataset.id = item.id;
  card.querySelector('.title').textContent = item.name;

  const typeEl = card.querySelector('.type');
  const typeInfo = typeStyles[item.type] || { cls: 'type-logistica', label: item.type };
  typeEl.textContent = typeInfo.label;
  typeEl.classList.add(typeInfo.cls);

  card.querySelector('.meta').textContent = `${item.location} · ${item.duration}h`;

  const quickMarksEl = card.querySelector('.quick-marks');
  const renderQuickMarks = () => {
    quickMarksEl.innerHTML = '';
    Object.entries(markLabels).forEach(([key, label]) => {
      if (!item.marks[key]) return;
      const tag = document.createElement('span');
      tag.className = 'quick-tag';
      tag.textContent = label;
      quickMarksEl.appendChild(tag);
    });
  };

  card.querySelectorAll('[data-mark]').forEach(cb => {
    const key = cb.dataset.mark;
    cb.checked = Boolean(item.marks[key]);
    cb.addEventListener('change', () => {
      item.marks[key] = cb.checked;
      renderQuickMarks();
      save();
    });
  });

  const notes = card.querySelector('.notes');
  notes.value = item.notes || '';
  notes.addEventListener('input', () => {
    item.notes = notes.value;
    save();
  });

  const details = card.querySelector('.details');
  const editBtn = card.querySelector('.edit');
  editBtn.addEventListener('click', () => {
    details.classList.toggle('hidden');
    editBtn.textContent = details.classList.contains('hidden') ? 'Editar' : 'Cerrar';
  });

  card.querySelector('.delete').addEventListener('click', () => {
    state.items = state.items.filter(x => x.id !== item.id);
    save();
    render();
  });

  card.addEventListener('dragstart', () => {
    draggedId = item.id;
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => {
    draggedId = null;
    card.classList.remove('dragging');
  });

  renderQuickMarks();
  return card;
}

function buildDayColumn(day) {
  const col = document.createElement('section');
  col.className = 'day';
  col.dataset.dayId = day.id;
  col.innerHTML = `<h3>${day.name}</h3>`;

  col.addEventListener('dragover', (e) => {
    e.preventDefault();
    col.classList.add('drag-over');
  });
  col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
  col.addEventListener('drop', () => {
    col.classList.remove('drag-over');
    if (!draggedId) return;
    const it = state.items.find(x => x.id === draggedId);
    if (!it) return;
    it.dayId = day.id;
    save();
    render();
  });

  state.items.filter(i => i.dayId === day.id).forEach(item => col.appendChild(buildCard(item)));
  return col;
}

function updateStats() {
  const totalStops = state.items.length;
  const totalHours = state.items.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const doneCount = state.items.filter(item => item.marks?.done).length;

  statStopsEl.textContent = `${totalStops} paradas`;
  statHoursEl.textContent = `${totalHours}h estimadas`;
  statDoneEl.textContent = `${doneCount} completadas`;
}

function render() {
  itineraryEl.innerHTML = '';

  const unassigned = document.createElement('section');
  unassigned.className = 'day';
  unassigned.innerHTML = '<h3>Sin asignar</h3>';
  unassigned.addEventListener('dragover', (e) => { e.preventDefault(); unassigned.classList.add('drag-over'); });
  unassigned.addEventListener('dragleave', () => unassigned.classList.remove('drag-over'));
  unassigned.addEventListener('drop', () => {
    unassigned.classList.remove('drag-over');
    const it = state.items.find(x => x.id === draggedId);
    if (!it) return;
    it.dayId = null;
    save();
    render();
  });

  state.items.filter(i => !i.dayId).forEach(item => unassigned.appendChild(buildCard(item)));
  itineraryEl.appendChild(unassigned);
  state.days.forEach(day => itineraryEl.appendChild(buildDayColumn(day)));
  refreshDaySelect();
  updateStats();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const item = {
    id: crypto.randomUUID(),
    dayId: daySelectEl.value || null,
    name: document.getElementById('name').value.trim(),
    location: document.getElementById('location').value.trim(),
    type: document.getElementById('type').value,
    duration: Number(document.getElementById('duration').value || 1),
    marks: { must: false, booked: false, done: false, lodging: false, dayvisit: false },
    notes: ''
  };
  state.items.push(item);
  form.reset();
  document.getElementById('duration').value = 2;
  save();
  render();
});

document.getElementById('addDayBtn').addEventListener('click', () => {
  const next = state.days.length + 1;
  state.days.push({ id: crypto.randomUUID(), name: `Día ${next}` });
  save();
  render();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('¿Seguro que quieres cargar la base recomendada de 12 días (Puerto Montt)?')) return;
  state = structuredClone(defaultData);
  save();
  render();
});

render();