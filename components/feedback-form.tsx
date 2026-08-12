"use client";

import { useState } from "react";
import { CheckCircle2, Send, Star } from "lucide-react";
import Link from "next/link";

import { feedbackCriteria, type FeedbackRatingKey, type PublicFeedback } from "@/lib/bookings/feedback-shared";

const labels = {
  de: {
    kicker: "Deine Fahrt",
    title: "Wie war deine Fahrt?",
    intro: "Deine kurze Rückmeldung hilft uns, den Verleih noch besser zu machen.",
    booking: "Buchung",
    optional: "optional",
    comment: "Möchtest du uns noch etwas sagen?",
    placeholder: "Was hat gut geklappt? Was können wir verbessern?",
    submit: "Feedback senden",
    sending: "Wird gesendet …",
    thanks: "Vielen Dank für dein Feedback!",
    thanksText: "Wir freuen uns sehr, dass du dir kurz Zeit genommen hast.",
    stars: "Sterne",
    home: "Zur Website",
    required: "Bitte bewerte noch alle Punkte.",
  },
  en: {
    kicker: "Your ride",
    title: "How was your ride?",
    intro: "Your quick feedback helps us make the rental experience even better.",
    booking: "Booking",
    optional: "optional",
    comment: "Anything else you would like to tell us?",
    placeholder: "What went well? What could we improve?",
    submit: "Send feedback",
    sending: "Sending …",
    thanks: "Thank you for your feedback!",
    thanksText: "We really appreciate you taking a moment to share your experience.",
    stars: "stars",
    home: "Back to website",
    required: "Please rate all points before sending.",
  },
} as const;

export function FeedbackForm({ feedback, token }: { feedback: PublicFeedback; token: string }) {
  const de = feedback.locale === "de";
  const copy = labels[feedback.locale];
  const [ratings, setRatings] = useState<Record<FeedbackRatingKey, number | null>>(feedback.ratings);
  const [comment, setComment] = useState(feedback.comment);
  const [submitted, setSubmitted] = useState(Boolean(feedback.submittedAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (feedbackCriteria.some(({ key }) => !ratings[key])) {
      setError(copy.required);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/feedback/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...ratings, comment }),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Feedback konnte nicht gespeichert werden.");
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Feedback konnte nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="public-offer-page feedback-page">
      <div className="public-offer-page__glow public-offer-page__glow--top" aria-hidden="true" />
      <div className="public-offer-page__glow public-offer-page__glow--bottom" aria-hidden="true" />
      <div className="public-offer-container feedback-container">
        <header className="public-offer-header">
          <Link className="public-offer-brand" href="/" aria-label="Your Bike Rental home">
            <span className="public-offer-brand__mark">Y</span>
            <span>Your Bike Rental</span>
          </Link>
          <span className="public-offer-header__reference">{feedback.orderNumber}</span>
        </header>
        <section className="public-offer-hero feedback-hero" aria-labelledby="feedback-title">
          <div className="public-offer-hero__copy">
            <div className="public-offer-kicker">
              <span>{copy.kicker}</span>
              <span className="public-offer-kicker__line" aria-hidden="true" />
              <span>{copy.booking}</span>
            </div>
            <h1 id="feedback-title">{copy.title}</h1>
            <p>
              {de ? `Hallo ${feedback.customerName}, ${copy.intro}` : `Hello ${feedback.customerName}, ${copy.intro}`}
            </p>
          </div>
          <div className="public-offer-status public-offer-status--success">
            <span className="public-offer-status__icon" aria-hidden="true">
              <Star size={19} strokeWidth={2} />
            </span>
            <span>
              <small>{copy.booking}</small>
              <strong>{feedback.orderNumber}</strong>
            </span>
          </div>
        </section>

        <section className="public-offer-panel feedback-panel" aria-labelledby="feedback-form-title">
          {submitted ? (
            <div className="feedback-success">
              <span className="feedback-success__icon" aria-hidden="true">
                <CheckCircle2 size={28} />
              </span>
              <h2>{copy.thanks}</h2>
              <p>{copy.thanksText}</p>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="public-offer-section-heading">
                <span className="public-offer-section-heading__icon" aria-hidden="true">
                  <Star size={20} strokeWidth={1.8} />
                </span>
                <div>
                  <span className="public-offer-section-heading__eyebrow">{copy.kicker}</span>
                  <h2 id="feedback-form-title">{copy.title}</h2>
                </div>
              </div>
              <div className="feedback-ratings">
                {feedbackCriteria.map(({ key, de: deLabel, en: enLabel }) => (
                  <fieldset className="feedback-rating" key={key}>
                    <legend>{de ? deLabel : enLabel}</legend>
                    <div className="feedback-stars" role="radiogroup" aria-label={de ? deLabel : enLabel}>
                      {[1, 2, 3, 4, 5].map((value) => {
                        const active = (ratings[key] ?? 0) >= value;
                        return (
                          <button
                            className={active ? "feedback-star is-active" : "feedback-star"}
                            type="button"
                            role="radio"
                            aria-checked={ratings[key] === value}
                            aria-label={`${value} ${copy.stars}`}
                            key={value}
                            onClick={() => setRatings((current) => ({ ...current, [key]: value }))}
                          >
                            <Star size={26} fill={active ? "currentColor" : "none"} strokeWidth={1.7} />
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
              <label className="feedback-comment">
                <span>
                  {copy.comment} <small>({copy.optional})</small>
                </span>
                <textarea
                  value={comment}
                  maxLength={2000}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={copy.placeholder}
                  rows={5}
                />
              </label>
              {error ? (
                <p className="public-offer-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="public-offer-button feedback-submit" disabled={busy} type="submit">
                <Send size={18} strokeWidth={1.9} />
                <span>{busy ? copy.sending : copy.submit}</span>
              </button>
            </form>
          )}
        </section>
        <footer className="public-offer-footer">
          <Link href="/">{copy.home}</Link>
          <span aria-hidden="true">·</span>
          <a href="mailto:hallo@munich-bike-rental.de">hallo@munich-bike-rental.de</a>
        </footer>
      </div>
    </main>
  );
}
