import { describe, expect, it } from "vitest";

import { splitMailThreadBody } from "../../lib/inquiries/mail-thread";
import { plainTextFromSource } from "../../lib/inquiries/mailbox";

describe("mail thread body splitting", () => {
  it("ignores binary MIME attachments when extracting the message body", () => {
    const source = Buffer.from(
      [
        "Content-Type: multipart/mixed; boundary=mail-boundary",
        "",
        "--mail-boundary",
        "Content-Type: image/tiff",
        "Content-Transfer-Encoding: base64",
        "",
        "TU0AKgAAAAA=",
        "--mail-boundary",
        "Content-Type: text/plain; charset=utf-8",
        "",
        "Hallo, hier ist der eigentliche Mailtext.",
        "--mail-boundary--",
      ].join("\r\n"),
    );

    expect(plainTextFromSource(source)).toBe("Hallo, hier ist der eigentliche Mailtext.");
  });

  it("keeps the latest reply visible and collapses the quoted history", () => {
    const result = splitMailThreadBody(`Hallo Valerie,

Vielen Dank für deine Rückmeldung.

> Am 23.07.2026 um 10:23 schrieb valerie.gottschalk <valerie.gottschalk@protonmail.com>:
>
> Lieber Justus,
>
> Vielen Dank für die Rückmeldung.
>
> -------- Original Message --------
> On Tuesday, 07/21/26 at 15:33 Justus Bahr <hallo@munich-bike-rental.de> wrote:
> Hallo Valerie,
> vielen Dank für deine Anfrage!`);

    expect(result.visibleText).toContain("Hallo Valerie");
    expect(result.visibleText).toContain("Vielen Dank für deine Rückmeldung.");
    expect(result.quotedText).toContain("Am 23.07.2026");
    expect(result.quotedText).toContain("Original Message");
    expect(result.quotedText).not.toContain("Vielen Dank für deine Rückmeldung.");
  });

  it("returns the whole body when there is no quoted history marker", () => {
    const result = splitMailThreadBody("Hallo zusammen,\n\nDas ist eine normale Nachricht.");

    expect(result.visibleText).toBe("Hallo zusammen,\n\nDas ist eine normale Nachricht.");
    expect(result.quotedText).toBeNull();
  });

  it("does not render persisted binary attachment data", () => {
    const result = splitMailThreadBody("MM\u0000*\u0001\u0011\u0000\u0000\u0000binary data");

    expect(result.visibleText).toBe("Der Inhalt dieser E-Mail konnte nicht gelesen werden.");
    expect(result.quotedText).toBeNull();
  });
});
