import { describe, expect, it } from "vitest";

import { readBoundedJson, readBoundedText } from "../../lib/security/request-body";

describe("bounded request bodies", () => {
  it("parses JSON within the byte limit", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ token: "opaque" }),
      headers: { "content-type": "application/json" },
    });

    await expect(readBoundedJson(request, 128)).resolves.toEqual({ token: "opaque" });
  });

  it("rejects oversized content before JSON parsing", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ message: "x".repeat(100) }),
      headers: { "content-type": "application/json" },
    });

    await expect(readBoundedJson(request, 32)).resolves.toBeNull();
  });

  it("bounds non-JSON text bodies as well", async () => {
    const request = new Request("http://localhost/test", { method: "POST", body: "payload" });
    await expect(readBoundedText(request, 16)).resolves.toBe("payload");
  });
});
