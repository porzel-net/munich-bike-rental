import { describe, expect, it } from "vitest";

import { hasUserVerifiedPasskey } from "../../lib/auth/passkey-policy";

describe("passkey admin policy", () => {
  it("requires explicit authenticator user verification", () => {
    expect(hasUserVerifiedPasskey({ userVerified: true })).toBe(true);
    expect(hasUserVerifiedPasskey({ userVerified: false })).toBe(false);
    expect(hasUserVerifiedPasskey({})).toBe(false);
    expect(hasUserVerifiedPasskey(null)).toBe(false);
  });
});
