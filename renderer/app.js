'use strict';
/* ================= Tempo — renderer ================= */
const bridge = window.api || null; // exposed by preload.js

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
const pad = (n) => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const todayStr = () => ymd(new Date());
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));
const snap = (m, step = 15) => Math.round(m / step) * step;
const isToday = (ts) => !!ts && ymd(new Date(ts)) === todayStr();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const hhmm = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.round(min) % 60)}`;
const parseHHMM = (s) => { const [h, m] = String(s).split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function fmtTime(min) {
  min = Math.round(min);
  let h = Math.floor(min / 60) % 24; const m = min % 60;
  if (state.settings.h24) return `${pad(h)}:${pad(m)}`;
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return m ? `${h}:${pad(m)} ${ap}` : `${h} ${ap}`;
}
function fmtHour(h) {
  if (state.settings.h24) return h === 24 ? '24:00' : `${pad(h)}:00`;
  const hh = h % 24; return `${hh % 12 || 12} ${hh >= 12 ? 'PM' : 'AM'}`;
}
function fmtDur(min) {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
function fmtShort(min) {
  min = Math.round(min);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
const fmtLeft = (min) => fmtShort(Math.max(1, Math.ceil(min)));
const mmss = (sec) => { sec = Math.max(0, Math.ceil(sec)); return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`; };
function dayLabel(ds) {
  const diff = Math.round((parseYmd(ds) - parseYmd(todayStr())) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const d = parseYmd(ds);
  if (diff > 1 && diff < 7) return DOW[d.getDay()];
  return `${DOW[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 864e5 + 1) / 7);
}
const nextQuarter = () => clamp(Math.ceil(nowMin() / 15) * 15, 0, 1440 - 15);

/* ---------- icons (SF Symbols-like outlines) ---------- */
const I = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  tasks: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8M13 12h8M13 18h8"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  plusCircle: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  walk: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4M4 13h4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  dumbbell: '<path d="M14.4 14.4 9.6 9.6"/><path d="M18.66 21.49a2 2 0 1 1-2.83-2.83l-1.77 1.77a2 2 0 1 1-2.83-2.83l6.37-6.36a2 2 0 1 1 2.83 2.83l-1.77 1.77a2 2 0 1 1 2.83 2.83z"/><path d="m21.5 21.5-1.4-1.4M3.9 3.9 2.5 2.5"/><path d="M6.4 12.77a2 2 0 1 1-2.83-2.83l1.77-1.77a2 2 0 1 1-2.83-2.83l2.83-2.83a2 2 0 1 1 2.83 2.83l1.77-1.77a2 2 0 1 1 2.83 2.83z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  apple: '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.78 4.78 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${I[n] || ''}</svg>`;

/* ---------- palettes ---------- */
// Event colours are Apple system colours; older saved keys map onto the nearest one
const EVENT_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'brown'];
const LEGACY_COLOR = { violet: 'purple', lime: 'green', amber: 'orange', rose: 'red', cyan: 'teal' };
const colorOf = (k) => `var(--${EVENT_COLORS.includes(k) || k === 'mint' || k === 'cyan' ? k : LEGACY_COLOR[k] || 'blue'})`;
const COLOR_CYCLE = ['blue', 'orange', 'green', 'purple', 'pink', 'teal', 'red', 'indigo', 'yellow'];
const ACCENTS = ['gold', 'blue', 'purple', 'pink', 'red', 'orange', 'green', 'gray'];
const HABIT_ICONS = [['droplet', 'cyan'], ['walk', 'green'], ['moon', 'indigo'], ['pill', 'red'], ['book', 'orange'], ['dumbbell', 'pink'], ['leaf', 'mint'], ['apple', 'red'], ['pen', 'yellow'], ['sun', 'orange'], ['heart', 'pink'], ['coffee', 'brown']];

/* ---------- state ---------- */
let state = null;
const fx = new Set(); // one-shot animation keys consumed by the next render

function defaults() {
  const h = (name, ic, color) => ({ id: uid(), name, icon: ic, color, log: {}, createdAt: Date.now() });
  return {
    version: 3,
    events: [],
    tasks: [],
    habits: [h('Drink water', 'droplet', 'cyan'), h('Move', 'walk', 'green'), h('Bed on time', 'moon', 'indigo')],
    focus: [],
    settings: {
      theme: 'dark', accent: 'gold', h24: true, dayStart: 7, dayEnd: 23,
      lead: 10, wrapup: true, sound: true, reduceMotion: false, closeToTray: true, launchAtLogin: false,
      focusLen: 25, shortLen: 5, longLen: 15, focusGoal: 60, onboarded: false,
    },
    ui: { view: 'today', taskFilter: 'inbox', weekOffset: 0 },
  };
}

function newTask(title, o = {}) {
  const t = { id: uid(), title, done: false, doneAt: null, createdAt: Date.now(), due: o.due ?? null, top: !!o.top, topAt: o.top ? Date.now() : null, est: o.est ?? null };
  state.tasks.push(t);
  fx.add('new:task:' + t.id);
  return t;
}

async function load() {
  let raw = null;
  try { raw = bridge ? await bridge.load() : JSON.parse(localStorage.getItem('tempo-data') || 'null'); } catch { raw = null; }
  const d = defaults();
  if (!raw || typeof raw !== 'object') { state = d; return; }
  state = { ...d, ...raw, settings: { ...d.settings, ...(raw.settings || {}) }, ui: { ...d.ui, ...(raw.ui || {}), weekOffset: 0 } };
  for (const k of ['events', 'tasks', 'habits', 'focus']) if (!Array.isArray(state[k])) state[k] = [];
  // v3 switched the default accent from blue to gold
  if ((raw.version || 1) < 3 && state.settings.accent === 'blue') state.settings.accent = 'gold';
  if (!ACCENTS.includes(state.settings.accent)) state.settings.accent = 'gold';
  if (!['dark', 'light', 'system'].includes(state.settings.theme)) state.settings.theme = 'dark';
}

let saveT = null;
const serialize = () => JSON.stringify({ version: 3, events: state.events, tasks: state.tasks, habits: state.habits, focus: state.focus, settings: state.settings, ui: state.ui });
function save() { clearTimeout(saveT); saveT = setTimeout(flush, 250); }
function flush() {
  clearTimeout(saveT); saveT = null;
  const j = serialize();
  if (bridge) bridge.save(j); else try { localStorage.setItem('tempo-data', j); } catch {}
}
window.addEventListener('beforeunload', () => {
  if (!saveT) return;
  const j = serialize();
  if (bridge) bridge.saveSync(j); else try { localStorage.setItem('tempo-data', j); } catch {}
});
const snapshot = () => JSON.stringify({ events: state.events, tasks: state.tasks, habits: state.habits, focus: state.focus });
function restore(snap) { Object.assign(state, JSON.parse(snap)); commit(); }
function commit() { save(); render(); }

/* ---------- events / occurrences ---------- */
function occursOn(ev, ds) {
  if (ev.skip && ev.skip[ds]) return false;
  if (!ev.repeat || ev.repeat === 'none') return ev.date === ds;
  if (ds < ev.date) return false;
  const dow = parseYmd(ds).getDay();
  if (ev.repeat === 'daily') return true;
  if (ev.repeat === 'weekdays') return dow >= 1 && dow <= 5;
  if (ev.repeat === 'weekly') return dow === parseYmd(ev.date).getDay();
  return false;
}
const isEvDone = (ev, ds) => !!(ev.doneOn && ev.doneOn[ds]);
function eventsOn(ds) {
  return state.events
    .filter((e) => occursOn(e, ds))
    .map((e) => ({ ev: e, date: ds, start: e.start, end: e.start + e.dur, done: isEvDone(e, ds) }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
}
function nowInfo() {
  const ds = todayStr(), m = nowMin();
  const all = eventsOn(ds);
  const current = all.filter((o) => o.start <= m && m < o.end && !o.done).pop() || null;
  const next = all.find((o) => o.start > m && !o.done) || null;
  return { all, current, next };
}
const nowKey = () => { const { current, next } = nowInfo(); return (current ? current.ev.id : '-') + '|' + (next ? next.ev.id + next.start : '-'); };
const nextColor = () => COLOR_CYCLE[state.events.length % COLOR_CYCLE.length];
const findTask = (id) => state.tasks.find((t) => t.id === id);
const findEvent = (id) => state.events.find((e) => e.id === id);

/* ---------- tracking ---------- */
function activityMap() {
  const map = {};
  const add = (d) => { map[d] = (map[d] || 0) + 1; };
  state.tasks.forEach((t) => { if (t.done && t.doneAt) add(ymd(new Date(t.doneAt))); });
  state.habits.forEach((h) => Object.keys(h.log || {}).forEach((d) => h.log[d] && add(d)));
  state.focus.forEach((f) => add(f.date));
  state.events.forEach((e) => Object.keys(e.doneOn || {}).forEach((d) => e.doneOn[d] && add(d)));
  return map;
}
function streakOf(has) {
  let d = new Date(), n = 0;
  if (!has(ymd(d))) d = addDays(d, -1);
  while (has(ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}
const dayStreak = () => { const m = activityMap(); return streakOf((d) => !!m[d]); };
const habitStreak = (h) => streakOf((d) => !!(h.log && h.log[d]));
function todayRings() {
  const ds = todayStr();
  const done = state.tasks.filter((t) => t.done && isToday(t.doneAt)).length;
  const open = state.tasks.filter((t) => !t.done && t.due && t.due <= ds).length;
  const focus = state.focus.filter((f) => f.date === ds).reduce((a, f) => a + f.minutes, 0);
  const hDone = state.habits.filter((h) => h.log && h.log[ds]).length;
  return {
    tasks: { v: done, goal: done + open },
    focus: { v: focus, goal: state.settings.focusGoal || 60 },
    habits: { v: hDone, goal: state.habits.length },
  };
}
// Plain labelled progress bars for today's tasks / focus / habits
function todayBarsHTML(r, big = false) {
  const rows = [['Tasks', r.tasks, `${r.tasks.v} of ${r.tasks.goal}`], ['Focus', r.focus, `${r.focus.v} of ${r.focus.goal} min`], ['Habits', r.habits, `${r.habits.v} of ${r.habits.goal}`]];
  return rows.map(([k, d, txt]) => `<div class="tb${big ? ' big' : ''}"><div class="tb-top"><span>${k}</span><span class="tb-v">${txt}</span></div><div class="tb-bar"><i style="width:${d.goal ? Math.min(100, (d.v / d.goal) * 100) : 0}%"></i></div></div>`).join('');
}

/* ---------- sound ---------- */
let actx = null;
function chime(kind) {
  if (!state.settings.sound) return;
  try {
    actx = actx || new AudioContext();
    if (actx.state === 'suspended') actx.resume();
    const seq = { done: [[1046.5, 0]], start: [[659.25, 0], [880, 0.13]], end: [[880, 0], [659.25, 0.15], [523.25, 0.3]] }[kind] || [[880, 0]];
    seq.forEach(([f, dt]) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = actx.currentTime + dt;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + 0.5);
    });
  } catch {}
}

/* ---------- HUD toasts / notifications ---------- */
function toast(msg, { undo = null, ms = 3600 } = {}) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button>Undo</button>' : ''}`;
  $('#toasts').appendChild(el);
  const kill = () => { if (el.classList.contains('out')) return; el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  if (undo) el.querySelector('button').onclick = () => { undo(); kill(); };
  setTimeout(kill, undo ? ms + 2400 : ms);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
}
function notify(title, body) {
  if (bridge && !(document.hasFocus() && document.visibilityState === 'visible')) bridge.notify(title, body);
  else toast(title, { ms: 5000 });
}
const shake = (el) => { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); };

/* ---------- segmented controls (sliding thumb) ---------- */
const segPos = new Map();
function layoutSegs(root = document, animate = true) {
  $$('.seg[data-seg]', root).forEach((seg) => {
    let thumb = $('.seg-thumb', seg);
    if (!thumb) { thumb = document.createElement('i'); thumb.className = 'seg-thumb'; seg.prepend(thumb); }
    const on = $('button.on', seg);
    if (!on) { thumb.style.opacity = '0'; return; }
    const key = seg.dataset.seg, pos = { x: on.offsetLeft, w: on.offsetWidth };
    const prev = segPos.get(key);
    if (!animate) thumb.style.transition = 'none';
    else if (prev && (prev.x !== pos.x || prev.w !== pos.w)) {
      thumb.style.transition = 'none';
      thumb.style.transform = `translateX(${prev.x}px)`; thumb.style.width = prev.w + 'px';
      void thumb.offsetWidth;
      thumb.style.transition = '';
    }
    thumb.style.transform = `translateX(${pos.x}px)`; thumb.style.width = pos.w + 'px';
    if (!animate) { void thumb.offsetWidth; thumb.style.transition = ''; }
    segPos.set(key, pos);
  });
}
const segHTML = (key, opts, cur, attrs) => `<div class="seg" data-seg="${key}"><i class="seg-thumb"></i>${opts.map(([v, label]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" ${attrs(v)}>${label}</button>`).join('')}</div>`;

/* ---------- sheets ---------- */
let modalToken = 0;
const modalOpen = () => $('#modalRoot').classList.contains('open') && !$('#modalRoot').classList.contains('closing');
function openModal(html, { cls = '', onMount, onClose } = {}) {
  const root = $('#modalRoot');
  ++modalToken;
  root.classList.remove('closing');
  root.classList.toggle('spot-mode', cls.includes('spot'));
  root.innerHTML = `<div class="backdrop"></div><div class="modal ${cls}" role="dialog">${html}</div>`;
  root.classList.add('open');
  root._onClose = onClose || null;
  const m = $('.modal', root);
  $('.backdrop', root).addEventListener('click', () => closeModal());
  m.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeModal(); });
  if (onMount) onMount(m);
  layoutSegs(m, false);
  return m;
}
function closeModal() {
  const root = $('#modalRoot');
  if (!root.classList.contains('open') || root.classList.contains('closing')) return;
  const tok = modalToken;
  const cb = root._onClose; root._onClose = null;
  root.classList.add('closing');
  setTimeout(() => { if (tok !== modalToken) return; root.classList.remove('open', 'closing'); root.innerHTML = ''; }, 180);
  if (cb) cb();
}

/* ---------- quick add parser ---------- */
const DOW_RE = /\s(?:on\s+)?(next\s+)?(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?=\s)/i;
function to24(h, ap) {
  h = +h;
  if (ap) { ap = ap.toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; }
  return h;
}
function parseQuick(text) {
  let t = ` ${String(text || '').trim()} `;
  const out = { title: '', date: null, start: null, dur: null };
  let m;
  const cut = () => { t = t.replace(m[0], ' '); };
  // time ranges: 9-11, 14:00-15:30, 2pm-4pm
  if ((m = t.match(/\s(?:from\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?(?=\s)/i))) {
    const ap2 = m[6], ap1 = m[3] || (ap2 && +m[1] <= +m[4] ? ap2 : null);
    const s = to24(m[1], ap1) * 60 + +(m[2] || 0), e = to24(m[4], ap2) * 60 + +(m[5] || 0);
    if (s < 1440 && e <= 1440 && e > s) { out.start = s; out.dur = e - s; cut(); }
  }
  // durations
  if (out.dur == null && (m = t.match(/\s(?:for\s+)?(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hours?)(?:\s*(\d{1,2})\s*(?:m|min|mins)|(\d{1,2}))?(?=\s)/i))) {
    out.dur = Math.round(parseFloat(m[1].replace(',', '.')) * 60) + +(m[2] || m[3] || 0); cut();
  } else if (out.dur == null && (m = t.match(/\s(?:for\s+)?(\d{1,3})\s*(?:m|min|mins|minutes?)(?=\s)/i))) {
    out.dur = +m[1]; cut();
  }
  // times
  if (out.start == null) {
    if ((m = t.match(/\s(?:at\s+|@\s*)?(\d{1,2})[:.](\d{2})\s*(am|pm)?(?=\s)/i))) { const h = to24(m[1], m[3]); if (h < 24 && +m[2] < 60) { out.start = h * 60 + +m[2]; cut(); } }
    else if ((m = t.match(/\s(?:at\s+|@\s*)?(\d{1,2})\s*(am|pm)(?=\s)/i))) { const h = to24(m[1], m[2]); if (h < 24) { out.start = h * 60; cut(); } }
    else if ((m = t.match(/\s(?:at|@)\s*(\d{1,2})(?=\s)/i))) { const h = +m[1]; if (h < 24) { out.start = h * 60; cut(); } }
    else if ((m = t.match(/\s(noon|midday)(?=\s)/i))) { out.start = 720; cut(); }
  }
  // dates
  const today = new Date();
  if ((m = t.match(/\s(today|tonight)(?=\s)/i))) { out.date = ymd(today); cut(); }
  else if ((m = t.match(/\s(tomorrow|tmrw|tmr)(?=\s)/i))) { out.date = ymd(addDays(today, 1)); cut(); }
  else if ((m = t.match(/\sin\s+(\d{1,2})\s+days?(?=\s)/i))) { out.date = ymd(addDays(today, +m[1])); cut(); }
  else if ((m = t.match(/\s(?:on\s+)?(\d{1,2})\/(\d{1,2})(?=\s)/))) {
    let d = new Date(today.getFullYear(), +m[2] - 1, +m[1]);
    if (d < addDays(today, -1)) d = new Date(today.getFullYear() + 1, +m[2] - 1, +m[1]);
    if (!isNaN(d)) { out.date = ymd(d); cut(); }
  } else if ((m = t.match(DOW_RE))) {
    const idx = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[2].slice(0, 3).toLowerCase());
    let diff = (idx - today.getDay() + 7) % 7;
    if (m[1] && diff === 0) diff = 7;
    out.date = ymd(addDays(today, diff)); cut();
  }
  out.title = t.replace(/\s+/g, ' ').trim().replace(/\s+(at|on|for|from)$/i, '').replace(/^(at|on)\s+/i, '');
  return out;
}

// quietIf(task) → true when the new task is already visible where it was typed, so no toast is needed
function addFromQuick(text, ctxDue = null, quietIf = null) {
  const p = parseQuick(text);
  if (!p.title) return false;
  if (p.start != null) {
    const ev = { id: uid(), title: p.title, date: p.date || todayStr(), start: p.start, dur: clamp(p.dur || 60, 5, 1440 - p.start), color: nextColor(), repeat: 'none', notes: '', doneOn: {}, skip: {}, createdAt: Date.now() };
    state.events.push(ev);
    fx.add('new:ev:' + ev.id);
    toast(`Added “${ev.title}” · ${dayLabel(ev.date)}, ${fmtTime(ev.start)}`);
  } else {
    const t = newTask(p.title, { due: p.date || ctxDue, est: p.dur });
    if (!(quietIf && quietIf(t))) toast(t.due ? `Added to ${dayLabel(t.due)}` : 'Added to Inbox');
  }
  commit();
  return true;
}

function spotResultsHTML(p, raw) {
  if (!raw.trim()) {
    const ex = ['Gym tomorrow 18:00 1h', 'Call mom friday', 'Deep work 9–11', 'Pay rent'];
    return `<div class="spot-sec">Examples</div>${ex.map((e) => `<button class="spot-row ex" data-ex="${esc(e.replace('–', '-'))}">${icon('search', 'sm')}${esc(e)}</button>`).join('')}`;
  }
  if (!p.title) return '';
  if (p.start != null) {
    const dur = p.dur || 60;
    return `<div class="spot-row sel"><span class="app-icon" style="--hc:var(--red)">${icon('calendar')}</span><div><div class="t">${esc(p.title)}</div><div class="d">Time block · ${dayLabel(p.date || todayStr())}, ${fmtTime(p.start)} – ${fmtTime(Math.min(1440, p.start + dur))}</div></div><span class="ret">↵</span></div>`;
  }
  return `<div class="spot-row sel"><span class="app-icon" style="--hc:var(--blue)">${icon('tasks')}</span><div><div class="t">${esc(p.title)}</div><div class="d">Task · ${p.date ? dayLabel(p.date) : 'Inbox'}${p.dur ? ` · about ${fmtDur(p.dur)}` : ''}</div></div><span class="ret">↵</span></div>`;
}

function openQuickAdd(prefill = '') {
  openModal(`
    <div class="spot-in">${icon('plusCircle')}<input id="qaInput" autocomplete="off" spellcheck="false" placeholder="New task or event"></div>
    <div class="spot-res" id="qaRes"></div>
    <div class="spot-foot"><span><b>↵</b> Add</span><span><b>Shift ↵</b> Add another</span><span class="grow"></span><span>Add a time to schedule it</span></div>`, {
    cls: 'spot',
    onMount(m) {
      const inp = $('#qaInput', m), res = $('#qaRes', m);
      const upd = () => { res.innerHTML = spotResultsHTML(parseQuick(inp.value), inp.value); };
      inp.value = prefill; upd();
      inp.addEventListener('input', upd);
      res.addEventListener('click', (e) => { const b = e.target.closest('[data-ex]'); if (b) { inp.value = b.dataset.ex; upd(); inp.focus(); } });
      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault(); e.stopPropagation();
        if (!addFromQuick(inp.value)) { shake(m); return; }
        chime('done');
        if (e.shiftKey) { inp.value = ''; upd(); } else closeModal();
      });
      inp.focus();
      setTimeout(() => inp.focus(), 40);
    },
  });
}

/* ---------- event editor ---------- */
const DUR_CHOICES = [15, 30, 45, 60, 90, 120];
function openEventEditor(o = {}) {
  const existing = o.id ? findEvent(o.id) : null;
  const d = existing
    ? { ...existing }
    : { title: o.title || '', date: o.date || todayStr(), start: o.start ?? nextQuarter(), dur: o.dur || 60, color: o.color || nextColor(), repeat: 'none', notes: '', taskId: o.taskId || null };
  d.dur = clamp(d.dur, 5, 1440 - d.start);
  if (!EVENT_COLORS.includes(d.color)) d.color = LEGACY_COLOR[d.color] || 'blue';
  const occDate = o.date || d.date;
  const isRep = existing && existing.repeat && existing.repeat !== 'none';

  const durHTML = () => {
    const list = DUR_CHOICES.includes(d.dur) ? DUR_CHOICES : [...DUR_CHOICES, d.dur].sort((a, b) => a - b);
    return list.map((v) => `<button class="chipbtn${v === d.dur ? ' on' : ''}" data-v="${v}">${fmtShort(v)}</button>`).join('');
  };
  const colorHTML = () => EVENT_COLORS.map((k) => `<button class="sw${k === d.color ? ' on' : ''}" data-v="${k}" style="--c:${colorOf(k)}" title="${k}"></button>`).join('');
  const repOpts = [['none', 'Never'], ['daily', 'Every Day'], ['weekdays', 'Every Weekday'], ['weekly', 'Every Week']];

  openModal(`
    <div class="sheet-head"><button class="btn plain" data-close>Cancel</button><h3>${existing ? 'Edit Block' : 'New Block'}</h3><button class="btn plain strong" data-ed="save">${existing ? 'Done' : 'Add'}</button></div>
    <div class="sheet-body">
      <div class="list">
        <div class="frow"><input class="t-input" name="title" maxlength="120" placeholder="Title" value="${esc(d.title)}"></div>
        <div class="frow"><textarea class="n-input" name="notes" rows="2" placeholder="Notes">${esc(d.notes || '')}</textarea></div>
      </div>
      <div class="list">
        <div class="frow"><span class="lbl">Date</span><input class="field" type="date" name="date" value="${d.date}"></div>
        <div class="frow"><span class="lbl">Starts</span><input class="field" type="time" name="start" step="300" value="${hhmm(d.start)}"></div>
        <div class="frow"><span class="lbl">Ends</span><input class="field" type="time" name="end" step="300" value="${hhmm(d.start + d.dur)}"></div>
        <div class="frow"><span class="lbl">Duration</span><div class="chips" data-g="dur">${durHTML()}</div></div>
      </div>
      <div class="list">
        <div class="frow"><span class="lbl">Repeat</span><select class="popup" name="repeat">${repOpts.map(([v, l]) => `<option value="${v}"${(d.repeat || 'none') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="frow"><span class="lbl">Colour</span><div class="swatches" data-g="color">${colorHTML()}</div></div>
      </div>
      ${isRep ? '<div class="sheet-note">Changes apply to every repeat of this block.</div>' : ''}
      ${existing ? `<div class="list">${isRep ? '<button class="frow btnrow destructive" data-ed="skip">Skip This Day Only</button>' : ''}<button class="frow btnrow destructive" data-ed="delete">${isRep ? 'Delete All Repeats' : 'Delete Block'}</button></div>` : ''}
    </div>`, {
    onMount(m) {
      const f = (n) => $(`[name=${n}]`, m);
      const refresh = () => {
        $('[data-g=dur]', m).innerHTML = durHTML();
        $('[data-g=color]', m).innerHTML = colorHTML();
        f('end').value = hhmm(d.start + d.dur);
      };
      m.addEventListener('click', (e) => {
        const b = e.target.closest('[data-g] [data-v]');
        if (b) {
          const g = b.closest('[data-g]').dataset.g;
          if (g === 'dur') d.dur = clamp(+b.dataset.v, 5, 1440 - d.start);
          else d.color = b.dataset.v;
          refresh();
          return;
        }
        const ed = e.target.closest('[data-ed]');
        if (ed) act(ed.dataset.ed);
      });
      f('repeat').addEventListener('change', () => { d.repeat = f('repeat').value; });
      f('start').addEventListener('change', () => {
        const v = parseHHMM(f('start').value);
        if (v == null) return;
        d.start = clamp(v, 0, 1440 - 5);
        d.dur = clamp(d.dur, 5, 1440 - d.start);
        refresh();
      });
      f('end').addEventListener('change', () => {
        let v = parseHHMM(f('end').value);
        if (v == null) return;
        if (v === 0) v = 1440;
        if (v > d.start) d.dur = v - d.start;
        refresh();
      });
      m.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); e.stopPropagation(); act('save'); }
      });
      function act(kind) {
        if (kind === 'save') {
          d.title = f('title').value.trim();
          if (!d.title) { shake(f('title').closest('.list')); f('title').focus(); return; }
          d.date = f('date').value || d.date;
          d.notes = f('notes').value;
          d.repeat = f('repeat').value;
          d.dur = clamp(d.dur, 5, 1440 - d.start);
          if (existing) Object.assign(existing, d);
          else {
            const ev = { ...d, id: uid(), doneOn: {}, skip: {}, createdAt: Date.now() };
            state.events.push(ev);
            fx.add('new:ev:' + ev.id);
            const rep = { daily: 'every day', weekdays: 'every weekday', weekly: `every ${DOW[parseYmd(ev.date).getDay()]}` }[ev.repeat];
            toast(rep ? `“${ev.title}” repeats ${rep} at ${fmtTime(ev.start)}` : `Added “${ev.title}” · ${dayLabel(ev.date)}, ${fmtTime(ev.start)}`);
          }
          closeModal(); commit();
        } else if (kind === 'delete') {
          const snap = snapshot();
          state.events = state.events.filter((e) => e !== existing);
          closeModal(); commit();
          toast(`Deleted “${existing.title}”`, { undo: () => restore(snap) });
        } else if (kind === 'skip') {
          const snap = snapshot();
          existing.skip = { ...(existing.skip || {}), [occDate]: true };
          closeModal(); commit();
          toast(`Skipped “${existing.title}” on ${dayLabel(occDate)}`, { undo: () => restore(snap) });
        }
      }
      if (!existing) f('title').focus();
    },
  });
}

