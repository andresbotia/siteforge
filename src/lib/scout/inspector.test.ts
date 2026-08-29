import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMockHttpClient, inspectWebsite, ScoutFetchError } from "./inspector";

describe("website inspector", () => {
  it("flags unreachable websites", async () => {
    const http = createMockHttpClient({
      "https://down.example.test": { throwCode: "network" },
    });
    const result = await inspectWebsite("https://down.example.test", http);
    assert.equal(result.reachable, false);
    assert.equal(result.error, "network");
  });

  it("detects missing viewport", async () => {
    const http = createMockHttpClient({
      "https://noview.example.test": {
        body: `<html><head><title>Shop</title></head><body><h1>Hi</h1></body></html>`,
      },
    });
    const result = await inspectWebsite("https://noview.example.test", http);
    assert.equal(result.homepage?.hasViewport, false);
  });

  it("records broken important links", async () => {
    const http = createMockHttpClient({
      "https://resto.example.test": {
        body: `<html><head><meta name="viewport" content="width=device-width"><title>Resto</title></head><body><a href="/menu">Menu</a></body></html>`,
      },
      "https://resto.example.test/menu": { status: 404, body: "gone" },
    });
    const result = await inspectWebsite("https://resto.example.test", http);
    assert.equal(result.linkChecks.some((item) => item.kind === "menu" && !item.ok), true);
  });

  it("handles request timeout", async () => {
    const http = {
      async fetch() {
        throw new ScoutFetchError("timeout", "timeout");
      },
    };
    const result = await inspectWebsite("https://slow.example.test", http);
    assert.equal(result.reachable, false);
    assert.equal(result.error, "timeout");
  });

  it("handles response-size cap", async () => {
    const http = {
      async fetch() {
        throw new ScoutFetchError("size", "size");
      },
    };
    const result = await inspectWebsite("https://huge.example.test", http);
    assert.equal(result.reachable, false);
    assert.equal(result.error, "size");
  });
});
