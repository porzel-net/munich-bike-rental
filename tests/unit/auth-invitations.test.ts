import { describe, expect, it } from "vitest";

import { createInvitationToken, hashInvitationToken } from "../../lib/auth/invitations";
import { invitationRegistrationSchema, resolveInvitationName } from "../../lib/auth/invitation-validation";

describe("account invitations", () => {
  it("creates high-entropy opaque tokens with stable one-way hashes", () => {
    const first = createInvitationToken();
    const second = createInvitationToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(40);
    expect(hashInvitationToken(first)).toHaveLength(64);
    expect(hashInvitationToken(first)).toBe(hashInvitationToken(first));
    expect(hashInvitationToken(first)).not.toBe(hashInvitationToken(second));
  });

  it("requires a strong password and valid email for every invitation", () => {
    expect(
      invitationRegistrationSchema.safeParse({ email: "user@example.com", password: "StrongPassword-2026!" }).success,
    ).toBe(true);
    expect(invitationRegistrationSchema.safeParse({ email: "user@example.com", password: "weak" }).success).toBe(false);
    expect(
      invitationRegistrationSchema.safeParse({ email: "not-an-email", password: "StrongPassword-2026!" }).success,
    ).toBe(false);
  });

  it("allows a name only for the nameless bootstrap invitation", () => {
    expect(resolveInvitationName("", "  Neue Adminin  ")).toBe("Neue Adminin");
    expect(resolveInvitationName("Festgelegter Name", "Manipulierter Name")).toBe("Festgelegter Name");
    expect(resolveInvitationName("", "x")).toBeNull();
  });
});