/* ---------- time grid ---------- */
function layoutLanes(occs) {
  const out = [];
  let cluster = [], clusterEnd = -1;
  const flushCluster = () => {
    const lanesEnd = [];
    cluster.forEach((it) => {
      let l = lanesEnd.findIndex((e) => e <= it.o.start);
      if (l === -1) { l = lanesEnd.length; lanesEnd.push(0); }
      lanesEnd[l] = it.o.end; it.lane = l;
    });
    cluster.forEach((it) => { it.lanes = lanesEnd.length; });
    out.push(...cluster); cluster = []; clusterEnd = -1;
  };
  occs.forEach((o) => { if (cluster.length && o.start >= clusterEnd) flushCluster(); cluster.push({ o }); clusterEnd = Math.max(clusterEnd, o.end); });
  if (cluster.length) flushCluster();
  return out;
}

function evHTML(o, lane, lanes, sh, hh) {
  const top = ((o.start - sh * 60) / 60) * hh;
  const h = Math.max((o.ev.dur / 60) * hh, 20);
  const m = nowMin();
  const isNow = o.date === todayStr() && o.start <= m && m < o.end && !o.done;
  const rep = o.ev.repeat && o.ev.repeat !== 'none';
  const cls = ['ev', o.done && 'done', isNow && 'now', h < 40 && 'short', fx.has('new:ev:' + o.ev.id) && 'appear'].filter(Boolean).join(' ');
  return `<div class="${cls}" data-id="${o.ev.id}" data-date="${o.date}" data-flip="ev:${o.ev.id}:${o.date}" style="top:${top}px;height:${h - 2}px;left:calc(${(lane / lanes) * 100}% + 3px);width:calc(${100 / lanes}% - 6px);--c:${colorOf(o.ev.color)}">
    <div class="ev-title">${esc(o.ev.title)}</div>
    <div class="ev-time">${fmtTime(o.start)} – ${fmtTime(o.end)}${rep ? icon('repeat', 'xs') : ''}</div>
    <button class="ev-check" data-act="toggle-ev" title="${o.done ? 'Mark as not done' : 'Mark as done'}"></button>
    <div class="ev-resize"></div>
  </div>`;
}

