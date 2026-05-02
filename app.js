const STORAGE_KEY = 'carretera-austral-planner-v2';
const SUPABASE_URL = 'https://cioggccobgnglprrvfpk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_v_qzelV5YofpbQWaxf4wIw_mhKt-WOh';
const SUPABASE_TABLE = 'planner_state';
const SUPABASE_PLAN_PREFIX = 'carretera-austral-';
const STATE_SCHEMA_VERSION = 2;
const AUTO_SAVE_DELAY_MS = 1400;
const DAILY_HOURS_WARNING = 9;
const REMOTE_CONFLICT_CODE = 'REMOTE_CONFLICT';

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
  schemaVersion: STATE_SCHEMA_VERSION,
  days: defaultDays,
  items: defaultItems
};

function createEmptyPlanData() {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    days: structuredClone(defaultDays),
    items: []
  };
}

let state = structuredClone(defaultData);
let draggedId = null;
let supabaseClient = null;
let hasUnsavedChanges = false;
let currentPlanKey = DEFAULT_PLAN_KEY;
let mobileDayIndex = 0;
let lastRemoteUpdatedAt = null;
let autoSaveTimer = null;
let isSaving = false;
let changeSerial = 0;
let pendingConflict = null;
let activeFilter = 'all';
let searchTerm = '';

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
const statWarningsEl = document.getElementById('statWarnings');
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
const mapUrlEl = document.getElementById('mapUrl');
const reservationUrlEl = document.getElementById('reservationUrl');

