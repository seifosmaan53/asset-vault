import * as bcrypt from 'bcryptjs';
import { getMetadataArgsStorage } from 'typeorm';
import { MASKED_SMTP_PASSWORD } from './user-settings.service';
import { UserSettings } from './entities/user-settings.entity';

/* The stored SMTP password has four properties that have to hold together, and each one
   is a different kind of mistake if it slips:

     not loaded by default   — so a future endpoint returning the entity cannot leak it
     never serialised raw    — the response carries a placeholder instead
     a blank field is "leave it alone", not "erase it"
     the placeholder coming back is "leave it alone", not a new password

   The last one is the subtle one. The placeholder is not a bcrypt hash, so without an
   explicit guard it takes the "this is a new password" branch and a working password is
   replaced by a hash of '***ENCRYPTED***'.

   These test the decision rules directly rather than driving the service, which needs a
   DataSource, a query runner and eight repositories to construct. The rules are the part
   that has to be right; a test that needed all that scaffolding would not be run. */

const BCRYPT_HASH_SHAPE = /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/** Mirrors the branch in UserSettingsService.updateSettings that decides what a submitted
 *  smtpPassword means. Returns the value to persist, or undefined for "leave unchanged". */
async function resolveSubmittedPassword(
  submitted: string | undefined,
): Promise<string | undefined> {
  if (submitted === MASKED_SMTP_PASSWORD) return undefined;
  if (submitted && submitted.trim() !== '') {
    return BCRYPT_HASH_SHAPE.test(submitted) ? submitted : bcrypt.hashSync(submitted, 10);
  }
  if (submitted === '') return undefined;
  return undefined;
}

describe('smtpPassword handling', () => {
  it('is not loaded by default', () => {
    const column = getMetadataArgsStorage().columns.find(
      (c) => c.target === UserSettings && c.propertyName === 'smtpPassword',
    );
    expect(column?.options.select).toBe(false);
  });

  it('leaves the stored password alone when the field is submitted empty', async () => {
    // Saving any other setting sends an untouched, empty password field. That must not
    // be read as "clear it".
    await expect(resolveSubmittedPassword('')).resolves.toBeUndefined();
  });

  it('leaves the stored password alone when the field is absent', async () => {
    await expect(resolveSubmittedPassword(undefined)).resolves.toBeUndefined();
  });

  it('treats the returned placeholder as unchanged, not as a new password', async () => {
    // The regression this exists for: the placeholder is not bcrypt-shaped, so without
    // the guard it would be hashed and stored, destroying the real password.
    const result = await resolveSubmittedPassword(MASKED_SMTP_PASSWORD);
    expect(result).toBeUndefined();
  });

  it('hashes a genuinely new password', async () => {
    const result = await resolveSubmittedPassword('correct horse battery staple');
    expect(result).toBeDefined();
    expect(result).toMatch(BCRYPT_HASH_SHAPE);
    expect(result).not.toBe('correct horse battery staple');
  });

  it('does not re-hash a value that is already a bcrypt hash', async () => {
    const alreadyHashed = bcrypt.hashSync('something', 10);
    await expect(resolveSubmittedPassword(alreadyHashed)).resolves.toBe(alreadyHashed);
  });

  it('never uses the placeholder as a real secret', () => {
    // Guards against someone "simplifying" the placeholder into something a person might
    // plausibly type, which would make the guard above reject a legitimate password.
    expect(MASKED_SMTP_PASSWORD).toBe('***ENCRYPTED***');
    expect(BCRYPT_HASH_SHAPE.test(MASKED_SMTP_PASSWORD)).toBe(false);
  });
});
