import { afterEach, describe, expect, it, vi } from "vitest";

import { NevloClient, type NevloStoredTokens, type NevloTokenStore } from "../../lib/nevlo";

afterEach(() => {
  vi.unstubAllGlobals();
});

function createStore(initial: NevloStoredTokens | null = null) {
  let current = initial;
  const store: NevloTokenStore = {
    load: () => current,
    save: (tokens) => {
      current = tokens;
    },
  };
  return { store, read: () => current };
}

describe("Nevlo OAuth token rotation", () => {
  it("persists the rotated refresh token and reuses it for the retry", async () => {
    const { store, read } = createStore();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("expired", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accounts: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new NevloClient("client-1", "access-1", "refresh-1", store);
    await expect(client.getAccounts()).resolves.toEqual([]);

    expect(read()).toMatchObject({ accessToken: "access-2", refreshToken: "refresh-2" });
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain("refresh_token=refresh-1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("uses persisted tokens after a process restart", async () => {
    const { store } = createStore({ accessToken: "access-2", refreshToken: "refresh-2" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accounts: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new NevloClient("client-1", "bootstrap-access", "bootstrap-refresh", store);
    await expect(client.getAccounts()).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer access-2" });
  });

  it("refreshes proactively before the access token expires", async () => {
    const { store, read } = createStore({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accessTokenExpiresAt: new Date(Date.now() + 1_000),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "access-2", refresh_token: "refresh-2", expires_in: 3600 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accounts: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new NevloClient("client-1", "bootstrap-access", "bootstrap-refresh", store);
    await expect(client.getAccounts()).resolves.toEqual([]);

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://nevlo.io/oauth/token");
    expect(read()).toMatchObject({ accessToken: "access-2", refreshToken: "refresh-2" });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: "Bearer access-2" });
  });
});
