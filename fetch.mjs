#!/usr/bin/env node
/**
 * Preuzima sveže dnevne podatke sa Yahoo Finance (chart v8) i pravi history.json
 * koji aplikacija u root-u repozitorijuma direktno čita.
 *
 * Upotreba:
 *   node fetch.mjs                     # podrazumevano: 5 godina, history.json
 *   node fetch.mjs --range 5y --out /tmp/h.json
 *   node scripts/fetch.mjs --only SPY,XLE
 *
 * Bez ijedne spoljne biblioteke. Radi na Node 18+ (globalni fetch).
 * Ako jedan ticker padne, ostali se i dalje preuzimaju; na kraju se ispiše lista padova.
 * Izlazni kod je 1 ako padne VIŠE od 20% tickera (da CI ne objavi polovičan fajl).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const HOSTS = ['query2.finance.yahoo.com', 'query1.finance.yahoo.com'];

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const RANGE = arg('range', '5y');
const OUT = path.resolve(arg('out', path.join(ROOT, 'history.json')));
const CATALOG = path.resolve(arg('catalog', path.join(ROOT, 'tickers.json')));
const ONLY = arg('only', '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
const DELAY_MS = Number(arg('delay', '350'));
const MAX_RETRY = Number(arg('retry', '4'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Trenutno vreme u Njujorku (berza) — da ne ubacimo nedovršenu današnju sveću. */
function nyNow() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => p.find((x) => x.type === t)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: +get('hour') * 60 + +get('minute') };
}
const round = (v, d = 4) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

async function getJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json,text/plain,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status} ${url} ${body.slice(0, 120)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Jedan ticker → { d:[...], w:[...] } ili null uz razlog. */
async function fetchTicker(t) {
  let lastErr = null;
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    const host = HOSTS[attempt % HOSTS.length];
    const url =
      `https://${host}/v8/finance/chart/${encodeURIComponent(t)}` +
      `?range=${RANGE}&interval=1d&events=div%2Csplit&includeAdjustedClose=true`;
    try {
      const js = await getJson(url);
      const r = js?.chart?.result?.[0];
      if (!r || !Array.isArray(r.timestamp) || !r.timestamp.length) {
        throw new Error('nema podataka u odgovoru');
      }
      const q = r.indicators?.quote?.[0] || {};
      const adj = r.indicators?.adjclose?.[0]?.adjclose || [];
      const off = Number(r.meta?.gmtoffset || 0);
      const d = [];
      for (let i = 0; i < r.timestamp.length; i++) {
        const rawClose = q.close?.[i];
        const close = adj[i] ?? rawClose;
        if (!Number.isFinite(close) || close <= 0) continue;
        const date = new Date((r.timestamp[i] + off) * 1000).toISOString().slice(0, 10);
        d.push([
          date,
          round(close),
          Number.isFinite(q.volume?.[i]) ? Math.round(q.volume[i]) : 0,
          round(q.high?.[i] ?? rawClose ?? close),
          round(q.low?.[i] ?? rawClose ?? close),
          round(rawClose),
        ]);
      }
      // ako je zadnja sveća današnja a berza još radi → izbaci je (nedovršen dan)
      const ny = nyNow();
      if (d.length > 1 && d.at(-1)[0] === ny.date && ny.minutes < 16 * 60) d.pop();
      if (d.length < 30) throw new Error(`premalo podataka (${d.length})`);
      return {
        d,
        w: toWeekly(d),
        currency: r.meta?.currency || null,
        tz: r.meta?.exchangeTimezoneName || null,
      };
    } catch (e) {
      lastErr = e;
      // 429/5xx/mreža → sačekaj i probaj drugi host; 404 → nema smisla ponavljati
      if (e.status === 404) break;
      await sleep(1200 * (attempt + 1) + Math.random() * 400);
    }
  }
  throw lastErr || new Error('nepoznata greška');
}

