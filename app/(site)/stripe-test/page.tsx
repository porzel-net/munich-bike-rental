import type { Metadata } from "next";
import Link from "next/link";

import { StripeTestCheckout } from "@/components/stripe-test-checkout";

export const metadata: Metadata = {
  title: "Stripe Sandbox testen",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StripeTestPage() {
  return (
    <main className="site-shell stripe-test-page">
      <section className="section stripe-test-hero">
        <div className="container stripe-test-hero__inner">
          <Link className="stripe-test-back" href="/">
            ← Zur Startseite
          </Link>
          <span className="section-heading__eyebrow">Technischer Testbereich</span>
          <h1 className="section-heading__title">Stripe Sandbox</h1>
          <p className="section-copy stripe-test-hero__copy">
            Hier kannst du den Stripe-Checkout testen. Es wird keine echte Buchung angelegt und im Testmodus fließt kein
            echtes Geld.
          </p>
          <StripeTestCheckout />
          <p className="stripe-test-note">
            Nach dem Klick öffnet sich eine von Stripe gehostete Zahlungsseite. Für einen erfolgreichen Test kannst du
            dort die Karte
            <strong> 4242 4242 4242 4242</strong> mit beliebigem zukünftigen Ablaufdatum und beliebigem CVC verwenden.
          </p>
        </div>
      </section>
    </main>
  );
}
