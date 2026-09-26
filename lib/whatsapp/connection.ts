import { mkdir, rename } from "node:fs/promises";
import { resolve } from "node:path";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  extractMessageContent,
  fetchLatestWaWebVersion,
  type WAMessage,
  useMultiFileAuthState as loadMultiFileAuthState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";

import { getDatabase } from "../db/client";
import { MAX_FINANCIAL_DOCUMENT_BYTES } from "../financial/documents";
import { isAuthorizedWhatsAppReceiptSender, processWhatsAppFinancialReceipt } from "../financial/whatsapp-receipts";

export type WhatsAppConnectionStatus = "idle" | "connecting" | "qr" | "connected" | "logged_out" | "error";

export type WhatsAppConnectionDiagnostics = {
  inboundEventCount: number;
  lastInboundAt: string | null;
  lastInboundEvent: "message_batch" | "message_receipt" | null;
  lastConnectionOpenedAt: string | null;
  lastProbeAt: string | null;
  lastProbeSucceededAt: string | null;
  lastProbeFailedAt: string | null;
  lastDisconnectStatusCode: number | null;
};

export type WhatsAppConnectionSnapshot = {
  status: WhatsAppConnectionStatus;
  qrDataUrl: string | null;
  phone: string | null;
  error: string | null;
  diagnostics: WhatsAppConnectionDiagnostics;
};

type StartOptions = {
  /**
   * WhatsApp invalidates the stored credentials after a logout. Only an
   * authenticated administrator using the settings screen may replace them;
   * background reconnects must leave the state intact for diagnosis.
   */
  resetLoggedOutAuth?: boolean;
  /** Explicit admin action for migrations that require a fresh Signal session. */
  forceRelink?: boolean;
};

const authDirectory =
  process.env.WHATSAPP_AUTH_DIR?.trim() ||
  (process.env.NODE_ENV === "production" ? "/data/whatsapp-auth" : "./data/whatsapp-auth");

// Baileys' default logger includes WhatsApp JIDs and message metadata. Those
// values are personal data and must not end up in container logs, which are
// commonly shipped to third-party log collectors.
const silentLogger = {
  level: "silent",
  child: () => silentLogger,
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

type DisconnectError = {
  message?: string;
  output?: {
    statusCode?: number;
  };
};

function freshDiagnostics(): WhatsAppConnectionDiagnostics {
  return {
    inboundEventCount: 0,
    lastInboundAt: null,
    lastInboundEvent: null,
    lastConnectionOpenedAt: null,
    lastProbeAt: null,
    lastProbeSucceededAt: null,
    lastProbeFailedAt: null,
    lastDisconnectStatusCode: null,
  };
}

export function isSupportedWhatsAppDirectChat(remoteJid: string) {
  return remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@lid");
}

export function whatsappConversationKind(remoteJid: string | null | undefined) {
  if (!remoteJid) return "missing";
  if (remoteJid.endsWith("@s.whatsapp.net")) return "phone";
  if (remoteJid.endsWith("@lid")) return "lid";
  if (remoteJid.endsWith("@g.us")) return "group";
  return "other";
}

/** Returns a phone number only when Baileys supplied a trustworthy PN mapping for a LID chat. */
export function incomingWhatsAppSenderPhone(key: Pick<WAMessage["key"], "remoteJid"> & { remoteJidAlt?: string }) {
  const remoteJid = key.remoteJid;
  if (typeof remoteJid !== "string") return null;
  // Baileys 7 supplies the paired phone-number JID as remoteJidAlt whenever
  // the direct conversation itself is addressed by a LID.
  if (remoteJid.endsWith("@lid")) return key.remoteJidAlt?.split("@")[0] || null;
  return remoteJid.split("@")[0] || null;
}

/**
 * Collects decrypted WhatsApp media without trusting its sender-provided
 * length. Throwing inside the async iterator closes the Baileys stream, so an
 * oversized upload cannot be buffered in full before validation.
 */
export async function readWhatsAppMediaWithinLimit(
  stream: AsyncIterable<Uint8Array>,
  maximumBytes = MAX_FINANCIAL_DOCUMENT_BYTES,
) {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    if (bytes.byteLength > maximumBytes - byteLength)
      throw new Error("WhatsApp-Beleg überschreitet die zulässige Größe.");
    chunks.push(bytes);
    byteLength += bytes.byteLength;
  }
  return Buffer.concat(chunks, byteLength);
}

