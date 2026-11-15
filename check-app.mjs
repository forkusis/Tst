#!/usr/bin/env node
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const [html,css,core,app,catText,histText]=await Promise.all([
 fs.readFile('index.html','utf8'),fs.readFile('styles.css','utf8'),fs.readFile('core.js','utf8'),fs.readFile('app.js','utf8'),
 fs.readFile('tickers.json','utf8'),fs.readFile('history.json','utf8')
]);
const cat=JSON.parse(catText),hist=JSON.parse(histText);
for(const p of ['overview','context','rotation','strength','volume','correlations','lab','universe'])assert.ok(html.includes('data-page="'+p+'"'),'missing nav page '+p);
for(const id of ['app.js','core.js'])assert.ok(html.includes(id),'missing script '+id);
assert.ok(css.length>1000&&app.length>5000&&core.length>1000);
assert.equal(Object.keys(cat.tickers).length,59);
for(const g of cat.groups)for(const t of g.instruments)assert.ok(cat.tickers[t],'unknown group symbol '+t);
for(const t of Object.keys(cat.tickers))assert.ok(hist.tickers[t],'missing historical ticker '+t);
console.log('OK: 8 navigable modules, '+Object.keys(cat.tickers).length+' catalog symbols, '+Object.keys(hist.tickers).length+' history series.');
