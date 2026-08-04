import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Stripe Sandbox – abgebrochen",
  robots: { index: false, follow: false },
};

export default function StripeTestCancelPage() {
  return (
    <main className="site-shell stripe-test-page">
      <section className="section stripe-test-hero">
        <div className="container stripe-test-hero__inner">
          <span className="section-heading__eyebrow">Stripe Sandbox</span>
          <h1 className="section-heading__title">Zahlung abgebrochen</h1>
          <p className="section-copy stripe-test-hero__copy">
            Es wurde keine Zahlung abgeschlossen. Du kannst den Test direkt erneut starten.
          </p>
          <Link className="button--arrow" href="/stripe-test">
            <span>Zurück zum Test</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
