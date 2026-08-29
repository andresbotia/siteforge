import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockHttpClient, inspectWebsite } from "./inspector";
import { assertSafeHttpUrl } from "./ssrf";

describe("SSRF protections", () => {
  it("blocks localhost", async () => {
    await assert.rejects(() => assertSafeHttpUrl("http://localhost/admin"), /blocked_hostname/);
    const result = await inspectWebsite("http://localhost/", createMockHttpClient({}));
    assert.equal(result.reachable, false);
    assert.match(String(result.blockedReason), /blocked/);
  });

  it("blocks 127.0.0.1", async () => {
    await assert.rejects(() => assertSafeHttpUrl("http://127.0.0.1:8080"), /blocked_private_ip/);
  });

  it("blocks private 10.x", async () => {
    await assert.rejects(() => assertSafeHttpUrl("http://10.0.0.8/"), /blocked_private_ip/);
  });

  it("blocks 192.168.x", async () => {
    await assert.rejects(() => assertSafeHttpUrl("http://192.168.1.20/"), /blocked_private_ip/);
  });

  it("blocks 169.254.169.254", async () => {
    await assert.rejects(
      () => assertSafeHttpUrl("http://169.254.169.254/latest/meta-data"),
      /blocked/,
    );
  });

  it("blocks redirects into a private address", async () => {
    const http = createMockHttpClient({
      "https://safe.example.test/": {
        status: 302,
        location: "http://192.168.0.10/secret",
        body: "",
      },
    });
    const result = await inspectWebsite("https://safe.example.test/", http);
    assert.equal(result.reachable, false);
    assert.match(String(result.blockedReason ?? result.error), /blocked_private_ip/);
  });

  it("blocks non-http schemes", async () => {
    await assert.rejects(() => assertSafeHttpUrl("file:///etc/passwd"), /non_http_scheme/);
    await assert.rejects(() => assertSafeHttpUrl("javascript:alert(1)"), /non_http_scheme/);
  });

  it("blocks hostnames that resolve to private IPs", async () => {
    await assert.rejects(
      () =>
        assertSafeHttpUrl("https://evil.example.test", async () => ["10.1.1.1"]),
      /blocked_resolved_private_ip/,
    );
  });
});
