import { afterEach, describe, expect, it, vi } from "vitest";

import { syncContactsToRadicale } from "../../lib/carddav/client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Radicale CardDAV client", () => {
  it("creates the private address book and upserts vCards with the validated user header", async () => {
    vi.stubEnv("CARDDAV_INTERNAL_URL", "http://radicale:5232");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"/>', { status: 207 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncContactsToRadicale("mbr-user", [
      {
        key: "email:ada@example.com",
        uid: "urn:test:ada",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+49 111",
        locations: ["munich"],
        latestUpdatedAt: new Date(),
        bookings: [],
      },
    ]);

    expect(result).toEqual({ synced: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe("http://radicale:5232/mbr-user/contacts/");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "MKCOL",
      headers: expect.objectContaining({ "X-Remote-User": "mbr-user" }),
    });
    expect(fetchMock.mock.calls[1][0]).toBe("http://radicale:5232/mbr-user/contacts/urn%3Atest%3Aada.vcf");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: "PUT",
      headers: expect.objectContaining({ "X-Remote-User": "mbr-user", "If-None-Match": "*" }),
    });
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "PROPFIND" });
  });

  it("updates an existing vCard after a conditional create conflict", async () => {
    vi.stubEnv("CARDDAV_INTERNAL_URL", "http://radicale:5232");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(null, { status: 412 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"/>', { status: 207 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      syncContactsToRadicale("mbr-user", [
        {
          key: "email:ada@example.com",
          uid: "urn:test:ada",
          name: "Ada Lovelace",
          email: "ada@example.com",
          phone: "+49 111",
          locations: ["munich"],
          latestUpdatedAt: new Date(),
          bookings: [],
        },
      ]),
    ).resolves.toEqual({ synced: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("removes only stale contacts created by the application", async () => {
    vi.stubEnv("CARDDAV_INTERNAL_URL", "http://radicale:5232");
    const staleUid = "urn:munich-bike-rental:contact:stale";
    const manualUid = "urn:iphone:manual";
    const propfind = `<d:multistatus xmlns:d="DAV:">
      <d:response><d:href>/mbr-user/contacts/${encodeURIComponent(staleUid)}.vcf</d:href></d:response>
      <d:response><d:href>/mbr-user/contacts/${encodeURIComponent(manualUid)}.vcf</d:href></d:response>
    </d:multistatus>`;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 405 }))
      .mockResolvedValueOnce(new Response(propfind, { status: 207 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(syncContactsToRadicale("mbr-user", [])).resolves.toEqual({ synced: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(
      `http://radicale:5232/mbr-user/contacts/${encodeURIComponent(staleUid)}.vcf`,
    );
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "DELETE" });
  });

  it("fails closed when Radicale returns an unexpected status", async () => {
    vi.stubEnv("CARDDAV_INTERNAL_URL", "http://radicale:5232");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(syncContactsToRadicale("mbr-user", [])).rejects.toThrow(/Adressbuch/);
  });
});
