import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";

import {
  incomingWhatsAppSenderPhone,
  isSupportedWhatsAppDirectChat,
  readWhatsAppMediaWithinLimit,
  whatsappConversationKind,
} from "@/lib/whatsapp/connection";

describe("WhatsApp direct-message normalization", () => {
  it("accepts both phone-number and LID direct chats", () => {
    expect(isSupportedWhatsAppDirectChat("491701234567@s.whatsapp.net")).toBe(true);
    expect(isSupportedWhatsAppDirectChat("123456789012345@lid")).toBe(true);
    expect(isSupportedWhatsAppDirectChat("123456@g.us")).toBe(false);
  });

  it("uses the Baileys phone mapping for an LID sender", () => {
    expect(
      incomingWhatsAppSenderPhone({ remoteJid: "123456789012345@lid", remoteJidAlt: "491701234567@s.whatsapp.net" }),
    ).toBe("491701234567");
    expect(incomingWhatsAppSenderPhone({ remoteJid: "123456789012345@lid" })).toBeNull();
  });

  it("classifies conversation identifiers without logging their values", () => {
    expect(whatsappConversationKind("491701234567@s.whatsapp.net")).toBe("phone");
    expect(whatsappConversationKind("123456789012345@lid")).toBe("lid");
    expect(whatsappConversationKind("123456@g.us")).toBe("group");
  });

  it("stops an oversized media download even when WhatsApp advertises a smaller file", async () => {
    await expect(readWhatsAppMediaWithinLimit(Readable.from([Buffer.alloc(5), Buffer.alloc(6)]), 10)).rejects.toThrow(
      "überschreitet die zulässige Größe",
    );
  });
});
