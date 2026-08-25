import { describe, expect, it } from "vitest";

import { parseBasicAuthorization } from "../../lib/carddav/auth";

function basic(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

describe("CardDAV authentication boundary", () => {
  it("parses credentials without treating a colon in the password as a separator", () => {
    expect(parseBasicAuthorization(basic("alice", "a-long-password:with-colon"))).toEqual({
      username: "alice",
      password: "a-long-password:with-colon",
    });
  });

  it("rejects malformed, empty, oversized, and header-injection credentials", () => {
    expect(parseBasicAuthorization(null)).toBeNull();
    expect(parseBasicAuthorization("Bearer username:password")).toBeNull();
    expect(parseBasicAuthorization("Basic not-base64!!!")).toBeNull();
    expect(parseBasicAuthorization(basic("", "password"))).toBeNull();
    expect(parseBasicAuthorization(basic("alice\r\nX-Injected: yes", "password"))).toBeNull();
    expect(parseBasicAuthorization(basic("a".repeat(129), "password"))).toBeNull();
    expect(parseBasicAuthorization(basic("alice", "p".repeat(257)))).toBeNull();
  });
});