function gridRange(occsList) {
  let sh = state.settings.dayStart, eh = state.settings.dayEnd;
  occsList.flat().forEach((o) => { sh = Math.min(sh, Math.floor(o.start / 60)); eh = Math.max(eh, Math.ceil(o.end / 60)); });
  return [clamp(sh, 0, 23), clamp(eh, sh + 1, 24)];
}

function gridHTML(dates, hh, full = false) {
  const occs = dates.map((d) => eventsOn(d));
  const [sh, eh] = gridRange(occs);
  const ds = todayStr();
  const nowTop = ((nowMin() - sh * 60) / 60) * hh;
  const nowVisible = dates.includes(ds) && nowMin() >= sh * 60 && nowMin() <= eh * 60;
  let hours = '';
  for (let h = sh; h <= eh; h++) hours += `<div class="hr" style="top:${(h - sh) * hh}px">${fmtHour(h)}</div>`;
  if (nowVisible) hours += `<div class="now-tag" style="top:${nowTop}px">${fmtTime(Math.floor(nowMin()))}</div>`;
  const cols = dates.map((d, i) => {
    const evs = layoutLanes(occs[i]).map(({ o, lane, lanes }) => evHTML(o, lane, lanes, sh, hh)).join('');
    const dow = parseYmd(d).getDay();
    const cls = ['col', d === ds && 'is-today', full && (dow === 0 || dow === 6) && 'weekend'].filter(Boolean).join(' ');
    return `<div class="${cls}" data-date="${d}">${evs}${d === ds && nowVisible ? `<div class="nowline" style="top:${nowTop}px"></div>` : ''}</div>`;
  }).join('');
  const head = full
    ? `<div class="g-head" style="--n:${dates.length}"><div></div>${dates.map((d) => { const dt = parseYmd(d); return `<div class="g-day${d === ds ? ' is-today' : ''}"><span class="dow">${DOW[dt.getDay()].slice(0, 3)}</span><span class="num">${dt.getDate()}</span></div>`; }).join('')}</div>`
    : '';
  return `<div class="grid${full ? ' full' : ''}" data-starth="${sh}" data-endh="${eh}" data-hh="${hh}" style="--hh:${hh}px">${head}<div class="g-body" style="height:${(eh - sh) * hh}px"><div class="hours">${hours}</div><div class="cols" style="grid-template-columns:repeat(${dates.length},1fr)">${cols}</div></div></div>`;
}

