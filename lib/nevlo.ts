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

  constructor(
    private readonly clientId = requiredEnv("NEVLO_CLIENT_ID"),
    accessToken = requiredEnv("NEVLO_ACCESS_TOKEN"),
    refreshToken = requiredEnv("NEVLO_REFRESH_TOKEN"),
  ) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  async getAccounts() {
    return (await this.request<AccountsResponse>("/accounts")).accounts;
  }

  async getTransactions(input: {
    accountId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    perPage?: number;
  } = {}) {
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

  /** The refreshed token is kept in this process; the original .env.local remains the bootstrap secret source. */
  getCurrentTokens() {
    return { accessToken: this.accessToken, refreshToken: this.refreshToken };
  }

  private async refreshAccessToken() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const response = await fetch(NEVLO_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
          client_id: this.clientId,
        }),
        cache: "no-store",
      });
      const body = await response.text();
      if (!response.ok) throw new NevloApiError(`Nevlo Token-Refresh fehlgeschlagen: ${parseErrorBody(body)}`, response.status);
      const token = JSON.parse(body) as TokenResponse;
      if (!token.access_token) throw new NevloApiError("Nevlo hat kein Access Token geliefert.", response.status);
      this.accessToken = token.access_token;
      if (token.refresh_token) this.refreshToken = token.refresh_token;
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