class WhatsAppConnection {
  private reconnectTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private startPromise: Promise<WhatsAppConnectionSnapshot> | null = null;
  private socket: ReturnType<typeof makeWASocket> | null = null;
  private diagnostics = freshDiagnostics();
  private snapshot: WhatsAppConnectionSnapshot = {
    status: "idle",
    qrDataUrl: null,
    phone: null,
    error: null,
    diagnostics: freshDiagnostics(),
  };

  getSnapshot() {
    return { ...this.snapshot, diagnostics: { ...this.diagnostics } };
  }

  async start(options: StartOptions = {}) {
    if (options.forceRelink) {
      await this.unlinkAndArchiveAuthState();
    }
    if (
      this.snapshot.status === "connecting" ||
      this.snapshot.status === "qr" ||
      this.snapshot.status === "connected"
    ) {
      return this.getSnapshot();
    }

    if (this.startPromise) return this.startPromise;

    this.startPromise = (async () => {
      if (this.snapshot.status === "logged_out") {
        if (!options.resetLoggedOutAuth) return this.getSnapshot();
        await this.archiveLoggedOutAuthState();
      }
      return this.connect();
    })();
    try {
      return await this.startPromise;
    } catch (error) {
      this.snapshot = {
        status: "error",
        qrDataUrl: null,
        phone: null,
        error: error instanceof Error ? error.message : "WhatsApp-Verbindung konnte nicht gestartet werden.",
        diagnostics: this.diagnostics,
      };
      throw error;
    } finally {
      this.startPromise = null;
    }
  }

