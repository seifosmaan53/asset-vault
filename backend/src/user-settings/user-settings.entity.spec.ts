import { getMetadataArgsStorage } from 'typeorm';
import { UserSettings } from './entities/user-settings.entity';

/* These assert a security property of the schema rather than a behaviour of a service,
   which is deliberate: the risk with a stored secret is not one endpoint leaking it, it
   is the NEXT endpoint someone writes returning the entity directly. `select: false`
   makes not-loading the default, so a leak requires someone to opt in by name.

   Reading TypeORM's metadata storage keeps this a fast unit test with no database.

   Note this is about exposure only. Where those secrets come from and whether they are
   recoverable is a separate question, and the SMTP password is currently bcrypt-hashed
   (one-way), which is its own problem recorded outside this file. */

const columnsFor = (target: unknown) =>
  getMetadataArgsStorage().columns.filter((c) => c.target === target);

const optionsFor = (property: string) =>
  columnsFor(UserSettings).find((c) => c.propertyName === property)?.options;

describe('UserSettings entity', () => {
  it('registers its columns with TypeORM', () => {
    expect(columnsFor(UserSettings).length).toBeGreaterThan(0);
  });

  describe('secrets are not loaded by default', () => {
    it.each(['smtpPassword', 'twoFactorSecret'])(
      '%s is declared select: false',
      (property) => {
        const options = optionsFor(property);
        expect(options).toBeDefined();
        expect(options?.select).toBe(false);
      },
    );
  });

  it('does not mark ordinary settings as select: false', () => {
    // Guards against someone "fixing" a future test by making the whole entity opt-in,
    // which would quietly stop normal settings from loading.
    expect(optionsFor('companyName')?.select).not.toBe(false);
    expect(optionsFor('smtpUser')?.select).not.toBe(false);
  });

  it('keeps every column that is select: false accounted for', () => {
    // If a new secret is added, it should be a deliberate decision to list it here
    // rather than something that slipped in unreviewed.
    const hidden = columnsFor(UserSettings)
      .filter((c) => c.options?.select === false)
      .map((c) => c.propertyName)
      .sort();

    expect(hidden).toEqual(['smtpPassword', 'twoFactorSecret']);
  });
});
