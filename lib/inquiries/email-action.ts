import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";

import type { AppDatabase } from "../db/client";
import { bookings, communicationMessages, emailActionReviews } from "../db/schema";
import { readSecret } from "./server";

export const EMAIL_ACTION_PROMPT_VERSION = "email-action-v1";
export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
export const DEFAULT_REASONING_EFFORT = "middle";
export const EMAIL_ACTION_START_AT = new Date("2026-08-01T00:00:00+02:00");

const openAiReviewSchema = z.object({
  needs_action: z.boolean(),
  summary: z.string().min(1).max(1_000),
  open_questions: z.array(z.string().min(1).max(500)).max(10),
});

const MAX_PROMPT_CHARS = 60_000;

function redactPromptText(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, "[URL]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[E-MAIL]")
    .replace(/\b[A-Z]{2}\d{2}(?:[ -]?\d{4}){4,7}\b/gi, "[IBAN]")
    .replace(/\b\d{13,19}\b/g, "[ZAHLUNGSNUMMER]")
    .replace(/(?<!\d)\+?\d[\d ().\/-]{7,}\d(?!\d)/g, "[TELEFON]");
}

export type EmailActionReview = z.infer<typeof openAiReviewSchema>;

export type EmailActionMessage = {
  id: number;
  direction: "inbound" | "outbound";
  sender: string;
  recipients: string;
  subject: string;
  plainText: string;
  sentAt: Date | string | number;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

type FetchLike = typeof fetch;

function getModel(environment: Partial<NodeJS.ProcessEnv>) {
  const configuredModel = environment.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  return configuredModel === "gpt-luna" ? DEFAULT_OPENAI_MODEL : configuredModel;
}

function getRequestedReasoningEffort(environment: Partial<NodeJS.ProcessEnv>) {
  return environment.OPENAI_REASONING_EFFORT?.trim().toLowerCase() || DEFAULT_REASONING_EFFORT;
}

function apiReasoningEffort(value: string) {
  // "middle" is the product-facing label requested for this automation;
  // OpenAI's public Responses API calls the same level "medium".
  return value === "middle" ? "medium" : value;
}

export function isInitialInquiryMessage(messages: readonly EmailActionMessage[], triggerMessageId: number) {
  const inboundMessages = messages
    .filter((message) => message.direction === "inbound")
    .sort((left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime());
  const trigger = inboundMessages[0];
  if (!trigger || trigger.id !== triggerMessageId) return false;
  return /^(?:re|aw|fwd|fw):\s*/i.test(trigger.subject)
    ? /^(?:(?:re|aw|fwd|fw):\s*)*(?:neue bike-anfrage|new bike inquiry)\b/i.test(trigger.subject)
    : /^(?:neue bike-anfrage|new bike inquiry)\b/i.test(trigger.subject);
}

export function isEmailActionEligible(
  bookingCreatedAt: Date | string | number,
  messages: readonly EmailActionMessage[],
) {
  const firstIncoming = messages
    .filter((message) => message.direction === "inbound")
    .sort((left, right) => new Date(left.sentAt).getTime() - new Date(right.sentAt).getTime())[0];
  const requestDate = firstIncoming ? new Date(firstIncoming.sentAt) : new Date(bookingCreatedAt);
  return requestDate.getTime() >= EMAIL_ACTION_START_AT.getTime();
}

export function buildEmailActionPrompt(messages: readonly EmailActionMessage[]) {
  let remainingChars = MAX_PROMPT_CHARS;
  const transcript = messages
    .slice(-30)
    .reduce<string[]>((blocks, message, index) => {
      if (remainingChars <= 0) return blocks;
      const sentAt = new Date(message.sentAt).toISOString();
      const prefix = `Nachricht ${index + 1} | ${message.direction === "inbound" ? "KUNDE" : "MITARBEITER"} | ${sentAt}\nVon: ${redactPromptText(message.sender)}\nAn: ${redactPromptText(message.recipients)}\nBetreff: ${redactPromptText(message.subject)}\nText:\n`;
      const bodyBudget = Math.min(8_000, Math.max(0, remainingChars - prefix.length));
      const body = redactPromptText(message.plainText.trim()).slice(0, bodyBudget);
      const block = `${prefix}${body}`;
      remainingChars -= block.length;
      blocks.push(block);
      return blocks;
    }, [])
    .join("\n\n---\n\n");

  return `Analysiere den folgenden E-Mail-Verlauf eines Fahrradverleihs. Entscheide ausschließlich, ob ein Mitarbeiter jetzt noch handeln muss, um eine Kundenfrage oder eine konkrete Kundenbitte zu beantworten.

Regeln:
- Beziehe den gesamten Verlauf ein und achte besonders auf die letzte Kundennachricht.
- needs_action=true, wenn eine Frage, eine unbeantwortete Bitte, eine fehlende Entscheidung oder eine noch zu bestätigende Information offen ist.
- needs_action=false bei reinen Danksagungen, Bestätigungen, Verabschiedungen oder wenn die letzte Kundennachricht durch eine spätere Mitarbeiterantwort vollständig beantwortet wurde.
- Eine Aussage wie „Könnten Sie …?“, „Ist es möglich …?“ oder „Bitte bestätigen Sie …“ ist auch ohne Fragezeichen eine offene Frage bzw. Bitte.
- Behandle automatische Signaturen, zitierten Verlauf und Höflichkeitsfloskeln nicht als offene Aufgaben.
- Erfinde keine offenen Fragen. Nenne in open_questions nur konkrete, aus dem Verlauf belegbare Fragen oder Bitten.
- summary ist eine kurze Begründung auf Deutsch. Wenn needs_action=false, erkläre kurz, warum nichts offen ist.
- Antworte ausschließlich als JSON nach dem vorgegebenen Schema.

E-Mail-Verlauf:
${transcript}`;
}

function extractOutputText(response: OpenAiResponse) {
  if (response.output_text?.trim()) return response.output_text.trim();
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text ?? "")
      .join("\n")
      .trim() ?? ""
  );
}

