// Renders the UI with demo data and saves README screenshots to docs/.
// Run: node_modules\electron\dist\electron.exe tools/screenshots.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'docs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Executed inside the page: builds a believable week of data using the app's own helpers
const SEED = `(() => {
  const ds = todayStr(), now = Math.floor(nowMin() / 15) * 15;
  const wk = startOfWeek(new Date());
  const day = (i) => ymd(addDays(wk, i));
  const ev = (title, date, start, dur, color, extra = {}) => ({ id: uid(), title, date, start, dur, color, repeat: 'none', notes: '', doneOn: {}, skip: {}, createdAt: Date.now(), ...extra });
  state.events = [
    ev('Standup', day(0), 570, 15, 'indigo', { repeat: 'weekdays' }),
    ev('Deep work: thesis', ds, Math.max(0, now - 30), 90, 'blue'),
    ev('Lunch with Sara', ds, Math.max(0, now - 240), 60, 'green', { doneOn: { [ds]: true } }),
    ev('Gym', ds, Math.min(1380, now + 120), 60, 'orange'),
    ev('Lecture', day(1), 600, 120, 'purple', { doneOn: { [day(1)]: true } }),
    ev('Study group', day(2), 840, 90, 'teal'),
    ev('Dentist', day(3), 870, 45, 'red'),
    ev('Gym', day(0), 1050, 60, 'orange', { repeat: 'weekly' }),
    ev('Read', day(4), 1200, 45, 'brown'),
    ev('Groceries', day(5), 660, 45, 'yellow'),
    ev('Call home', day(6), 1140, 30, 'pink'),
  ];
  const t = (title, o = {}) => ({ id: uid(), title, done: false, doneAt: null, createdAt: Date.now() - Math.random() * 1e7, due: null, top: false, topAt: null, est: null, ...o });
  const doneAt = (d) => parseYmd(d).getTime() + 15 * 3600e3;
  state.tasks = [
    t('Finish chapter 2 outline', { due: ds, top: true, topAt: 1, est: 60 }),
    t('Email supervisor about deadline', { due: ds, top: true, topAt: 2, done: true, doneAt: Date.now() - 3600e3 }),
    t('Pay phone bill', { due: ds, top: true, topAt: 3 }),
    t('Pick up package', { due: ds }),
    t('Reply to Jonas', { due: ymd(addDays(new Date(), -1)) }),
    t('Water plants', { due: ds, done: true, doneAt: Date.now() - 7200e3 }),
    t('Book haircut'), t('Look into summer internships'), t('Fix bike light', { est: 20 }),
    t('Renew passport', { due: ymd(addDays(new Date(), 3)) }),
    t('Birthday gift for mom', { due: ymd(addDays(new Date(), 5)) }),
  ];
  for (let i = 1; i < 14; i++) for (let k = 0; k < (i * 7) % 5; k++) state.tasks.push(t('Older task', { done: true, doneAt: doneAt(ymd(addDays(new Date(), -i))) }));
  state.focus = [];
  for (let i = 0; i < 7; i++) [25, 25, 50].slice(0, (i * 3 + 2) % 4).forEach((m) => state.focus.push({ id: uid(), date: ymd(addDays(new Date(), -i)), minutes: m, at: 0 }));
  const h = (name, icon, color, days) => ({ id: uid(), name, icon, color, createdAt: 0, log: Object.fromEntries(days.map((i) => [ymd(addDays(new Date(), -i)), true])) });
  state.habits = [h('Drink water', 'droplet', 'cyan', [0, 1, 2, 3, 4, 6]), h('Take meds', 'pill', 'red', [0, 1, 2, 3, 4, 5, 6]), h('Move', 'walk', 'green', [1, 2, 4, 5]), h('Read 20 min', 'book', 'orange', [0, 2, 3])];
  for (let i = 7; i < 180; i++) if ((i * 13) % 7 > 2) state.habits[1].log[ymd(addDays(new Date(), -i))] = true;
  state.settings.onboarded = true;
  state.ui.view = 'today';
  commit();
})()`;

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const win = new BrowserWindow({ width: 1440, height: 900, x: -4000, y: 0, show: true, skipTaskbar: true, frame: false, backgroundColor: '#111113', webPreferences: { backgroundThrottling: false } });
  await win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  const js = (code) => win.webContents.executeJavaScript(code);
  await wait(800);
  await js('closeModal()');
  await js(SEED);
  const shot = async (name, code, ms = 1800) => {
    if (code) await js(code);
    await wait(ms);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(OUT, name), img.toPNG());
    console.log('saved', name);
  };
  await shot('today.png', "go('week'); go('today')");
  await shot('calendar.png', "go('week')");
  await shot('tasks.png', "state.ui.taskFilter = 'inbox'; go('tasks')");
  await shot('focus.png', "timer.mode = 'focus'; timer.total = 1500; timer.remaining = 1122; timer.taskId = state.tasks[0].id; go('focus')");
  await shot('progress.png', "go('progress')");
  await shot('quick-add.png', "go('today'); setTimeout(() => { openQuickAdd('Dentist friday 14:30 45m'); document.querySelector('#qaInput').dispatchEvent(new Event('input')); }, 900)", 2200);
  await js('closeModal()');
  await shot('light.png', "state.settings.theme = 'light'; state.settings.accent = 'blue'; applySettings(); go('week'); go('today')", 2000);
  await js("state.settings.theme = 'dark'; state.settings.accent = 'gold'; applySettings(); localStorage.clear()");
  app.quit();
});