let drag = null;
function onGridDown(e) {
  if (e.button !== 0 || e.target.closest('[data-act]')) return;
  const col = e.target.closest('.col');
  if (!col) return;
  const grid = col.closest('.grid');
  const meta = { sh: +grid.dataset.starth, eh: +grid.dataset.endh, hh: +grid.dataset.hh };
  const cols = $$('.col', grid);
  const minAt = (y, c) => meta.sh * 60 + ((y - c.getBoundingClientRect().top) / meta.hh) * 60;
  const evEl = e.target.closest('.ev');
  if (evEl) {
    const ev = findEvent(evEl.dataset.id);
    if (!ev) return;
    drag = {
      type: e.target.closest('.ev-resize') ? 'resize' : 'move', el: evEl, ev, date: evEl.dataset.date,
      x0: e.clientX, y0: e.clientY, moved: false, cols, colIdx: cols.indexOf(col), meta, minAt,
      grab: minAt(e.clientY, col) - ev.start, newStart: ev.start, newDur: ev.dur, newIdx: cols.indexOf(col),
      repeating: ev.repeat && ev.repeat !== 'none',
    };
  } else {
    const a = clamp(Math.floor(minAt(e.clientY, col) / 15) * 15, 0, 1440 - 15);
    drag = { type: 'create', col, date: col.dataset.date, x0: e.clientX, y0: e.clientY, moved: false, meta, minAt, anchor: a, s: a, e: a + 60 };
  }
  window.addEventListener('pointermove', onGridMove);
  window.addEventListener('pointerup', onGridUp, { once: true });
}
function onGridMove(e) {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
  const { meta } = drag;
  const topPx = (min) => ((min - meta.sh * 60) / 60) * meta.hh;
  if (!drag.moved) {
    drag.moved = true;
    if (drag.el) { drag.el.classList.add('dragging'); if (drag.type === 'move') { drag.el.style.left = '3px'; drag.el.style.width = 'calc(100% - 6px)'; } }
    if (drag.type === 'create') {
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'ev ghost';
      drag.ghost.innerHTML = '<div class="ev-title">New Block</div><div class="ev-time"></div>';
      drag.ghost.style.cssText = 'left:3px;width:calc(100% - 6px)';
      drag.col.appendChild(drag.ghost);
    }
    document.body.style.cursor = drag.type === 'resize' ? 'ns-resize' : drag.type === 'move' ? 'grabbing' : 'default';
  }
  if (drag.type === 'move') {
    let idx = drag.colIdx;
    if (drag.cols.length > 1 && !drag.repeating) {
      drag.cols.forEach((c, i) => { const r = c.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX < r.right) idx = i; });
    }
    const col = drag.cols[idx];
    const start = clamp(snap(drag.minAt(e.clientY, col) - drag.grab), 0, 1440 - drag.ev.dur);
    drag.newStart = start; drag.newIdx = idx;
    if (drag.el.parentElement !== col) col.appendChild(drag.el);
    drag.el.style.top = topPx(start) + 'px';
    $('.ev-time', drag.el).textContent = `${fmtTime(start)} – ${fmtTime(start + drag.ev.dur)}`;
  } else if (drag.type === 'resize') {
    const col = drag.cols[drag.colIdx];
    const dur = clamp(snap(drag.minAt(e.clientY, col) - drag.ev.start), 15, 1440 - drag.ev.start);
    drag.newDur = dur;
    drag.el.style.height = Math.max((dur / 60) * meta.hh, 20) - 2 + 'px';
    $('.ev-time', drag.el).textContent = `${fmtTime(drag.ev.start)} – ${fmtTime(drag.ev.start + dur)}`;
  } else {
    const cur = clamp(snap(drag.minAt(e.clientY, drag.col)), 0, 1440);
    drag.s = Math.min(drag.anchor, cur);
    drag.e = Math.max(drag.anchor + 15, cur);
    drag.ghost.style.top = topPx(drag.s) + 'px';
    drag.ghost.style.height = ((drag.e - drag.s) / 60) * meta.hh - 2 + 'px';
    $('.ev-time', drag.ghost).textContent = `${fmtTime(drag.s)} – ${fmtTime(drag.e)}`;
  }
}
function onGridUp() {
  window.removeEventListener('pointermove', onGridMove);
  document.body.style.cursor = '';
  const d = drag; drag = null;
  if (!d) return;
  if (!d.moved) {
    if (d.ev) openEventEditor({ id: d.ev.id, date: d.date });
    else openEventEditor({ date: d.date, start: d.anchor, dur: 60 });
    return;
  }
  if (d.type === 'move') {
    d.ev.start = d.newStart;
    if (!d.repeating) d.ev.date = d.cols[d.newIdx].dataset.date;
    commit();
  } else if (d.type === 'resize') {
    d.ev.dur = d.newDur;
    commit();
  } else {
    openEventEditor({ date: d.date, start: d.s, dur: d.e - d.s });
    render();
  }
}

/* ---------- task rows ---------- */
function taskRowHTML(t, o = {}) {
  const ds = todayStr();
  const meta = [];
  if (!t.done && t.due && t.due < ds) meta.push('<span class="warn">Carried over</span>');
  else if (t.due && !['today', 'top', 'upcoming'].includes(o.ctx) && !t.done) meta.push(dayLabel(t.due));
  if (t.top && !t.done && o.ctx !== 'top') meta.push('<span class="star">Priority</span>');
  if (t.est) meta.push(`about ${fmtDur(t.est)}`);
  if (t.done && t.doneAt && o.ctx === 'done') meta.push(`Completed ${new Date(t.doneAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !state.settings.h24 })}`);
  const b = (act, title, ic, cls = '') => `<button class="icon-btn ${cls}" data-act="${act}" title="${title}">${icon(ic)}</button>`;
  const acts = [];
  if (!t.done) {
    acts.push(b('star', t.top ? 'Remove from priorities' : 'Make it a priority', 'star', 'star' + (t.top ? ' on' : '')));
    if (!t.due || t.due > ds) acts.push(b('due-today', 'Move to Today', 'sun'));
    else acts.push(b('push', 'Move to tomorrow', 'arrow'));
    acts.push(b('schedule', 'Schedule a time block', 'calendar'));
  }
  acts.push(b('del-task', 'Delete', 'trash'));
  const cls = ['row', 'task', t.done && 'done', fx.has('new:task:' + t.id) && 'appear'].filter(Boolean).join(' ');
  return `<div class="${cls}" data-id="${t.id}" data-flip="task:${t.id}">
    <button class="cb" data-act="toggle-task" title="${t.done ? 'Mark as not done' : 'Complete'}"></button>
    <div class="r-main"><div class="r-title" data-edit="task">${esc(t.title)}</div>${meta.length ? `<div class="r-meta">${meta.join(' · ')}</div>` : ''}</div>
    <div class="t-actions">${acts.join('')}</div>
  </div>`;
}

/* ---------- views ---------- */
function dayProgress() {
  const s = state.settings, m = nowMin();
  const a = s.dayStart * 60, b = s.dayEnd * 60;
  if (m < a) return { pct: 0, label: `Starts ${fmtTime(a)}` };
  if (m >= b) return { pct: 100, label: 'Day finished' };
  return { pct: ((m - a) / (b - a)) * 100, label: `${fmtShort(b - m)} left` };
}

function nowCardHTML() {
  const { all, current, next } = nowInfo();
  const m = nowMin();
  if (current) {
    const o = current, pct = ((m - o.start) / (o.end - o.start)) * 100;
    return `<div class="now" style="--c:${colorOf(o.ev.color)}" data-nc="cur" data-s="${o.start}" data-e="${o.end}">
      <div class="now-top"><span class="live-dot"></span>Now<span class="time">${fmtTime(o.start)} – ${fmtTime(o.end)}</span><span class="left" data-live="ncleft">${fmtLeft(o.end - m)} left</span></div>
      <div class="now-title"><span>${esc(o.ev.title)}</span></div>
      <div class="now-bar"><i data-live="ncbar" style="width:${pct}%"></i></div>
      <div class="now-foot"><span>${next ? `Next: ${esc(next.ev.title)} at ${fmtTime(next.start)}` : 'Nothing scheduled after this'}</span><span class="grow"></span>
        <button class="btn sm tinted" data-act="focus-ev" data-id="${o.ev.id}" data-date="${o.date}">Focus</button>
        <button class="btn sm filled" data-act="toggle-ev" data-id="${o.ev.id}" data-date="${o.date}">Done</button>
      </div>
    </div>`;
  }
  if (next) {
    const gap = next.start - m;
    return `<div class="now" style="--c:${colorOf(next.ev.color)}" data-nc="next" data-s="${next.start}">
      <div class="now-top">Up Next<span class="time">${fmtTime(next.start)} – ${fmtTime(next.end)}</span><span class="left" data-live="ncleft">in ${fmtLeft(gap)}</span></div>
      <div class="now-title"><span>${esc(next.ev.title)}</span></div>
      <div class="now-foot"><span>${gap >= 25 ? 'You have time for a focus session first.' : 'Starting soon — find a stopping point.'}</span><span class="grow"></span>
        ${gap >= 25 ? '<button class="btn sm tinted" data-act="go" data-view="focus">Start Focus</button>' : ''}
      </div>
    </div>`;
  }
  const done = all.filter((o) => o.done).length;
  return `<div class="now" style="--c:var(--label-2)">
    <div class="now-top">${all.length ? 'Schedule' : 'Nothing Scheduled'}</div>
    <div class="now-title plain"><span>${all.length ? 'No more blocks today' : 'Give today a shape'}</span></div>
    <div class="now-foot"><span>${all.length ? `${done} of ${all.length} blocks done` : 'Drag on the timeline, or press N and type “Gym 18:00 1h”.'}</span><span class="grow"></span>
      <button class="btn sm tinted" data-act="new-event">New Block</button>
    </div>
  </div>`;
}

const habitGlyph = (h, cls = 'app-icon') => `<span class="${cls}" style="--hc:${colorOf(h.color)}">${h.icon && I[h.icon] ? icon(h.icon) : esc(h.emoji || '•')}</span>`;

function viewToday() {
  const ds = todayStr(), now = new Date();
  const { all } = nowInfo();
  const planned = all.reduce((a, o) => a + o.ev.dur, 0);
  const dp = dayProgress();
  // Open priorities are capped at 3 when starring; ones finished today stay visible
  const top = state.tasks.filter((t) => t.top && (!t.done || isToday(t.doneAt))).sort((a, b) => (a.topAt || 0) - (b.topAt || 0));
  const topOpen = top.filter((t) => !t.done).length;
  const rest = state.tasks.filter((t) => !t.top && !t.done && t.due && t.due <= ds).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.createdAt - b.createdAt));
  const doneToday = state.tasks.filter((t) => !t.top && t.done && isToday(t.doneAt)).sort((a, b) => a.doneAt - b.doneAt);
  const inboxN = state.tasks.filter((t) => !t.done && !t.due).length;
  const placeholder = topOpen < 3
    ? `<div class="row placeholder"><span class="cb"></span>${top.length ? 'Star another task (up to 3)' : 'Star up to 3 tasks to focus on'}</div>`
    : '';
  const habits = state.habits.map((h) => {
    const on = !!(h.log && h.log[ds]);
    return `<button class="hcap${on ? ' on' : ''}${fx.has('habit:' + h.id) ? ' just' : ''}" data-act="habit-today" data-id="${h.id}" style="--hc:${colorOf(h.color)}">${habitGlyph(h, 'hi')}${esc(h.name)}</button>`;
  }).join('');

  return `<div class="header">
      <div class="h-title rise"><h1>Today</h1><div class="sub">${DOW[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}</div></div>
      <div class="h-actions rise"><div class="dayline"><span class="clock" data-live="clock"></span><div class="dl-meter"><i data-live="dpbar" style="width:${dp.pct}%"></i></div><span data-live="dplabel">${dp.label}</span></div></div>
    </div>
    <div class="today-body">
      <section class="col-main">
        <div class="rise" style="--i:1">${nowCardHTML()}</div>
        <div class="sched rise" style="--i:2">
          <div class="sched-head"><h2>Schedule</h2><span class="meta">${all.length ? `${plural(all.length, 'block')} · ${fmtShort(planned)}` : ''}</span><span class="grow"></span><button class="icon-btn accent" data-act="new-event" title="New block">${icon('plus')}</button></div>
          <div class="grid-scroll" data-scroll-key="today-grid">${gridHTML([ds], 60)}</div>
        </div>
      </section>
      <section class="col-side" data-scroll-key="today-side">
        <div class="group rise" style="--i:1">
          <div class="group-title"><h2>Priorities</h2>${top.length ? `<span class="meta">${top.length - topOpen} of ${top.length}</span>` : ''}</div>
          <div class="list">${top.map((t) => taskRowHTML(t, { ctx: 'top' })).join('')}${placeholder}</div>
        </div>
        <div class="group rise" style="--i:2">
          <div class="group-title"><h2>Tasks</h2>${rest.length ? `<span class="meta">${rest.length}</span>` : ''}</div>
          <div class="list">
            ${rest.map((t) => taskRowHTML(t, { ctx: 'today' })).join('')}
            ${doneToday.map((t) => taskRowHTML(t, { ctx: 'today' })).join('')}
            <label class="add-row">${icon('plusCircle')}<input data-enter="add-today" data-focus-key="add-today" placeholder="New Task" autocomplete="off" spellcheck="false"></label>
          </div>
          ${inboxN ? `<div class="list" style="margin-top:10px"><button class="row link" data-act="go-inbox">${icon('inbox')}<span class="grow">Inbox</span><span class="meta">${inboxN}</span>${icon('right', 'chev')}</button></div>` : ''}
        </div>
        <div class="group rise" style="--i:3">
          <div class="group-title"><h2>Habits</h2><span class="grow"></span><button class="btn plain sm" data-act="go" data-view="progress">Edit</button></div>
          <div class="hcaps">${habits || '<span class="meta">No habits yet.</span>'}</div>
        </div>
      </section>
    </div>`;
}

