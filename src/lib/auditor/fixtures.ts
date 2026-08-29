import { createMockHttpClient, createLiveHttpClient, type SafeHttpClient } from "@/lib/http/fetch";
import { CATALOG_HTTP_FIXTURES } from "@/lib/scout/catalog";
import { AUDITOR_USER_AGENT } from "./limits";

export function healthyHtml(overrides?: { title?: string; extra?: string }): string {
  const title = overrides?.title ?? "Harborline Plumbing | Fort Lauderdale";
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="Emergency and scheduled plumbing in Fort Lauderdale.">
<link rel="canonical" href="https://healthy.example.test/">
</head><body>
<nav>
  <a href="/">Home</a>
  <a href="/services">Services</a>
  <a href="/contact">Contact</a>
  <a href="/about">About</a>
</nav>
<h1>Harborline Plumbing</h1>
<h2>Services</h2>
<p>We serve Fort Lauderdale and nearby Broward County. Drain cleaning, leak repair, and water heaters. Serving homes from 1842 SE 17th Street.</p>
<p>Hours: Monday–Saturday 8am–6pm. Emergency 24/7 dispatch.</p>
<p>Call <a href="tel:9545550142">(954) 555-0142</a> or <a href="/contact">request a quote</a>.</p>
<form action="/contact" method="get"><input name="name"><button>Get a quote</button></form>
<footer>© 2026 Harborline Plumbing. All rights reserved.</footer>
${overrides?.extra ?? ""}
</body></html>`;
}

export function healthyRestaurantHtml(): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mangrove Table | Fort Lauderdale restaurant</title>
<meta name="description" content="Independent seafood restaurant in Fort Lauderdale.">
<link rel="canonical" href="https://healthy-resto.example.test/">
</head><body>
<nav>
  <a href="/">Home</a>
  <a href="/menu">Menu</a>
  <a href="/contact">Contact</a>
  <a href="/about">About</a>
</nav>
<h1>Mangrove Table</h1>
<h2>Dinner in Fort Lauderdale</h2>
<p>Located at 100 Las Olas Boulevard, Fort Lauderdale. Hours: Tuesday–Sunday 5pm–10pm.</p>
<p>View our <a href="/menu">HTML dinner menu</a> or <a href="tel:9545550444">call (954) 555-0444</a>.</p>
<form><input name="party"><button>Contact</button></form>
<footer>© 2026 Mangrove Table</footer>
</body></html>`;
}

export function poorHtml(): string {
  return `<!doctype html><html><head><title></title></head>
<body>
<p>Welcome</p>
<a href="/menu">Menu</a>
<a href="/contact">Contact</a>
<p>Call 954-555-0199 for service.</p>
<p>© 2018 Sample Business</p>
</body></html>`;
}

export const AUDITOR_DEMO_FIXTURES: Record<
  string,
  { status?: number; body?: string; location?: string | null; elapsedMs?: number; truncated?: boolean; contentType?: string | null }
> = {
  "https://healthy.example.test/": { body: healthyHtml() },
  "https://healthy.example.test/services": {
    body: healthyHtml({ title: "Plumbing services in Fort Lauderdale" }),
  },
  "https://healthy.example.test/contact": {
    body: healthyHtml({ title: "Contact Harborline Plumbing" }),
  },
  "https://healthy.example.test/about": {
    body: healthyHtml({ title: "About Harborline Plumbing" }),
  },
  "https://healthy-resto.example.test/": { body: healthyRestaurantHtml() },
  "https://healthy-resto.example.test/menu": {
    body: `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Dinner menu | Mangrove Table</title><link rel="canonical" href="https://healthy-resto.example.test/menu"></head><body><nav><a href="/">Home</a><a href="/menu">Menu</a></nav><h1>Dinner menu</h1><p>Appetizers and entrees. Fort Lauderdale dining. Hours 5pm-10pm.</p></body></html>`,
  },
  "https://healthy-resto.example.test/contact": {
    body: `<html><head><title>Contact Mangrove Table</title><meta name="viewport" content="width=device-width"></head><body><h1>Contact</h1><a href="tel:9545550444">Call</a><p>100 Las Olas Boulevard, Fort Lauderdale</p></body></html>`,
  },
  "https://healthy-resto.example.test/about": {
    body: `<html><head><title>About Mangrove Table</title></head><body><h1>About</h1><p>Independent restaurant in Fort Lauderdale.</p></body></html>`,
  },
  "https://poor.example.test/": { body: poorHtml() },
  "https://poor.example.test/menu": { status: 404, body: "missing" },
  "https://poor.example.test/contact": { status: 404, body: "missing" },
  "*": { body: poorHtml() },
};

export function createAuditorHttpClient(): SafeHttpClient {
  const fixtures = createMockHttpClient({
    ...CATALOG_HTTP_FIXTURES,
    ...AUDITOR_DEMO_FIXTURES,
  });
  const live = createLiveHttpClient(AUDITOR_USER_AGENT);
  return {
    async fetch(url, options) {
      let host = "";
      try {
        host = new URL(url).hostname.toLowerCase();
      } catch {
        return fixtures.fetch(url, options);
      }
      if (host.endsWith(".example.test") || host.endsWith(".example.com")) {
        return fixtures.fetch(url, options);
      }
      return live.fetch(url, options);
    },
  };
}
