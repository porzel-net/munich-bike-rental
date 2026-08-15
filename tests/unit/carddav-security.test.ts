import { describe, expect, it } from "vitest";

import {
  carddavPasswordPolicy,
  generateCarddavPassword,
  hashCarddavPassword,
  parseBasicAuthorization,
  verifyCarddavPassword,
} from "../../lib/carddav/auth";
import { carddavUsername, getCarddavInternalUrl, getCarddavPublicUrl } from "../../lib/carddav/config";

describe("CardDAV credential security", () => {
  it("generates high-entropy passwords and never stores them in cleartext", async () => {
    const password = generateCarddavPassword();
    const hash = await hashCarddavPassword(password);

    expect(password).toHaveLength(32);
    expect(hash).toMatch(/^scrypt-v1\$/);
    expect(hash).not.toContain(password);
    expect(await verifyCarddavPassword(password, hash)).toBe(true);
    expect(await verifyCarddavPassword(`${password}x`, hash)).toBe(false);
  });

  it("rejects weak, malformed, and tampered credentials", async () => {
    await expect(hashCarddavPassword("too-short")).rejects.toThrow();
    expect(await verifyCarddavPassword("a".repeat(carddavPasswordPolicy.minLength), "not-a-hash")).toBe(false);

    const password = generateCarddavPassword();
    const hash = await hashCarddavPassword(password);
    const parts = hash.split("$");
    parts[5] = `${parts[5]}tampered`;
    expect(await verifyCarddavPassword(password, parts.join("$"))).toBe(false);
  });

  it("parses only valid Basic credentials and rejects header injection", () => {
    const encoded = Buffer.from("mbr-user:secret-password-that-is-long").toString("base64");
    expect(parseBasicAuthorization(`Basic ${encoded}`)).toEqual({
      username: "mbr-user",
      password: "secret-password-that-is-long",
    });
    expect(parseBasicAuthorization("Bearer token")).toBeNull();
    expect(parseBasicAuthorization("Basic not-base64!")).toBeNull();
    expect(parseBasicAuthorization(`Basic ${Buffer.from("user:\npass").toString("base64")}`)).toBeNull();
  });

  it("uses a stable non-PII Radicale username", () => {
    expect(carddavUsername("user-1")).toBe(carddavUsername("user-1"));
    expect(carddavUsername("user-1")).not.toBe(carddavUsername("user-2"));
    expect(carddavUsername("user-1")).toMatch(/^mbr-[a-f0-9]{24}$/);
    expect(carddavUsername("user@example.com")).not.toContain("@");
  });

  it("fails closed for an insecure production CardDAV URL", () => {
    expect(getCarddavPublicUrl({ NODE_ENV: "production", CARDDAV_PUBLIC_URL: "http://contacts.example.com" })).toBe(
      null,
    );
    expect(getCarddavPublicUrl({ NODE_ENV: "production", CARDDAV_PUBLIC_URL: "https://contacts.example.com/" })).toBe(
      "https://contacts.example.com",
    );
  });

  it("allows the default private Radicale hosts and rejects external targets", () => {
    expect(getCarddavInternalUrl({ CARDDAV_INTERNAL_URL: "http://radicale:5232" })).toBe("http://radicale:5232");
    expect(getCarddavInternalUrl({ CARDDAV_INTERNAL_URL: "http://127.0.0.1:5232" })).toBe("http://127.0.0.1:5232");
    expect(getCarddavInternalUrl({ CARDDAV_INTERNAL_URL: "https://contacts.example.com:5232" })).toBeNull();
    expect(getCarddavInternalUrl({ CARDDAV_INTERNAL_URL: "http://user:password@radicale:5232" })).toBeNull();
    expect(
      getCarddavInternalUrl({
        CARDDAV_INTERNAL_URL: "http://carddav.internal:5232",
        CARDDAV_INTERNAL_ALLOWED_HOSTS: "carddav.internal",
      }),
    ).toBe("http://carddav.internal:5232");
  });
});
