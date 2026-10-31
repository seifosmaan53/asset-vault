import { isPublicAddress, resolveHostAddresses } from './smtp-address.util';

describe('isPublicAddress', () => {
  it.each([
    '0.0.0.0',
    '10.0.0.5',
    '100.64.0.1',
    '127.0.0.1',
    '127.255.255.254',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    '::ffff:10.1.2.3',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'ff02::1',
    'not-an-ip',
  ])('refuses %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each([
    '8.8.8.8',
    '172.32.0.1',
    '93.184.216.34',
    '2606:4700::1111',
    '::ffff:8.8.8.8',
  ])('allows %s', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });
});

describe('resolveHostAddresses', () => {
  it('returns a literal address unchanged', async () => {
    await expect(resolveHostAddresses('10.0.0.5')).resolves.toEqual([
      '10.0.0.5',
    ]);
  });

  it('resolves shorthand IPv4 such as 127.1 to the loopback address it means', async () => {
    await expect(resolveHostAddresses('127.1')).resolves.toEqual(['127.0.0.1']);
  });

  it('returns no addresses for a name that does not resolve', async () => {
    await expect(resolveHostAddresses('no-such-host.invalid')).resolves.toEqual(
      [],
    );
  });
});
