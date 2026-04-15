const STORAGE_KEY = 'carretera-austral-planner-v2';
const SUPABASE_URL = 'https://cioggccobgnglprrvfpk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_v_qzelV5YofpbQWaxf4wIw_mhKt-WOh';
const SUPABASE_TABLE = 'planner_state';
const SUPABASE_PLAN_PREFIX = 'carretera-austral-';

const PLAN_OPTIONS = [
  { key: 'general', label: 'General' },
  { key: 'molina', label: 'Molina' },
  { key: 'inaki', label: 'Iñaki' },
  { key: 'nef', label: 'Nef' },
  { key: 'ross', label: 'Ross' }
];

const DEFAULT_PLAN_KEY = PLAN_OPTIONS[0].key;

const defaultDays = Array.from({ length: 12 }, (_, i) => ({
  id: `day-${i + 1}`,
  name: `Día ${i + 1}`
}));

const defaultItems = [
  { id: 'item-1', dayId: 'day-1', order: 0, name: 'Llegada a Puerto Montt + compra de provisiones', location: 'Puerto Montt', type: 'Logística', duration: 3, marks: { must: true, booked: false, done: false, lodging: true, dayvisit: false }, notes: 'Base sugerida para salida temprano al día siguiente.' },
  { id: 'item-2', dayId: 'day-2', order: 0, name: 'Navegación Hornopirén -> Caleta Gonzalo', location: 'Hornopirén / Caleta Gonzalo', type: 'Logística', duration: 5, marks: { must: true, booked: true, done: false, lodging: false, dayvisit: true }, notes: 'Reservar tramo bimodal con anticipación.' },
  { id: 'item-3', dayId: 'day-2', order: 1, name: 'Parque Pumalín', location: 'Chaitén - Caleta Gonzalo', type: 'Naturaleza', duration: 4, marks: { must: true, booked: false, done: false, lodging: false, dayvisit: true }, notes: '' },
  { id: 'item-4', dayId: 'day-3', order: 0, name: 'Ruta a Futaleufú / opción cruce a Esquel-Bariloche', location: 'Futaleufú', type: 'Aventura', duration: 6, marks: { must: false, booked: false, done: false, lodging: true, dayvisit: false }, notes: 'Opcional según clima y papeles para Argentina.' },
  { id: 'item-5', dayId: 'day-4', order: 0, name: 'Raúl Marín Balmaceda / entorno Queulat', location: 'La Junta', type: 'Naturaleza', duration: 4, marks: { must: false, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },
  { id: 'item-6', dayId: 'day-5', order: 0, name: 'Isla Magdalena', location: 'Puerto Cisnes', type: 'Cultura', duration: 3, marks: { must: false, booked: false, done: false, lodging: false, dayvisit: true }, notes: '' },
  { id: 'item-7', dayId: 'day-6', order: 0, name: 'Parque Queulat + Termas', location: 'Puyuhuapi', type: 'Naturaleza', duration: 6, marks: { must: true, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },
  { id: 'item-8', dayId: 'day-7', order: 0, name: 'Reserva Nacional Río Simpson', location: 'Coyhaique', type: 'Naturaleza', duration: 3, marks: { must: false, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },
  { id: 'item-9', dayId: 'day-7', order: 1, name: 'Capilla Redonda', location: 'Coyhaique', type: 'Cultura', duration: 1, marks: { must: false, booked: false, done: false, lodging: false, dayvisit: true }, notes: '' },
  { id: 'item-10', dayId: 'day-8', order: 0, name: 'Capillas de Mármol', location: 'Puerto Río Tranquilo', type: 'Naturaleza', duration: 3, marks: { must: true, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },
  { id: 'item-11', dayId: 'day-8', order: 1, name: 'Laguna San Rafael (excursión larga)', location: 'Puerto Río Tranquilo', type: 'Aventura', duration: 12, marks: { must: false, booked: false, done: false, lodging: false, dayvisit: true }, notes: 'Alternativa: Glaciar Exploradores.' },
  { id: 'item-12', dayId: 'day-9', order: 0, name: 'Río Baker + kayak/rafting', location: 'Puerto Bertrand', type: 'Aventura', duration: 4, marks: { must: false, booked: false, done: false, lodging: false, dayvisit: true }, notes: '' },
  { id: 'item-13', dayId: 'day-9', order: 1, name: 'Campo de Hielo Norte / fósiles', location: 'Puerto Guadal', type: 'Naturaleza', duration: 4, marks: { must: false, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },
  { id: 'item-14', dayId: 'day-10', order: 0, name: 'Reserva Nacional Jeinimeni', location: 'Chile Chico', type: 'Naturaleza', duration: 5, marks: { must: false, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },
  { id: 'item-15', dayId: 'day-11', order: 0, name: 'Parque Patagonia + RN Tamango + Glaciar Calluqueo', location: 'Cochrane', type: 'Naturaleza', duration: 6, marks: { must: true, booked: false, done: false, lodging: true, dayvisit: true }, notes: '' },
  { id: 'item-16', dayId: 'day-12', order: 0, name: 'Pasarelas de Caleta Tortel + Isla de los Muertos', location: 'Caleta Tortel', type: 'Cultura', duration: 5, marks: { must: true, booked: false, done: false, lodging: false, dayvisit: true }, notes: '' },
  { id: 'item-17', dayId: 'day-12', order: 1, name: 'Puerto Yungay / Cerro Santiago / conexión a Villa O\'Higgins', location: 'Villa O\'Higgins', type: 'Logística', duration: 5, marks: { must: false, booked: false, done: false, lodging: false, dayvisit: true }, notes: 'Usar como cierre o extensión de itinerario.' }
];

const defaultData = {
  days: defaultDays,
  items: defaultItems
};

function createEmptyPlanData() {
  return {
    days: structuredClone(defaultDays),
    items: []
  };
}

let state = structuredClone(defaultData);
let draggedId = null;
let supabaseClient = null;
let hasUnsavedChanges = false;
let currentPlanKey = DEFAULT_PLAN_KEY;

const typeStyles = {
  Naturaleza: { cls: 'type-naturaleza', label: '🌲 Naturaleza' },
  Aventura: { cls: 'type-aventura', label: '🧗 Aventura' },
  Cultura: { cls: 'type-cultura', label: '🏛️ Cultura' },
  'Gastronomía': { cls: 'type-gastronomia', label: '🍲 Gastronomía' },
  'Logística': { cls: 'type-logistica', label: '🛳️ Logística' },
  Traslado: { cls: 'type-traslado', label: '🚐 Traslado' },
  Ferry: { cls: 'type-ferry', label: '⛴️ Ferry' }
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
const saveBtn = document.getElementById('saveBtn');
const syncStatusEl = document.getElementById('syncStatus');
const planSelectEl = document.getElementById('planSelect');

const entryKindEl = document.getElementById('entryKind');
const placeFieldsEl = document.getElementById('placeFields');
const tripFieldsEl = document.getElementById('tripFields');
const placeNameEl = document.getElementById('placeName');
const placeLocationEl = document.getElementById('placeLocation');
const placeTypeEl = document.getElementById('placeType');
const placeDurationEl = document.getElementById('placeDuration');
const tripStartEl = document.getElementById('tripStart');
const tripEndEl = document.getElementById('tripEnd');
const tripModeEl = document.getElementById('tripMode');
const tripDurationEl = document.getElementById('tripDuration');

const addDayBtn = document.getElementById('addDayBtn');
const resetBtn = document.getElementById('resetBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');

const syncTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

function getPlanLabel(planKey) {
  return PLAN_OPTIONS.find((plan) => plan.key === planKey)?.label || planKey;
}

function getPlanRowId(planKey) {
  return `${SUPABASE_PLAN_PREFIX}${planKey}`;
}

function createDefaultStore() {
  return {
    selectedPlanKey: DEFAULT_PLAN_KEY,
    plans: {}
  };
}

function updateSyncStatus(message, level = 'local') {
  if (!syncStatusEl) return;
  syncStatusEl.textContent = message;
  syncStatusEl.dataset.level = level;
}

function setSaveButtonBusy(isBusy) {
  if (!saveBtn) return;
  saveBtn.disabled = isBusy;
  saveBtn.textContent = isBusy ? 'Guardando...' : 'Guardar planificación';
}

function setPlanSelectBusy(isBusy) {
  if (!planSelectEl) return;
  planSelectEl.disabled = isBusy;
}

function setFieldRequired(field, isRequired) {
  if (!field) return;
  field.required = isRequired;
}

function updateEntryKindUI() {
  const isPlace = entryKindEl.value === 'place';
  placeFieldsEl.classList.toggle('hidden', !isPlace);
  tripFieldsEl.classList.toggle('hidden', isPlace);

  setFieldRequired(placeNameEl, isPlace);
  setFieldRequired(placeLocationEl, isPlace);
  setFieldRequired(tripStartEl, !isPlace);
  setFieldRequired(tripEndEl, !isPlace);
}

function normalizeType(typeValue) {
  const typeMap = {
    Gastronomia: 'Gastronomía',
    Logistica: 'Logística',
    Auto: 'Traslado'
  };

  const normalized = typeMap[typeValue] || typeValue;
  return typeStyles[normalized] ? normalized : 'Logística';
}

function sanitizeMarks(marks) {
  const source = marks && typeof marks === 'object' ? marks : {};
  return {
    must: Boolean(source.must),
    booked: Boolean(source.booked),
    done: Boolean(source.done),
    lodging: Boolean(source.lodging),
    dayvisit: Boolean(source.dayvisit)
  };
}

function sanitizeState(rawState) {
  if (!rawState || typeof rawState !== 'object') {
    throw new Error('Estado inválido: objeto esperado.');
  }

  const rawDays = Array.isArray(rawState.days) ? rawState.days : [];
  if (rawDays.length === 0) {
    throw new Error('El JSON no contiene días.');
  }

  const daySeen = new Set();
  const days = rawDays.map((day, index) => {
    const source = day && typeof day === 'object' ? day : {};
    let id = typeof source.id === 'string' ? source.id.trim() : '';
    if (!id) id = `day-import-${index + 1}`;
    if (daySeen.has(id)) id = `${id}-${crypto.randomUUID().slice(0, 6)}`;
    daySeen.add(id);

    const name = typeof source.name === 'string' && source.name.trim()
      ? source.name.trim()
      : `Día ${index + 1}`;

    return { id, name };
  });

  const validDayIds = new Set(days.map((d) => d.id));
  const rawItems = Array.isArray(rawState.items) ? rawState.items : [];
  const itemSeen = new Set();

  const items = rawItems.map((item, index) => {
    const source = item && typeof item === 'object' ? item : {};

    let id = typeof source.id === 'string' ? source.id.trim() : '';
    if (!id) id = `item-import-${index + 1}`;
    if (itemSeen.has(id)) id = `${id}-${crypto.randomUUID().slice(0, 6)}`;
    itemSeen.add(id);

    const parsedDuration = Number(source.duration);
    const duration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 1;

    const name = typeof source.name === 'string' ? source.name.trim() : '';
    const location = typeof source.location === 'string' ? source.location.trim() : '';

    return {
      id,
      dayId: typeof source.dayId === 'string' && validDayIds.has(source.dayId) ? source.dayId : null,
      order: Number.isFinite(source.order) ? source.order : index,
      name: name || 'Parada sin nombre',
      location,
      type: normalizeType(typeof source.type === 'string' ? source.type : ''),
      duration,
      marks: sanitizeMarks(source.marks),
      notes: typeof source.notes === 'string' ? source.notes : ''
    };
  });

  return { days, items };
}

function parseLocalStore(rawText) {
  if (!rawText) return createDefaultStore();

  try {
    const parsed = JSON.parse(rawText);

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.days) && Array.isArray(parsed.items)) {
      const legacyState = sanitizeState(parsed);
      return {
        selectedPlanKey: DEFAULT_PLAN_KEY,
        plans: {
          [DEFAULT_PLAN_KEY]: legacyState
        }
      };
    }

    if (!parsed || typeof parsed !== 'object') return createDefaultStore();

    const safeStore = createDefaultStore();
    const selected = typeof parsed.selectedPlanKey === 'string' ? parsed.selectedPlanKey : DEFAULT_PLAN_KEY;
    safeStore.selectedPlanKey = PLAN_OPTIONS.some((p) => p.key === selected) ? selected : DEFAULT_PLAN_KEY;

    if (parsed.plans && typeof parsed.plans === 'object') {
      PLAN_OPTIONS.forEach((plan) => {
        const value = parsed.plans[plan.key];
        if (!value) return;

        try {
          safeStore.plans[plan.key] = sanitizeState(value);
        } catch (error) {
          console.warn(`Plan local inválido (${plan.key}), se ignora:`, error.message);
        }
      });
    }

    return safeStore;
  } catch (error) {
    console.warn('localStorage inválido, se usa almacenamiento limpio:', error.message);
    return createDefaultStore();
  }
}

function readLocalStore() {
  return parseLocalStore(localStorage.getItem(STORAGE_KEY));
}

function writeLocalStore(store) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function getLocalPlanState(planKey) {
  const store = readLocalStore();
  const planState = store.plans[planKey];
  return planState ? sanitizeState(planState) : createEmptyPlanData();
}

function persistLocalPlanState(planKey, planState) {
  const store = readLocalStore();
  store.plans[planKey] = sanitizeState(planState);
  store.selectedPlanKey = planKey;
  writeLocalStore(store);
}

function getInitialPlanKey() {
  const store = readLocalStore();
  const selected = store.selectedPlanKey;
  return PLAN_OPTIONS.some((plan) => plan.key === selected) ? selected : DEFAULT_PLAN_KEY;
}

function populatePlanSelect() {
  planSelectEl.innerHTML = '';

  PLAN_OPTIONS.forEach((plan) => {
    const option = document.createElement('option');
    option.value = plan.key;
    option.textContent = plan.label;
    planSelectEl.appendChild(option);
  });

  planSelectEl.value = currentPlanKey;
}

function getOrderKey(dayValue) {
  return dayValue || '__unassigned__';
}

function getItemsForDay(dayValue) {
  return state.items
    .filter((item) => (item.dayId || null) === (dayValue || null))
    .sort((a, b) => {
      const aOrder = Number.isFinite(a.order) ? a.order : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b.order) ? b.order : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder;
    });
}

function getNextOrderForDay(dayValue, excludedId = null) {
  let maxOrder = -1;
  state.items.forEach((item) => {
    if ((item.dayId || null) !== (dayValue || null)) return;
    if (excludedId && item.id === excludedId) return;
    const itemOrder = Number.isFinite(item.order) ? item.order : -1;
    if (itemOrder > maxOrder) maxOrder = itemOrder;
  });
  return maxOrder + 1;
}

function normalizeState() {
  const groups = new Map();

  state.items.forEach((item, index) => {
    if (!item.marks) {
      item.marks = { must: false, booked: false, done: false, lodging: false, dayvisit: false };
    }
    if (typeof item.notes !== 'string') item.notes = '';
    item.type = normalizeType(item.type);

    const key = getOrderKey(item.dayId);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ item, index });
  });

  groups.forEach((entries) => {
    entries.sort((a, b) => {
      const aOrder = Number.isFinite(a.item.order) ? a.item.order : Number.MAX_SAFE_INTEGER;
      const bOrder = Number.isFinite(b.item.order) ? b.item.order : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.index - b.index;
    });

    entries.forEach((entry, idx) => {
      entry.item.order = idx;
    });
  });
}

function markUnsaved() {
  normalizeState();
  hasUnsavedChanges = true;
  updateSyncStatus(`Hay cambios sin guardar en "${getPlanLabel(currentPlanKey)}". Presiona "Guardar planificación".`, 'pending');
}

function moveItemToDay(itemId, targetDayId) {
  const item = state.items.find((x) => x.id === itemId);
  if (!item) return;
  item.dayId = targetDayId;
  item.order = getNextOrderForDay(targetDayId, itemId);
  markUnsaved();
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

async function loadRemoteState(planKey) {
  const rowId = getPlanRowId(planKey);

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select('state_json')
    .eq('id', rowId)
    .maybeSingle();

  if (error) throw error;
  if (data?.state_json) return sanitizeState(data.state_json);

  const emptyPlan = createEmptyPlanData();
  await saveRemoteState(planKey, emptyPlan);
  return emptyPlan;
}

async function saveRemoteState(planKey, nextState) {
  const payload = {
    id: getPlanRowId(planKey),
    state_json: nextState,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    throw error;
  }
}

async function saveCurrentState() {
  normalizeState();
  const snapshot = structuredClone(state);
  persistLocalPlanState(currentPlanKey, snapshot);

  if (!supabaseClient) {
    hasUnsavedChanges = false;
    updateSyncStatus(`Planificación "${getPlanLabel(currentPlanKey)}" guardada localmente.`, 'local');
    return;
  }

  setSaveButtonBusy(true);
  updateSyncStatus(`Guardando "${getPlanLabel(currentPlanKey)}" en la base...`, 'saving');

  try {
    await saveRemoteState(currentPlanKey, snapshot);
    hasUnsavedChanges = false;
    const syncTime = syncTimeFormatter.format(new Date());
    updateSyncStatus(`Planificación "${getPlanLabel(currentPlanKey)}" guardada a las ${syncTime}.`, 'saved');
  } finally {
    setSaveButtonBusy(false);
  }
}

async function switchToPlan(nextPlanKey, options = {}) {
  const { force = false } = options;

  if (!PLAN_OPTIONS.some((plan) => plan.key === nextPlanKey)) return;

  if (!force && nextPlanKey === currentPlanKey) {
    planSelectEl.value = currentPlanKey;
    return;
  }

  if (!force && hasUnsavedChanges) {
    const shouldContinue = window.confirm(
      `Hay cambios sin guardar en "${getPlanLabel(currentPlanKey)}". Si cambias de planificación, esos cambios se perderán. ¿Continuar?`
    );

    if (!shouldContinue) {
      planSelectEl.value = currentPlanKey;
      return;
    }
  }

  setPlanSelectBusy(true);
  updateSyncStatus(`Cargando planificación "${getPlanLabel(nextPlanKey)}"...`, 'saving');

  try {
    let nextState;

    if (supabaseClient) {
      try {
        nextState = await loadRemoteState(nextPlanKey);
        updateSyncStatus(`Planificación "${getPlanLabel(nextPlanKey)}" cargada desde la base de datos.`, 'saved');
      } catch (error) {
        console.error(`No se pudo cargar ${nextPlanKey} desde Supabase:`, error.message);
        nextState = getLocalPlanState(nextPlanKey);
        updateSyncStatus(`No se pudo leer "${getPlanLabel(nextPlanKey)}" desde Supabase. Se cargó respaldo local.`, 'error');
      }
    } else {
      nextState = getLocalPlanState(nextPlanKey);
      updateSyncStatus(`Planificación "${getPlanLabel(nextPlanKey)}" en modo local.`, 'local');
    }

    state = sanitizeState(nextState);
    currentPlanKey = nextPlanKey;
    hasUnsavedChanges = false;
    persistLocalPlanState(currentPlanKey, state);
    normalizeState();
    render();
    planSelectEl.value = currentPlanKey;
  } finally {
    setPlanSelectBusy(false);
  }
}

function refreshDaySelect() {
  const currentValue = daySelectEl.value;
  daySelectEl.innerHTML = '<option value="">Sin asignar</option>';

  state.days.forEach((day) => {
    const opt = document.createElement('option');
    opt.value = day.id;
    opt.textContent = day.name;
    daySelectEl.appendChild(opt);
  });

  if (currentValue && state.days.some((day) => day.id === currentValue)) {
    daySelectEl.value = currentValue;
  }
}

function buildCard(item) {
  const card = cardTemplate.content.firstElementChild.cloneNode(true);
  card.dataset.id = item.id;
  const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  if (isCoarsePointer) {
    card.draggable = false;
  }

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

  card.querySelectorAll('[data-mark]').forEach((checkbox) => {
    const key = checkbox.dataset.mark;
    checkbox.checked = Boolean(item.marks[key]);
    checkbox.addEventListener('change', () => {
      item.marks[key] = checkbox.checked;
      renderQuickMarks();
      markUnsaved();
    });
  });

  const notes = card.querySelector('.notes');
  notes.value = item.notes || '';
  notes.addEventListener('input', () => {
    item.notes = notes.value;
    markUnsaved();
  });

  const details = card.querySelector('.details');
  const moveDaySelect = card.querySelector('.move-day');
  const moveApplyBtn = card.querySelector('.move-apply');
  const editBtn = card.querySelector('.edit');

  moveDaySelect.innerHTML = '<option value="">Sin asignar</option>';
  state.days.forEach((day) => {
    const opt = document.createElement('option');
    opt.value = day.id;
    opt.textContent = day.name;
    moveDaySelect.appendChild(opt);
  });
  moveDaySelect.value = item.dayId || '';

  moveApplyBtn.addEventListener('click', () => {
    const targetDayId = moveDaySelect.value || null;
    const currentDayId = item.dayId || null;
    if (targetDayId === currentDayId) return;
    moveItemToDay(item.id, targetDayId);
    render();
  });

  editBtn.addEventListener('click', () => {
    details.classList.toggle('hidden');
    editBtn.textContent = details.classList.contains('hidden') ? 'Editar' : 'Cerrar';
  });

  card.querySelector('.delete').addEventListener('click', () => {
    state.items = state.items.filter((x) => x.id !== item.id);
    markUnsaved();
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

  col.addEventListener('dragover', (event) => {
    event.preventDefault();
    col.classList.add('drag-over');
  });

  col.addEventListener('dragleave', () => col.classList.remove('drag-over'));

  col.addEventListener('drop', () => {
    col.classList.remove('drag-over');
    if (!draggedId) return;
    moveItemToDay(draggedId, day.id);
    render();
  });

  getItemsForDay(day.id).forEach((item) => col.appendChild(buildCard(item)));
  return col;
}

function updateStats() {
  const totalStops = state.items.length;
  const totalHours = state.items.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const doneCount = state.items.filter((item) => item.marks?.done).length;

  statStopsEl.textContent = `${totalStops} paradas`;
  statHoursEl.textContent = `${totalHours}h estimadas`;
  statDoneEl.textContent = `${doneCount} completadas`;
}

function render() {
  itineraryEl.innerHTML = '';
  unassignedEl.innerHTML = '';

  unassignedEl.ondragover = (event) => {
    event.preventDefault();
    unassignedEl.classList.add('drag-over');
  };

  unassignedEl.ondragleave = () => unassignedEl.classList.remove('drag-over');

  unassignedEl.ondrop = () => {
    unassignedEl.classList.remove('drag-over');
    if (!draggedId) return;
    moveItemToDay(draggedId, null);
    render();
  };

  getItemsForDay(null).forEach((item) => unassignedEl.appendChild(buildCard(item)));
  state.days.forEach((day) => itineraryEl.appendChild(buildDayColumn(day)));
  refreshDaySelect();
  updateStats();
}

function buildItemFromForm() {
  const dayId = daySelectEl.value || null;
  const kind = entryKindEl.value;

  if (kind === 'trip') {
    const start = tripStartEl.value.trim();
    const end = tripEndEl.value.trim();
    const mode = tripModeEl.value;
    const duration = Number(tripDurationEl.value || 1);

    if (!start || !end) {
      throw new Error('Completa inicio y fin del viaje.');
    }

    const route = `${start} -> ${end}`;

    return {
      id: crypto.randomUUID(),
      dayId,
      order: getNextOrderForDay(dayId),
      name: mode === 'Ferry' ? `Ferry ${route}` : `Viaje ${route}`,
      location: route,
      type: normalizeType(mode),
      duration: Number.isFinite(duration) && duration > 0 ? duration : 1,
      marks: { must: false, booked: false, done: false, lodging: false, dayvisit: false },
      notes: ''
    };
  }

  const placeName = placeNameEl.value.trim();
  const placeLocation = placeLocationEl.value.trim();
  const placeType = normalizeType(placeTypeEl.value);
  const placeDuration = Number(placeDurationEl.value || 1);

  if (!placeName || !placeLocation) {
    throw new Error('Completa nombre y lugar de la parada.');
  }

  return {
    id: crypto.randomUUID(),
    dayId,
    order: getNextOrderForDay(dayId),
    name: placeName,
    location: placeLocation,
    type: placeType,
    duration: Number.isFinite(placeDuration) && placeDuration > 0 ? placeDuration : 1,
    marks: { must: false, booked: false, done: false, lodging: false, dayvisit: false },
    notes: ''
  };
}

function resetFormAfterSubmit(selectedKind, selectedDayId) {
  form.reset();
  entryKindEl.value = selectedKind;
  placeDurationEl.value = 2;
  tripDurationEl.value = 4;
  daySelectEl.value = selectedDayId || '';
  updateEntryKindUI();
}

function exportStateAsJson() {
  normalizeState();
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  anchor.href = url;
  anchor.download = `carretera-austral-${currentPlanKey}-${stamp}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);

  updateSyncStatus(`JSON exportado (${getPlanLabel(currentPlanKey)}).`, hasUnsavedChanges ? 'pending' : (supabaseClient ? 'saved' : 'local'));
}

async function importStateFromFile(file) {
  if (!file) return;

  const text = await file.text();
  const parsed = JSON.parse(text);
  const imported = sanitizeState(parsed);

  const confirmed = window.confirm(
    `Este JSON reemplazará la planificación "${getPlanLabel(currentPlanKey)}". ¿Continuar?`
  );

  if (!confirmed) return;

  state = imported;
  normalizeState();
  render();
  markUnsaved();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();

  try {
    const selectedKind = entryKindEl.value;
    const selectedDayId = daySelectEl.value || null;
    const item = buildItemFromForm();

    state.items.push(item);
    markUnsaved();
    render();
    resetFormAfterSubmit(selectedKind, selectedDayId);
  } catch (error) {
    window.alert(error.message);
  }
});

entryKindEl.addEventListener('change', () => {
  updateEntryKindUI();
});

planSelectEl.addEventListener('change', async () => {
  try {
    await switchToPlan(planSelectEl.value);
  } catch (error) {
    console.error('Error cambiando de planificación:', error.message);
    planSelectEl.value = currentPlanKey;
    updateSyncStatus('No se pudo cambiar de planificación.', 'error');
  }
});

saveBtn.addEventListener('click', async () => {
  if (!hasUnsavedChanges) {
    updateSyncStatus(`No hay cambios sin guardar en "${getPlanLabel(currentPlanKey)}".`, supabaseClient ? 'saved' : 'local');
    return;
  }

  try {
    await saveCurrentState();
  } catch (error) {
    console.error('Error al guardar:', error.message);
    updateSyncStatus(`No se pudo guardar "${getPlanLabel(currentPlanKey)}" en la base de datos.`, 'error');
  }
});

addDayBtn.addEventListener('click', () => {
  const next = state.days.length + 1;
  state.days.push({ id: crypto.randomUUID(), name: `Día ${next}` });
  markUnsaved();
  render();
});

resetBtn.addEventListener('click', () => {
  const confirmed = window.confirm(
    `¿Seguro que quieres cargar la base recomendada de 12 días en "${getPlanLabel(currentPlanKey)}"?`
  );

  if (!confirmed) return;

  state = structuredClone(defaultData);
  normalizeState();
  markUnsaved();
  render();
});

exportJsonBtn.addEventListener('click', () => {
  exportStateAsJson();
});

importJsonBtn.addEventListener('click', () => {
  importJsonInput.click();
});

importJsonInput.addEventListener('change', async () => {
  const file = importJsonInput.files?.[0];

  try {
    await importStateFromFile(file);
  } catch (error) {
    console.error('Error importando JSON:', error.message);
    updateSyncStatus('JSON inválido. Revisa el archivo e intenta de nuevo.', 'error');
  } finally {
    importJsonInput.value = '';
  }
});

async function init() {
  updateEntryKindUI();
  initSupabase();

  currentPlanKey = getInitialPlanKey();
  populatePlanSelect();

  try {
    await switchToPlan(currentPlanKey, { force: true });
  } catch (error) {
    console.error('Error inicializando planificación:', error.message);
    state = createEmptyPlanData();
    normalizeState();
    render();
    updateSyncStatus('No se pudo cargar la planificación inicial.', 'error');
  }

  hasUnsavedChanges = false;
}

init();
