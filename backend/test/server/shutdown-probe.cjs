#!/usr/bin/env node
/*
 * Graceful-shutdown probe. Holds a real request in flight across a SIGTERM and reports what the
 * API did. Used by the CI job `api-shutdown` against the production image, and runnable against
 * a local `node dist/main`.
 *
 *   PORT=3000 STOP_CMD='docker stop -t 30 av-api' node test/server/shutdown-probe.cjs [complete|hang]
 *
 * The in-flight request is GET /api/v1/health (public; it queries PostgreSQL) with a JSON body
 * that is sent in two halves: Express's body parser holds the request open until the second half
 * arrives, so the request is genuinely in flight when the signal lands, and its handler only runs
 * (and touches the database pool) AFTER the signal.
 *
 * complete: send half the body, run STOP_CMD, wait until new connections are refused, hold the
 *           request HOLD_MS longer, send the rest, and require a complete 200 {"status":"ok"}.
 * hang:     never send the rest; the API must give up at its bound and close the connection.
 *
 * Prints one line `SHUTDOWN_PROBE {json}` and exits non-zero when an expectation fails. The
 * caller checks the process exit code (docker inspect) and compares stopMs with the bound.
 */
'use strict';
const net = require('node:net');
const { spawn } = require('node:child_process');

const mode = process.argv[2] || 'complete';
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const stopCmd = process.env.STOP_CMD;
const holdMs = Number(process.env.HOLD_MS || 2000);
if (!stopCmd) {
  console.error('STOP_CMD is required');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

function tryConnect() {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    s.once('connect', () => {
      s.destroy();
      resolve('accepted');
    });
    s.once('error', (e) => resolve(e.code || String(e)));
  });
}

async function main() {
  const body = JSON.stringify({ probe: 'x'.repeat(64) });
  const half = Math.floor(body.length / 2);
  const sock = net.connect({ host, port });
  await new Promise((resolve, reject) => {
    sock.once('connect', resolve);
    sock.once('error', reject);
  });
  let raw = '';
  let closedAt = null;
  sock.on('data', (d) => (raw += d.toString('utf8')));
  sock.on('error', () => {});
  sock.on('close', () => (closedAt = now()));
  sock.write(
    'GET /api/v1/health HTTP/1.1\r\n' +
      `Host: ${host}:${port}\r\n` +
      'X-Forwarded-Proto: https\r\n' +
      'Content-Type: application/json\r\n' +
      `Content-Length: ${Buffer.byteLength(body)}\r\n` +
      'Connection: keep-alive\r\n\r\n' +
      body.slice(0, half),
  );
  await sleep(300);
  if (raw !== '') throw new Error(`the API answered before the body was complete: ${raw}`);

  const t0 = now();
  const stop = spawn('sh', ['-c', stopCmd], { stdio: ['ignore', 'inherit', 'inherit'] });
  const stopped = new Promise((resolve) => stop.on('exit', (code) => resolve({ code, at: now() })));

  // New connections must be refused once the signal has been handled.
  let refusedAt = null;
  let lastConnect = '';
  while (now() - t0 < 5000) {
    lastConnect = await tryConnect();
    if (lastConnect !== 'accepted') {
      refusedAt = now();
      break;
    }
    await sleep(50);
  }

  const result = { mode, refused: lastConnect, refusedAfterMs: refusedAt && refusedAt - t0 };
  const failures = [];
  if (refusedAt === null) failures.push('new connections were still accepted 5 s after the stop signal');
  else if (!/ECONNREFUSED|ECONNRESET/.test(lastConnect)) failures.push(`unexpected connect result ${lastConnect}`);

  if (mode === 'complete') {
    await sleep(holdMs);
    result.inFlightAtMs = now() - t0;
    if (closedAt !== null) failures.push('the in-flight connection was closed before its request finished');
    sock.write(body.slice(half));
    const deadline = now() + 10000;
    while (now() < deadline && !/\r\n\r\n[\s\S]*"status":"ok"/.test(raw) && closedAt === null) await sleep(20);
    await sleep(100);
    const statusLine = raw.split('\r\n')[0];
    result.response = statusLine;
    result.responseBodyOk = /"status":"ok"/.test(raw);
    if (statusLine !== 'HTTP/1.1 200 OK') failures.push(`in-flight request got "${statusLine}"`);
    if (!result.responseBodyOk) failures.push('in-flight response body is not {"status":"ok",...}');
  }

  const { code, at } = await stopped;
  result.stopCommandExit = code;
  result.stopMs = at - t0;
  if (mode === 'hang') {
    result.connectionClosedByServer = closedAt !== null;
    result.response = raw.split('\r\n')[0] || '(none)';
    if (closedAt === null) failures.push('the hung connection was not closed by the server');
  }
  sock.destroy();
  result.failures = failures;
  console.log(`SHUTDOWN_PROBE ${JSON.stringify(result)}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
