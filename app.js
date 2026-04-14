const STORAGE_KEY = 'carretera-austral-planner-v2';
const SUPABASE_URL = 'PEGA_AQUI_TU_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'PEGA_AQUI_TU_SUPABASE_ANON_KEY';
const SUPABASE_TABLE = 'planner_state';
const SUPABASE_PLAN_ID = 'carretera-austral-public';

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

let state = structuredClone(defaultData);
let draggedId = null;
let supabaseClient = null;
let saveTimer = null;
let pendingRemoteSave = Promise.resolve();

const typeStyles = {
  'Naturaleza': { cls: 'type-naturaleza', label: '🌲 Naturaleza' },
  'Aventura': { cls: 'type-aventura', label: '🧗 Aventura' },
  'Cultura': { cls: 'type-cultura', label: '🏛️ Cultura' },
  'Gastronomía': { cls: 'type-gastronomia', label: '🍲 Gastronomía' },
  'Logística': { cls: 'type-logistica', label: '🛳️ Logística' },
  'Traslado': { cls: 'type-traslado', label: '🚐 Traslado' },
  'Ferry': { cls: 'type-ferry', label: '⛴️ Ferry' }
};

const markLabels = {
  must: '⭐ Imprescindible',
  booked: '🎟️ Reservado',
  done: '✅ Completado',
  lodging: '🛏️ Alojamiento',
  dayvisit: '📍 Visita día'
};

const itineraryEl = document.getElementById('itinerary');
const unassignedEl = document.getElementById('unassigned');
const daySelectEl = document.getElementById('daySelect');
const form = document.getElementById('attractionForm');
const cardTemplate = document.getElementById('cardTemplate');
const statStopsEl = document.getElementById('statStops');
const statHoursEl = document.getElementById('statHours');
const statDoneEl = document.getElementById('statDone');

function loadLocal() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : structuredClone(defaultData);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  queueRemoteSave();
}

function canUseSupabase() {
  const hasPlaceholders =
    SUPABASE_URL.includes('PEGA_AQUI') || SUPABASE_ANON_KEY.includes('PEGA_AQUI');
  return Boolean(window.supabase) && !hasPlaceholders;
}

function initSupabase() {
  if (!canUseSupabase()) return;
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function loadRemoteState() {
  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select('state_json')
    .eq('id', SUPABASE_PLAN_ID)
    .maybeSingle();

  if (error) throw error;
  if (data?.state_json) return data.state_json;

  await saveRemoteState(structuredClone(defaultData));
  return structuredClone(defaultData);
}

async function saveRemoteState(nextState) {
  const payload = {
    id: SUPABASE_PLAN_ID,
    state_json: nextState,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('Error guardando en Supabase:', error.message);
  }
}

function queueRemoteSave() {
  if (!supabaseClient) return;
  if (saveTimer) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    const snapshot = structuredClone(state);
    pendingRemoteSave = pendingRemoteSave
      .then(() => saveRemoteState(snapshot))
      .catch((err) => console.error('Error de cola Supabase:', err));
  }, 450);
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

  const isTransport = item.type === 'Traslado' || item.type === 'Ferry';
  const titleEl = card.querySelector('.title');
  const metaEl = card.querySelector('.meta');
  const quickMarksEl = card.querySelector('.quick-marks');

  if (isTransport) {
    card.classList.add('card-transport');
    if (item.type === 'Ferry') card.classList.add('card-ferry');
    titleEl.textContent = item.location || item.name || 'Inicio - Destino';
    metaEl.textContent = `⏱ ${item.duration}h total`;
  } else {
    titleEl.textContent = item.name;
    metaEl.textContent = `${item.location} · ${item.duration}h`;
  }

  const typeEl = card.querySelector('.type');
  const typeInfo = typeStyles[item.type] || { cls: 'type-logistica', label: item.type };
  typeEl.textContent = typeInfo.label;
  typeEl.classList.add(typeInfo.cls);

  const renderQuickMarks = () => {
    quickMarksEl.innerHTML = '';
    Object.entries(markLabels).forEach(([key, label]) => {
      if (!item.marks[key]) return;
      const tag = document.createElement('span');
      tag.className = 'quick-tag';
      tag.textContent = label;
      quickMarksEl.appendChild(tag);
    });
    if (isTransport && quickMarksEl.childElementCount === 0) {
      quickMarksEl.classList.add('hidden');
    } else {
      quickMarksEl.classList.remove('hidden');
    }
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
  unassignedEl.innerHTML = '';

  unassignedEl.ondragover = (e) => { e.preventDefault(); unassignedEl.classList.add('drag-over'); };
  unassignedEl.ondragleave = () => unassignedEl.classList.remove('drag-over');
  unassignedEl.ondrop = () => {
    unassignedEl.classList.remove('drag-over');
    const it = state.items.find(x => x.id === draggedId);
    if (!it) return;
    it.dayId = null;
    save();
    render();
  };

  state.items.filter(i => !i.dayId).forEach(item => unassignedEl.appendChild(buildCard(item)));
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

async function init() {
  initSupabase();

  if (supabaseClient) {
    try {
      state = await loadRemoteState();
    } catch (error) {
      console.error('No se pudo cargar Supabase, usando localStorage:', error.message);
      state = loadLocal();
    }
  } else {
    state = loadLocal();
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

init();