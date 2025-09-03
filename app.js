// Challenge Checklist – lightweight engine with persistence

const el  = s => document.querySelector(s);
const els = s => [...document.querySelectorAll(s)];

const $cats        = el('#categories');
const $tasksDone   = el('#tasksDone');
const $pointsTotal = el('#pointsTotal');
const $checkAll    = el('#checkAll');
const $settings    = el('#settings');
const $openSettings= el('#openSettings');
const $excludeWrap = el('#excludeWrap');
const $difficulty  = el('#difficulty');
const $mode        = el('#mode');
const $reset       = el('#resetProgress');

const STORE_KEY    = 'checklist-progress-v1';
const SETTINGS_KEY = 'checklist-settings-v1';

let DATA;
let progress = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
let settings = Object.assign(
  { mode: 'solo', difficulty: 'easy', excluded: {} },
  JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
);

// Bind once to avoid duplicate listeners when re-rendering
let listBound = false;
function onChecklistChange(e) {
  if (!e.target.matches('input[type="checkbox"][data-task]')) return;
  const id = e.target.dataset.task;
  if (e.target.checked) progress[id] = true;
  else delete progress[id];
  persistProgress();
  updateTotals();
  updatePerCategoryCounts();
}

async function load() {
  DATA = await fetch('tasks.json').then(r => r.json());

  // Build exclude toggles
  $excludeWrap.innerHTML = DATA.categories.map(c =>
    `<label class="toggle">
       <input type="checkbox" data-exclude="${c.id}" ${settings.excluded[c.id] ? 'checked':''}/>
       Exclude ${c.title}
     </label>`
  ).join('');

  $difficulty.value = settings.difficulty;
  $mode.value = settings.mode;

  render();
  bindEvents();
}

function bindEvents() {
  if (!listBound) {
    $cats.addEventListener('change', onChecklistChange);
    listBound = true;
  }

  $openSettings.onclick = () => $settings.showModal();
  $settings.addEventListener('close', persistSettings);

  $excludeWrap.addEventListener('change', e => {
    if (!e.target.matches('[data-exclude]')) return;
    settings.excluded[e.target.dataset.exclude] = e.target.checked;
    persistSettings();
    render();
  });

  $difficulty.onchange = () => {
    settings.difficulty = $difficulty.value;
    persistSettings();
    updateTotals();
  };
  $mode.onchange = () => {
    settings.mode = $mode.value;
    persistSettings();
  };

  $reset.onclick = () => {
    progress = {};
    localStorage.removeItem(STORE_KEY);
    els('input[type="checkbox"][data-task]').forEach(cb => cb.checked = false);
    updateTotals();
    updatePerCategoryCounts();
  };

  $checkAll.onclick = () => {
    els('input[type="checkbox"][data-task]').forEach(cb => {
      cb.checked = true;
      progress[cb.dataset.task] = true;
    });
    persistProgress();
    updateTotals();
    updatePerCategoryCounts();
  };
}

function persistProgress() {
  localStorage.setItem(STORE_KEY, JSON.stringify(progress));
}
function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function render() {
  $cats.innerHTML = '';

  for (const cat of DATA.categories) {
    if (settings.excluded[cat.id]) continue;

    const card = document.createElement('section');
    card.className = 'card';
    card.innerHTML = `
      <h2>${cat.title}</h2>
      <div class="meta"><span id="meta-${cat.id}">0 / ${cat.tasks.length}</span></div>
      <div class="list"></div>
    `;
    const list = card.querySelector('.list');

    for (const t of cat.tasks) {
      const checked = !!progress[t.id];
      const row = document.createElement('div');
      row.className = 'task';
      row.innerHTML = `
        <label>
          <input type="checkbox" data-task="${t.id}" ${checked ? 'checked':''}/>
          <span>${t.label}</span>
          <span class="pts">${t.points} pts</span>
        </label>
      `;
      list.appendChild(row);
    }
    $cats.appendChild(card);
  }

  updateTotals();
  updatePerCategoryCounts();
}

function updatePerCategoryCounts() {
  for (const cat of DATA.categories) {
    if (settings.excluded[cat.id]) continue;
    const ids = new Set(cat.tasks.map(t => t.id));
    const done = Object.keys(progress).filter(id => ids.has(id)).length;
    const meta = el(`#meta-${cat.id}`);
    if (meta) meta.textContent = `${done} / ${cat.tasks.length}`;
  }
}

function updateTotals() {
  const activeCats = DATA.categories.filter(c => !settings.excluded[c.id]);
  const allTasks   = activeCats.flatMap(c => c.tasks);
  const doneIds    = new Set(Object.keys(progress));

  const doneCount  = allTasks.filter(t => doneIds.has(t.id)).length;
  const totalCount = allTasks.length;

  const diff = DATA.difficulties[settings.difficulty] || { multiplier: 1 };
  const basePoints = allTasks.reduce((sum, t) => sum + (doneIds.has(t.id) ? t.points : 0), 0);
  const points = basePoints * (diff.multiplier || 1);

  $tasksDone.textContent = `Tasks: ${doneCount} / ${totalCount}`;
  $pointsTotal.textContent = `Points: ${points}`;
}

load();
