import type { Metadata } from "next";
import Link from "next/link";

import { getStripeCheckoutSession, StripeConfigurationError } from "@/lib/stripe";

export const metadata: Metadata = {
  title: "Stripe Sandbox – Zahlung erfolgreich",
  robots: { index: false, follow: false },
};

type SuccessPageProps = {
  searchParams?: Promise<{ session_id?: string }>;
};

export default async function StripeTestSuccessPage({ searchParams }: SuccessPageProps) {
  const params = await searchParams;
  const sessionId = params?.session_id;
  let session: Awaited<ReturnType<typeof getStripeCheckoutSession>> | null = null;

  if (sessionId) {
    try {
      session = await getStripeCheckoutSession(sessionId);
    } catch (error) {
      if (!(error instanceof StripeConfigurationError)) {
        session = null;
      }
    }
  }

  const amount =
    session?.amount_total != null
      ? new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(session.amount_total / 100)
      : null;
  const isPaid = session?.payment_status === "paid";

  return (
    <main className="site-shell stripe-test-page">
      <section className="section stripe-test-hero">
        <div className="container stripe-test-hero__inner">
          <span className="section-heading__eyebrow">Stripe Sandbox</span>
          <h1 className="section-heading__title">{isPaid ? "Zahlung erfolgreich" : "Checkout abgeschlossen"}</h1>
          <p className="section-copy stripe-test-hero__copy">
            {amount
              ? `Der Testbetrag von ${amount} wurde im Stripe-Testmodus als bezahlt gemeldet.`
              : "Stripe hat dich zurück auf die Website geleitet."}
          </p>
          {sessionId ? <p className="stripe-test-session">Session: {sessionId}</p> : null}
          <Link className="button--arrow" href="/stripe-test">
            <span>Nochmal testen</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
