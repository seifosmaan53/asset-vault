// Copyright (c) 2025 Asset Vault. All rights reserved.

/**
 * Entry point for the one-off CLI scripts in this directory (`npm run <script>`).
 *
 * Each script's main function already catches its own errors and exits. Anything that
 * still escapes (for example a failure inside a `finally`) used to become an unhandled
 * rejection, which Node reports and turns into exit code 1; this keeps that outcome
 * but makes the handling explicit.
 */
export function runScript(main: () => Promise<unknown>): void {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
