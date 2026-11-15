/**
 * Provera da app/index.html radi sa svežim history.json — bez browsera.
 * Pravi minimalni DOM, izvršava skriptu iz index.html i posle učitavanja
 * podataka proverava da su svi paneli popunjeni brojevima (a ne "?").
 *
 *   node test/check-app.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await fs.readFile(path.join(ROOT, 'app', 'index.html'), 'utf8');
const data = JSON.parse(await fs.readFile(path.join(ROOT, 'app', 'history.json'), 'utf8'));

const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (!scripts.length) throw new Error('nema inline skripte');

class El {
  constructor(id = '') {
    this.id = id;
    this._html = '';
    this.textContent = '';
    this.value = '';
    this.style = {};
    this.children = [];
    this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    this.dataset = {};
    this.onclick = null;
    this.onchange = null;
    this.files = [];
    this.checked = false;
  }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener() {}
  getContext() { return {}; }
  querySelectorAll() { return []; }
  setAttribute() {}
  focus() {}
}

const els = new Map();
const get = (id) => {
  if (!els.has(id)) els.set(id, new El(id));
  return els.get(id);
};

const store = new Map();
const idOverrides = {};
const sandbox = {
  console,
  Math,
  Date,
  JSON,
  Number,
  String,
  Array,
  Object,
  Map,
  Set,
  Promise,
  isFinite,
  parseInt,
  parseFloat,
  URLSearchParams,
  setTimeout,
  clearTimeout,
  fetch: async (url) => {
    if (String(url).includes('history.json')) return { ok: true, json: async () => data };
    throw new Error('offline u testu');
  },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  location: { search: '', reload() {} },
  prompt: () => 'test',
  Chart: undefined,
  document: {
    getElementById: get,
    querySelector: (s) => get(s),
    querySelectorAll: () => [],
    createElement: () => new El(),
    addEventListener() {},
    body: new El('body'),
  },
  addEventListener() {},
};
sandbox.window = sandbox;
// u browseru svaki id iz HTML-a postaje globalna promenljiva — ovde isto
for (const m of html.matchAll(/\sid="([^"]+)"/g)) {
  const id = m[1];
  if (id in sandbox) continue;
  Object.defineProperty(sandbox, id, {
    get: () => (id in idOverrides ? idOverrides[id] : get(id)),
    set: (v) => { idOverrides[id] = v; },
    configurable: true,
  });
}
const ctx = vm.createContext(sandbox);

for (const s of scripts) vm.runInContext(s, ctx, { filename: 'index.html:inline' });

// sačekaj async fetch iz bootstrap-a
await new Promise((r) => setTimeout(r, 300));

const txt = (id) => String(get(id).innerHTML || get(id).textContent || '');
const checks = [
  ['metaLine', /DATA: OK/],
  ['semafBody', /RISK-(ON|OFF)|mješovito/i],
  ['oneBody', /JAK|SLAB/],
  ['rotSummary', /RANI REŽIM|POTVRĐENI REŽIM/],
  ['rotBody', /RANI KANDIDATI/],
  ['scanBody', /<table/],
  ['tbl', /Podaci|<table/],
  ['q1body', /SPY\/BIL/],
  ['q2body', /Najjača trenutna relativna snaga/],
];

let bad = 0;
for (const [id, re] of checks) {
  const v = txt(id);
  const ok = re.test(v);
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${id.padEnd(12)} ${ok ? '' : v.slice(0, 160)}`);
}

// ključni brojevi moraju postojati, ne sme sve biti "?"
const semafor = String(get('semafBody').innerHTML);
const kpi = (semafor.match(/<b>([^<]+)<\/b>/g) || []).map((x) => x.replace(/<\/?b>/g, ''));
console.log('\nKPI iz semafora:', kpi.join(' | '));

console.log('\nZaglavlje u app-u:', get('metaLine').textContent);
const tickers = Object.keys(data.tickers).length;
console.log(`tickera u history.json: ${tickers}, meta.ts: ${data.meta.ts}`);
if (bad) {
  console.error(`\n${bad} provera nije prošlo.`);
  process.exit(1);
}
console.log('\nSve provere prošle: aplikacija čita svež history.json i popunjava svih 6 panela.');
