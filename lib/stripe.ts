import { createHmac, timingSafeEqual } from "node:crypto";

const STRIPE_API_URL = "https://api.stripe.com/v1";
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

type StripeErrorResponse = {
  error?: {
    message?: string;
  };
};

export type StripeCheckoutSession = {
  id: string;
  created?: number;
  url: string | null;
  status?: "open" | "complete" | "expired" | string;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  customer_email?: string | null;
  client_reference_id?: string | null;
  payment_intent?: string | StripePaymentIntent | null;
  metadata?: Record<string, string>;
};

export type StripeBalanceTransaction = {
  id: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  created: number;
  available_on?: number | null;
};

export type StripeCharge = {
  id: string;
  balance_transaction?: string | StripeBalanceTransaction | null;
};

export type StripeRefund = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created?: number;
  metadata?: Record<string, string>;
  payment_intent?: string | StripePaymentIntent | null;
  charge?: string | StripeCharge | null;
  balance_transaction?: string | StripeBalanceTransaction | null;
};

export type StripePaymentIntent = {
  id: string;
  latest_charge?: string | StripeCharge | null;
};

type StripeListResponse<T> = {
  object: "list";
  data: T[];
  has_more: boolean;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: { object: StripeCheckoutSession };
};

export class StripeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigurationError";
  }
}

function getStripeSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new StripeConfigurationError("STRIPE_SECRET_KEY ist nicht konfiguriert.");
  }

  if (!secretKey.startsWith("sk_")) {
    throw new StripeConfigurationError("STRIPE_SECRET_KEY muss mit sk_ beginnen.");
  }

  return secretKey;
}

