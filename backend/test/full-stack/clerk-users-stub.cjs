// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// Full-stack check only: a stand-in for ONE Clerk network call, loaded with
//   NODE_OPTIONS="--require /path/to/clerk-users-stub.cjs"
// It is not part of the application, is not in the image, and does nothing unless preloaded.
//
// Why it exists: ClerkAuthGuard verifies the session token with the real @clerk/backend
// verifyToken() (networkless here, with CLERK_JWT_KEY), then re-checks the user with Clerk's
// Backend API: clerkClient.users.getUser(). The guard creates that client as
// createClerkClient({ secretKey }), and @clerk/backend 3.x does not read an API URL from the
// environment (its default is the constant https://api.clerk.com), so the call cannot be pointed
// at a local HTTP stub without changing application code. Without a Clerk instance it would
// fail, and every authenticated request with it.
//
// So this replaces just users.getUser() on the client createClerkClient() returns, reading users
// from FULL_STACK_CLERK_DIRECTORY (written by prepare.cjs). verifyToken() and everything else the
// module exports are the real SDK, untouched. Unknown ids are rejected the way Clerk rejects them
// (the call throws), so the guard's "user not found" path stays exercised.
//
// It refuses to load unless FULL_STACK_CLERK_STUB=1 and CLERK_SECRET_KEY is an sk_test_ key, so it
// cannot silently stand in for Clerk against a live instance.

'use strict';

const Module = require('node:module');
const { readFileSync } = require('node:fs');

if (process.env.FULL_STACK_CLERK_STUB !== '1') {
  throw new Error(
    'clerk-users-stub: refusing to load without FULL_STACK_CLERK_STUB=1',
  );
}
if (!/^sk_test_/.test(process.env.CLERK_SECRET_KEY || '')) {
  throw new Error(
    'clerk-users-stub: refusing to load with a non-test CLERK_SECRET_KEY',
  );
}
const directoryPath = process.env.FULL_STACK_CLERK_DIRECTORY;
if (!directoryPath)
  throw new Error('clerk-users-stub: FULL_STACK_CLERK_DIRECTORY is not set');

const lookups = { found: 0, missing: 0 };

async function getUser(userId) {
  // Read on every call, like the real API: a user removed from the directory stops working.
  const directory = JSON.parse(readFileSync(directoryPath, 'utf8'));
  const user = directory[userId];
  if (!user) {
    lookups.missing++;
    const error = new Error(`clerk-users-stub: no user ${userId}`);
    error.status = 404;
    throw error;
  }
  lookups.found++;
  return user;
}

const originalLoad = Module._load;
let patched;
Module._load = function load(request, parent, isMain) {
  const exported = originalLoad.call(this, request, parent, isMain);
  if (request !== '@clerk/backend') return exported;
  if (!patched) {
    // The SDK's exports are getter-only, so wrap rather than assign.
    patched = Object.create(null);
    for (const key of Object.keys(exported)) {
      if (key === 'createClerkClient') continue;
      Object.defineProperty(patched, key, {
        enumerable: true,
        get: () => exported[key],
      });
    }
    Object.defineProperty(patched, 'createClerkClient', {
      enumerable: true,
      value: (options) => {
        const client = exported.createClerkClient(options);
        // Only users.getUser is replaced; the rest of client.users and the client stay real.
        const users = Object.create(client.users, {
          getUser: { value: getUser },
        });
        return new Proxy(client, {
          get: (target, prop, receiver) =>
            prop === 'users' ? users : Reflect.get(target, prop, receiver),
        });
      },
    });
    process.stderr.write(
      '[clerk-users-stub] users.getUser() is served from ' +
        directoryPath +
        '\n',
    );
    process.on('exit', () =>
      process.stderr.write(
        `[clerk-users-stub] lookups: ${lookups.found} found, ${lookups.missing} missing\n`,
      ),
    );
  }
  return patched;
};
