import { mkdir } from "node:fs/promises";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  extractMessageContent,
  fetchLatestBaileysVersion,
  type WAMessage,
  useMultiFileAuthState as loadMultiFileAuthState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";

import { getDatabase } from "../db/client";
import { MAX_FINANCIAL_DOCUMENT_BYTES } from "../financial/documents";
import { isAuthorizedWhatsAppReceiptSender, processWhatsAppFinancialReceipt } from "../financial/whatsapp-receipts";

export type WhatsAppConnectionStatus = "idle" | "connecting" | "qr" | "connected" | "logged_out" | "error";

export type WhatsAppConnectionSnapshot = {
  status: WhatsAppConnectionStatus;
  qrDataUrl: string | null;
  phone: string | null;
  error: string | null;
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

class WhatsAppConnection {
  private reconnectTimer: NodeJS.Timeout | null = null;
  private startPromise: Promise<WhatsAppConnectionSnapshot> | null = null;
  private socket: ReturnType<typeof makeWASocket> | null = null;
  private snapshot: WhatsAppConnectionSnapshot = {
    status: "idle",
    qrDataUrl: null,
    phone: null,
    error: null,
  };

  getSnapshot() {
    return this.snapshot;
  }

  async start() {
    if (
      this.snapshot.status === "connecting" ||
      this.snapshot.status === "qr" ||
      this.snapshot.status === "connected"
    ) {
      return this.snapshot;
    }

    if (this.startPromise) return this.startPromise;

    this.startPromise = this.connect();
    try {
      return await this.startPromise;
    } catch (error) {
      this.snapshot = {
        status: "error",
        qrDataUrl: null,
        phone: null,
        error: error instanceof Error ? error.message : "WhatsApp-Verbindung konnte nicht gestartet werden.",
      };
      throw error;
    } finally {
      this.startPromise = null;
    }
  }

  private async connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    await mkdir(authDirectory, { recursive: true, mode: 0o700 });
    const { state, saveCreds } = await loadMultiFileAuthState(authDirectory);
    this.snapshot = { status: "connecting", qrDataUrl: null, phone: null, error: null };
    const { version } = await fetchLatestBaileysVersion({ timeout: 10_000 });

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
    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        this.snapshot = { ...this.snapshot, status: "qr", qrDataUrl: await QRCode.toDataURL(qr), error: null };
      }

      if (connection === "open") {
        this.snapshot = {
          status: "connected",
          qrDataUrl: null,
          phone: socket.user?.id?.split(":")[0] ?? null,
          error: null,
        };
        console.info("WhatsApp connection established");
        return;
      }

      if (connection !== "close") return;
      const disconnectError = lastDisconnect?.error as DisconnectError | undefined;
      const statusCode = disconnectError?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        this.socket = null;
        this.snapshot = {
          status: "logged_out",
          qrDataUrl: null,
          phone: null,
          error: "Das WhatsApp-Konto wurde abgemeldet.",
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
      };
      this.socket = null;
      console.warn("WhatsApp connection interrupted", { statusCode: statusCode ?? "unknown" });
      this.reconnectTimer = setTimeout(() => void this.start(), 3000);
    });

    return this.snapshot;
  }

  private async handleIncomingReceipt(socket: ReturnType<typeof makeWASocket>, message: WAMessage) {
    const remoteJid = message.key.remoteJid;
    if (message.key.fromMe) {
      console.info("Outgoing WhatsApp message observed");
      return;
    }
    if (!remoteJid) {
      console.warn("Incoming WhatsApp message skipped because it has no conversation identifier");
      return;
    }
    if (!remoteJid.endsWith("@s.whatsapp.net")) {
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
    const senderPhone = (message.key.senderPn ?? remoteJid).split("@")[0];
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
      const bytes = await downloadMediaMessage(
        message,
        "buffer",
        {},
        { reuploadRequest: socket.updateMediaMessage, logger: silentLogger },
      );
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
