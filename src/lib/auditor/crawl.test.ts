import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockHttpClient } from "../http/fetch";
import { assertSafeHttpUrl } from "../http/ssrf";
import { crawlWebsite } from "./crawl";
import { AUDITOR_MAX_PAGES, AUDITOR_MAX_REDIRECTS } from "./limits";

const manyLinks = `<html><head><title>Hub</title><meta name="viewport" content="width=device-width"></head><body>
<nav>
<a href="/contact">Contact</a>
<a href="/about">About</a>
<a href="/services">Services</a>
<a href="/menu">Menu</a>
<a href="/location">Location</a>
<a href="/team">Team</a>
<a href="/faq">FAQ</a>
<a href="/gallery">Gallery</a>
</nav>
<h1>Hub</h1>
</body></html>`;

describe("bounded crawl", () => {
  it("enforces the page limit", async () => {
    const pages: Record<string, { body: string }> = {
      "https://limit.example.test/": { body: manyLinks },
    };
    for (const path of ["contact", "about", "services", "menu", "location", "team", "faq", "gallery"]) {
      pages[`https://limit.example.test/${path}`] = { body: `<html><title>${path}</title><body><h1>${path}</h1></body></html>` };
    }
    const result = await crawlWebsite("https://limit.example.test/", createMockHttpClient(pages));
    assert.ok(result.pagesFetched <= AUDITOR_MAX_PAGES, String(result.pagesFetched));
    assert.equal(result.pages.length, result.pagesFetched);
  });

  it("enforces the redirect limit", async () => {
    const http = createMockHttpClient({
      "https://redir.example.test/": { status: 302, location: "https://redir.example.test/a", body: "" },
      "https://redir.example.test/a": { status: 302, location: "https://redir.example.test/b", body: "" },
      "https://redir.example.test/b": { status: 302, location: "https://redir.example.test/c", body: "" },
      "https://redir.example.test/c": { status: 302, location: "https://redir.example.test/d", body: "" },
      "https://redir.example.test/d": { status: 302, location: "https://redir.example.test/e", body: "" },
      "https://redir.example.test/e": { status: 200, body: "<html><title>End</title></html>" },
    });
    const result = await crawlWebsite("https://redir.example.test/", http);
    assert.equal(result.homepageOk, false);
    assert.equal(result.error, "too_many_redirects");
    assert.ok(AUDITOR_MAX_REDIRECTS < 5);
  });
});

describe("SSRF protections on Auditor crawls", () => {
  it("blocks localhost", async () => {
    await assert.rejects(() => assertSafeHttpUrl("http://localhost/admin"), /blocked_hostname/);
    const result = await crawlWebsite("http://localhost/", createMockHttpClient({}));
    assert.equal(result.homepageOk, false);
    assert.match(String(result.blockedReason), /blocked/);
  });

  it("blocks loopback", async () => {
    await assert.rejects(() => assertSafeHttpUrl("http://127.0.0.1:8080"), /blocked_private_ip/);
  });

  it("blocks RFC1918 addresses", async () => {
    await assert.rejects(() => assertSafeHttpUrl("http://10.0.0.8/"), /blocked_private_ip/);
    await assert.rejects(() => assertSafeHttpUrl("http://192.168.1.20/"), /blocked_private_ip/);
    await assert.rejects(() => assertSafeHttpUrl("http://172.16.5.4/"), /blocked_private_ip/);
  });

  it("blocks metadata IPs", async () => {
    await assert.rejects(
      () => assertSafeHttpUrl("http://169.254.169.254/latest/meta-data"),
      /blocked/,
    );
  });

  it("blocks unsafe redirects into a private address", async () => {
    const http = createMockHttpClient({
      "https://safe.example.test/": {
        status: 302,
        location: "http://192.168.0.10/secret",
        body: "",
      },
    });
    const result = await crawlWebsite("https://safe.example.test/", http);
    assert.equal(result.homepageOk, false);
    assert.match(String(result.blockedReason ?? result.error), /blocked_private_ip/);
  });

  it("blocks hostnames that resolve to private IPs", async () => {
    await assert.rejects(
      () => assertSafeHttpUrl("https://evil.example.test", async () => ["10.1.1.1"]),
      /blocked_resolved_private_ip/,
    );
    const result = await crawlWebsite("https://evil.example.test/", createMockHttpClient({
      "https://evil.example.test/": { body: "<html></html>" },
    }), async () => ["10.1.1.1"]);
    assert.equal(result.homepageOk, false);
    assert.match(String(result.blockedReason ?? result.error), /blocked_resolved_private_ip/);
  });
});
