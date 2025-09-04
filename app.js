/* Enhanced Challenge Checklist – a11y, search, collapse, import/export */
const el  = s => document.querySelector(s);
const els = s => [...document.querySelectorAll(s)];

const $cats         = el('#categories');
const $tasksDone    = el('#tasksDone');
const $pointsTotal  = el('#pointsTotal');
const $checkAll     = el('#checkAll');
const $settings     = el('#settings');
const $openSettings = el('#openSettings');
const $excludeWrap  = el('#excludeWrap');
const $difficulty   = el('#difficulty');
const $mode         = el('#mode');
const $reset        = el('#resetProgress');
const $taskSearch   = el('#taskSearch');
const $globalProg   = el('#globalProgress');
const $globalPct    = el('#globalPct');
const $exportBtn    = el('#exportBtn');
const $importInput  = el('#importInput');

const STORE_KEY    = 'checklist-progress-v2';
const SETTINGS_KEY = 'checklist-settings-v2';

let DATA;
let progress = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
let settings = Object.assign(
  { mode: 'solo', difficulty: 'easy', excluded: {}, collapsed: {} },
  JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
);

let listBound = false;
let searchTerm = "";

function onChecklistChange(e) {
  const cb = e.target.closest('input[type="checkbox"][data-task]');
  if (!cb) return;
  const id = cb.dataset.task;
  cb.checked ? (progress[id] = true) : delete progress[id];
  persistProgress();
  queueUpdate();
}

async function load() {
  DATA = await fetch('tasks.json').then(r => r.json());
  // Exclude toggles
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
  queueUpdate();
}

function bindEvents() {
  if (!listBound) {
    $cats.addEventListener('change', onChecklistChange);
    $cats.addEventListener('keydown', e => {
      if (e.key === ' ' && e.target.matches('input[type="checkbox"][data-task]')) {
        e.preventDefault();
        e.target.click();
      }
    });
    listBound = true;
  }

  $openSettings.onclick = () => $settings.showModal();
  $settings.addEventListener('close', persistSettings);

  $excludeWrap.addEventListener('change', e => {
    const t = e.target;
    if (!t.matches('[data-exclude]')) return;
    settings.excluded[t.dataset.exclude] = t.checked;
    persistSettings();
    render();
    queueUpdate();
  });

  $difficulty.onchange = () => {
    settings.difficulty = $difficulty.value;
    persistSettings();
    queueUpdate();
  };

  $mode.onchange = () => {
    settings.mode = $mode.value;
    persistSettings();
  };

  $reset.onclick = () => {
    progress = {};
    localStorage.removeItem(STORE_KEY);
    els('input[type="checkbox"][data-task]').forEach(cb => (cb.checked = false));
    queueUpdate();
  };

  $checkAll.onclick = () => {
    els('.card:not([data-collapsed="true"]) input[type="checkbox"][data-task]').forEach(cb => {
      cb.checked = true;
      progress[cb.dataset.task] = true;
    });
    persistProgress();
    queueUpdate();
  };

  // Search, with lightweight debounce
  let t;
  $taskSearch.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      searchTerm = $taskSearch.value.trim().toLowerCase();
      filterTasks();
    }, 80);
  });
  // Focus search with /
  window.addEventListener('keydown', e => {
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      $taskSearch.focus();
    }
  });

  // Export / Import
  $exportBtn.onclick = () => {
    const payload = { progress, settings };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'checklist-progress.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  $importInput.onchange = async () => {
    const file = $importInput.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const json = JSON.parse(txt);
      if (json.progress) progress = json.progress;
      if (json.settings) settings = Object.assign(settings, json.settings);
      persistProgress(); persistSettings();
      render(); queueUpdate();
    } catch (err) {
      alert('Invalid file');
    }
    $importInput.value = '';
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

    const collapsed = !!settings.collapsed[cat.id];

    const card = document.createElement('section');
    card.className = 'card';
    card.dataset.collapsed = collapsed ? 'true' : 'false';
    card.innerHTML = `
      <header role="button" tabindex="0" aria-expanded="${!collapsed}">
        <svg class="chev" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
        <h2>${cat.title}</h2>
        <div class="meta"><span id="meta-${cat.id}">0 / ${cat.tasks.length}</span> • <span id="pts-${cat.id}">0 pts</span></div>
      </header>
      <div class="progressbar"><div class="fill" id="bar-${cat.id}"></div></div>
      <div class="list" role="group" aria-label="${cat.title} tasks"></div>
    `;

    const list = card.querySelector('.list');

    for (const t of cat.tasks) {
      const checked = !!progress[t.id];
      const row = document.createElement('div');
      row.className = 'task';
      row.innerHTML = `
        <label>
          <input type="checkbox" data-task="${t.id}" ${checked ? 'checked' : ''}/>
          <span>${t.label}</span>
          <span class="pts">${t.points} pts</span>
        </label>
      `;
      list.appendChild(row);
    }

    // collapse/expand
    const header = card.querySelector('header');
    const toggle = () => {
      const now = card.dataset.collapsed !== 'true';
      card.dataset.collapsed = now ? 'true' : 'false';
      header.setAttribute('aria-expanded', String(!now));
      settings.collapsed[cat.id] = now;
      persistSettings();
    };
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    $cats.appendChild(card);
  }

  filterTasks();
}

function filterTasks() {
  // Apply search filter
  els('.card').forEach(card => {
    const matches = els('.task', card).map(row => {
      const text = row.textContent.toLowerCase();
      const hit = !searchTerm || text.includes(searchTerm);
      row.style.display = hit ? '' : 'none';
      return hit;
    });
    // Collapse card if no visible tasks
    const any = matches.some(Boolean);
    card.style.opacity = any ? '1' : '.45';
    card.style.pointerEvents = any ? '' : 'none';
  });
  queueUpdate();
}

let rafToken = 0;
function queueUpdate() {
  cancelAnimationFrame(rafToken);
  rafToken = requestAnimationFrame(() => {
    updateTotals();
    updatePerCategoryCounts();
  });
}

function updatePerCategoryCounts() {
  for (const cat of DATA.categories) {
    if (settings.excluded[cat.id]) continue;
    const ids = new Set(cat.tasks.map(t => t.id));
    const done = Object.keys(progress).filter(id => ids.has(id)).length;
    const meta = el(`#meta-${cat.id}`);
    if (meta) meta.textContent = `${done} / ${cat.tasks.length}`;

    const pts = cat.tasks.reduce((s,t)=> s + (progress[t.id] ? t.points : 0), 0);
    const ptsEl = el(`#pts-${cat.id}`);
    if (ptsEl) ptsEl.textContent = `${pts} pts`;

    const pct = Math.round((done / cat.tasks.length) * 100) || 0;
    const bar = el(`#bar-${cat.id}`);
    if (bar) bar.style.width = pct + '%';
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

  const pct = Math.round((doneCount / Math.max(totalCount,1)) * 100);
  $globalProg.value = pct;
  $globalPct.textContent = pct + '%';
}

load();