/** Nedeljne sveće: poslednji trgovinski dan u (ISO) nedelji. */
function toWeekly(daily) {
  const byWeek = new Map();
  for (const row of daily) {
    const dt = new Date(row[0] + 'T00:00:00Z');
    const day = (dt.getUTCDay() + 6) % 7;
    const monday = new Date(dt.getTime() - day * 86400000).toISOString().slice(0, 10);
    const current = byWeek.get(monday);
    if (!current) {
      byWeek.set(monday, { last: row, volume: Number(row[2] || 0), high: row[3], low: row[4] });
    } else {
      current.last = row;
      current.volume += Number(row[2] || 0);
      if (Number.isFinite(row[3])) current.high = current.high == null ? row[3] : Math.max(current.high, row[3]);
      if (Number.isFinite(row[4])) current.low = current.low == null ? row[4] : Math.min(current.low, row[4]);
    }
  }
  return [...byWeek.values()].map((w) => [
    w.last[0], w.last[1], w.volume, w.high, w.low, w.last[5] ?? null,
  ]);
}

async function main() {
  const cat = JSON.parse(await fs.readFile(CATALOG, 'utf8'));
  const tickers = cat.tickers || {};
  let list = Object.keys(tickers).sort();
  if (ONLY.length) list = list.filter((t) => ONLY.includes(t));
  if (!list.length) throw new Error('prazna lista tickera');

  const out = {};
  const fails = [];
  const stats = { adjclose: 0, close_only: 0 };
  const t0 = Date.now();

  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const meta = tickers[t] || {};
    try {
      const r = await fetchTicker(t);
      out[t] = {
        d: r.d,
        w: r.w,
        name: meta.name || t,
        type: meta.type || 'ETF',
        group: meta.group || 'ostalo',
        basis: 'adjclose',
        price_type: 'adjclose',
        currency: r.currency || 'USD',
        tz: r.tz || null,
      };
      stats.adjclose++;
      process.stderr.write(
        `[${i + 1}/${list.length}] ${t} ok  ${r.d.length}D/${r.w.length}W  ${r.d[0][0]}..${r.d.at(-1)[0]}\n`
      );
    } catch (e) {
      fails.push({ ticker: t, error: String(e.message || e).slice(0, 160) });
      process.stderr.write(`[${i + 1}/${list.length}] ${t} FAIL  ${e.message}\n`);
    }
    if (i < list.length - 1) await sleep(DELAY_MS + Math.random() * 250);
  }

  const dates = Object.values(out).flatMap((x) => [x.d[0][0], x.d.at(-1)[0]]);
  const meta = {
    schema: 'history-v2',
    mode: 'history-v2',
    format:
      'd:[date,adjclose,volume,high_raw,low_raw,close_raw] w:[date,adjclose,volume,high_raw,low_raw,close_raw]',
    return_type: 'adjusted (total-return)',
    price_types: { adjclose: stats.adjclose },
    count: Object.keys(out).length,
    requested: list.length,
    fails,
    range: RANGE,
    source: 'yahoo-chart-v8',
    ts: new Date().toISOString(),
    latestD: dates.length ? dates.sort().at(-1) : null,
    took_sec: Math.round((Date.now() - t0) / 1000),
  };

  meta.raw_ohlc = 'Yahoo raw High/Low/Close; adjusted Close za return/RR';
  const payload = { meta, tickers: out, groups: cat.groups || [] };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(payload));

  const bytes = (await fs.stat(OUT)).size;
  process.stderr.write(
    `\nGOTOVO: ${Object.keys(out).length}/${list.length} tickera · ` +
      `${(bytes / 1048576).toFixed(2)} MB → ${OUT} · ${meta.took_sec}s\n`
  );
  if (fails.length) process.stderr.write(`PADOVI: ${fails.map((f) => f.ticker).join(', ')}\n`);

  const failRatio = fails.length / list.length;
  if (!Object.keys(out).length) process.exit(2);
  if (failRatio > 0.2) {
    process.stderr.write('Previše padova (>20%) — ne objavljujem.\n');
    process.exit(1);
  }
}

main().catch((e) => {
  process.stderr.write('FATAL: ' + (e?.stack || e) + '\n');
  process.exit(2);
});