async function stripeRequest<T>(
  path: string,
  params: URLSearchParams,
  method: "POST" | "GET" = "POST",
  options: { idempotencyKey?: string } = {},
) {
  const secretKey = getStripeSecretKey();
  const response = await fetch(`${STRIPE_API_URL}/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    ...(method === "POST" ? { body: params.toString() } : {}),
    cache: "no-store",
  });

  const payload = (await response.json()) as T & StripeErrorResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Stripe konnte die Anfrage nicht verarbeiten.");
  }

  return payload as T;
}

export async function createStripeCheckoutSession(input: {
  amountCents: number;
  customerEmail?: string;
  clientReferenceId?: string;
  productName: string;
  productDescription?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Der Stripe-Betrag muss eine positive Ganzzahl in Cent sein.");
  }

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("payment_method_types[0]", "card");
  params.set("line_items[0][price_data][currency]", "eur");
  params.set("line_items[0][price_data][product_data][name]", input.productName);
  if (input.productDescription) {
    params.set("line_items[0][price_data][product_data][description]", input.productDescription);
  }
  params.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  if (input.customerEmail) params.set("customer_email", input.customerEmail);
  if (input.clientReferenceId) params.set("client_reference_id", input.clientReferenceId);
  for (const [key, value] of Object.entries(input.metadata ?? {})) params.set(`metadata[${key}]`, value);

  const session = await stripeRequest<StripeCheckoutSession>("checkout/sessions", params, "POST", {
    idempotencyKey: input.idempotencyKey,
  });
  if (!session.url) {
    throw new Error("Stripe hat keine Checkout-URL zurückgegeben.");
  }

  return session;
}

export async function createStripeRefund(input: {
  paymentIntentId: string;
  amountCents: number;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}) {
  if (!/^pi_[A-Za-z0-9_]+$/.test(input.paymentIntentId)) throw new Error("Die Stripe-Zahlungsreferenz ist ungültig.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0)
    throw new Error("Der Stripe-Erstattungsbetrag muss eine positive Ganzzahl in Cent sein.");
  if (!input.idempotencyKey.trim())
    throw new Error("Für eine Stripe-Erstattung ist ein Idempotenzschlüssel erforderlich.");

  const params = new URLSearchParams();
  params.set("payment_intent", input.paymentIntentId);
  params.set("amount", String(input.amountCents));
  params.set("expand[]", "balance_transaction");
  for (const [key, value] of Object.entries(input.metadata ?? {})) params.set(`metadata[${key}]`, value);
  const refund = await stripeRequest<StripeRefund>("refunds", params, "POST", {
    idempotencyKey: input.idempotencyKey,
  });
  if (refund.status !== "succeeded" && refund.status !== "pending")
    throw new Error("Stripe hat die Erstattung nicht angenommen.");
  if (refund.amount !== input.amountCents) throw new Error("Stripe hat einen anderen Erstattungsbetrag zurückgegeben.");
  return refund;
}

/** Lists all refunds for one PaymentIntent so dashboard-created refunds are reconciled too. */
export async function listStripeRefundsForPaymentIntent(
  paymentIntentId: string,
  input: { startingAfter?: string; limit?: number } = {},
) {
  if (!/^pi_[A-Za-z0-9_]+$/.test(paymentIntentId)) throw new Error("Die Stripe-Zahlungsreferenz ist ungültig.");
  const params = new URLSearchParams();
  params.set("payment_intent", paymentIntentId);
  params.set("limit", String(Math.min(100, Math.max(1, input.limit ?? 100))));
  params.set("expand[]", "data.balance_transaction");
  if (input.startingAfter) params.set("starting_after", input.startingAfter);
  return stripeRequest<StripeListResponse<StripeRefund>>(`refunds?${params.toString()}`, new URLSearchParams(), "GET");
}

export async function getStripeCheckoutSession(sessionId: string) {
  return stripeRequest<StripeCheckoutSession>(
    `checkout/sessions/${encodeURIComponent(sessionId)}`,
    new URLSearchParams(),
    "GET",
  );
}

/**
 * Lists completed Checkout Sessions for the Stripe reconciliation/backfill.
 * The API is paginated, so callers must continue with the last session ID
 * while `has_more` is true.
 */
export async function listStripeCheckoutSessions(
  input: {
    createdGte?: number;
    createdLte?: number;
    startingAfter?: string;
    limit?: number;
  } = {},
) {
  const params = new URLSearchParams();
  params.set("status", "complete");
  params.set("limit", String(Math.min(100, Math.max(1, input.limit ?? 100))));
  params.set("expand[]", "data.payment_intent.latest_charge.balance_transaction");
  if (input.createdGte !== undefined) params.set("created[gte]", String(input.createdGte));
  if (input.createdLte !== undefined) params.set("created[lte]", String(input.createdLte));
  if (input.startingAfter) params.set("starting_after", input.startingAfter);

  return stripeRequest<StripeListResponse<StripeCheckoutSession>>(
    `checkout/sessions?${params.toString()}`,
    new URLSearchParams(),
    "GET",
  );
}

/**
 * Loads the payment and its Stripe balance transaction. The balance transaction
 * is the authoritative source for gross amount, Stripe fee, net amount and
 * the dates needed for the accounting/reconciliation layer.
 */
export async function getStripeCheckoutPaymentDetails(sessionId: string) {
  const session = await stripeRequest<StripeCheckoutSession>(
    `checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent.latest_charge.balance_transaction`,
    new URLSearchParams(),
    "GET",
  );
  const paymentIntent = typeof session.payment_intent === "object" ? session.payment_intent : null;
  const charge = paymentIntent && typeof paymentIntent.latest_charge === "object" ? paymentIntent.latest_charge : null;
  const balanceTransaction =
    charge && typeof charge.balance_transaction === "object" ? charge.balance_transaction : null;
  if (!balanceTransaction) {
    throw new Error("Stripe-Zahlung hat noch keine Balance Transaction.");
  }
  return {
    session,
    paymentIntentId: paymentIntent?.id ?? (typeof session.payment_intent === "string" ? session.payment_intent : null),
    chargeId: charge?.id ?? null,
    balanceTransaction,
  };
}

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new StripeConfigurationError("STRIPE_WEBHOOK_SECRET ist nicht konfiguriert.");
  return secret;
}

export function constructStripeWebhookEvent(payload: string, signature: string | null) {
  if (!signature) throw new Error("Stripe-Signatur fehlt.");
  const parts = signature.split(",");
  const timestamp = Number(parts.find((part) => part.startsWith("t="))?.slice(2));
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!Number.isSafeInteger(timestamp) || signatures.length === 0) throw new Error("Ungültige Stripe-Signatur.");
  if (Math.abs(Date.now() / 1_000 - timestamp) > STRIPE_WEBHOOK_TOLERANCE_SECONDS)
    throw new Error("Stripe-Signatur ist abgelaufen.");

  const expected = createHmac("sha256", getWebhookSecret()).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const valid = signatures.some((candidate) => {
    const candidateBuffer = Buffer.from(candidate, "hex");
    return candidateBuffer.length === expectedBuffer.length && timingSafeEqual(candidateBuffer, expectedBuffer);
  });
  if (!valid) throw new Error("Stripe-Signatur konnte nicht verifiziert werden.");

  const event = JSON.parse(payload) as StripeWebhookEvent;
  if (!event.id || !event.type || !event.data?.object) throw new Error("Ungültiges Stripe-Event.");
  return event;
}
