// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// Container health probe: `node dist/server/healthcheck.js` (docker-compose.yml, release.sh).
// Exit 0 when GET /api/v1/health on this container answers 200 {"status":"ok"} (the route
// queries PostgreSQL; the body is printed), 1 otherwise.
//
// The probe connects over loopback and says X-Forwarded-Proto: https, standing in for the TLS
// proxy. In production the API believes that header only from a trusted peer, so TRUST_PROXY
// must trust loopback: a hop count (TRUST_PROXY=1, as in docker-compose.yml) or a list that
// includes `loopback`. Otherwise the API answers 301 and the probe says so.

const port = Number(process.env.PORT || 3000);
const url = `http://127.0.0.1:${port}/api/v1/health`;

async function probe(): Promise<number> {
  const res = await fetch(url, {
    headers: { 'x-forwarded-proto': 'https' },
    redirect: 'manual',
    signal: AbortSignal.timeout(4000),
  });
  if (res.status === 301) {
    console.error(
      `healthcheck: ${url} redirected to ${res.headers.get('location')}: TRUST_PROXY does not trust loopback`,
    );
    return 1;
  }
  const body: unknown = await res.json().catch(() => null);
  const ok =
    res.status === 200 &&
    typeof body === 'object' &&
    body !== null &&
    'status' in body &&
    body.status === 'ok';
  if (ok) console.log(JSON.stringify(body));
  else console.error(`healthcheck: ${url} answered ${res.status}`);
  return ok ? 0 : 1;
}

probe().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(
      `healthcheck: ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  },
);