function viewWeek() {
  const base = addDays(startOfWeek(new Date()), state.ui.weekOffset * 7);
  const dates = [...Array(7)].map((_, i) => ymd(addDays(base, i)));
  const end = addDays(base, 6);
  const occ = dates.flatMap(eventsOn);
  const planned = occ.reduce((a, o) => a + o.ev.dur, 0);
  const title = base.getMonth() === end.getMonth()
    ? `${MONTHS[base.getMonth()]} ${base.getFullYear()}`
    : `${MONTHS[base.getMonth()].slice(0, 3)} – ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  return `<div class="header">
      <div class="h-title rise"><h1>${title}</h1><div class="sub">Week ${isoWeek(base)}${occ.length ? ` · ${fmtShort(planned)} planned` : ''}</div></div>
      <div class="h-actions rise">
        <div class="btn-group"><button class="icon-btn" data-act="wk" data-d="-1" title="Previous week">${icon('left')}</button><button class="btn sm" data-act="wk" data-d="0">Today</button><button class="icon-btn" data-act="wk" data-d="1" title="Next week">${icon('right')}</button></div>
        <button class="round-add" data-act="new-event" title="New block">${icon('plus')}</button>
      </div>
    </div>
    <div class="week-body rise" style="--i:1"><div class="grid-scroll" data-scroll-key="week-grid">${gridHTML(dates, 54, true)}</div></div>`;
}

function viewTasks() {
  const ds = todayStr(), f = state.ui.taskFilter;
  const open = state.tasks.filter((t) => !t.done);
  const groups = {
    inbox: open.filter((t) => !t.due).sort((a, b) => b.createdAt - a.createdAt),
    today: open.filter((t) => t.due && t.due <= ds).sort((a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0) || (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) || a.createdAt - b.createdAt),
    upcoming: open.filter((t) => t.due && t.due > ds).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.createdAt - b.createdAt)),
    done: state.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 80),
  };
  const list = groups[f] || groups.inbox;
  const empty = {
    inbox: ['Inbox Empty', 'Type anything above to capture it.'],
    today: ['Nothing Due Today', 'Move something from the Inbox when you’re ready.'],
    upcoming: ['Nothing Upcoming', 'Add a day like “friday” or “tomorrow” when you capture a task.'],
    done: ['No Completed Tasks', 'Finished tasks show up here.'],
  }[f];
  const ph = { inbox: 'Add to Inbox', today: 'Add to Today', upcoming: 'Add for later, e.g. “renew passport fri”', done: 'Add to Inbox' }[f];
  let body;
  if (!list.length) body = `<div class="empty-state"><h3>${empty[0]}</h3><p>${empty[1]}</p></div>`;
  else if (f === 'upcoming' || f === 'done') {
    const byDay = new Map();
    list.forEach((t) => { const k = f === 'done' ? ymd(new Date(t.doneAt || t.createdAt)) : t.due; if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(t); });
    body = [...byDay].map(([k, ts]) => `<div class="sec-label">${dayLabel(k)}</div><div class="list">${ts.map((t) => taskRowHTML(t, { ctx: f })).join('')}</div>`).join('');
  } else body = `<div class="list">${list.map((t) => taskRowHTML(t, { ctx: f })).join('')}</div>`;
  const tabs = [['inbox', 'Inbox'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['done', 'Completed']];
  return `<div class="header">
      <div class="h-title rise"><h1>Tasks</h1><div class="sub">${plural(open.length, 'open task')}</div></div>
      <div class="h-actions rise">${segHTML('tasks', tabs.map(([k, l]) => [k, k === 'done' ? l : `${l} <span class="n">${groups[k].length}</span>`]), f, (v) => `data-act="filter" data-f="${v}"`)}</div>
    </div>
    <div class="body" data-scroll-key="tasks-${f}"><div class="tasks-wrap">
      <label class="capture rise" style="--i:1">${icon('plusCircle')}<input data-enter="dump" data-focus-key="dump" placeholder="${ph}" autocomplete="off" spellcheck="false"></label>
      <div class="rise" style="--i:2">${body}</div>
    </div></div>`;
}

/* ---------- focus timer ---------- */
const timer = { mode: 'focus', running: false, endAt: 0, remaining: null, total: null, taskId: '', label: '', cycle: 0 };
const MODE_LABEL = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };
const RING_R = 144, RING_C = 2 * Math.PI * RING_R;
const modeLen = (m) => (m === 'focus' ? state.settings.focusLen : m === 'short' ? state.settings.shortLen : state.settings.longLen) * 60;
const timerTotal = () => timer.total ?? modeLen(timer.mode);
const timerRemaining = () => (timer.running ? Math.max(0, (timer.endAt - Date.now()) / 1000) : timer.remaining ?? timerTotal());
const timerActive = () => timer.running || timer.remaining != null;
const focusToday = () => state.focus.filter((f) => f.date === todayStr());

function startTimer() {
  const rem = timerRemaining();
  timer.total = timerTotal();
  timer.endAt = Date.now() + rem * 1000;
  timer.running = true; timer.remaining = null;
  refreshTimer(true);
}
function pauseTimer() { timer.remaining = timerRemaining(); timer.running = false; refreshTimer(true); }
function resetTimer() { timer.running = false; timer.remaining = null; timer.total = null; refreshTimer(true); }
function setMode(m) { timer.mode = m; resetTimer(); }
function completeTimer(early = false) {
  const wasFocus = timer.mode === 'focus';
  if (wasFocus) {
    const mins = Math.round((timerTotal() - timerRemaining()) / 60);
    if (mins >= 1) {
      state.focus.push({ id: uid(), date: todayStr(), minutes: mins, taskId: timer.taskId || null, label: timer.label || '', at: Date.now() });
      timer.cycle++;
      if (!early) { notify('Focus session complete', `${mins} minutes done. Time for a break.`); chime('end'); }
      else toast(`Logged ${fmtDur(mins)} of focus`);
    }
    timer.mode = timer.cycle > 0 && timer.cycle % 4 === 0 ? 'long' : 'short';
  } else {
    if (!early) { notify('Break is over', 'Ready for the next session?'); chime('start'); }
    timer.mode = 'focus';
  }
  timer.running = false; timer.remaining = null; timer.total = null;
  save();
  refreshTimer(true);
}
function refreshTimer(full) {
  if (full && state.ui.view === 'focus') render();
  updateTimerUI();
  renderSidebar();
}
let lastProgress = '';
function updateTimerUI() {
  const rem = timerRemaining(), tot = timerTotal();
  const txt = mmss(rem);
  $$('[data-live=timer]').forEach((el) => { el.textContent = txt; });
  const ring = $('.ring .prog');
  if (ring) ring.style.strokeDashoffset = String(RING_C * (1 - rem / tot));
  const mini = $('#miniTimer');
  if (mini) mini.textContent = txt;
  document.title = timer.running ? `${txt} · ${MODE_LABEL[timer.mode]} — Tempo` : 'Tempo';
  if (bridge) {
    const p = timer.running ? [1 - rem / tot, 'normal'] : timer.remaining != null ? [1 - rem / tot, 'paused'] : [-1, ''];
    const key = p[0].toFixed(3) + p[1];
    if (key !== lastProgress) { lastProgress = key; bridge.progress(p[0], p[1] || undefined); }
  }
}

function viewFocus() {
  const rem = timerRemaining(), tot = timerTotal();
  const ft = focusToday();
  const mins = ft.reduce((a, f) => a + f.minutes, 0);
  const wk = ymd(startOfWeek(new Date()));
  const weekMins = state.focus.filter((f) => f.date >= wk).reduce((a, f) => a + f.minutes, 0);
  const openTasks = state.tasks.filter((t) => !t.done).sort((a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0) || (a.due || 'z').localeCompare(b.due || 'z'));
  const isBreak = timer.mode !== 'focus';
  const what = isBreak ? MODE_LABEL[timer.mode] : timer.label || (timer.taskId && findTask(timer.taskId)?.title) || 'Focus';
  const endAt = new Date(Date.now() + rem * 1000);
  const sub = timer.running
    ? `${icon('bell')}<span>${fmtTime(endAt.getHours() * 60 + endAt.getMinutes())}</span>`
    : `<span>${esc(what)}</span>`;
  const mainBtn = timer.running
    ? '<button class="cbtn pause" data-act="timer-toggle">Pause</button>'
    : `<button class="cbtn start" data-act="timer-toggle">${timer.remaining != null ? 'Resume' : 'Start'}</button>`;
  return `<div class="header">
      <div class="h-title rise"><h1>Focus</h1><div class="sub">${mins ? `${fmtDur(mins)} today` : 'No sessions yet today'}</div></div>
      <div class="h-actions rise">${segHTML('mode', [['focus', 'Focus'], ['short', 'Short Break'], ['long', 'Long Break']], timer.mode, (v) => `data-act="mode" data-m="${v}"`)}</div>
    </div>
    <div class="focus-body">
      <div class="ring-wrap rise" style="--i:1;--rc:${isBreak ? 'var(--green)' : 'var(--accent)'}">
        <svg class="ring" viewBox="0 0 300 300">
          <circle class="track" cx="150" cy="150" r="${RING_R}"/>
          <circle class="prog" cx="150" cy="150" r="${RING_R}" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C * (1 - rem / tot)}"/>
        </svg>
        <div class="ring-center"><div class="ring-time" data-live="timer">${mmss(rem)}</div><div class="ring-sub">${sub}</div></div>
      </div>
      <div class="timer-btns rise" style="--i:2">
        <button class="cbtn cancel" data-act="timer-reset"${timerActive() ? '' : ' disabled'}>Cancel</button>
        ${mainBtn}
      </div>
      ${isBreak ? '' : `<div class="focus-pick rise" style="--i:3">Working on
        <select class="popup" data-change="focus-task">
          <option value="">${timer.label ? esc(timer.label) : 'Nothing specific'}</option>
          ${openTasks.map((t) => `<option value="${t.id}"${t.id === timer.taskId ? ' selected' : ''}>${esc(t.title)}</option>`).join('')}
        </select></div>`}
      <div class="focus-stats rise" style="--i:4">
        <span>Today <b>${fmtShort(mins)}</b></span><span>This week <b>${fmtShort(weekMins)}</b></span><span>Sessions <b>${ft.length}</b></span>
        ${timerActive() || isBreak ? `<button class="btn plain sm" data-act="timer-skip">${isBreak ? 'Skip Break' : 'Finish Early'}</button>` : ''}
      </div>
    </div>`;
}

/* ---------- progress ---------- */
function viewProgress() {
  const act = activityMap();
  const streak = streakOf((d) => !!act[d]);
  const now = new Date(), ds = todayStr();
  const wk = startOfWeek(now), wkS = ymd(wk);
  const elapsed = (now.getDay() + 6) % 7 + 1;
  const doneDay = (t) => (t.done && t.doneAt ? ymd(new Date(t.doneAt)) : null);
  const tasksWeek = state.tasks.filter((t) => { const d = doneDay(t); return d && d >= wkS; }).length;
  const lwS = ymd(addDays(wk, -7)), lwE = ymd(addDays(wk, -7 + elapsed - 1));
  const tasksLast = state.tasks.filter((t) => { const d = doneDay(t); return d && d >= lwS && d <= lwE; }).length;
  const focusWeek = state.focus.filter((f) => f.date >= wkS).reduce((a, f) => a + f.minutes, 0);
  const blocksWeek = state.events.reduce((a, e) => a + Object.keys(e.doneOn || {}).filter((d) => e.doneOn[d] && d >= wkS).length, 0);
  let hDone = 0;
  state.habits.forEach((h) => { for (let i = 0; i < elapsed; i++) if (h.log && h.log[ymd(addDays(wk, i))]) hDone++; });
  const hPct = state.habits.length ? Math.round((hDone / (state.habits.length * elapsed)) * 100) : 0;
  const delta = tasksWeek - tasksLast;
  const r = todayRings();

  const days14 = [...Array(14)].map((_, i) => ymd(addDays(now, i - 13)));
  const perDay = Object.fromEntries(days14.map((d) => [d, 0]));
  state.tasks.forEach((t) => { const d = doneDay(t); if (d && d in perDay) perDay[d]++; });
  const max14 = Math.max(4, ...Object.values(perDay));
  const bars = (days, vals, max, col, fmt) => `<div class="bars">${days.map((d, i) => `<div class="bcol" title="${dayLabel(d)}: ${fmt(vals[d])}"><div class="bar${vals[d] ? '' : ' zero'}" style="--h:${(vals[d] / max) * 100}%;--i:${i};--bc:${col}"></div></div>`).join('')}</div>
    <div class="blbls">${days.map((d) => `<span class="${d === ds ? 'today' : ''}">${DOW[parseYmd(d).getDay()].slice(0, 1)}</span>`).join('')}</div>`;
  const days7 = [...Array(7)].map((_, i) => ymd(addDays(now, i - 6)));
  const fDay = Object.fromEntries(days7.map((d) => [d, 0]));
  state.focus.forEach((f) => { if (f.date in fDay) fDay[f.date] += f.minutes; });
  const maxF = Math.max(60, ...Object.values(fDay));

  const WEEKS = 26, hStart = addDays(wk, -7 * (WEEKS - 1));
  let heat = '';
  for (let w = 0; w < WEEKS; w++) {
    let cells = '';
    for (let dd = 0; dd < 7; dd++) {
      const d = ymd(addDays(hStart, w * 7 + dd)), n = act[d] || 0;
      const lv = n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : n <= 7 ? 3 : 4;
      cells += `<i class="${lv ? 'l' + lv : ''}${d > ds ? ' future' : ''}${d === ds ? ' today' : ''}" title="${dayLabel(d)}: ${plural(n, 'thing')} done"></i>`;
    }
    heat += `<div class="heat-col">${cells}</div>`;
  }

  const last7 = [...Array(7)].map((_, i) => ymd(addDays(now, i - 6)));
  const habitRows = state.habits.map((h) => {
    const st = habitStreak(h);
    const dots = last7.map((d) => `<button class="dot${h.log && h.log[d] ? ' on' : ''}${d === ds ? ' today' : ''}${fx.has('hd:' + h.id + d) ? ' just' : ''}" data-act="habit-day" data-id="${h.id}" data-date="${d}" style="--hc:${colorOf(h.color)}" title="${dayLabel(d)}"><span>${DOW[parseYmd(d).getDay()].slice(0, 1)}</span><i></i></button>`).join('');
    return `<div class="row" data-flip="habit:${h.id}">${habitGlyph(h)}<div class="r-main"><div class="r-title">${esc(h.name)}</div><div class="r-meta">${st ? `${st}-day streak` : 'No streak yet'}</div></div><div class="dots">${dots}</div><button class="icon-btn" data-act="del-habit" data-id="${h.id}" title="Delete habit">${icon('trash')}</button></div>`;
  }).join('');
  const ha = state.ui.habitDraft;
  const habitAdd = ha
    ? `<div class="habit-edit">
        <div class="icon-pick">${HABIT_ICONS.map(([ic, col]) => `<button class="${ha.icon === ic ? 'on' : ''}" data-act="habit-icon" data-ic="${ic}" data-col="${col}"><span class="app-icon" style="--hc:var(--${col})">${icon(ic)}</span></button>`).join('')}</div>
        <div class="line"><input class="field" id="hName" data-enter="add-habit" placeholder="Habit name" maxlength="40" autocomplete="off"><button class="btn" data-act="habit-cancel">Cancel</button><button class="btn filled" data-act="add-habit">Add</button></div>
      </div>`
    : `<button class="add-row" data-act="habit-new" style="width:100%">${icon('plusCircle')}<span>Add Habit</span></button>`;

  const stat = (col, ic, k, v, unit, d) => `<div class="stat" style="--sc:${col}"><div class="k">${icon(ic)}${k}</div><div class="v">${v}${unit ? `<small>${unit}</small>` : ''}</div><div class="d">${d}</div></div>`;
  return `<div class="header">
      <div class="h-title rise"><h1>Progress</h1><div class="sub">${DOW[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}</div></div>
    </div>
    <div class="body" data-scroll-key="progress"><div class="prog-wrap">
      <div class="group rise" style="--i:1"><div class="group-title"><h2>Today</h2><span class="meta">${streak ? `${plural(streak, 'day')} in a row` : ''}</span></div>
        <div class="today-card">${todayBarsHTML(r, true)}</div>
      </div>
      <div class="group rise" style="--i:2"><div class="group-title"><h2>This Week</h2></div>
        <div class="stats">
          ${stat('var(--blue)', 'check', 'Tasks', tasksWeek, 'done', delta > 0 ? `${delta} more than last week` : delta < 0 ? `${-delta} fewer than last week` : 'Same as last week')}
          ${stat('var(--green)', 'timer', 'Focus', fmtShort(focusWeek), '', `${plural(state.focus.filter((f) => f.date >= wkS).length, 'session')}`)}
          ${stat('var(--orange)', 'calendar', 'Blocks', blocksWeek, 'done', 'Time blocks checked off')}
          ${stat('var(--pink)', 'heart', 'Habits', `${hPct}%`, '', `${plural(hDone, 'check-in')}`)}
        </div>
      </div>
      <div class="group rise" style="--i:3"><div class="group-title"><h2>Habits</h2><span class="meta">Last 7 days</span></div>
        <div class="list">${habitRows}${habitAdd}</div>
      </div>
      <div class="group rise" style="--i:4"><div class="two">
        <div class="chart-card"><h2>Tasks Completed</h2><div class="meta">Last 14 days</div>${bars(days14, perDay, max14, 'var(--blue)', (n) => plural(n, 'task'))}</div>
        <div class="chart-card"><h2>Focus Time</h2><div class="meta">Last 7 days</div>${bars(days7, fDay, maxF, 'var(--green)', (n) => fmtDur(n))}</div>
      </div></div>
      <div class="group rise" style="--i:5"><div class="chart-card"><h2>Activity</h2><div class="meta">Last 6 months</div><div class="heat">${heat}</div></div></div>
    </div></div>`;
}

/* ---------- sidebar ---------- */
const NAV = [['today', 'Today', 'sun'], ['week', 'Calendar', 'calendar'], ['tasks', 'Tasks', 'tasks'], ['focus', 'Focus', 'timer'], ['progress', 'Progress', 'chart']];
function buildSidebar() {
  $('#sidebar').innerHTML = `
    <div class="sb-top"><img src="icon.png" alt="">Tempo</div>
    <button class="sb-search" data-act="quick-add">${icon('plus')}<span>New…</span><kbd>Ctrl K</kbd></button>
    <nav class="nav"><div class="nav-hl" id="navHl"></div>
      ${NAV.map(([k, l, ic], i) => `<button class="nav-item" data-act="go" data-view="${k}" title="${l} (${i + 1})">${icon(ic)}<span>${l}</span><span class="count" data-count="${k}"></span></button>`).join('')}
    </nav>
    <div class="sb-foot">
      <button class="sb-today" data-act="go" data-view="progress" id="sbToday" title="Today’s progress"></button>
      <button class="nav-item" data-act="settings">${icon('gear')}<span>Settings</span></button>
    </div>`;
}
function renderSidebar() {
  $$('#sidebar .nav-item[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === state.ui.view));
  const act = $(`#sidebar .nav .nav-item[data-view="${state.ui.view}"]`);
  const hl = $('#navHl');
  if (act) { hl.style.opacity = '1'; hl.style.transform = `translateY(${act.offsetTop}px)`; }
  else hl.style.opacity = '0';
  const ds = todayStr();
  const count = (k, v) => { const el = $(`[data-count="${k}"]`); if (el) { el.textContent = v || ''; el.className = 'count'; el.removeAttribute('id'); } };
  count('today', state.tasks.filter((t) => !t.done && t.due && t.due <= ds).length);
  count('tasks', state.tasks.filter((t) => !t.done && !t.due).length);
  count('focus', '');
  if (timerActive()) { const el = $('[data-count="focus"]'); el.className = 'count timer'; el.id = 'miniTimer'; el.textContent = mmss(timerRemaining()); }
  const r = todayRings();
  $('#sbToday').innerHTML = todayBarsHTML(r);
}

