import type { EmailActionReviewStatus } from "@/lib/db/schema";

export type AiLogSource = "all" | "openai" | "inquiry_rule" | "fallback";
export type AiLogStatus = "all" | EmailActionReviewStatus;

export function aiLogStatusView(status: Exclude<AiLogStatus, "all">) {
  if (status === "needs_action") return { label: "Handlung erforderlich", variant: "destructive" as const };
  if (status === "error") return { label: "Prüfung fehlgeschlagen", variant: "destructive" as const };
  return { label: "Nichts offen", variant: "success" as const };
}

export function aiLogSourceLabel(source: AiLogSource) {
  if (source === "openai") return "OpenAI-Modell";
  if (source === "inquiry_rule") return "Eingangsregel";
  if (source === "fallback") return "Fallback";
  return "Alle Quellen";
}

/** The user-facing agent name is intentionally separate from the technical source. */
export function aiLogAgentLabel(source: Exclude<AiLogSource, "all">) {
  if (source === "inquiry_rule") return "E-Mail-Fragenprüfung";
  if (source === "openai") return "E-Mail-Fragenprüfung (KI)";
  return "E-Mail-Fragenprüfung (Fallback)";
}
