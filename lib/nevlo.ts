const NEVLO_API_BASE_URL = "https://nevlo.io/api/v1";
const NEVLO_TOKEN_URL = "https://nevlo.io/oauth/token";

export type NevloAccount = {
  id: string;
  accountName: string;
  iban?: string;
  accountType?: string;
  balance?: number;
  currency?: string;
  lastSyncedAt?: string;
  bankConnection?: { bankName?: string; status?: string };
};

export type NevloTransaction = {
  id: string;
  amount: number;
  currency: string;
  bookingDate: string;
  valueDate?: string;
  merchantName?: string;
  counterpartName?: string;
  counterpartIban?: string;
  counterpartBic?: string;
  counterpartBankName?: string;
  counterpartMandateReference?: string;
  counterpartCreditorId?: string | null;
  counterpartDebitorId?: string | null;
  type?: string;
  category?: string;
  purpose?: string;
  bankTransactionCode?: string;
  sepaPurposeCode?: string | null;
  isPotentialDuplicate?: boolean;
  isAdjustingEntry?: boolean;
  createdAt?: string;
  bankAccount?: { id?: string; iban?: string; accountName?: string; bankConnection?: { bankName?: string } };
  [key: string]: unknown;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

export type NevloStoredTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt?: Date | null;
};

/** Persistence for the latest token pair returned by Nevlo's rotating token endpoint. */
export type NevloTokenStore = {
  load(): NevloStoredTokens | null;
  save(tokens: NevloStoredTokens): void;
};

type AccountsResponse = { accounts: NevloAccount[] };
type TransactionsResponse = {
  transactions: NevloTransaction[];
  pagination?: { page: number; perPage: number; total: number; pageCount: number };
};

export class NevloConfigurationError extends Error {}
export class NevloApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function isNevloConfigured(environment: Partial<NodeJS.ProcessEnv> = process.env) {
  return ["NEVLO_CLIENT_ID", "NEVLO_ACCESS_TOKEN", "NEVLO_REFRESH_TOKEN"].every((name) =>
    Boolean(environment[name]?.trim()),
  );
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new NevloConfigurationError(`${name} ist nicht konfiguriert.`);
  return value;
}

function parseErrorBody(value: string) {
  try {
    const parsed = JSON.parse(value) as { message?: string; error?: string; error_description?: string };
    return parsed.error_description || parsed.message || parsed.error || value;
  } catch {
    return value;
  }
}

export class NevloClient {
  private accessToken: string;
  private refreshToken: string;
  private refreshPromise: Promise<void> | null = null;
  private readonly tokenStore?: NevloTokenStore;

  constructor(
    private readonly clientId = requiredEnv("NEVLO_CLIENT_ID"),
    accessToken = requiredEnv("NEVLO_ACCESS_TOKEN"),
    refreshToken = requiredEnv("NEVLO_REFRESH_TOKEN"),
    tokenStore?: NevloTokenStore,
  ) {
    this.tokenStore = tokenStore;
    const storedTokens = tokenStore?.load();
    this.accessToken = storedTokens?.accessToken || accessToken;
    this.refreshToken = storedTokens?.refreshToken || refreshToken;
  }

  async getAccounts() {
    return (await this.request<AccountsResponse>("/accounts")).accounts;
  }

  async getTransactions(
    input: {
      accountId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      perPage?: number;
    } = {},
  ) {
    const params = new URLSearchParams();
    if (input.accountId) params.set("accountIds", input.accountId);
    if (input.dateFrom) params.set("dateFrom", input.dateFrom);
    if (input.dateTo) params.set("dateTo", input.dateTo);
    params.set("page", String(input.page ?? 1));
    params.set("perPage", String(Math.min(input.perPage ?? 100, 100)));
    return this.request<TransactionsResponse>(`/transactions?${params.toString()}`);
  }

  async getAllTransactions(input: { accountId?: string; dateFrom?: string; dateTo?: string } = {}) {
    const transactions: NevloTransaction[] = [];
    let page = 1;
    let pageCount = 1;
    do {
      const result = await this.getTransactions({ ...input, page, perPage: 100 });
      transactions.push(...result.transactions);
      pageCount = result.pagination?.pageCount ?? page;
      page += 1;
    } while (page <= pageCount);
    return transactions;
  }

  /** The latest token pair is kept in memory; environment values are only the bootstrap source. */
  getCurrentTokens() {
    return { accessToken: this.accessToken, refreshToken: this.refreshToken };
  }

  private async refreshAccessToken() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      // Another Node.js worker may have completed the rotation while this
      // worker was waiting for the API response. Reuse that token instead of
      // replaying the now-invalid refresh token.
      const latestTokens = this.tokenStore?.load();
      if (
        latestTokens &&
        (latestTokens.accessToken !== this.accessToken || latestTokens.refreshToken !== this.refreshToken)
      ) {
        this.accessToken = latestTokens.accessToken;
        this.refreshToken = latestTokens.refreshToken;
        return;
      }

      const refreshTokenUsed = this.refreshToken;
      const response = await fetch(NEVLO_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshTokenUsed,
          client_id: this.clientId,
        }),
        cache: "no-store",
      });
      const body = await response.text();
      if (!response.ok) {
        // A different process can win a rotating-token race. If it persisted
        // a newer pair, adopt it and let the original API request retry.
        const rotatedTokens = this.tokenStore?.load();
        if (rotatedTokens && rotatedTokens.refreshToken !== refreshTokenUsed) {
          this.accessToken = rotatedTokens.accessToken;
          this.refreshToken = rotatedTokens.refreshToken;
          return;
        }
        throw new NevloApiError(`Nevlo Token-Refresh fehlgeschlagen: ${parseErrorBody(body)}`, response.status);
      }
      const token = JSON.parse(body) as TokenResponse;
      if (!token.access_token) throw new NevloApiError("Nevlo hat kein Access Token geliefert.", response.status);
      this.accessToken = token.access_token;
      if (token.refresh_token) this.refreshToken = token.refresh_token;
      this.tokenStore?.save({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        accessTokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      });
    })().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async request<T>(path: string, retried = false): Promise<T> {
    const response = await fetch(`${NEVLO_API_BASE_URL}${path}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${this.accessToken}` },
      cache: "no-store",
    });
    const body = await response.text();
    if (response.status === 401 && !retried) {
      await this.refreshAccessToken();
      return this.request<T>(path, true);
    }
    if (!response.ok) throw new NevloApiError(`Nevlo API-Fehler: ${parseErrorBody(body)}`, response.status);
    return JSON.parse(body) as T;
  }
}