/* ---------- render ---------- */
const VIEWS = { today: viewToday, week: viewWeek, tasks: viewTasks, focus: viewFocus, progress: viewProgress };
let renderT = null, lastNowKey = '', inlineEditing = false;

function flipCapture() {
  const m = new Map();
  $$('#view [data-flip]').forEach((el) => m.set(el.dataset.flip, el.getBoundingClientRect()));
  return m;
}
function flipPlay(prev) {
  if (state.settings.reduceMotion) return;
  $$('#view [data-flip]').forEach((el) => {
    const r0 = prev.get(el.dataset.flip);
    if (!r0) return;
    const r1 = el.getBoundingClientRect();
    const dx = r0.left - r1.left, dy = r0.top - r1.top;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  });
}

function render(enter = false) {
  clearTimeout(renderT); renderT = null;
  const v = $('#view');
  const ae = document.activeElement;
  const fk = ae && ae.dataset && ae.dataset.focusKey ? { key: ae.dataset.focusKey, val: ae.value, s: ae.selectionStart, e: ae.selectionEnd } : null;
  const scrolls = {};
  $$('[data-scroll-key]', v).forEach((el) => { scrolls[el.dataset.scrollKey] = el.scrollTop; });
  const prev = enter ? null : flipCapture();
  v.classList.toggle('enter', enter);
  v.innerHTML = VIEWS[state.ui.view]();
  if (!enter) $$('[data-scroll-key]', v).forEach((el) => { if (scrolls[el.dataset.scrollKey] != null) el.scrollTop = scrolls[el.dataset.scrollKey]; });
  if (fk) {
    const el = $(`[data-focus-key="${fk.key}"]`, v);
    if (el) { el.value = fk.val; el.focus(); try { el.setSelectionRange(fk.s, fk.e); } catch {} }
  }
  if (prev) flipPlay(prev);
  if (enter) {
    const gs = $('.grid-scroll', v), grid = $('.grid', v);
    if (gs && grid) {
      const sh = +grid.dataset.starth, hh = +grid.dataset.hh;
      gs.scrollTop = Math.max(0, ((nowMin() - sh * 60) / 60) * hh - gs.clientHeight * 0.3);
    }
  }
  layoutSegs(v, !enter);
  const hn = $('#hName', v); if (hn && state.ui.habitDraft) hn.focus();
  lastNowKey = nowKey();
  renderSidebar();
  updateLive();
  fx.clear();
}
const scheduleRender = (ms) => { clearTimeout(renderT); renderT = setTimeout(() => render(), ms); };
function go(view) {
  if (!VIEWS[view] || state.ui.view === view) return;
  state.ui.view = view;
  state.ui.habitDraft = null;
  save();
  render(true);
}

