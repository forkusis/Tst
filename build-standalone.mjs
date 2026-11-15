#!/usr/bin/env node
/**
 * Pravi JEDAN samostalan HTML fajl: aplikacija + sveži podaci unutra.
 * Radi bez servera i bez interneta — otvoriš fajl i sve je tu.
 *
 *   node scripts/build-standalone.mjs
 *   → dist/rotacija-<datum>.html
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await fs.readFile(path.join(ROOT, 'app', 'index.html'), 'utf8');
const data = JSON.parse(await fs.readFile(path.join(ROOT, 'app', 'history.json'), 'utf8'));

const stamp = (data.meta?.latestD || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
const outDir = path.join(ROOT, 'dist');
const outFile = path.join(outDir, `rotacija-${stamp}.html`);

const marker = "<script>\n'use strict';";
if (!html.includes(marker)) throw new Error('ne nalazim glavnu skriptu u app/index.html');

const injected =
  '<script>window.EMB_H=' +
  JSON.stringify(data) +
  ';</script>\n' +
  marker;

let out = html.replace(marker, injected);
out = out.replace(
  '<div class="sub" id="metaLine">DATA: čekam history.json</div>',
  '<div class="sub" id="metaLine">DATA: ugrađeno</div>'
);

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(outFile, out);
const mb = (Buffer.byteLength(out) / 1048576).toFixed(2);
console.log(`${outFile}  ${mb} MB  (podaci do ${data.meta?.latestD})`);
