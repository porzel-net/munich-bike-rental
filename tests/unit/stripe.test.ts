import { afterEach, describe, expect, it, vi } from "vitest";

import { createStripeCheckoutSession, createStripeRefund } from "../../lib/stripe";

const originalSecret = process.env.STRIPE_SECRET_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalSecret === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = originalSecret;
});

describe("Stripe request safety", () => {
  it("sends a stable idempotency key for Checkout creation", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "cs_test_checkout", url: "https://checkout.stripe.test/session" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createStripeCheckoutSession({
      amountCents: 10_000,
      productName: "Bike",
      successUrl: "https://example.test/success",
      cancelUrl: "https://example.test/cancel",
      idempotencyKey: "booking-offer-checkout:42",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/checkout/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Idempotency-Key": "booking-offer-checkout:42" }),
      }),
    );
  });

  it("creates only positive, exact-amount refunds with an idempotency key", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "re_test_refund", amount: 2_500, currency: "eur", status: "succeeded" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createStripeRefund({ paymentIntentId: "pi_test_payment", amountCents: 2_500, idempotencyKey: "refund-42" }),
    ).resolves.toMatchObject({ id: "re_test_refund", amount: 2_500 });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toMatchObject({ "Idempotency-Key": "refund-42" });
    expect(request.body).toContain("payment_intent=pi_test_payment");
    expect(request.body).toContain("amount=2500");
  });
});
