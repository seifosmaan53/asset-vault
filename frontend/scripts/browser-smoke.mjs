#!/usr/bin/env node
// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// Opens the served production build in headless Chromium and checks what a person would see
// on the routes that render WITHOUT a Clerk session (sign-in needs a real Clerk instance):
//   1. an unknown path renders the lazily loaded 404 page (the chunk loads and runs);
//   2. when that page's chunk cannot be downloaded, the route shows a recoverable error with a
//      Reload button instead of a blank page, and Reload recovers once the network is back.
//
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/browser-smoke.mjs http://localhost:4173
/* global process, console */

import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4173';
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : ` -> ${detail}`}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  const notFoundChunk = /\/assets\/NotFound-[^/]+\.js$/;

  await page.goto(`${base}/full-stack-missing-route`);
  const heading = page.getByText('Page Not Found');
  await heading.waitFor({ timeout: 15000 }).catch(() => {});
  check('unknown path renders the lazily loaded 404 page', await heading.isVisible(), await page.locator('#root').innerText());
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

  // Fresh context: no cached chunk. Abort the page's chunk.
  const context = await browser.newContext();
  const offline = await context.newPage();
  let aborted = 0;
  await offline.route(notFoundChunk, (route) => {
    aborted++;
    return route.abort('internetdisconnected');
  });
  await offline.goto(`${base}/full-stack-missing-route`);
  const alert = offline.getByRole('alert');
  await alert.waitFor({ timeout: 15000 }).catch(() => {});
  const alertText = (await alert.isVisible()) ? await alert.innerText() : await offline.locator('#root').innerText();
  check('a chunk that cannot be downloaded shows an error, not a blank page', /could not be loaded/.test(alertText), alertText);
  check('the page chunk was requested', aborted >= 1, `${aborted} request(s)`);

  await offline.unroute(notFoundChunk);
  const reload = offline.getByRole('button', { name: 'Reload' });
  check('a Reload button is offered', (await reload.count()) === 1);
  if ((await reload.count()) === 1) {
    await reload.click();
    const recovered = offline.getByText('Page Not Found');
    await recovered.waitFor({ timeout: 15000 }).catch(() => {});
    check('Reload recovers once the chunk is reachable again', await recovered.isVisible());
  }
  await context.close();
} finally {
  await browser.close();
}

console.log(`${failures.length} failure(s)`);
process.exit(failures.length ? 1 : 0);
