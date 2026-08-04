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
  url: string | null;
  payment_status: string;
  amount_total: number | null;
  currency: string | null;
  customer_email?: string | null;
  client_reference_id?: string | null;
  payment_intent?: string | null;
  metadata?: Record<string, string>;
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

function getStripeSecretKey({ testOnly = false }: { testOnly?: boolean } = {}) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new StripeConfigurationError("STRIPE_SECRET_KEY ist nicht konfiguriert.");
  }

  if (!secretKey.startsWith("sk_")) {
    throw new StripeConfigurationError("STRIPE_SECRET_KEY muss mit sk_ beginnen.");
  }

  if (testOnly && !secretKey.startsWith("sk_test_")) {
    throw new StripeConfigurationError("Für diese Testseite muss STRIPE_SECRET_KEY mit sk_test_ beginnen.");
  }

  return secretKey;
}

async function stripeRequest<T>(
  path: string,
  params: URLSearchParams,
  method: "POST" | "GET" = "POST",
  options?: { testOnly?: boolean },
) {
  const secretKey = getStripeSecretKey(options);
  const response = await fetch(`${STRIPE_API_URL}/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
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

function getAppOrigin(requestUrl: string) {
  return process.env.APP_ORIGIN?.trim() || new URL(requestUrl).origin;
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
  testOnly?: boolean;
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
    testOnly: input.testOnly,
  });
  if (!session.url) {
    throw new Error("Stripe hat keine Checkout-URL zurückgegeben.");
  }

  return session;
}

export async function createStripeTestCheckoutSession(requestUrl: string) {
  const amountCents = Math.floor(Math.random() * 4_501) + 500;
  const origin = getAppOrigin(requestUrl);
  const session = await createStripeCheckoutSession({
    amountCents,
    productName: "Stripe-Sandbox-Testzahlung",
    productDescription: "Nur ein technischer Test – keine echte Buchung",
    successUrl: `${origin}/stripe-test/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/stripe-test/cancel`,
    metadata: { test_page: "stripe-test" },
    testOnly: true,
  });
  return { amountCents, url: session.url };
}

export async function getStripeCheckoutSession(sessionId: string) {
  return stripeRequest<StripeCheckoutSession>(
    `checkout/sessions/${encodeURIComponent(sessionId)}`,
    new URLSearchParams(),
    "GET",
  );
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
