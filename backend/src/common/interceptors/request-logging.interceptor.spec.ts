import { redactSensitive } from './request-logging.interceptor';

// Regression: redaction matched exact key names only, so smtpPassword (and currentPassword,
// clientSecret, nested credentials) reached the debug log, which Nest enables by default.
describe('redactSensitive', () => {
  it('redacts every spelling of a credential key, at any depth', () => {
    const out = JSON.stringify(
      redactSensitive({
        smtpHost: 'mail.example.test',
        smtpUser: 'alice',
        smtpPassword: 'p1',
        currentPassword: 'p2',
        newPassword: 'p3',
        PASSWORD: 'p4',
        smtpPass: 'p5',
        clientSecret: 's1',
        refreshToken: 't1',
        Authorization: 'Bearer t2',
        apiKey: 'k1',
        privateKey: 'k2',
        nested: {
          credentials: { user: 'x', pass: 'p6' },
          list: [{ token: 't3' }],
        },
      }),
    );
    for (const secret of [
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
      'p6',
      's1',
      't1',
      't2',
      't3',
      'k1',
      'k2',
    ]) {
      expect([secret, out.includes(`"${secret}"`)]).toEqual([secret, false]);
    }
    expect(out).toContain('"smtpHost":"mail.example.test"');
    expect(out).toContain('"smtpUser":"alice"');
  });

  it('leaves primitives and ordinary fields untouched', () => {
    expect(redactSensitive('text')).toBe('text');
    expect(redactSensitive(null)).toBeNull();
    expect(
      redactSensitive({ name: 'Item', quantity: 2, keyword: 'x' }),
    ).toEqual({
      name: 'Item',
      quantity: 2,
      keyword: 'x',
    });
  });

  it('bounds the depth of what it copies', () => {
    let deep: Record<string, unknown> = { password: 'leaf' };
    for (let i = 0; i < 10; i += 1) deep = { child: deep };
    expect(JSON.stringify(redactSensitive(deep))).not.toContain('leaf');
  });
});