  private async archiveLoggedOutAuthState() {
    // Keep the prior device state recoverable for support instead of deleting
    // a Docker volume or the application's other persistent data.
    const resolvedAuthDirectory = resolve(authDirectory);
    if (["/", "/data", resolve(".")].includes(resolvedAuthDirectory)) {
      throw new Error("WHATSAPP_AUTH_DIR muss auf ein eigenes Unterverzeichnis zeigen.");
    }
    const archivedDirectory = `${authDirectory}.logged-out-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    try {
      await rename(authDirectory, archivedDirectory);
      console.info("WhatsApp logged-out credentials archived for an explicit relink");
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }

    await mkdir(authDirectory, { recursive: true, mode: 0o700 });
    this.socket = null;
    this.clearHealthChecks();
    this.diagnostics = freshDiagnostics();
    this.snapshot = { status: "idle", qrDataUrl: null, phone: null, error: null, diagnostics: this.diagnostics };
  }

  private async unlinkAndArchiveAuthState() {
    const activeSocket = this.socket;
    this.socket = null;
    this.clearHealthChecks();
    if (activeSocket) {
      try {
        await activeSocket.logout();
      } catch (error) {
        console.warn("WhatsApp companion could not be unlinked before relinking", {
          errorName: error instanceof Error ? error.name : "unknown error",
        });
      }
    }
    await this.archiveLoggedOutAuthState();
  }

  private async connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearHealthChecks();

    await mkdir(authDirectory, { recursive: true, mode: 0o700 });
    const { state, saveCreds } = await loadMultiFileAuthState(authDirectory);
    this.snapshot = { status: "connecting", qrDataUrl: null, phone: null, error: null, diagnostics: this.diagnostics };
    // Pairing requires the version currently accepted by WhatsApp Web. The
    // Baileys-release version helper can lag behind and yields a QR that scans
    // but is rejected by WhatsApp during the companion-device handshake.
    const { version } = await fetchLatestWaWebVersion({ signal: AbortSignal.timeout(10_000) });

    const socket = makeWASocket({
      auth: state,
      browser: Browsers.macOS("Munich Bike Rental"),
      version,
      connectTimeoutMs: 60_000,
      logger: silentLogger,
      printQRInTerminal: false,
      syncFullHistory: false,
      // Do not process unsolicited history-sync payloads. This is also the
      // documented mitigation for the message/history spoofing issue in the
      // 6.x line until the deployment is migrated to Baileys 7.x.
      shouldSyncHistoryMessage: () => false,
    });
    this.socket = socket;
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("messages.upsert", ({ messages, type }) => {
      this.recordInboundEvent("message_batch");
      console.info("WhatsApp message batch received", {
        updateType: type,
        messageCount: messages.length,
        incomingCount: messages.filter((message) => !message.key.fromMe).length,
        outgoingCount: messages.filter((message) => message.key.fromMe).length,
      });
      if (type !== "notify") {
        console.info("WhatsApp message batch skipped because it is not a live notification", { updateType: type });
        return;
      }
      for (const message of messages) void this.handleIncomingReceipt(socket, message);
    });
    socket.ev.on("message-receipt.update", () => {
      this.recordInboundEvent("message_receipt");
    });
    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.snapshot = {
          ...this.snapshot,
          status: "qr",
          qrDataUrl: await QRCode.toDataURL(qr),
          error: null,
          diagnostics: this.diagnostics,
        };
      }

      if (connection === "open") {
        this.diagnostics.lastConnectionOpenedAt = new Date().toISOString();
        this.diagnostics.lastDisconnectStatusCode = null;
        this.snapshot = {
          status: "connected",
          qrDataUrl: null,
          phone: socket.user?.id?.split(":")[0] ?? null,
          error: null,
          diagnostics: this.diagnostics,
        };
        console.info("WhatsApp connection established");
        this.scheduleHealthChecks(socket);
        return;
      }

      if (connection !== "close") return;
      const disconnectError = lastDisconnect?.error as DisconnectError | undefined;
      const statusCode = disconnectError?.output?.statusCode;
      this.diagnostics.lastDisconnectStatusCode = statusCode ?? null;
      this.clearHealthChecks();
      if (statusCode === DisconnectReason.loggedOut) {
        this.socket = null;
        this.snapshot = {
          status: "logged_out",
          qrDataUrl: null,
          phone: null,
          error: "Das WhatsApp-Konto wurde abgemeldet.",
          diagnostics: this.diagnostics,
        };
        console.warn("WhatsApp connection logged out");
        return;
      }

      this.snapshot = {
        status: "error",
        qrDataUrl: null,
        phone: null,
        error:
          statusCode === DisconnectReason.connectionClosed
            ? "WhatsApp hat die Verbindung geschlossen (428). Neuer Verbindungsversuch folgt."
            : `Die Verbindung zu WhatsApp wurde unterbrochen${statusCode ? ` (${statusCode})` : ""}. Neuer Verbindungsversuch folgt.`,
        diagnostics: this.diagnostics,
      };
      this.socket = null;
      console.warn("WhatsApp connection interrupted", { statusCode: statusCode ?? "unknown" });
      this.reconnectTimer = setTimeout(() => void this.start(), 3000);
    });

    return this.getSnapshot();
  }

  private recordInboundEvent(event: WhatsAppConnectionDiagnostics["lastInboundEvent"]) {
    this.diagnostics.inboundEventCount += 1;
    this.diagnostics.lastInboundAt = new Date().toISOString();
    this.diagnostics.lastInboundEvent = event;
  }

  private clearHealthChecks() {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = null;
  }

  private scheduleHealthChecks(socket: ReturnType<typeof makeWASocket>) {
    this.clearHealthChecks();
    const checkHealth = async () => {
      if (this.socket !== socket || this.snapshot.status !== "connected") return;
      const ownPhone = socket.user?.id?.split("@")[0]?.split(":")[0];
      if (!ownPhone) return;

      this.diagnostics.lastProbeAt = new Date().toISOString();
      let timeoutId: NodeJS.Timeout | null = null;
      try {
        await Promise.race([
          socket.onWhatsApp(ownPhone),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("WhatsApp health probe timed out")), 25_000);
          }),
        ]);
        this.diagnostics.lastProbeSucceededAt = new Date().toISOString();
      } catch (error) {
        this.diagnostics.lastProbeFailedAt = new Date().toISOString();
        console.error("WhatsApp socket health probe failed; forcing recovery", {
          errorName: error instanceof Error ? error.name : "unknown error",
        });
        if (process.env.NODE_ENV === "production") {
          // Docker's restart policy provides a fresh process, which is more
          // reliable than recreating a potentially deaf Baileys socket in-process.
          setTimeout(() => process.exit(1), 250).unref();
        } else {
          socket.ws?.close();
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };
    this.healthCheckTimer = setInterval(() => void checkHealth(), 90_000);
    this.healthCheckTimer.unref?.();
  }

  private async handleIncomingReceipt(socket: ReturnType<typeof makeWASocket>, message: WAMessage) {
    const remoteJid = message.key.remoteJid;
    const conversationKind = whatsappConversationKind(remoteJid);
    console.info("Incoming WhatsApp message observed", {
      conversationKind,
      fromMe: Boolean(message.key.fromMe),
      hasMessageId: Boolean(message.key.id),
      senderPhoneAvailable: Boolean(message.key.remoteJidAlt),
    });
    if (message.key.fromMe) {
      console.info("Outgoing WhatsApp message observed");
      return;
    }
    if (!remoteJid) {
      console.warn("Incoming WhatsApp message skipped because it has no conversation identifier");
      return;
    }
    if (!isSupportedWhatsAppDirectChat(remoteJid)) {
      console.info("Incoming WhatsApp message skipped because it is not a direct chat");
      return;
    }
    if (!message.key.id) {
      console.warn("Incoming WhatsApp message skipped because it has no message identifier");
      return;
    }
    const content = extractMessageContent(message.message);
    const image = content?.imageMessage;
    const document = content?.documentMessage;
    const mimeType = image?.mimetype ?? document?.mimetype;
    if (!image && !document) {
      console.info("Incoming WhatsApp message skipped because it is not a document or image");
      return;
    }
    if (!mimeType || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
      console.info("Incoming WhatsApp media skipped because its file type is unsupported", {
        mediaKind: image ? "image" : "document",
        mimeType: mimeType ?? "missing",
      });
      return;
    }
    const senderPhone = incomingWhatsAppSenderPhone(message.key);
    if (!senderPhone) {
      console.warn("Incoming WhatsApp LID receipt skipped because no phone mapping was supplied");
      return;
    }
    if (!isAuthorizedWhatsAppReceiptSender(getDatabase(), senderPhone)) {
      // Authenticate before downloading any attacker-controlled media. The
      // processor repeats this check because it is also callable internally.
      console.info("Incoming WhatsApp receipt skipped because its sender is not an active admin");
      return;
    }
    const advertisedFileLength = image?.fileLength ?? document?.fileLength;
    if (typeof advertisedFileLength === "number" && advertisedFileLength > MAX_FINANCIAL_DOCUMENT_BYTES) {
      console.info("Incoming WhatsApp receipt skipped because its advertised size exceeds the limit");
      return;
    }

    try {
      console.info("Incoming WhatsApp financial receipt received", { mimeType });
      // WhatsApp only displays this while the document is being downloaded,
      // OCRed and reconciled; the final response below stops it again.
      await socket.sendPresenceUpdate("composing", remoteJid);
      const mediaStream = await downloadMediaMessage(
        message,
        "stream",
        {},
        { reuploadRequest: socket.updateMediaMessage, logger: silentLogger },
      );
      const bytes = await readWhatsAppMediaWithinLimit(mediaStream);
      console.info("Incoming WhatsApp financial receipt downloaded", { mimeType, byteLength: bytes.byteLength });
      const result = await processWhatsAppFinancialReceipt(getDatabase(), {
        messageId: message.key.id,
        senderPhone,
        fileName: document?.fileName ?? `WhatsApp-Beleg.${mimeType === "application/pdf" ? "pdf" : "jpg"}`,
        mimeType: mimeType as "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
        bytes,
        caption: image?.caption ?? document?.caption ?? "",
      });
      // Do not confirm messages from unknown numbers: a response would reveal
      // that the accounting assistant is active to an untrusted sender.
      if (result.outcome !== "ignored" && result.outcome !== "duplicate") {
        console.info("WhatsApp receipt response sending", { outcome: result.outcome });
        await socket.sendMessage(remoteJid, { text: `🏦 ${result.message}` });
        console.info("WhatsApp receipt response sent", { outcome: result.outcome });
      }
      console.info("Incoming WhatsApp financial receipt handled", {
        outcome: result.outcome,
        documentId: "documentId" in result ? result.documentId : null,
        transactionId: "transactionId" in result ? result.transactionId : null,
      });
    } catch (error) {
      // Media payloads and OCR failures must not bring down the WhatsApp
      // connection. Avoid logging sender/message content.
      console.error(
        "Failed to process incoming WhatsApp financial receipt",
        error instanceof Error ? error.name : "unknown error",
      );
    } finally {
      await socket.sendPresenceUpdate("paused", remoteJid).catch(() => undefined);
    }
  }

  async sendTextMessage(phone: string, text: string) {
    if (this.snapshot.status !== "connected" || !this.socket) {
      throw new Error("WhatsApp ist derzeit nicht verbunden.");
    }
    const digits = phone.replace(/\D/g, "").replace(/^00/, "");
    if (digits.length < 8) throw new Error("Die WhatsApp-Nummer des Empfängers ist ungültig.");
    console.info("WhatsApp operational notification sending", { textLength: text.length });
    await this.socket.sendMessage(`${digits}@s.whatsapp.net`, { text });
    console.info("WhatsApp operational notification sent");
  }
}

const globalStore = globalThis as typeof globalThis & { whatsappConnection?: WhatsAppConnection };
export const whatsappConnection = (globalStore.whatsappConnection ??= new WhatsAppConnection());
