import { mkdir } from "node:fs/promises";

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState as loadMultiFileAuthState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";

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

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    await mkdir(authDirectory, { recursive: true, mode: 0o700 });
    const { state, saveCreds } = await loadMultiFileAuthState(authDirectory);
    const { version } = await fetchLatestBaileysVersion({ timeout: 10_000 });
    this.snapshot = { status: "connecting", qrDataUrl: null, phone: null, error: null };

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
    socket.ev.on("creds.update", saveCreds);
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
        return;
      }

      if (connection !== "close") return;
      const disconnectError = lastDisconnect?.error as DisconnectError | undefined;
      const statusCode = disconnectError?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        this.snapshot = {
          status: "logged_out",
          qrDataUrl: null,
          phone: null,
          error: "Das WhatsApp-Konto wurde abgemeldet.",
        };
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
      this.reconnectTimer = setTimeout(() => void this.start(), 3000);
    });

    return this.snapshot;
  }
}

const globalStore = globalThis as typeof globalThis & { whatsappConnection?: WhatsAppConnection };
export const whatsappConnection = (globalStore.whatsappConnection ??= new WhatsAppConnection());