/* ---------- live ticker ---------- */
function updateLive() {
  const m = nowMin();
  const clock = fmtTime(Math.floor(m));
  $$('[data-live=clock]').forEach((el) => { el.textContent = clock; });
  const dp = dayProgress();
  const dpl = $('[data-live=dplabel]'); if (dpl) dpl.textContent = dp.label;
  const dpb = $('[data-live=dpbar]'); if (dpb) dpb.style.width = dp.pct + '%';
  const nc = $('[data-nc]');
  if (nc) {
    const s = +nc.dataset.s, e = +nc.dataset.e;
    const left = $('[data-live=ncleft]', nc), bar = $('[data-live=ncbar]', nc);
    if (nc.dataset.nc === 'cur') { if (left) left.textContent = `${fmtLeft(e - m)} left`; if (bar) bar.style.width = clamp(((m - s) / (e - s)) * 100, 0, 100) + '%'; }
    else if (left) left.textContent = `in ${fmtLeft(s - m)}`;
  }
  $$('.grid').forEach((g) => {
    const sh = +g.dataset.starth, hh = +g.dataset.hh, top = ((m - sh * 60) / 60) * hh;
    const nl = $('.nowline', g); if (nl) nl.style.top = top + 'px';
    const tag = $('.now-tag', g);
    if (tag) {
      tag.style.top = top + 'px'; tag.textContent = clock;
      $$('.hr', g).forEach((hr) => { hr.style.opacity = Math.abs(parseFloat(hr.style.top) - top) < 12 ? '0' : ''; });
    }
  });
}

const fired = new Set();
function checkReminders() {
  const s = state.settings, ds = todayStr(), m = nowMin();
  for (const o of eventsOn(ds)) {
    if (o.done) continue;
    const k = `${o.ev.id}|${ds}|${o.start}|${o.end}|`;
    if (s.lead > 0 && m >= o.start - s.lead && m < o.start && !fired.has(k + 'pre')) {
      fired.add(k + 'pre');
      notify(`${o.ev.title} starts in ${Math.ceil(o.start - m)} min`, `${fmtTime(o.start)} – ${fmtTime(o.end)}`);
    }
    if (m >= o.start && m < o.start + 2 && !fired.has(k + 'start')) {
      fired.add(k + 'start'); fired.add(k + 'pre');
      notify(`${o.ev.title} has started`, `Until ${fmtTime(o.end)} · ${fmtDur(o.ev.dur)}`);
      chime('start');
    }
    if (s.wrapup && o.ev.dur >= 20 && m >= o.end - 5 && m < o.end && !fired.has(k + 'wrap')) {
      fired.add(k + 'wrap');
      notify(`${o.ev.title} ends in 5 min`, 'Time to find a stopping point.');
    }
  }
}

let lastDay = '', lastMinute = -1;
function tick() {
  const ds = todayStr();
  if (lastDay && ds !== lastDay && !drag && !inlineEditing) { lastDay = ds; render(); }
  lastDay = ds;
  updateLive();
  if (timer.running) { if (timerRemaining() <= 0) completeTimer(); else updateTimerUI(); }
  const mm = Math.floor(nowMin());
  if (mm !== lastMinute) {
    lastMinute = mm;
    checkReminders();
    if (bridge) {
      const { current, next } = nowInfo();
      bridge.tooltip(current ? `Tempo — ${current.ev.title} (${fmtLeft(current.end - nowMin())} left)` : next ? `Tempo — Next: ${next.ev.title} at ${fmtTime(next.start)}` : 'Tempo');
    }
  }
  if (!drag && !inlineEditing && !renderT && (state.ui.view === 'today' || state.ui.view === 'week') && nowKey() !== lastNowKey) render();
}

/* ---------- actions ---------- */
function toggleTask(el) {
  const row = el.closest('.task');
  const t = findTask(row.dataset.id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  if (t.done) {
    row.classList.add('done', 'checking');
    chime('done');
    const top = state.tasks.filter((x) => x.top && (!x.done || isToday(x.doneAt)));
    if (t.top && top.length >= 2 && top.every((x) => x.done)) setTimeout(() => toast('All priorities done for today'), 400);
  } else row.classList.remove('done', 'checking');
  save();
  scheduleRender(t.done ? 750 : 0);
}

function toggleEventDone(el) {
  const host = el.closest('[data-id]');
  const ev = findEvent(host.dataset.id), date = host.dataset.date;
  if (!ev) return;
  ev.doneOn = { ...(ev.doneOn || {}) };
  if (ev.doneOn[date]) delete ev.doneOn[date];
  else {
    ev.doneOn[date] = true;
    chime('done');
    if (ev.taskId) { const t = findTask(ev.taskId); if (t && !t.done) { t.done = true; t.doneAt = Date.now(); } }
  }
  commit();
}

const ACTIONS = {
  go: (el) => go(el.dataset.view),
  'quick-add': () => openQuickAdd(),
  settings: () => openSettings(),
  'new-event': () => openEventEditor({ date: state.ui.view === 'week' && state.ui.weekOffset ? ymd(addDays(startOfWeek(new Date()), state.ui.weekOffset * 7)) : todayStr() }),
  'toggle-ev': toggleEventDone,
  'focus-ev': (el) => {
    const ev = findEvent(el.dataset.id);
    if (!ev) return;
    timer.label = ev.title; timer.taskId = ev.taskId || '';
    if (!timer.running) { timer.mode = 'focus'; timer.remaining = null; timer.total = null; }
    state.ui.view = 'focus';
    render(true);
    if (!timer.running) startTimer();
  },
  'toggle-task': toggleTask,
  star: (el) => {
    const t = findTask(el.closest('[data-id]').dataset.id);
    if (!t) return;
    if (!t.top) {
      if (state.tasks.filter((x) => x.top && !x.done).length >= 3) { toast('You already have 3 priorities'); shake(el.closest('.row')); return; }
      t.top = true; t.topAt = Date.now();
      if (!t.due || t.due > todayStr()) t.due = todayStr();
      if (state.ui.view !== 'today') toast('Added to today’s priorities');
    } else t.top = false;
    commit();
  },
  'due-today': (el) => { const t = findTask(el.closest('[data-id]').dataset.id); if (!t) return; t.due = todayStr(); commit(); toast('Moved to Today'); },
  push: (el) => {
    const t = findTask(el.closest('[data-id]').dataset.id);
    if (!t) return;
    const snap = snapshot();
    t.due = ymd(addDays(new Date(), 1)); t.top = false;
    commit();
    toast('Moved to Tomorrow', { undo: () => restore(snap) });
  },
  schedule: (el) => {
    const t = findTask(el.closest('[data-id]').dataset.id);
    if (!t) return;
    openEventEditor({ title: t.title, dur: t.est || 30, taskId: t.id, date: t.due && t.due > todayStr() ? t.due : todayStr() });
  },
  'del-task': (el) => {
    const t = findTask(el.closest('[data-id]').dataset.id);
    if (!t) return;
    const snap = snapshot();
    state.tasks = state.tasks.filter((x) => x !== t);
    commit();
    toast('Task deleted', { undo: () => restore(snap) });
  },
  filter: (el) => { state.ui.taskFilter = el.dataset.f; save(); render(); },
  'go-inbox': () => { state.ui.taskFilter = 'inbox'; go('tasks'); },
  wk: (el) => { const d = +el.dataset.d; state.ui.weekOffset = d === 0 ? 0 : state.ui.weekOffset + d; render(true); },
  'habit-today': (el) => {
    const h = state.habits.find((x) => x.id === el.dataset.id);
    if (!h) return;
    const ds = todayStr();
    h.log = { ...(h.log || {}) };
    if (h.log[ds]) delete h.log[ds];
    else { h.log[ds] = true; fx.add('habit:' + h.id); chime('done'); }
    commit();
  },
  'habit-day': (el) => {
    const h = state.habits.find((x) => x.id === el.dataset.id), d = el.dataset.date;
    if (!h) return;
    h.log = { ...(h.log || {}) };
    if (h.log[d]) delete h.log[d];
    else { h.log[d] = true; fx.add('hd:' + h.id + d); chime('done'); }
    commit();
  },
  'del-habit': (el) => {
    const h = state.habits.find((x) => x.id === el.dataset.id);
    if (!h) return;
    const snap = snapshot();
    state.habits = state.habits.filter((x) => x !== h);
    commit();
    toast(`Deleted “${h.name}”`, { undo: () => restore(snap) });
  },
  'habit-new': () => { state.ui.habitDraft = { icon: HABIT_ICONS[0][0], color: HABIT_ICONS[0][1] }; render(); },
  'habit-icon': (el) => {
    const name = $('#hName') ? $('#hName').value : '';
    state.ui.habitDraft = { icon: el.dataset.ic, color: el.dataset.col };
    render();
    const n = $('#hName'); if (n) n.value = name;
  },
  'habit-cancel': () => { state.ui.habitDraft = null; render(); },
  'add-habit': () => addHabit(),
  mode: (el) => setMode(el.dataset.m),
  'timer-toggle': () => (timer.running ? pauseTimer() : startTimer()),
  'timer-reset': () => resetTimer(),
  'timer-skip': () => completeTimer(true),
  export: async () => {
    const j = serialize();
    if (bridge) { if (await bridge.exportData(j)) toast('Backup saved'); }
    else { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([j], { type: 'application/json' })); a.download = 'tempo-backup.json'; a.click(); }
  },
  import: async () => {
    let txt = null;
    if (bridge) txt = await bridge.importData();
    if (!txt) return;
    try {
      const d = JSON.parse(txt);
      if (!d || !Array.isArray(d.tasks) || !Array.isArray(d.events)) throw new Error('bad');
      const snap = snapshot();
      state.events = d.events; state.tasks = d.tasks; state.habits = Array.isArray(d.habits) ? d.habits : []; state.focus = Array.isArray(d.focus) ? d.focus : [];
      closeModal(); commit();
      toast('Data imported', { undo: () => restore(snap) });
    } catch { toast('That file isn’t a Tempo backup'); }
  },
};

