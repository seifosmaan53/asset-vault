#!/usr/bin/env node
// Copyright (c) 2025 Asset Vault. All rights reserved.
//
// Full-stack check, step 1 of 3: the throwaway identity material the API is started with.
//
//   node test/full-stack/prepare.cjs <dir>
//
// Writes into <dir>:
//   jwt-public.pem   -> given to the API as CLERK_JWT_KEY (the SDK's documented networkless mode),
//   jwt-private.pem  -> used by flow.cjs to sign RS256 session tokens the real verifyToken() checks,
//   attacker-private.pem -> a second key, for tokens that must be rejected,
//   clerk-directory.json -> the users the Clerk users.getUser() stand-in knows (see clerk-users-stub.cjs).
// The key pair is generated per run and never leaves the runner.

'use strict';

const { generateKeyPairSync } = require('node:crypto');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const dir = process.argv[2];
if (!dir) {
  console.error('usage: prepare.cjs <dir>');
  process.exit(2);
}
mkdirSync(dir, { recursive: true });

const pair = () =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
const instance = pair();
const attacker = pair();

writeFileSync(join(dir, 'jwt-public.pem'), instance.publicKey);
writeFileSync(join(dir, 'jwt-private.pem'), instance.privateKey, {
  mode: 0o600,
});
writeFileSync(join(dir, 'attacker-private.pem'), attacker.privateKey, {
  mode: 0o600,
});

// Synthetic users only (reserved .invalid domain). Shape = the fields the guard reads from Clerk's User.
const user = (id, email, extra = {}) => ({
  id,
  banned: false,
  emailAddresses: [{ id: `${id}_email`, emailAddress: email }],
  primaryEmailAddressId: `${id}_email`,
  firstName: 'Full',
  lastName: 'Stack',
  ...extra,
});
const directory = {
  user_fullstack_owner: user(
    'user_fullstack_owner',
    'owner@full-stack.invalid',
  ),
  user_fullstack_other: user(
    'user_fullstack_other',
    'other@full-stack.invalid',
  ),
  user_fullstack_banned: user(
    'user_fullstack_banned',
    'banned@full-stack.invalid',
    { banned: true },
  ),
};
writeFileSync(
  join(dir, 'clerk-directory.json'),
  JSON.stringify(directory, null, 2),
);
console.log(
  `wrote keys and ${Object.keys(directory).length} synthetic users to ${dir}`,
);