const addDayBtn = document.getElementById('addDayBtn');
const resetBtn = document.getElementById('resetBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
const copyPlanSelectEl = document.getElementById('copyPlanSelect');
const copyPlanBtn = document.getElementById('copyPlanBtn');
const mobileDayNavEl = document.getElementById('mobileDayNav');
const prevDayBtn = document.getElementById('prevDayBtn');
const nextDayBtn = document.getElementById('nextDayBtn');
const searchInputEl = document.getElementById('searchInput');
const filterSelectEl = document.getElementById('filterSelect');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const mobileViewportQuery = window.matchMedia('(max-width: 900px)');

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

function normalizeKind(kindValue, normalizedType) {
  if (kindValue === 'place' || kindValue === 'trip') return kindValue;
  return normalizedType === 'Traslado' || normalizedType === 'Ferry' ? 'trip' : 'place';
}

function limitText(value, maxLength = 160) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeUrl(value) {
  const rawUrl = limitText(value, 2048);
  if (!rawUrl) return '';

  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function parseRouteParts(source) {
  const routeText = limitText(source, 220);
  if (!routeText) return { start: '', end: '' };

  const arrowParts = routeText.split(/\s*(?:->|→)\s*/);
  if (arrowParts.length >= 2) {
    return {
      start: limitText(arrowParts[0], 80),
      end: limitText(arrowParts.slice(1).join(' -> '), 80)
    };
  }

  return { start: '', end: '' };
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

    const name = limitText(source.name, 48)
      ? limitText(source.name, 48)
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

    const fallbackType = typeof source.type === 'string' ? source.type : '';
    const normalizedType = normalizeType(source.transportMode || source.mode || fallbackType);
    const kind = normalizeKind(source.kind, normalizedType);
    const routeParts = parseRouteParts(source.location || source.name);
    const start = limitText(source.start || routeParts.start, 80);
    const end = limitText(source.end || routeParts.end, 80);
    const routeLocation = start && end ? `${start} -> ${end}` : '';
    const rawLocation = limitText(source.location, 140);
    const location = kind === 'trip' ? (routeLocation || rawLocation) : rawLocation;
    const rawName = limitText(source.name, 140);
    const type = kind === 'trip' ? normalizeType(normalizedType) : normalizeType(fallbackType);
    const name = rawName || (kind === 'trip' && location ? `Viaje ${location}` : '');

    return {
      id,
      dayId: typeof source.dayId === 'string' && validDayIds.has(source.dayId) ? source.dayId : null,
      order: Number.isFinite(source.order) ? source.order : index,
      name: name || 'Parada sin nombre',
      location,
      type,
      kind,
      start: kind === 'trip' ? start : '',
      end: kind === 'trip' ? end : '',
      mapUrl: sanitizeUrl(source.mapUrl),
      reservationUrl: sanitizeUrl(source.reservationUrl || source.bookingUrl),
      duration,
      marks: sanitizeMarks(source.marks),
      notes: limitText(source.notes, 1200)
    };
  });

  return { schemaVersion: STATE_SCHEMA_VERSION, days, items };
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

function refreshCopyPlanOptions() {
  if (!copyPlanSelectEl || !copyPlanBtn) return;

  const previousSelection = copyPlanSelectEl.value;
  copyPlanSelectEl.innerHTML = '';

  PLAN_OPTIONS
    .filter((plan) => plan.key !== currentPlanKey)
    .forEach((plan) => {
      const option = document.createElement('option');
      option.value = plan.key;
      option.textContent = plan.label;
      copyPlanSelectEl.appendChild(option);
    });

  if (previousSelection && previousSelection !== currentPlanKey) {
    copyPlanSelectEl.value = previousSelection;
  }

  const hasTargets = copyPlanSelectEl.options.length > 0;
  copyPlanSelectEl.disabled = !hasTargets;
  copyPlanBtn.disabled = !hasTargets;
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

function hasActiveViewFilter() {
  return activeFilter !== 'all' || searchTerm.trim().length > 0;
}

function getItemSearchText(item) {
  return [
    item.name,
    item.location,
    item.type,
    item.kind,
    item.start,
    item.end,
    item.notes
  ].filter(Boolean).join(' ').toLocaleLowerCase('es-CL');
}

function itemMatchesView(item) {
  if (activeFilter === 'must' && !item.marks?.must) return false;
  if (activeFilter === 'booked' && !item.marks?.booked) return false;
  if (activeFilter === 'done' && !item.marks?.done) return false;
  if (activeFilter === 'pending' && item.marks?.done) return false;
  if (activeFilter === 'lodging' && !item.marks?.lodging) return false;
  if (activeFilter === 'dayvisit' && !item.marks?.dayvisit) return false;
  if (activeFilter === 'trip' && item.kind !== 'trip') return false;
  if (activeFilter === 'place' && item.kind !== 'place') return false;
  if (activeFilter === 'unassigned' && item.dayId) return false;

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('es-CL');
  return !normalizedSearch || getItemSearchText(item).includes(normalizedSearch);
}

function getVisibleItemsForDay(dayValue) {
  return getItemsForDay(dayValue).filter(itemMatchesView);
}

function getDaySummary(dayValue) {
  const items = getItemsForDay(dayValue);
  return {
    total: items.length,
    visible: items.filter(itemMatchesView).length,
    hours: items.reduce((sum, item) => sum + Number(item.duration || 0), 0),
    done: items.filter((item) => item.marks?.done).length,
    lodging: items.filter((item) => item.marks?.lodging).length
  };
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
    item.name = limitText(item.name, 140) || 'Parada sin nombre';
    item.location = limitText(item.location, 140);
    const parsedDuration = Number(item.duration);
    item.duration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 1;
    if (typeof item.notes !== 'string') item.notes = '';
    item.type = normalizeType(item.type);
    item.kind = normalizeKind(item.kind, item.type);
    item.mapUrl = sanitizeUrl(item.mapUrl);
    item.reservationUrl = sanitizeUrl(item.reservationUrl);

    if (item.kind === 'trip') {
      const routeParts = parseRouteParts(item.location || item.name);
      item.start = limitText(item.start || routeParts.start, 80);
      item.end = limitText(item.end || routeParts.end, 80);
      if (item.start && item.end) item.location = `${item.start} -> ${item.end}`;
      if (item.type !== 'Ferry') item.type = 'Traslado';
    } else {
      item.start = '';
      item.end = '';
    }

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

  state.schemaVersion = STATE_SCHEMA_VERSION;
}

function markUnsaved() {
  normalizeState();
  changeSerial += 1;
  hasUnsavedChanges = true;
  persistLocalPlanState(currentPlanKey, structuredClone(state));

  if (pendingConflict) {
    updateSyncStatus('Hay un conflicto remoto pendiente. Tus cambios están guardados localmente.', 'conflict');
    return;
  }

  if (supabaseClient) {
    updateSyncStatus(`Cambios guardados localmente. Autosave remoto pendiente en "${getPlanLabel(currentPlanKey)}".`, 'pending');
    scheduleAutoSave();
  } else {
    updateSyncStatus(`Planificación "${getPlanLabel(currentPlanKey)}" guardada localmente.`, 'local');
  }
}

function moveItemToDay(itemId, targetDayId) {
  moveItemToDayAt(itemId, targetDayId, getNextOrderForDay(targetDayId, itemId));
}

function moveItemToDayAt(itemId, targetDayId, targetIndex) {
  const item = state.items.find((x) => x.id === itemId);
  if (!item) return;

  const sourceDayId = item.dayId || null;
  const normalizedTargetDayId = targetDayId || null;
  const targetItems = getItemsForDay(normalizedTargetDayId).filter((entry) => entry.id !== itemId);
  const insertIndex = Math.min(Math.max(Number(targetIndex) || 0, 0), targetItems.length);

  item.dayId = normalizedTargetDayId;
  targetItems.splice(insertIndex, 0, item);
  targetItems.forEach((entry, index) => {
    entry.order = index;
  });

  if (sourceDayId !== normalizedTargetDayId) {
    getItemsForDay(sourceDayId).forEach((entry, index) => {
      entry.order = index;
    });
  }

  markUnsaved();
}

function duplicateItem(itemId) {
  const item = state.items.find((entry) => entry.id === itemId);
  if (!item) return;

  const copy = structuredClone(item);
  copy.id = crypto.randomUUID();
  copy.name = `${copy.name} copia`;
  copy.order = getNextOrderForDay(copy.dayId);
  state.items.push(copy);
  markUnsaved();
}

function renameDay(dayId, nextName) {
  const day = state.days.find((entry) => entry.id === dayId);
  if (!day) return;

  const safeName = limitText(nextName, 48) || day.name;
  if (safeName === day.name) {
    render();
    return;
  }

  day.name = safeName;
  markUnsaved();
  render();
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

function clearAutoSaveTimer() {
  if (!autoSaveTimer) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
}

function scheduleAutoSave(delay = AUTO_SAVE_DELAY_MS) {
  if (!supabaseClient || pendingConflict) return;

  const scheduledPlanKey = currentPlanKey;
  clearAutoSaveTimer();
  autoSaveTimer = window.setTimeout(async () => {
    autoSaveTimer = null;
    if (!hasUnsavedChanges || currentPlanKey !== scheduledPlanKey) return;

    try {
      await saveCurrentState({ source: 'auto' });
    } catch (error) {
      console.error('Autosave falló:', error.message);
      updateSyncStatus('Autosave remoto falló. Tus cambios quedan guardados localmente.', 'error');
    }
  }, delay);
}

function createRemoteConflictError() {
  const error = new Error('La planificación remota cambió desde la última carga.');
  error.code = REMOTE_CONFLICT_CODE;
  return error;
}

function isRemoteConflictError(error) {
  return error?.code === REMOTE_CONFLICT_CODE;
}

async function loadRemoteState(planKey) {
  const rowId = getPlanRowId(planKey);

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select('state_json, updated_at')
    .eq('id', rowId)
    .maybeSingle();

  if (error) throw error;
  if (data?.state_json) {
    return {
      state: sanitizeState(data.state_json),
      updatedAt: data.updated_at || null
    };
  }

  const emptyPlan = createEmptyPlanData();
  const saved = await saveRemoteState(planKey, emptyPlan);
  return {
    state: emptyPlan,
    updatedAt: saved.updatedAt
  };
}

async function saveRemoteState(planKey, nextState, options = {}) {
  const { expectedUpdatedAt = null } = options;
  const payload = {
    state_json: nextState,
    updated_at: new Date().toISOString()
  };
  const rowId = getPlanRowId(planKey);

  if (expectedUpdatedAt) {
    const { data, error } = await supabaseClient
      .from(SUPABASE_TABLE)
      .update(payload)
      .eq('id', rowId)
      .eq('updated_at', expectedUpdatedAt)
      .select('updated_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw createRemoteConflictError();

    return { updatedAt: data.updated_at || payload.updated_at };
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .upsert({ id: rowId, ...payload }, { onConflict: 'id' })
    .select('updated_at')
    .single();

  if (error) {
    throw error;
  }

  return { updatedAt: data?.updated_at || payload.updated_at };
}

async function fetchRemotePlan(planKey) {
  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select('state_json, updated_at')
    .eq('id', getPlanRowId(planKey))
    .maybeSingle();

  if (error) throw error;
  return data
    ? { state: data.state_json ? sanitizeState(data.state_json) : null, updatedAt: data.updated_at || null }
    : { state: null, updatedAt: null };
}

async function handleRemoteConflict(localSnapshot) {
  let remotePlan = { state: null, updatedAt: null };

  try {
    remotePlan = await fetchRemotePlan(currentPlanKey);
  } catch (error) {
    console.error('No se pudo leer la versión remota en conflicto:', error.message);
  }

  pendingConflict = {
    localSnapshot,
    remoteUpdatedAt: remotePlan.updatedAt
  };
  if (remotePlan.updatedAt) lastRemoteUpdatedAt = remotePlan.updatedAt;
  hasUnsavedChanges = true;
  persistLocalPlanState(currentPlanKey, localSnapshot);

  const shouldLoadRemote = remotePlan.state && window.confirm(
    'La planificación cambió en otro navegador. Acepta para cargar la versión remota; cancela para mantener tus cambios locales y decidir después.'
  );

  if (shouldLoadRemote) {
    pendingConflict = null;
    state = remotePlan.state;
    hasUnsavedChanges = false;
    persistLocalPlanState(currentPlanKey, state);
    normalizeState();
    render();
    updateSyncStatus('Se cargó la versión remota más reciente.', 'saved');
    return;
  }

  updateSyncStatus('Conflicto remoto detectado. Tus cambios siguen guardados localmente; Guardar otra vez permite sobrescribir si confirmas.', 'conflict');
}

async function saveCurrentState(options = {}) {
  const { source = 'manual' } = options;
  clearAutoSaveTimer();

  if (isSaving) {
    scheduleAutoSave(400);
    return false;
  }

  if (pendingConflict) {
    if (source === 'auto') return false;

    const shouldOverwrite = window.confirm(
      'Hay una versión más nueva en la base. ¿Quieres sobrescribirla con tus cambios locales?'
    );

    if (!shouldOverwrite) {
      updateSyncStatus('Se mantiene el conflicto pendiente. Tus cambios están guardados localmente.', 'conflict');
      return false;
    }

    lastRemoteUpdatedAt = pendingConflict.remoteUpdatedAt || lastRemoteUpdatedAt;
    pendingConflict = null;
  }

  normalizeState();
  const snapshot = sanitizeState(structuredClone(state));
  const saveSerial = changeSerial;
  persistLocalPlanState(currentPlanKey, snapshot);

  if (!supabaseClient) {
    hasUnsavedChanges = changeSerial !== saveSerial;
    updateSyncStatus(`Planificación "${getPlanLabel(currentPlanKey)}" guardada localmente.`, 'local');
    return true;
  }

  isSaving = true;
  setSaveButtonBusy(true);
  updateSyncStatus(
    source === 'auto'
      ? `Autosave remoto de "${getPlanLabel(currentPlanKey)}"...`
      : `Guardando "${getPlanLabel(currentPlanKey)}" en la base...`,
    'saving'
  );

  try {
    const saved = await saveRemoteState(currentPlanKey, snapshot, { expectedUpdatedAt: lastRemoteUpdatedAt });
    lastRemoteUpdatedAt = saved.updatedAt || lastRemoteUpdatedAt;
    hasUnsavedChanges = changeSerial !== saveSerial;
    const syncTime = syncTimeFormatter.format(new Date());
    if (hasUnsavedChanges) {
      updateSyncStatus(`Cambios nuevos detectados mientras se guardaba. Autosave reprogramado.`, 'pending');
      scheduleAutoSave();
    } else {
      updateSyncStatus(`Planificación "${getPlanLabel(currentPlanKey)}" guardada a las ${syncTime}.`, 'saved');
    }
    return true;
  } catch (error) {
    if (isRemoteConflictError(error)) {
      await handleRemoteConflict(snapshot);
      return false;
    }
    throw error;
  } finally {
    isSaving = false;
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

  clearAutoSaveTimer();
  pendingConflict = null;
  setPlanSelectBusy(true);
  updateSyncStatus(`Cargando planificación "${getPlanLabel(nextPlanKey)}"...`, 'saving');

  try {
    let nextState;
    let remoteUpdatedAt = null;

    if (supabaseClient) {
      try {
        const remotePlan = await loadRemoteState(nextPlanKey);
        nextState = remotePlan.state;
        remoteUpdatedAt = remotePlan.updatedAt;
        updateSyncStatus(`Planificación "${getPlanLabel(nextPlanKey)}" cargada desde la base de datos.`, 'saved');
      } catch (error) {
        console.error(`No se pudo cargar ${nextPlanKey} desde Supabase:`, error.message);
        nextState = getLocalPlanState(nextPlanKey);
        remoteUpdatedAt = null;
        updateSyncStatus(`No se pudo leer "${getPlanLabel(nextPlanKey)}" desde Supabase. Se cargó respaldo local.`, 'error');
      }
    } else {
      nextState = getLocalPlanState(nextPlanKey);
      updateSyncStatus(`Planificación "${getPlanLabel(nextPlanKey)}" en modo local.`, 'local');
    }

    state = sanitizeState(nextState);
    currentPlanKey = nextPlanKey;
    mobileDayIndex = 0;
    lastRemoteUpdatedAt = remoteUpdatedAt;
    hasUnsavedChanges = false;
    persistLocalPlanState(currentPlanKey, state);
    normalizeState();
    refreshCopyPlanOptions();
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

  const isTransport = item.kind === 'trip' || item.type === 'Traslado' || item.type === 'Ferry';
  const titleEl = card.querySelector('.title');
  const metaEl = card.querySelector('.meta');
  const quickMarksEl = card.querySelector('.quick-marks');
  const linkActionsEl = card.querySelector('.link-actions');

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

  const renderCardLinks = () => {
    linkActionsEl.innerHTML = '';

    [
      { url: item.mapUrl, label: 'Mapa' },
      { url: item.reservationUrl, label: 'Reserva' }
    ].forEach((link) => {
      const safeUrl = sanitizeUrl(link.url);
      if (!safeUrl) return;

      const anchor = document.createElement('a');
      anchor.href = safeUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = link.label;
      linkActionsEl.appendChild(anchor);
    });

    linkActionsEl.classList.toggle('hidden', linkActionsEl.childElementCount === 0);
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
  const mapUrlInput = card.querySelector('.map-url');
  const reservationUrlInput = card.querySelector('.reservation-url');

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

  mapUrlInput.value = item.mapUrl || '';
  mapUrlInput.addEventListener('change', () => {
    item.mapUrl = mapUrlInput.value.trim();
    renderCardLinks();
    markUnsaved();
  });

  reservationUrlInput.value = item.reservationUrl || '';
  reservationUrlInput.addEventListener('change', () => {
    item.reservationUrl = reservationUrlInput.value.trim();
    renderCardLinks();
    markUnsaved();
  });

  editBtn.addEventListener('click', () => {
    const isNowHidden = details.classList.toggle('hidden');
    editBtn.classList.toggle('is-open', !isNowHidden);
    editBtn.textContent = isNowHidden ? '✎' : '✕';
    editBtn.setAttribute('aria-label', isNowHidden ? 'Editar' : 'Cerrar');
    editBtn.setAttribute('title', isNowHidden ? 'Editar' : 'Cerrar');
  });

  card.querySelector('.duplicate').addEventListener('click', () => {
    duplicateItem(item.id);
    render();
  });

  card.querySelector('.delete').addEventListener('click', () => {
    const confirmed = window.confirm(`¿Eliminar "${item.name}"?`);
    if (!confirmed) return;
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
  renderCardLinks();
  return card;
}

function appendEmptyState(container, message) {
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  empty.textContent = message;
  container.appendChild(empty);
}

function clearDropIndicators(container) {
  container.querySelectorAll('.drop-before').forEach((card) => {
    card.classList.remove('drop-before');
  });
}

function getDropIndex(container, pointerY) {
  const cards = Array.from(container.querySelectorAll('.card:not(.dragging)'));
  let closest = { offset: Number.NEGATIVE_INFINITY, index: cards.length };

  cards.forEach((card, index) => {
    const box = card.getBoundingClientRect();
    const offset = pointerY - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      closest = { offset, index };
    }
  });

  return closest.index;
}

function updateDropIndicator(container, pointerY) {
  clearDropIndicators(container);
  if (hasActiveViewFilter()) return;

  const cards = Array.from(container.querySelectorAll('.card:not(.dragging)'));
  const index = getDropIndex(container, pointerY);
  if (cards[index]) cards[index].classList.add('drop-before');
}

function attachDropHandlers(container, targetDayId) {
  container.ondragover = (event) => {
    event.preventDefault();
    container.classList.add('drag-over');
    updateDropIndicator(container, event.clientY);
  };

  container.ondragleave = () => {
    container.classList.remove('drag-over');
    clearDropIndicators(container);
  };

  container.ondrop = (event) => {
    event.preventDefault();
    container.classList.remove('drag-over');
    clearDropIndicators(container);
    if (!draggedId) return;

    const targetIndex = hasActiveViewFilter()
      ? getNextOrderForDay(targetDayId, draggedId)
      : getDropIndex(container, event.clientY);
    moveItemToDayAt(draggedId, targetDayId, targetIndex);
    render();
  };
}

function renderItems(container, items, emptyMessage) {
  if (items.length === 0) {
    appendEmptyState(container, emptyMessage);
    return;
  }

  items.forEach((item) => container.appendChild(buildCard(item)));
}

function buildDayColumn(day) {
  const col = document.createElement('section');
  col.className = 'day';
  col.dataset.dayId = day.id;

  const dayHead = document.createElement('div');
  dayHead.className = 'day-head';

  const titleInput = document.createElement('input');
  titleInput.className = 'day-title-input';
  titleInput.value = day.name;
  titleInput.setAttribute('aria-label', `Nombre de ${day.name}`);
  titleInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') titleInput.blur();
  });
  titleInput.addEventListener('change', () => {
    renameDay(day.id, titleInput.value);
  });

  const deleteDayBtn = document.createElement('button');
  deleteDayBtn.type = 'button';
  deleteDayBtn.className = 'day-delete';
  deleteDayBtn.textContent = 'Eliminar día';

  dayHead.append(titleInput, deleteDayBtn);
  col.appendChild(dayHead);

  const summary = getDaySummary(day.id);
  const daySummaryEl = document.createElement('div');
  daySummaryEl.className = 'day-summary';
  daySummaryEl.classList.toggle('is-heavy', summary.hours > DAILY_HOURS_WARNING);
  daySummaryEl.textContent = `${summary.visible}/${summary.total} paradas · ${summary.hours}h · ${summary.done} completadas`;
  col.appendChild(daySummaryEl);

  deleteDayBtn.addEventListener('click', () => {
    if (state.days.length <= 1) {
      window.alert('Debe quedar al menos un día en la planificación.');
      return;
    }

    const dayItems = getItemsForDay(day.id);
    const itemCount = dayItems.length;
    const confirmed = window.confirm(
      `¿Eliminar ${day.name}? ${itemCount > 0 ? `Sus ${itemCount} parada(s) pasarán a "Sin asignar".` : ''}`
    );

    if (!confirmed) return;

    let nextUnassignedOrder = getNextOrderForDay(null);
    dayItems.forEach((item) => {
      item.dayId = null;
      item.order = nextUnassignedOrder;
      nextUnassignedOrder += 1;
    });

    state.days = state.days.filter((entry) => entry.id !== day.id);
    markUnsaved();
    render();
  });

  attachDropHandlers(col, day.id);
  renderItems(col, getVisibleItemsForDay(day.id), hasActiveViewFilter() ? 'Sin resultados visibles.' : 'Sin paradas.');
  return col;
}

function clampMobileDayIndex() {
  const maxIndex = Math.max(state.days.length - 1, 0);
  mobileDayIndex = Math.min(Math.max(mobileDayIndex, 0), maxIndex);
}

function applyMobileDayNavigation() {
  if (!mobileDayNavEl || !prevDayBtn || !nextDayBtn) return;

  const dayColumns = Array.from(itineraryEl.querySelectorAll('.day'));
  const isMobile = mobileViewportQuery.matches;
  const hasDays = dayColumns.length > 0;

  mobileDayNavEl.classList.toggle('is-hidden', !isMobile || !hasDays);

  if (!isMobile || !hasDays) {
    dayColumns.forEach((col) => col.classList.remove('mobile-hidden'));
    return;
  }

  clampMobileDayIndex();

  dayColumns.forEach((col, index) => {
    col.classList.toggle('mobile-hidden', index !== mobileDayIndex);
  });

  prevDayBtn.disabled = mobileDayIndex === 0;
  nextDayBtn.disabled = mobileDayIndex === dayColumns.length - 1;
}

async function copyCurrentPlanTo(targetPlanKey) {
  if (!targetPlanKey || targetPlanKey === currentPlanKey) return;
  if (!PLAN_OPTIONS.some((plan) => plan.key === targetPlanKey)) return;

  const targetLabel = getPlanLabel(targetPlanKey);
  const confirmed = window.confirm(
    `Se copiará "${getPlanLabel(currentPlanKey)}" sobre "${targetLabel}". ¿Continuar?`
  );

  if (!confirmed) return;

  normalizeState();
  const snapshot = sanitizeState(structuredClone(state));
  const store = readLocalStore();
  store.plans[targetPlanKey] = snapshot;
  store.selectedPlanKey = currentPlanKey;
  writeLocalStore(store);

  if (!supabaseClient) {
    updateSyncStatus(`Planificación copiada a "${targetLabel}" en modo local.`, hasUnsavedChanges ? 'pending' : 'local');
    return;
  }

  updateSyncStatus(`Copiando planificación a "${targetLabel}"...`, 'saving');

  try {
    await saveRemoteState(targetPlanKey, snapshot);
    updateSyncStatus(
      `Planificación copiada desde "${getPlanLabel(currentPlanKey)}" a "${targetLabel}".`,
      hasUnsavedChanges ? 'pending' : 'saved'
    );
  } catch (error) {
    console.error('Error copiando planificación:', error.message);
    updateSyncStatus(`Se copió localmente a "${targetLabel}", pero falló el guardado en la base.`, 'error');
  }
}

function updateStats() {
  const totalStops = state.items.length;
  const visibleStops = state.items.filter(itemMatchesView).length;
  const totalHours = state.items.reduce((sum, item) => sum + Number(item.duration || 0), 0);
  const doneCount = state.items.filter((item) => item.marks?.done).length;
  const heavyDays = state.days.filter((day) => getDaySummary(day.id).hours > DAILY_HOURS_WARNING).length;

  statStopsEl.textContent = hasActiveViewFilter()
    ? `${visibleStops}/${totalStops} visibles`
    : `${totalStops} paradas`;
  statHoursEl.textContent = `${totalHours}h estimadas`;
  statDoneEl.textContent = `${doneCount} completadas`;
  if (statWarningsEl) {
    statWarningsEl.textContent = heavyDays === 0
      ? 'Sin sobrecarga'
      : `${heavyDays} día${heavyDays === 1 ? '' : 's'} sobre ${DAILY_HOURS_WARNING}h`;
    statWarningsEl.dataset.level = heavyDays === 0 ? 'ok' : 'warning';
  }
}

function render() {
  itineraryEl.innerHTML = '';
  unassignedEl.innerHTML = '';

  attachDropHandlers(unassignedEl, null);
  renderItems(unassignedEl, getVisibleItemsForDay(null), hasActiveViewFilter() ? 'Sin resultados visibles.' : 'Sin paradas sin asignar.');
  state.days.forEach((day) => itineraryEl.appendChild(buildDayColumn(day)));
  clampMobileDayIndex();
  applyMobileDayNavigation();
  refreshDaySelect();
  updateStats();
}

function buildItemFromForm() {
  const dayId = daySelectEl.value || null;
  const kind = entryKindEl.value;
  const mapUrl = mapUrlEl.value.trim();
  const reservationUrl = reservationUrlEl.value.trim();

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
      kind: 'trip',
      start,
      end,
      mapUrl,
      reservationUrl,
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
    kind: 'place',
    start: '',
    end: '',
    mapUrl,
    reservationUrl,
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
  mapUrlEl.value = '';
  reservationUrlEl.value = '';
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

searchInputEl.addEventListener('input', () => {
  searchTerm = searchInputEl.value;
  render();
});

filterSelectEl.addEventListener('change', () => {
  activeFilter = filterSelectEl.value;
  render();
});

clearFiltersBtn.addEventListener('click', () => {
  searchTerm = '';
  activeFilter = 'all';
  searchInputEl.value = '';
  filterSelectEl.value = 'all';
  render();
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

copyPlanBtn.addEventListener('click', async () => {
  try {
    await copyCurrentPlanTo(copyPlanSelectEl.value);
  } catch (error) {
    console.error('Error al copiar planificación:', error.message);
    updateSyncStatus('No se pudo copiar la planificación seleccionada.', 'error');
  }
});

prevDayBtn.addEventListener('click', () => {
  if (mobileDayIndex <= 0) return;
  mobileDayIndex -= 1;
  applyMobileDayNavigation();
});

nextDayBtn.addEventListener('click', () => {
  if (mobileDayIndex >= state.days.length - 1) return;
  mobileDayIndex += 1;
  applyMobileDayNavigation();
});

if (typeof mobileViewportQuery.addEventListener === 'function') {
  mobileViewportQuery.addEventListener('change', () => {
    applyMobileDayNavigation();
  });
} else if (typeof mobileViewportQuery.addListener === 'function') {
  mobileViewportQuery.addListener(() => {
    applyMobileDayNavigation();
  });
}

saveBtn.addEventListener('click', async () => {
  if (!hasUnsavedChanges) {
    updateSyncStatus(`No hay cambios sin guardar en "${getPlanLabel(currentPlanKey)}".`, supabaseClient ? 'saved' : 'local');
    return;
  }

  try {
    await saveCurrentState({ source: 'manual' });
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

window.addEventListener('beforeunload', (event) => {
  if (!hasUnsavedChanges || !supabaseClient) return;
  event.preventDefault();
  event.returnValue = '';
});

async function init() {
  updateEntryKindUI();
  initSupabase();

  currentPlanKey = getInitialPlanKey();
  populatePlanSelect();
  refreshCopyPlanOptions();

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
