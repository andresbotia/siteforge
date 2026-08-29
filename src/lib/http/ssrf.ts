export type DnsLookup = (hostname: string) => Promise<string[]>;

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
]);

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan"];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

function inRange(ip: number, start: string, prefix: number): boolean {
  const base = ipv4ToInt(start);
  if (base === null) return false;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ip & mask) === (base & mask);
}

export function isPrivateOrLocalIp(ip: string): boolean {
  const trimmed = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (trimmed === "::1" || trimmed === "0:0:0:0:0:0:0:1") return true;
  if (trimmed.startsWith("fe80:") || trimmed.startsWith("fc") || trimmed.startsWith("fd")) {
    return true;
  }
  const v4mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const v4 = v4mapped ? v4mapped[1] : trimmed;
  const n = ipv4ToInt(v4);
  if (n === null) {
    return trimmed.includes(":");
  }
  return (
    inRange(n, "0.0.0.0", 8) ||
    inRange(n, "10.0.0.0", 8) ||
    inRange(n, "127.0.0.0", 8) ||
    inRange(n, "169.254.0.0", 16) ||
    inRange(n, "172.16.0.0", 12) ||
    inRange(n, "192.168.0.0", 16) ||
    inRange(n, "100.64.0.0", 10) ||
    inRange(n, "224.0.0.0", 4)
  );
}

export function parseHttpUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("invalid_url");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("non_http_scheme");
  }
  if (parsed.username || parsed.password) {
    throw new Error("userinfo_blocked");
  }
  return parsed;
}

export async function assertSafeHttpUrl(
  raw: string,
  lookup?: DnsLookup,
): Promise<URL> {
  const url = parseHttpUrl(raw);
  const host = url.hostname.toLowerCase();
  if (!host) throw new Error("missing_hostname");
  if (BLOCKED_HOSTS.has(host)) throw new Error("blocked_hostname");
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new Error("blocked_hostname");
  }
  if (host === "169.254.169.254") throw new Error("blocked_metadata");

  if (isPrivateOrLocalIp(host)) {
    throw new Error("blocked_private_ip");
  }

  if (lookup && !ipv4ToInt(host) && !host.includes(":")) {
    const addresses = await lookup(host);
    if (addresses.length === 0) throw new Error("dns_failed");
    for (const address of addresses) {
      if (isPrivateOrLocalIp(address)) {
        throw new Error("blocked_resolved_private_ip");
      }
    }
  }

  return url;
}
