import { describe, expect, it } from "vitest";

import { splitMailThreadBody } from "../../lib/inquiries/mail-thread";

describe("mail thread body splitting", () => {
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
});
