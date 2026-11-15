#!/usr/bin/env node
/**
 * Builds a self-contained HTML shell with embedded catalog and historical data.
 * Chart.js remains loaded from its CDN for charts.
 * Usage: node build-standalone.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT=path.dirname(fileURLToPath(import.meta.url));
const [html,css,core,app,catalogText,historyText]=await Promise.all([
  fs.readFile(path.join(ROOT,'index.html'),'utf8'),
  fs.readFile(path.join(ROOT,'styles.css'),'utf8'),
  fs.readFile(path.join(ROOT,'core.js'),'utf8'),
  fs.readFile(path.join(ROOT,'app.js'),'utf8'),
  fs.readFile(path.join(ROOT,'tickers.json'),'utf8'),
  fs.readFile(path.join(ROOT,'history.json'),'utf8')
]);
const catalog=JSON.parse(catalogText),history=JSON.parse(historyText);
let out=html.replace('<link rel="stylesheet" href="./styles.css">','<style>\n'+css+'\n</style>');
const marker='<script src="./core.js"></script><script src="./app.js"></script>';
const embedded='<script>window.EMB_CATALOG='+JSON.stringify(catalog)+';window.EMB_HISTORY='+JSON.stringify(history)+'</script>\n<script>\n'+core+'\n</script>\n<script>\n'+app+'\n</script>';
if(!out.includes(marker))throw new Error('Application script insertion point not found');
out=out.replace(marker,embedded);
const stamp=(history.meta?.latestD||new Date().toISOString().slice(0,10)).replace(/-/g,'');
const dir=path.join(ROOT,'dist');await fs.mkdir(dir,{recursive:true});
const file=path.join(dir,'rotation-intelligence-'+stamp+'.html');
await fs.writeFile(file,out);
console.log(file+' · '+(Buffer.byteLength(out)/1048576).toFixed(2)+' MB · data through '+(history.meta?.latestD||'unknown'));
