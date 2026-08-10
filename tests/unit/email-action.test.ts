import { afterEach, describe, expect, it, vi } from "vitest";

import { createDatabaseConnection } from "../../lib/db/client";
import { bookings, communicationMessages } from "../../lib/db/schema";
import {
  analyzeEmailThread,
  buildEmailActionPrompt,
  isEmailActionEligible,
  isInitialInquiryMessage,
  reviewBookingEmailThread,
} from "../../lib/inquiries/email-action";
import { emailActionEvaluationCases } from "../fixtures/email-action-evaluation";

const connections: Array<ReturnType<typeof createDatabaseConnection>> = [];

afterEach(() => {
  while (connections.length) connections.pop()?.close();
});

describe("email action evaluation fixtures", () => {
  it("contains twenty open and twenty closed conversations", () => {
    expect(emailActionEvaluationCases).toHaveLength(40);
    expect(emailActionEvaluationCases.filter((item) => item.expectedNeedsAction)).toHaveLength(20);
    expect(emailActionEvaluationCases.filter((item) => !item.expectedNeedsAction)).toHaveLength(20);
    for (const item of emailActionEvaluationCases) expect(item.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("marks only the first incoming booking inquiry with the hard-coded rule", () => {
    const inquiry = emailActionEvaluationCases[0].messages;
    const firstIncoming = inquiry.find((message) => message.direction === "inbound")!;
    expect(
      isInitialInquiryMessage(
        [
          { ...firstIncoming, subject: "Neue Bike-Anfrage #20260805120000" },
          { ...inquiry[0], id: firstIncoming.id + 10 },
        ],
        firstIncoming.id,
      ),
    ).toBe(true);
    expect(
      isInitialInquiryMessage(
        [
          { ...firstIncoming, subject: "Neue Bike-Anfrage #20260805120000" },
          { ...firstIncoming, id: firstIncoming.id + 1, subject: "Re: Neue Bike-Anfrage #20260805120000" },
        ],
        firstIncoming.id + 1,
      ),
    ).toBe(false);
  });

  it("only considers inquiries from 1 August 2026 onward", () => {
    expect(isEmailActionEligible(new Date("2026-07-31T23:59:59+02:00"), [])).toBe(false);
    expect(isEmailActionEligible(new Date("2026-08-01T00:00:00+02:00"), [])).toBe(true);
    expect(
      isEmailActionEligible(new Date("2026-08-01T10:00:00+02:00"), [
        {
          id: 1,
          direction: "inbound",
          sender: "customer@example.com",
          recipients: "main@example.com",
          subject: "Neue Bike-Anfrage",
          plainText: "Bitte um ein Angebot.",
          sentAt: new Date("2026-08-01T08:00:00+02:00"),
        },
      ]),
    ).toBe(true);
  });

  it("sends the full classification contract with gpt-5.6-luna and middle reasoning", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            needs_action: true,
            summary: "Eine Kundenfrage ist offen.",
            open_questions: ["Verfügbarkeit"],
          }),
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const result = await analyzeEmailThread(emailActionEvaluationCases[0].messages, {
      environment: { OPENAI_API_KEY: "test-key", OPENAI_MODEL: "gpt-luna", OPENAI_REASONING_EFFORT: "middle" },
      fetcher,
    });
    expect(result.review.needs_action).toBe(true);
    const body = JSON.parse(fetcher.mock.calls[0][1]?.body as string);
    expect(body.model).toBe("gpt-5.6-luna");
    expect(body.store).toBe(false);
    expect(body.reasoning.effort).toBe("medium");
    expect(body.text.format.name).toBe("email_action_review");
    expect(body.input[1].content[0].text).toContain("Könnten Sie");
    expect(buildEmailActionPrompt(emailActionEvaluationCases[39].messages)).toContain("Passt, danke!");

    const redactedPrompt = buildEmailActionPrompt([
      {
        ...emailActionEvaluationCases[0].messages[0],
        sender: "customer@example.com",
        recipients: "hallo@munich-bike-rental.de",
        plainText: "Meine Telefonnummer ist +49 151 12345678 und die Zahlung 4111111111111111.",
      },
    ]);
    expect(redactedPrompt).not.toContain("customer@example.com");
    expect(redactedPrompt).not.toContain("4111111111111111");
    expect(redactedPrompt).toContain("[E-MAIL]");
    expect(redactedPrompt).toContain("[ZAHLUNGSNUMMER]");
  });

  it("persists the hard-coded incoming inquiry signal", async () => {
    const connection = createDatabaseConnection(":memory:");
    connections.push(connection);
    const { db } = connection;
    const booking = db
      .insert(bookings)
      .values({
        orderNumber: "#20260805120000",
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
        customerPhone: "+49",
        location: "munich",
        periodFrom: "2026-09-12",
        periodTo: "2026-09-14",
        pickupTime: "10:00",
        dropoffTime: "16:00",
        customerMessage: "",
        communicationLocale: "de",
        source: "web",
        status: "inquiry_received",
        quotedTotalCents: 0,
        createdAt: new Date("2026-08-15T10:00:00+02:00"),
        updatedAt: new Date("2026-08-15T10:00:00+02:00"),
      })
      .returning({ id: bookings.id })
      .get();
    const incoming = db
      .insert(communicationMessages)
      .values({
        bookingId: booking.id,
        direction: "inbound",
        rfcMessageId: "<new-inquiry@example.com>",
        threadMessageId: "<new-inquiry@example.com>",
        inReplyTo: null,
        referencesHeader: null,
        sender: "ada@example.com",
        recipients: "hallo@munich-bike-rental.de",
        subject: "Neue Bike-Anfrage #20260805120000",
        plainText: "Bitte Verfügbarkeit bestätigen.",
        sentAt: new Date("2026-08-15T10:01:00+02:00"),
        archivedAt: new Date("2026-08-15T10:01:00+02:00"),
      })
      .returning({ id: communicationMessages.id })
      .get();

    const review = await reviewBookingEmailThread(db, booking.id, incoming.id);
    expect(review).toMatchObject({
      bookingId: booking.id,
      triggerMessageId: incoming.id,
      status: "needs_action",
      source: "inquiry_rule",
    });
    expect(review?.openQuestionsJson).toContain("noch nicht bearbeitet");
  });
});
