import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasTrustedOrigin: vi.fn(),
  getServerSession: vi.fn(),
  canUseAdminApiAsAdmin: vi.fn(),
  getDatabase: vi.fn(),
  retryFailedOutboxMail: vi.fn(),
  cancelOutboxMail: vi.fn(),
}));

vi.mock("@/lib/auth/request", () => ({ hasTrustedOrigin: mocks.hasTrustedOrigin }));
vi.mock("@/lib/auth/session", () => ({
  getServerSession: mocks.getServerSession,
  canUseAdminApiAsAdmin: mocks.canUseAdminApiAsAdmin,
}));
vi.mock("@/lib/db/client", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("@/lib/bookings/outbox", () => ({
  retryFailedOutboxMail: mocks.retryFailedOutboxMail,
  cancelOutboxMail: mocks.cancelOutboxMail,
}));

import { POST } from "../../app/api/admin/mail-outbox/[id]/retry/route";
import { POST as cancelPOST } from "../../app/api/admin/mail-outbox/[id]/cancel/route";

function request() {
  return new Request("http://localhost:3000/api/admin/mail-outbox/7/retry", {
    method: "POST",
    headers: { origin: "http://localhost:3000" },
  });
}

function context(id = "7") {
  return { params: Promise.resolve({ id }) };
}

describe("mail outbox retry API", () => {
  beforeEach(() => {
    mocks.hasTrustedOrigin.mockReset();
    mocks.hasTrustedOrigin.mockReturnValue(true);
    mocks.getServerSession.mockReset();
    mocks.getServerSession.mockResolvedValue({ user: { id: "admin", role: "admin" } });
    mocks.canUseAdminApiAsAdmin.mockReset();
    mocks.canUseAdminApiAsAdmin.mockReturnValue(true);
    mocks.getDatabase.mockReset();
    mocks.getDatabase.mockReturnValue({ marker: "db" });
    mocks.retryFailedOutboxMail.mockReset();
    mocks.retryFailedOutboxMail.mockReturnValue(true);
    mocks.cancelOutboxMail.mockReset();
    mocks.cancelOutboxMail.mockReturnValue(true);
  });

  it("requeues a failed mail for an administrator", async () => {
    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "queued" });
    expect(mocks.retryFailedOutboxMail).toHaveBeenCalledWith({ marker: "db" }, 7);
  });

  it("rejects non-administrator retries", async () => {
    mocks.canUseAdminApiAsAdmin.mockReturnValue(false);

    const response = await POST(request(), context());

    expect(response.status).toBe(403);
    expect(mocks.retryFailedOutboxMail).not.toHaveBeenCalled();
  });

  it("reports when the mail is no longer in failed state", async () => {
    mocks.retryFailedOutboxMail.mockReturnValue(false);

    const response = await POST(request(), context());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: expect.stringContaining("fehlgeschlagene") });
  });

  it("cancels an open mail for an administrator", async () => {
    const response = await cancelPOST(request(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, status: "cancelled" });
    expect(mocks.cancelOutboxMail).toHaveBeenCalledWith({ marker: "db" }, 7);
  });

  it("rejects canceling a mail that is already sent or unavailable", async () => {
    mocks.cancelOutboxMail.mockReturnValue(false);

    const response = await cancelPOST(request(), context());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ message: expect.stringContaining("abgebrochen") });
  });
});
