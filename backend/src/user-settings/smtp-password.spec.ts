import { getMetadataArgsStorage } from 'typeorm';
import { MASKED_SMTP_PASSWORD } from './user-settings.service';
import { UserSettings } from './entities/user-settings.entity';
import { MailService } from '../mail/mail.service';
import { UserSettingsService } from './user-settings.service';
import * as fs from 'fs';
import * as path from 'path';

/* Per-account SMTP is not connected to anything, and these tests are what stops that from
   quietly becoming untrue again.

   MailService authenticates with SMTP_PASS from the environment; the stored smtpPassword
   column has no consumer. So the settings endpoint drops a submitted password instead of
   storing a secret nobody can use — and because that is an unusual thing for an endpoint
   to do, it is worth pinning rather than leaving to a comment.

   The environment-based path is deliberately untouched: these assert the stored column is
   unused, NOT that email is broken. */

const read = (p: string) => fs.readFileSync(path.join(__dirname, p), 'utf8');

describe('stored SMTP password', () => {
  describe('is not exposed', () => {
    it('is not loaded by default', () => {
      const column = getMetadataArgsStorage().columns.find(
        (c) => c.target === UserSettings && c.propertyName === 'smtpPassword',
      );
      expect(column?.options.select).toBe(false);
    });

    it('is replaced by a placeholder in responses, never returned raw', () => {
      const service = read('user-settings.service.ts');
      expect(service).toContain('smtpPassword: settings.smtpPassword ? MASKED_SMTP_PASSWORD');
      // The placeholder must not look like something a person would type as a password.
      expect(MASKED_SMTP_PASSWORD).toBe('***ENCRYPTED***');
    });

    it('is never written to a log line', () => {
      const service = read('user-settings.service.ts');
      const logsWithPassword = service
        .split('\n')
        .filter((l) => /logger\.(log|warn|error|debug)/.test(l) && /smtpPassword/.test(l));
      expect(logsWithPassword).toEqual([]);
    });
  });

  describe('is not accepted while the feature is inactive', () => {
    it('drops a submitted password before it can be persisted', () => {
      const service = read('user-settings.service.ts');
      expect(service).toContain('delete sanitizedData.smtpPassword;');
    });

    it('no longer hashes anything, since nothing is stored', () => {
      // bcrypt produced a one-way value that could never authenticate to a mail server.
      // Its removal is the point, so a reintroduced hash call should fail here.
      const service = read('user-settings.service.ts');
      expect(service).not.toMatch(/bcrypt\.hash\s*\(/);
    });
  });

  describe('environment-based email is untouched', () => {
    it('MailService still reads its credentials from the environment', () => {
      const mail = fs.readFileSync(
        path.join(__dirname, '..', 'mail', 'mail.service.ts'),
        'utf8',
      );
      expect(mail).toContain("this.configService.get('SMTP_PASS')");
      expect(MailService).toBeDefined();
    });

    it('MailService does not read the stored settings column', () => {
      const mail = fs.readFileSync(
        path.join(__dirname, '..', 'mail', 'mail.service.ts'),
        'utf8',
      );
      // If this ever changes, the drop rule above becomes a bug rather than a safeguard,
      // and the credential needs real encryption before it can be stored again.
      expect(mail).not.toMatch(/smtpPassword/);
    });
  });

  it('still exports the service it is describing', () => {
    expect(UserSettingsService).toBeDefined();
  });
});
