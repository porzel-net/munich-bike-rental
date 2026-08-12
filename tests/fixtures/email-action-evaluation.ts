import type { EmailActionMessage } from "../../lib/inquiries/email-action";

export type EmailActionEvaluationCase = {
  name: string;
  expectedNeedsAction: boolean;
  messages: EmailActionMessage[];
};

function message(
  id: number,
  direction: EmailActionMessage["direction"],
  subject: string,
  plainText: string,
): EmailActionMessage {
  return {
    id,
    direction,
    sender: direction === "inbound" ? "kunde@example.com" : "hallo@munich-bike-rental.de",
    recipients: direction === "inbound" ? "hallo@munich-bike-rental.de" : "kunde@example.com",
    subject,
    plainText,
    sentAt: new Date(`2026-08-${String(1 + ((id - 1) % 28)).padStart(2, "0")}T10:00:00.000Z`),
  };
}

function openCase(id: number, name: string, subject: string, question: string): EmailActionEvaluationCase {
  return {
    name,
    expectedNeedsAction: true,
    messages: [
      message(id * 3, "outbound", subject, "Guten Tag, danke für Ihre Nachricht. Wir prüfen den Vorgang gerne."),
      message(id * 3 + 1, "inbound", subject, question),
    ],
  };
}

function closedCase(id: number, name: string, subject: string, customerMessage: string): EmailActionEvaluationCase {
  return {
    name,
    expectedNeedsAction: false,
    messages: [
      message(id * 3, "inbound", subject, "Können Sie mir dazu bitte weiterhelfen?"),
      message(id * 3 + 1, "outbound", subject, "Ja, das ist möglich. Die Details finden Sie in unserem Angebot."),
      message(id * 3 + 2, "inbound", subject, customerMessage),
    ],
  };
}

