import { BadRequestException } from '@nestjs/common';
import {
  validateEmail,
  validatePhone,
  validateString,
  validateUUID,
  validateUUIDV4,
} from './edge-case-protection.util';
import { validateCurrencyCode } from '../../invoices/utils/currency.util';

/** Run fn and return the BadRequestException it throws (fails the test if it does not). */
function badRequest(fn: () => unknown): BadRequestException {
  try {
    fn();
  } catch (e) {
    if (e instanceof BadRequestException) return e;
    throw e;
  }
  throw new Error('expected a BadRequestException');
}

describe('validateString', () => {
  describe('accepted primitives (unchanged behaviour)', () => {
    it('returns a string, trimmed by default', () => {
      expect(validateString('  hello  ', 'name')).toBe('hello');
      expect(validateString('  hi ', 'name', { trim: false })).toBe('  hi ');
    });

    it('converts numbers with String()', () => {
      expect(validateString(5, 'qty')).toBe('5');
      expect(validateString(0, 'qty')).toBe('0');
      expect(validateString(-1.5, 'qty')).toBe('-1.5');
    });

    it('converts booleans with String()', () => {
      expect(validateString(true, 'flag')).toBe('true');
      expect(validateString(false, 'flag')).toBe('false');
    });

    it('converts bigints with String()', () => {
      expect(validateString(BigInt(42), 'big')).toBe('42');
    });

    it('treats null/undefined as missing: error when required, empty string otherwise', () => {
      expect(badRequest(() => validateString(null, 'name')).message).toBe(
        'name is required',
      );
      expect(badRequest(() => validateString(undefined, 'name')).message).toBe(
        'name is required',
      );
      expect(validateString(null, 'name', { required: false })).toBe('');
      expect(validateString(undefined, 'name', { required: false })).toBe('');
    });

    it('keeps the empty, length and pattern rules', () => {
      expect(badRequest(() => validateString('   ', 'name')).message).toBe(
        'name cannot be empty',
      );
      expect(validateString('', 'name', { required: false })).toBe('');
      expect(validateString('', 'name', { allowEmpty: true })).toBe('');
      expect(
        badRequest(() => validateString('ab', 'code', { minLength: 3 }))
          .message,
      ).toBe('code must be at least 3 characters long');
      expect(
        badRequest(() => validateString('abcd', 'code', { maxLength: 3 }))
          .message,
      ).toBe('code must be at most 3 characters long');
      expect(
        badRequest(() => validateString('ab1', 'code', { pattern: /^[a-z]+$/ }))
          .message,
      ).toBe('code has invalid format');
    });
  });

  describe('objects and arrays are rejected, not stringified', () => {
    const cases: [string, unknown][] = [
      ['empty object {}', {}],
      ['object with a toString-able value', { a: 1 }],
      ['empty array []', []],
      ['array of strings', ['a', 'b']],
      ['single-element array (would stringify to its element)', ['USD']],
      ['nested object', { a: { b: ['c'] } }],
      // What Express's extended query parser produces for `?q[a]=1` and `?q[]=1&q[]=2`.
      ['query-style object q[a]=1', { a: '1' }],
      ['query-style array q[]=1&q[]=2', ['1', '2']],
      ['Date', new Date('2026-01-01T00:00:00Z')],
      ['object with its own toString', { toString: () => 'looks fine' }],
      ['function', () => 'x'],
      ['symbol', Symbol('s')],
    ];

    it.each(cases)('%s -> 400 "must be a string"', (_label, value) => {
      const err = badRequest(() => validateString(value, 'field'));
      expect(err.getStatus()).toBe(400);
      expect(err.message).toBe('field must be a string');
    });

    it.each(cases)(
      '%s is rejected even when the field is optional',
      (_label, value) => {
        expect(
          badRequest(() => validateString(value, 'field', { required: false }))
            .message,
        ).toBe('field must be a string');
      },
    );
  });

  describe('callers', () => {
    it('validateCurrencyCode accepts a code and rejects arrays/objects that would stringify to one', () => {
      expect(validateCurrencyCode('USD')).toBe('USD');
      expect(badRequest(() => validateCurrencyCode(['USD'])).message).toBe(
        'currency must be a string',
      );
      expect(
        badRequest(() => validateCurrencyCode({ toString: () => 'USD' }))
          .message,
      ).toBe('currency must be a string');
    });

    it('validateEmail and validatePhone reject objects', () => {
      expect(validateEmail('a@b.co', 'email')).toBe('a@b.co');
      expect(badRequest(() => validateEmail(['a@b.co'], 'email')).message).toBe(
        'email must be a string',
      );
      expect(validatePhone('+1 555 123 4567', 'phone')).toBe('+1 555 123 4567');
      expect(badRequest(() => validatePhone({ n: 1 }, 'phone')).message).toBe(
        'phone must be a string',
      );
    });
  });
});

describe('validateUUID / validateUUIDV4', () => {
  const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  it('accept a UUID string (trimmed)', () => {
    expect(validateUUID(` ${uuid} `, 'id')).toBe(uuid);
    expect(validateUUIDV4(uuid, 'id')).toBe(uuid);
  });

  it('reject arrays and objects that would stringify to a UUID', () => {
    for (const value of [[uuid], { toString: () => uuid }]) {
      expect(badRequest(() => validateUUID(value, 'id')).message).toBe(
        'id must be a valid UUID',
      );
      expect(badRequest(() => validateUUIDV4(value, 'id')).message).toBe(
        'id must be a valid UUID v4',
      );
    }
  });

  it('keep the missing-value rules', () => {
    expect(badRequest(() => validateUUID(undefined, 'id')).message).toBe(
      'id is required',
    );
    expect(validateUUID(null, 'id', false)).toBe('');
  });
});