function addHabit() {
  const name = $('#hName');
  const draft = state.ui.habitDraft;
  if (!name || !draft) return;
  const n = name.value.trim();
  if (!n) { shake(name); name.focus(); return; }
  state.habits.push({ id: uid(), name: n, icon: draft.icon, color: draft.color, log: {}, createdAt: Date.now() });
  state.ui.habitDraft = null;
  commit();
}

const ENTER = {
  'add-today': (el) => {
    const v = el.value;
    if (!v.trim()) return;
    el.value = '';
    addFromQuick(v, todayStr(), (t) => t.due && t.due <= todayStr());
  },
  dump: (el) => {
    const v = el.value;
    if (!v.trim()) return shake(el.parentElement);
    el.value = '';
    const f = state.ui.taskFilter, ds = todayStr();
    const inView = { inbox: (t) => !t.due, today: (t) => t.due && t.due <= ds, upcoming: (t) => t.due && t.due > ds }[f];
    addFromQuick(v, f === 'today' ? ds : f === 'upcoming' ? ymd(addDays(new Date(), 1)) : null, inView);
  },
  'add-habit': () => addHabit(),
};

/* ---------- inline rename ---------- */
function startInlineEdit(el) {
  const row = el.closest('[data-id]');
  const t = row && findTask(row.dataset.id);
  if (!t || inlineEditing) return;
  inlineEditing = true;
  el.contentEditable = 'plaintext-only';
  el.classList.add('editing');
  el.focus();
  const r = document.createRange(); r.selectNodeContents(el);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  let finished = false;
  const finish = (keep) => {
    if (finished) return;
    finished = true; inlineEditing = false;
    el.removeEventListener('keydown', onKey); el.removeEventListener('blur', onBlur);
    const v = el.textContent.replace(/\s+/g, ' ').trim();
    if (keep && v) t.title = v;
    commit();
  };
  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(true); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); }
  };
  const onBlur = () => finish(true);
  el.addEventListener('keydown', onKey);
  el.addEventListener('blur', onBlur);
}

/* ---------- settings ---------- */
const darkMQ = matchMedia('(prefers-color-scheme: dark)');
const effectiveTheme = () => (state.settings.theme === 'system' ? (darkMQ.matches ? 'dark' : 'light') : state.settings.theme);
darkMQ.addEventListener('change', () => { if (state && state.settings.theme === 'system') applySettings(); });

function applySettings() {
  const s = state.settings, root = document.documentElement;
  const theme = effectiveTheme();
  root.dataset.theme = theme;
  root.dataset.motion = s.reduceMotion ? 'reduced' : 'full';
  root.style.setProperty('--accent', `var(--${s.accent})`);
  // light accents need dark text on filled buttons
  root.style.setProperty('--on-accent', s.accent === 'gold' && theme === 'dark' ? '#16120a' : '#fff');
  if (bridge) bridge.prefs({ theme, closeToTray: s.closeToTray, launchAtLogin: s.launchAtLogin });
}

function settingsHTML() {
  const s = state.settings;
  const sw = (k) => `<button class="switch${s[k] ? ' on' : ''}" data-set="${k}" data-type="bool" aria-pressed="${!!s[k]}"></button>`;
  const sel = (k, opts) => `<select class="popup" data-setsel="${k}">${opts.map(([v, l]) => `<option value="${v}"${s[k] === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const hours = (from, to) => [...Array(to - from + 1)].map((_, i) => [from + i, fmtHour(from + i)]);
  const mins = (list) => list.map((v) => [v, `${v} minutes`]);
  return `<div class="sheet-head"><span></span><h3>Settings</h3><button class="btn plain strong" data-close>Done</button></div>
  <div class="sheet-body">
    <div class="sec">Appearance</div>
    <div class="list">
      <div class="frow"><span class="lbl">Theme</span>${segHTML('set-theme', [['light', 'Light'], ['dark', 'Dark'], ['system', 'Auto']], s.theme, (v) => `data-set="theme" data-val="${v}"`).replace('class="seg"', 'class="seg sm"')}</div>
      <div class="frow"><span class="lbl">Accent colour</span><div class="swatches">${ACCENTS.map((k) => `<button class="sw${s.accent === k ? ' on' : ''}" data-set="accent" data-val="${k}" style="--c:var(--${k})" title="${k}"></button>`).join('')}</div></div>
      <div class="frow"><span class="lbl">Reduce motion</span>${sw('reduceMotion')}</div>
    </div>
    <div class="sec">Calendar</div>
    <div class="list">
      <div class="frow"><span class="lbl">24-hour time</span><button class="switch${s.h24 ? ' on' : ''}" data-set="h24" data-type="bool"></button></div>
      <div class="frow"><span class="lbl">Day starts</span>${sel('dayStart', hours(0, 12))}</div>
      <div class="frow"><span class="lbl">Day ends</span>${sel('dayEnd', hours(14, 24))}</div>
    </div>
    <div class="sec">Reminders</div>
    <div class="list">
      <div class="frow"><span class="lbl">Alert before a block<small>Gives you time to switch tasks</small></span>${sel('lead', [[0, 'None'], ...mins([5, 10, 15, 30])])}</div>
      <div class="frow"><span class="lbl">Alert before a block ends<small>5 minutes before the end</small></span>${sw('wrapup')}</div>
      <div class="frow"><span class="lbl">Sounds</span>${sw('sound')}</div>
    </div>
    <div class="sec">Focus</div>
    <div class="list">
      <div class="frow"><span class="lbl">Focus session</span>${sel('focusLen', mins([15, 20, 25, 30, 45, 50, 60, 90]))}</div>
      <div class="frow"><span class="lbl">Short break</span>${sel('shortLen', mins([3, 5, 10]))}</div>
      <div class="frow"><span class="lbl">Long break</span>${sel('longLen', mins([10, 15, 20, 30]))}</div>
      <div class="frow"><span class="lbl">Daily focus goal</span>${sel('focusGoal', mins([30, 60, 90, 120, 180, 240]))}</div>
    </div>
    <div class="sec">General</div>
    <div class="list">
      <div class="frow"><span class="lbl">Keep running in the tray<small>Reminders keep working when the window is closed</small></span>${sw('closeToTray')}</div>
      <div class="frow"><span class="lbl">Open at login</span>${sw('launchAtLogin')}</div>
    </div>
    <div class="list">
      <button class="frow btnrow" data-act="export">Export Data…</button>
      <button class="frow btnrow" data-act="import">Import Data…</button>
    </div>
    <div class="sheet-note" style="margin-top:-6px">Ctrl K or N: new task or event · Ctrl Shift Space: add from any app · 1–5: switch views · Space: start or pause focus</div>
  </div>`;
}

function openSettings() {
  openModal('<div id="setWrap"></div>', {
    onClose: () => render(),
    onMount(m) {
      const wrap = $('#setWrap', m);
      const draw = () => { const sc = m.scrollTop; wrap.innerHTML = settingsHTML(); m.scrollTop = sc; layoutSegs(wrap); };
      draw();
      const changed = () => { applySettings(); save(); draw(); renderSidebar(); };
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-set]');
        if (!b) return;
        const k = b.dataset.set;
        state.settings[k] = b.dataset.type === 'bool' ? !state.settings[k] : b.dataset.val;
        changed();
      });
      wrap.addEventListener('change', (e) => {
        const k = e.target.dataset.setsel;
        if (!k) return;
        state.settings[k] = +e.target.value;
        if (state.settings.dayEnd <= state.settings.dayStart) state.settings.dayEnd = Math.min(24, state.settings.dayStart + 8);
        changed();
      });
    },
  });
}

function openWelcome() {
  const row = (ic, t, d) => `<div class="w-row">${icon(ic)}<div><b>${t}</b><span>${d}</span></div></div>`;
  openModal(`<div class="welcome">
    <img class="w-icon" src="icon.png" alt="">
    <h1>Welcome to Tempo</h1>
    <div class="w-rows">
      ${row('calendar', 'Plan in time blocks', 'Drag on the timeline to give each part of your day a job.')}
      ${row('star', 'Three priorities', 'Star up to three tasks. Those are what today is about.')}
      ${row('bell', 'Gentle reminders', 'An alert before each block starts, and before it ends.')}
      ${row('plusCircle', 'Capture anything', 'Press Ctrl Shift Space from any app to add a task.')}
    </div>
    <button class="btn filled lg wide" data-close>Continue</button>
  </div>`, {
    onClose: () => { state.settings.onboarded = true; save(); },
  });
}

/* ---------- global listeners ---------- */
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const fn = ACTIONS[a.dataset.act];
  if (fn) fn(a, e);
});
document.addEventListener('dblclick', (e) => { const el = e.target.closest('[data-edit=task]'); if (el) startInlineEdit(el); });
document.addEventListener('change', (e) => {
  if (e.target.dataset.change === 'focus-task') {
    timer.taskId = e.target.value;
    if (timer.taskId) timer.label = '';
    if (!timer.running) render();
  }
});
document.addEventListener('keydown', (e) => {
  const el = e.target;
  if (e.key === 'Enter' && el.dataset && el.dataset.enter && !e.isComposing) { e.preventDefault(); ENTER[el.dataset.enter](el); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openQuickAdd(); return; }
  if (e.key === 'Escape') {
    if (modalOpen()) closeModal();
    else if (state.ui.habitDraft) { state.ui.habitDraft = null; render(); }
    else if (el && el.blur) el.blur();
    return;
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable;
  if (typing || modalOpen() || e.ctrlKey || e.altKey || e.metaKey) return;
  const n = '12345'.indexOf(e.key);
  if (n >= 0) { go(NAV[n][0]); return; }
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openQuickAdd(); return; }
  if (e.key === ' ' && state.ui.view === 'focus' && el.tagName !== 'BUTTON') { e.preventDefault(); timer.running ? pauseTimer() : startTimer(); return; }
  if (state.ui.view === 'week') {
    if (e.key === 'ArrowLeft') { state.ui.weekOffset--; render(true); }
    else if (e.key === 'ArrowRight') { state.ui.weekOffset++; render(true); }
    else if (e.key === 't' || e.key === 'T') { state.ui.weekOffset = 0; render(true); }
  }
});

/* ---------- boot ---------- */
(async function boot() {
  await load();
  state.ui.habitDraft = null;
  buildSidebar();
  applySettings();
  $('#view').addEventListener('pointerdown', onGridDown);
  render(true);
  // Inter loads asynchronously; re-measure anything sized from text once it has
  document.fonts.ready.then(() => { layoutSegs(document, false); renderSidebar(); });
  setInterval(tick, 1000);
  tick();
  if (bridge) bridge.onQuickAdd(() => { if (!modalOpen()) openQuickAdd(); });
  if (!state.settings.onboarded) setTimeout(openWelcome, 400);
  save();
})();
