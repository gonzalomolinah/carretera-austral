const STORAGE_KEY = 'carretera-austral-planner-v1';

const defaultData = {
  days: [
    { id: crypto.randomUUID(), name: 'Día 1' },
    { id: crypto.randomUUID(), name: 'Día 2' },
    { id: crypto.randomUUID(), name: 'Día 3' }
  ],
  items: [
    { id: crypto.randomUUID(), dayId: null, name: 'Capillas de Mármol', location: 'Puerto Río Tranquilo', type: 'Naturaleza', duration: 3, marks: { must: true, booked: false, done: false }, notes: '' },
    { id: crypto.randomUUID(), dayId: null, name: 'Glaciar Exploradores', location: 'Bahía Exploradores', type: 'Aventura', duration: 8, marks: { must: true, booked: false, done: false }, notes: '' },
    { id: crypto.randomUUID(), dayId: null, name: 'Barcaza Hornopirén-Caleta Gonzalo', location: 'Ruta Norte', type: 'Logística', duration: 5, marks: { must: true, booked: true, done: false }, notes: 'Reservar con anticipación.' }
  ]
};

let state = load();
let draggedId = null;

const itineraryEl = document.getElementById('itinerary');
const daySelectEl = document.getElementById('daySelect');
const form = document.getElementById('attractionForm');
const cardTemplate = document.getElementById('cardTemplate');

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
  card.querySelector('.type').textContent = item.type;
  card.querySelector('.meta').textContent = `${item.location} · ${item.duration}h`;

  card.querySelectorAll('[data-mark]').forEach(cb => {
    const key = cb.dataset.mark;
    cb.checked = item.marks[key];
    cb.addEventListener('change', () => {
      item.marks[key] = cb.checked;
      save();
    });
  });

  const notes = card.querySelector('.notes');
  notes.value = item.notes || '';
  notes.addEventListener('input', () => {
    item.notes = notes.value;
    save();
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

  state.items.filter(i => i.dayId === day.id).forEach(item => {
    col.appendChild(buildCard(item));
  });

  return col;
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
    marks: { must: false, booked: false, done: false },
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
  if (!confirm('¿Seguro que quieres resetear el plan a datos de ejemplo?')) return;
  state = structuredClone(defaultData);
  save();
  render();
});

render();