function parseModelResponse(response: OpenAiResponse) {
  const text = extractOutputText(response);
  const withoutFence = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFence);
  } catch {
    throw new Error("OpenAI returned invalid JSON");
  }
  return openAiReviewSchema.parse(parsed);
}

export async function analyzeEmailThread(
  messages: readonly EmailActionMessage[],
  options: { environment?: Partial<NodeJS.ProcessEnv>; fetcher?: FetchLike } = {},
): Promise<{ review: EmailActionReview; model: string; reasoningEffort: string }> {
  const environment = options.environment ?? process.env;
  const apiKey = await readSecret(environment, "OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const model = getModel(environment);
  const reasoningEffort = getRequestedReasoningEffort(environment);
  const response = await (options.fetcher ?? fetch)("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: apiReasoningEffort(reasoningEffort) },
      input: [
        {
          role: "developer",
          content: [{ type: "input_text", text: "Du bist ein präziser Klassifikator für offene Kundenfragen." }],
        },
        { role: "user", content: [{ type: "input_text", text: buildEmailActionPrompt(messages) }] },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "email_action_review",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              needs_action: { type: "boolean" },
              summary: { type: "string" },
              open_questions: { type: "array", items: { type: "string" } },
            },
            required: ["needs_action", "summary", "open_questions"],
          },
        },
      },
    }),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenAI request failed (${response.status})${errorText ? `: ${errorText.slice(0, 300)}` : ""}`);
  }
  return { review: parseModelResponse((await response.json()) as OpenAiResponse), model, reasoningEffort };
}

function parseQuestions(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function messageForReview(message: typeof communicationMessages.$inferSelect): EmailActionMessage {
  return {
    id: message.id,
    direction: message.direction,
    sender: message.sender,
    recipients: message.recipients,
    subject: message.subject,
    plainText: message.plainText,
    sentAt: message.sentAt,
  };
}

export function getLatestEmailActionReview(db: AppDatabase, bookingId: number) {
  return (
    db
      .select()
      .from(emailActionReviews)
      .where(eq(emailActionReviews.bookingId, bookingId))
      .orderBy(desc(emailActionReviews.createdAt), desc(emailActionReviews.id))
      .get() ?? null
  );
}

export async function reviewLatestUnprocessedEmailThread(db: AppDatabase, bookingId: number) {
  const booking = db.select({ createdAt: bookings.createdAt }).from(bookings).where(eq(bookings.id, bookingId)).get();
  const messages = db
    .select()
    .from(communicationMessages)
    .where(eq(communicationMessages.bookingId, bookingId))
    .orderBy(desc(communicationMessages.sentAt), desc(communicationMessages.id))
    .all();
  const latestMessage = messages[0];
  if (!booking || !latestMessage) return { status: "no_message" as const, review: null };
  if (!isEmailActionEligible(booking.createdAt, messages.map(messageForReview))) {
    return { status: "not_eligible" as const, review: null };
  }
  const existing = db
    .select({ id: emailActionReviews.id })
    .from(emailActionReviews)
    .where(eq(emailActionReviews.triggerMessageId, latestMessage.id))
    .get();
  if (existing) return { status: "skipped" as const, review: getLatestEmailActionReview(db, bookingId) };
  return { status: "checked" as const, review: await reviewBookingEmailThread(db, bookingId, latestMessage.id) };
}

export async function reviewBookingEmailThread(
  db: AppDatabase,
  bookingId: number,
  triggerMessageId: number,
  options: { force?: boolean } = {},
) {
  const messages = db
    .select()
    .from(communicationMessages)
    .where(eq(communicationMessages.bookingId, bookingId))
    .orderBy(asc(communicationMessages.sentAt), asc(communicationMessages.id))
    .all();
  const trigger = messages.find((message) => message.id === triggerMessageId);
  if (!trigger) return null;

  const booking = db.select({ createdAt: bookings.createdAt }).from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking || !isEmailActionEligible(booking.createdAt, messages.map(messageForReview))) return null;

  const environment = process.env;
  const createdAt = new Date();
  const existing = db
    .select({ id: emailActionReviews.id })
    .from(emailActionReviews)
    .where(eq(emailActionReviews.triggerMessageId, triggerMessageId))
    .get();
  if (existing && !options.force) return getLatestEmailActionReview(db, bookingId);

  let status: "needs_action" | "no_action" | "error";
  let source: "inquiry_rule" | "openai" | "fallback";
  let summary: string;
  let openQuestions: string[];
  let model: string | null = null;
  let reasoningEffort: string | null = null;
  let errorMessage: string | null = null;

  if (isInitialInquiryMessage(messages.map(messageForReview), triggerMessageId)) {
    status = "needs_action";
    source = "inquiry_rule";
    summary = "Neue eingehende Buchungsanfrage: Sie muss geprüft und beantwortet werden.";
    openQuestions = ["Die eingegangene Buchungsanfrage wurde noch nicht bearbeitet."];
  } else {
    try {
      const result = await analyzeEmailThread(messages.map(messageForReview), { environment });
      status = result.review.needs_action ? "needs_action" : "no_action";
      source = "openai";
      summary = result.review.summary;
      openQuestions = result.review.open_questions;
      model = result.model;
      reasoningEffort = result.reasoningEffort;
    } catch (error) {
      status = "error";
      source = "fallback";
      summary = "Die KI-Prüfung ist fehlgeschlagen. Bitte den Mailverlauf manuell prüfen.";
      openQuestions = ["Konnte wegen eines KI-Fehlers nicht automatisch bewertet werden."];
      errorMessage = error instanceof Error ? error.message : "Unknown OpenAI error";
      model = getModel(environment);
      reasoningEffort = getRequestedReasoningEffort(environment);
    }
  }

  const values = {
    bookingId,
    triggerMessageId,
    status,
    source,
    summary,
    openQuestionsJson: JSON.stringify(openQuestions),
    model,
    reasoningEffort,
    promptVersion: EMAIL_ACTION_PROMPT_VERSION,
    errorMessage,
    createdAt,
  } as const;
  if (existing) db.update(emailActionReviews).set(values).where(eq(emailActionReviews.id, existing.id)).run();
  else db.insert(emailActionReviews).values(values).run();
  return getLatestEmailActionReview(db, bookingId);
}

export function reviewQuestions(review: typeof emailActionReviews.$inferSelect | null) {
  return review ? parseQuestions(review.openQuestionsJson) : [];
}
