# Buchhaltungsszenarien und EÜR-Abstimmung

Dieses Dokument beschreibt die fachlichen Soll-Ergebnisse für die wichtigsten Buchhaltungspfade. Die ausführbaren End-to-End-Prüfungen liegen in `tests/unit/accounting-scenarios.test.ts`.

## Grundregeln

- Ein Zahlungseingang ist auf dem Finanzkonto positiv, eine Belastung negativ.
- Eine Transaktion darf erst `posted` werden, wenn die Summe ihrer Zuordnungen exakt dem Kontoumsatz entspricht.
- Journalbuchungen sind immer ausgeglichen: Die Summe aller Journalzeilen ist null.
- Die EÜR berücksichtigt nur gebuchte (`posted`) Zuordnungen sowie AfA und Anlagenabgänge. `needs_review` und `ignored` werden nicht als EÜR-Ergebnis gezählt.
- Transfers zwischen eigenen Konten verändern Kontostände, aber nicht den Gewinn. Private und steuerlich ausgeschlossene Vorgänge bleiben ebenfalls außerhalb von Einnahmen und Ausgaben.
- Eine EÜR-Zuordnung darf ihre Identität (Betrag, Transaktion, Anlagegut und Journalbezug) nachträglich nicht verändern. Korrekturen erfolgen über neue Journalbuchungen.

## Soll-Szenarien

| Szenario                 | Geschäftsvorfälle                                                                                                                                       | Erwartete EÜR                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemischtes Geschäftsjahr | 1.000,00 € Einnahme, 250,00 € Reparatur, 80,00 € USt-Zahlung, 47,50 € Vorsteuer, 19,00 € Umsatzsteuer, 200,00 € interne Umbuchung, 50,00 € privat       | Einnahmen 1.000,00 €, Ausgaben 330,00 €, Gewinn 670,00 €, Vorsteuer 47,50 €, Umsatzsteuer 19,00 €, USt-Zahlung 80,00 €. Die Umbuchung zählt 200,00 € als interne Bewegung, nicht als Aufwand.                                                                                      |
| Stripe-Zahlung           | 100,00 € Bruttozahlung, 3,00 € Stripe-Gebühr, 97,00 € Netto und spätere Stripe-Auszahlung                                                               | Einnahmen 100,00 €, Ausgaben 3,00 €, Gewinn 97,00 €. Die Auszahlung von 97,00 € ist nur ein Transfer und erzeugt keine zweite Einnahme. Das Stripe-Verrechnungskonto steht danach wieder auf null.                                                                                 |
| Rückerstattung           | 100,00 € Zahlung, danach 25,00 € Rückerstattung                                                                                                         | Einnahmen 75,00 €, Ausgaben 0,00 €, Gewinn 75,00 €. Die Rückzahlung wird über die Kategorie `refund` als negative Einnahme und mit `refund_issued` gebucht, nicht als beliebiger Aufwand.                                                                                          |
| Anlagegut und Verkauf    | Anschaffung 1.190,00 € brutto (1.000,00 € netto + 190,00 € Vorsteuer), AfA Januar bis März insgesamt 250,00 €, Verkauf für 500,00 € netto + 95,00 € USt | Keine sofortige Ausgabe für die Anschaffung, Vorsteuer 190,00 €, Einnahmen 500,00 €, Umsatzsteuer 95,00 €, Aufwand 1.000,00 € (AfA 250,00 € + Restbuchwert 750,00 €), Gewinn −500,00 €. Der Verkauf darf nicht zusätzlich aus den alten Anlagenfeldern ein zweites Mal erscheinen. |
| Geschäftsessen           | 100,00 € Zahlung, davon 20,00 € privat und 12,77 € Vorsteuer                                                                                            | 47,06 € abzugsfähiger Aufwand und 12,77 € separat ausgewiesene Vorsteuer. Der nicht abzugsfähige Geschäftsanteil und der private Anteil bleiben aus dem Gewinn heraus.                                                                                                             |

## Bewusste Schutzregeln

Die Anwendung lehnt unter anderem ungeklärte Kategorien, unvollständige Zuordnungen, Anlagegutdaten an normalen Aufwänden, Zielkonten bei Nicht-Transfers, Umbuchungen auf dasselbe Konto, inaktive Konten, Währungsabweichungen und negative normale Einnahmen ab. Eine negative Einnahme ist nur im expliziten Rückerstattungsfall zulässig.

Die Werte für Vorsteuer, Umsatzsteuer und USt-Zahlungen werden im aktuellen Modell separat geführt. Insbesondere wird eine Kategorie `vat_payment` als `tax_payment` zusätzlich in den Ausgaben und in `vatPaymentCents` ausgewiesen. Das ist die derzeit festgelegte Anwendungslogik; die endgültige steuerliche Behandlung und die Übertragung in eine amtliche Anlage EÜR muss mit der konkreten Umsatzsteuer- und Steuerberaterkonfiguration abgeglichen werden.
