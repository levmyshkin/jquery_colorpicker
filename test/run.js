#!/usr/bin/env node
/*
 * Behavioural comparison between the original jQuery ColorPicker 1.0.2
 * (test/original/) and the dependency-free rewrite (js/colorpicker.js).
 *
 * Every case in test/cases.js is run with a real mouse and keyboard in Chrome
 * against each implementation; after every action the picker state (fields,
 * selector/hue positions, colors, visibility, position) and the callback log
 * are compared. API checks for the rewrite live in test/api-tests.js.
 *
 *   npm test                  # everything
 *   node test/run.js basic    # selected cases
 *
 * Env: CHROME_PATH (defaults to the installed Chrome).
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const modules = path.join(root, 'node_modules');
const vendor = {
  'jquery-1.js': path.join(root, 'js/jquery.js'),
  'jquery-3.js': path.join(modules, 'jquery3/dist/jquery.js'),
  'jquery-4.js': path.join(modules, 'jquery4/dist/jquery.js')
};
const types = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.gif': 'image/gif' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = null;
    if (url.startsWith('/vendor/')) { file = vendor[url.slice(8)]; }
    if (url.startsWith('/repo/')) { file = path.join(root, url.slice(6)); }
    if (url.startsWith('/images/')) { file = path.join(root, url.slice(1)); }
    if (!file || !file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function act(page, a) {
  if (a.click) {
    await page.click(a.click);
  } else if (a.outside) {
    await page.mouse.click(3, 3);
  } else if (a.scroll !== undefined) {
    await page.evaluate((y) => window.scrollTo(0, y), a.scroll);
  } else if (a.js) {
    await page.evaluate((code) => { (0, eval)(code); }, a.js);
  } else if (a.call) {
    await page.evaluate((x) => T.call(x), a);
  } else if (a.drag) {
    const p = await page.evaluate((x) => T.point(x), a);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(p.x + (a.to[0] - a.from[0]) * i / steps, p.y + (a.to[1] - a.from[1]) * i / steps);
    }
    await page.mouse.up();
  } else if (a.part || a.hover) {
    const p = await page.evaluate((x) => T.point(x), a);
    if (a.hover) { await page.mouse.move(p.x, p.y); } else { await page.mouse.click(p.x, p.y); }
  } else if (a.type !== undefined) {
    const p = await page.evaluate((x) => T.point(Object.assign({}, x, { part: 'field:' + x.type })), a);
    await page.mouse.click(p.x, p.y);
    await page.keyboard.press('Control+A');
    await page.keyboard.type(a.text);
    if (a.key) { await page.keyboard.press(a.key); }
  } else if (a.key) {
    await page.keyboard.press(a.key);
  }
}

async function runCase(browser, base, config, name) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/repo/test/harness.html?impl=${config.impl}&jq=${config.jq}`);
  await page.waitForFunction(() => window.READY || window.LOAD_ERROR);
  const loadError = await page.evaluate(() => window.LOAD_ERROR);
  if (loadError) { throw new Error('failed to load ' + loadError); }
  const actions = await page.evaluate((n) => T.setup(n), name);
  await sleep(50);
  const snaps = [await page.evaluate(() => T.snap())];
  for (const a of actions) {
    await act(page, a);
    await sleep(a.wait || 60);
    snaps.push(await page.evaluate(() => T.snap()));
  }
  const probes = await page.evaluate(() => T.probes);
  await context.close();
  return { snaps, probes, errors };
}

function diff(a, b, where, out) {
  if (out.length > 12) { return out; }
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b)) {
    out.push(`${where}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  } else if (a && typeof a === 'object') {
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach((k) => diff(a[k], b[k], `${where}.${k}`, out));
  } else if (a !== b) {
    out.push(`${where}:\n      original: ${a}\n      rewrite:  ${b}`);
  }
  return out;
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    channel: process.env.CHROME_PATH ? undefined : 'chrome'
  });

  const page = await browser.newPage();
  await page.goto(`${base}/repo/test/harness.html?impl=vanilla&jq=none`);
  await page.waitForFunction(() => window.READY);
  const meta = await page.evaluate(() => {
    const out = {};
    Object.keys(T.cases).forEach((k) => { out[k] = { jqOnly: !!T.cases[k].jqOnly, skipJq: T.cases[k].skipJq || [] }; });
    return out;
  });
  await page.close();

  const args = process.argv.slice(2);
  const names = args.length ? args : Object.keys(meta);
  let failures = 0;

  for (const name of names) {
    const pairs = ['1', '3', '4'].filter((jq) => !meta[name].skipJq.includes(jq)).map((jq) => [{ impl: 'original', jq }, { impl: 'vanilla', jq }]);
    if (!meta[name].jqOnly) { pairs.push([{ impl: 'original', jq: '3' }, { impl: 'vanilla', jq: 'none' }]); }
    const results = await Promise.all(pairs.map(async ([ref, test]) => {
      const safe = (c) => runCase(browser, base, c, name).catch((e) => ({ snaps: [], probes: [], errors: ['runner: ' + e.message.split(/\r?\n/)[0]] }));
      const [a, b] = await Promise.all([safe(ref), safe(test)]);
      const problems = [];
      if (a.errors.length) { problems.push('original page errors: ' + a.errors.join('; ')); }
      if (b.errors.length) { problems.push('rewrite page errors: ' + b.errors.join('; ')); }
      diff(a.snaps, b.snaps, 'step', problems);
      if (test.jq !== 'none') { diff(a.probes, b.probes, 'callbackThis', problems); }
      return { label: `jq ${ref.jq} vs rewrite/jq ${test.jq}`, problems };
    }));
    for (const r of results) {
      if (r.problems.length) { failures++; }
      console.log(`${r.problems.length ? 'FAIL' : 'ok  '} ${name} [${r.label}]`);
      r.problems.forEach((p) => console.log('    ' + p));
    }
  }

  // Rewrite-only API checks, with and without jQuery.
  for (const jq of args.length && !process.env.API ? [] : ['none', '3', '1']) {
    const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
    const p = await context.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`${base}/repo/test/harness.html?impl=vanilla&jq=${jq}`);
    await p.waitForFunction(() => window.READY);
    for (const t of await p.evaluate(() => Object.keys(window.API_TESTS))) {
      errors.length = 0;
      const res = await p.evaluate(async (n) => {
        try { await window.API_TESTS[n](); return null; } catch (e) { return e.message; }
      }, t);
      const problem = res || (errors.length ? 'page errors: ' + errors.join('; ') : null);
      if (problem) { failures++; }
      console.log(`${problem ? 'FAIL' : 'ok  '} api: ${t} [jq ${jq}]`);
      if (problem) { console.log('    ' + problem); }
    }
    await context.close();
  }

  await browser.close();
  server.close();
  console.log(failures ? `\n${failures} failing check(s)` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
