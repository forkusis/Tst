#!/usr/bin/env node
/**
 * Lokalni server za pregled i OSVEŽAVANJE podataka na telefonu.
 *
 *   node dev-server.mjs            → http://127.0.0.1:8088
 *
 * Servira app/ (index.html + history.json) i dodaje dva mala endpointa koja
 * statički sajt na GitHub Pages ne može da ima:
 *   POST /api/refresh  → pokrene scripts/fetch.mjs i vrati rezultat (~1 min)
 *   GET  /api/health   → da li je server živ i koliko podaci imaju sati
 *
 * Dugme „Osvježi podatke" u aplikaciji samo na 127.0.0.1/localhost poziva
 * /api/refresh; na pravom sajtu samo ponovo učita history.json.
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(ROOT, 'app');
const PORT = Number(process.env.PORT || 8088);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

let refreshing = null; // Promise dok traje preuzimanje

function runFetch() {
  if (refreshing) return refreshing;
  refreshing = new Promise((resolve) => {
    const t0 = Date.now();
    const p = spawn(process.execPath, [path.join(ROOT, 'scripts', 'fetch.mjs'), '--range', '3y'], {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let log = '';
    p.stderr.on('data', (d) => {
      log += d.toString();
      if (log.length > 4000) log = log.slice(-4000);
    });
    p.on('close', async (code) => {
      refreshing = null;
      let latestD = null;
      try {
        const j = JSON.parse(await fs.readFile(path.join(APP, 'history.json'), 'utf8'));
        latestD = j?.meta?.latestD || null;
      } catch {}
      resolve({
        ok: code === 0,
        code,
        latestD,
        took_sec: Math.round((Date.now() - t0) / 1000),
        tail: log.split('\n').filter(Boolean).slice(-4),
      });
    });
  });
  return refreshing;
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/refresh') {
    const r = await runFetch();
    return sendJson(res, r.ok ? 200 : 500, r);
  }

  if (url.pathname === '/api/health') {
    let ageH = null;
    let latestD = null;
    try {
      const j = JSON.parse(await fs.readFile(path.join(APP, 'history.json'), 'utf8'));
      latestD = j?.meta?.latestD || null;
      const t = Date.parse(j?.meta?.ts || '');
      if (isFinite(t)) ageH = Math.round((Date.now() - t) / 36e5);
    } catch {}
    return sendJson(res, 200, { ok: true, refreshing: !!refreshing, ageH, latestD });
  }

  // statika
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(APP, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(APP)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const buf = await fs.readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Length': buf.length,
    });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Rotacija — lokalni pregled: http://127.0.0.1:${PORT}`);
  console.log('Dugme „Osvježi podatke" ovde stvarno preuzima nove kotacije (~1 min).');
});
