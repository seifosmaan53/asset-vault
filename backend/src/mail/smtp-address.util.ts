import { promises as dns } from 'dns';
import { BlockList, isIP } from 'net';

/**
 * Addresses a user-submitted SMTP test must never reach: the API host itself, its private
 * networks (Compose neighbours, cloud VPCs), link-local (cloud metadata), and other
 * non-routable ranges. The connection test is otherwise a way to probe internal ports and
 * read their banners.
 */
const NON_PUBLIC = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], // "this" network, incl. 0.0.0.0
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, incl. cloud metadata 169.254.169.254
  ['172.16.0.0', 12], // private (Docker bridge networks)
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, incl. broadcast
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, 'ipv6');
}

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** True only for a literal IP address outside every non-public range above. */
export function isPublicAddress(address: string): boolean {
  const mapped = IPV4_MAPPED.exec(address);
  if (mapped) return isPublicAddress(mapped[1]);
  const family = isIP(address);
  if (family === 4) return !NON_PUBLIC.check(address, 'ipv4');
  if (family === 6) return !NON_PUBLIC.check(address, 'ipv6');
  return false;
}

/** Every address a host name resolves to (or the literal itself); [] when it does not resolve. */
export async function resolveHostAddresses(host: string): Promise<string[]> {
  if (isIP(host)) return [host];
  try {
    const found = await dns.lookup(host, { all: true, verbatim: true });
    return found.map((entry) => entry.address);
  } catch {
    return [];
  }
}
