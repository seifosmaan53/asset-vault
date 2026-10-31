#!/usr/bin/env node
// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// Checks, over HTTP against a served production build, that every route in src/App.tsx
// has its own lazily loaded chunk and that the chunk and everything it imports is served.
//
//   vite build --manifest && vite preview --port 4173 &
//   node scripts/verify-route-chunks.mjs http://localhost:4173 dist
//
// For each <Route> whose element is a <RoutePage><Page /></RoutePage>:
//   - GET the route path itself: the SPA fallback must answer 200 with index.html;
//   - look up the page's source module in dist/.vite/manifest.json; it must be a dynamic
//     import of the entry (a separate chunk), not part of what index.html loads up front;
//   - GET that chunk and, transitively, the chunks and stylesheets it imports.
// It also checks that the entry and its preloads are served. Exit code 1 on any failure.

/* global process, console, fetch */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [base = 'http://localhost:4173', distArg = 'dist'] = process.argv.slice(2);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, distArg);
const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'));
const appSource = readFileSync(join(root, 'src', 'App.tsx'), 'utf8');

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`  FAIL ${msg}`);
};

// Page component name -> source module, from `const X = lazyPage(() => import('./pages/...'))`.
const pageModules = new Map();
for (const m of appSource.matchAll(/const (\w+) = lazyPage\(\(\) => import\('\.\/([^']+)'\)\)/g)) {
  pageModules.set(m[1], `src/${m[2]}.tsx`);
}

// Route path -> page component, one <Route ...> segment at a time.
const routes = [];
for (const segment of appSource.split(/<Route(?=\s)/).slice(1)) {
  const path = segment.match(/^\s+path="([^"]+)"/)?.[1];
  const page = segment.match(/<RoutePage><(\w+) \/><\/RoutePage>/)?.[1];
  if (path && page) routes.push({ path, page });
}

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
if (!entryKey) throw new Error('no entry in the manifest; build with --manifest');
const entry = manifest[entryKey];

// Everything index.html loads before any route renders.
const initial = new Set();
(function collect(key) {
  if (initial.has(key)) return;
  initial.add(key);
  for (const dep of manifest[key].imports ?? []) collect(dep);
})(entryKey);

const fetched = new Map();
async function get(url, kind) {
  if (fetched.has(url)) return fetched.get(url);
  const result = (async () => {
    const res = await fetch(url);
    const type = res.headers.get('content-type') ?? '';
    const body = await res.text();
    const ok =
      res.status === 200 &&
      (kind === 'js' ? /javascript/.test(type) : kind === 'css' ? /text\/css/.test(type) : /text\/html/.test(type));
    if (!ok) fail(`${url} -> HTTP ${res.status} ${type}`);
    return { ok, body };
  })();
  fetched.set(url, result);
  return result;
}

async function getChunkTree(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  seen.add(key);
  const chunk = manifest[key];
  await get(`${base}/${chunk.file}`, 'js');
  for (const css of chunk.css ?? []) await get(`${base}/${css}`, 'css');
  for (const dep of chunk.imports ?? []) await getChunkTree(dep, seen);
  return seen;
}

const concrete = (path) =>
  path === '*'
    ? '/this-route-does-not-exist'
    : `/${path.replace(/^\//, '').replace(/\/\*$/, '').replace(/:\w+/g, '00000000-0000-4000-8000-000000000000')}`;

console.log(`entry ${entry.file}; ${initial.size} chunk(s) loaded up front`);
const index = await get(`${base}/`, 'html');
if (!index.body.includes(`/${entry.file}`)) fail('index.html does not reference the manifest entry');
for (const key of initial) await get(`${base}/${manifest[key].file}`, 'js');

if (routes.length < 20) fail(`only ${routes.length} routes parsed from App.tsx`);
for (const { path, page } of routes) {
  const source = pageModules.get(page);
  const chunk = source && manifest[source];
  if (!chunk) {
    fail(`${path}: no chunk for ${page} (${source ?? 'not lazily imported'})`);
    continue;
  }
  if (initial.has(source)) fail(`${path}: ${page} is loaded up front, not lazily`);
  if (!(entry.dynamicImports ?? []).includes(source)) fail(`${path}: ${page} is not a dynamic import of the entry`);

  const html = await get(`${base}${concrete(path)}`, 'html');
  if (html.ok && !html.body.includes('<div id="root">')) fail(`${path}: fallback is not index.html`);
  const tree = await getChunkTree(source);
  const lazyDeps = [...tree].filter((k) => !initial.has(k)).length;
  console.log(`  ok   ${path.padEnd(32)} ${chunk.file} (+${lazyDeps - 1} lazy dep chunk(s))`);
}

console.log(`${routes.length} routes, ${fetched.size} URLs fetched, ${failures.length} failure(s)`);
process.exit(failures.length ? 1 : 0);