export const emailActionEvaluationCases: EmailActionEvaluationCase[] = [
  openCase(1, "Verfügbarkeit offen", "Re: Fahrradverleih", "Ist das Rennrad vom 12. bis 14. September noch verfügbar?"),
  openCase(2, "Preis offen", "Re: Fahrradverleih", "Wie hoch ist der Gesamtpreis inklusive Helm für zwei Tage?"),
  openCase(3, "Pedale offen", "Re: Zubehör", "Bitte teilen Sie mir noch mit, ob SPD-SL-Pedale vorhanden sind."),
  openCase(4, "Abholung offen", "Re: Abholung", "Wo genau kann ich die Fahrräder am Samstag abholen?"),
  openCase(
    5,
    "Stornierung offen",
    "Re: Buchung",
    "Welche Kosten entstehen, wenn ich die Buchung kurzfristig stornieren muss?",
  ),
  openCase(6, "Verlängerung offen", "Re: Mietdauer", "Kann ich die Miete um einen weiteren Tag verlängern?"),
  openCase(7, "Rechnung offen", "Re: Unterlagen", "Können Sie mir eine Rechnung auf meine Firma ausstellen?"),
  openCase(8, "Zahlung offen", "Re: Angebot", "Muss ich den Betrag vorab überweisen oder kann ich vor Ort bezahlen?"),
  openCase(9, "Termin offen", "Re: Zeitraum", "Wäre auch eine Abholung am Sonntagabend möglich?"),
  openCase(10, "Größe offen", "Re: Fahrradgröße", "Welche Rahmengröße empfehlen Sie mir bei 178 cm Körpergröße?"),
  openCase(11, "Versicherung offen", "Re: Mietbedingungen", "Ist im Mietpreis eine Diebstahlversicherung enthalten?"),
  openCase(12, "Öffnungszeit offen", "Re: Abholung", "Bis wann hat der Standort am Freitag geöffnet?"),
  openCase(13, "Kaution offen", "Re: Zahlung", "Wie hoch ist die Kaution und wann wird sie zurückerstattet?"),
  openCase(14, "Zubehörbitte offen", "Re: Ausrüstung", "Bitte reservieren Sie zusätzlich zwei Helme in Größe M."),
  openCase(15, "Lieferung offen", "Re: Service", "Könnten Sie die Räder auch zu unserem Hotel liefern?"),
  openCase(16, "Modell offen", "Re: Angebot", "Welches konkrete Fahrrad ist in dem Angebot für mich vorgesehen?"),
  openCase(
    17,
    "Englische Frage offen",
    "Re: Bike rental",
    "Could you confirm whether the rental includes a bike lock?",
  ),
  openCase(
    18,
    "Englische Terminbitte offen",
    "Re: Pickup",
    "Would it be possible to pick up the bikes one hour earlier?",
  ),
  openCase(19, "Datenschutzbitte offen", "Re: Booking", "Bitte löschen Sie meine alte Telefonnummer aus dem Vorgang."),
  openCase(
    20,
    "Mehrere Fragen offen",
    "Re: Reservation",
    "Is breakfast included, and can I change the pickup location?",
  ),
  closedCase(21, "Danke nach Antwort", "Re: Fahrradverleih", "Vielen Dank, das beantwortet meine Frage vollständig."),
  closedCase(22, "Angebot bestätigt", "Re: Angebot", "Das Angebot passt für mich, ich habe keine weiteren Fragen."),
  closedCase(23, "Alles klar", "Re: Abholung", "Alles klar, wir sehen uns am Samstag. Danke!"),
  closedCase(24, "Zahlung bestätigt", "Re: Zahlung", "Die Zahlung ist erfolgt. Von meiner Seite ist alles erledigt."),
  closedCase(25, "Keine weiteren Fragen", "Re: Buchung", "Danke für die schnelle Antwort, es ist nichts mehr offen."),
  closedCase(26, "Termin bestätigt", "Re: Zeitraum", "Der Termin am 12. September ist notiert. Vielen Dank."),
  closedCase(
    27,
    "Unterlagen erhalten",
    "Re: Unterlagen",
    "Ich habe die Rechnung erhalten und brauche nichts Weiteres.",
  ),
  closedCase(28, "Ausrüstung passt", "Re: Ausrüstung", "Die vorgeschlagene Ausrüstung ist genau richtig, danke."),
  closedCase(
    29,
    "Englische Bestätigung",
    "Re: Bike rental",
    "Thanks, that answers everything. We are looking forward to it.",
  ),
  closedCase(30, "Englische Verabschiedung", "Re: Pickup", "Perfect, see you then. No further questions from me."),
  closedCase(31, "Storno erledigt", "Re: Stornierung", "Danke, die Stornierung ist damit für mich erledigt."),
  closedCase(32, "Größe geklärt", "Re: Fahrradgröße", "Super, Größe M passt. Vielen Dank für die Beratung."),
  closedCase(33, "Kaution verstanden", "Re: Kaution", "Verstanden, danke für die Information zur Kaution."),
  closedCase(34, "Lieferung geklärt", "Re: Service", "Das ist in Ordnung, wir holen die Räder selbst ab."),
  closedCase(35, "Modell akzeptiert", "Re: Angebot", "Das vorgeschlagene Modell ist in Ordnung, danke."),
  closedCase(36, "Datenschutz erledigt", "Re: Booking", "Danke, die Daten sind jetzt korrekt hinterlegt."),
  closedCase(37, "Antwort akzeptiert", "Re: Reservation", "Vielen Dank, damit sind beide Punkte geklärt."),
  closedCase(38, "Freundliche Verabschiedung", "Re: Fahrradverleih", "Danke und einen schönen Tag noch."),
  closedCase(
    39,
    "Automatische Antwort abgeschlossen",
    "Re: Buchung",
    "Ihre Antwort wurde gelesen. Es ist keine Rückmeldung erforderlich.",
  ),
  closedCase(40, "Kurze Bestätigung", "Re: Angebot", "Passt, danke!"),
];
