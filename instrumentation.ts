/**
 * Initialize the auth store when the Node.js server starts. This prints the
 * first-admin invitation if the database has no users, without creating one.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { runStartupChecks } = await import("./lib/startup-check");
    await runStartupChecks();

    await import("./lib/auth");

    const [{ getDatabase }, { expireDueOffers }, { isNevloConfigured }] = await Promise.all([
      import("./lib/db/client"),
      import("./lib/bookings/service"),
      import("./lib/nevlo"),
    ]);
    const sweep = () => {
      try {
        expireDueOffers(getDatabase());
      } catch (error) {
        console.error("Failed to expire due booking offers", error);
      }
    };

    sweep();
    const timer = setInterval(sweep, 60_000);
    timer.unref?.();

    const { drainCarddavSyncQueue } = await import("./lib/carddav/queue");
    const syncCarddav = () => {
      void drainCarddavSyncQueue().catch((error) => {
        console.error("Failed to process CardDAV synchronization queue", error);
      });
    };
    syncCarddav();
    const carddavTimer = setInterval(syncCarddav, 2_000);
    carddavTimer.unref?.();

    let nevloSyncInFlight = false;
    const syncNevlo = async () => {
      if (!isNevloConfigured() || nevloSyncInFlight) return;
      nevloSyncInFlight = true;
      try {
        const { syncNevloTransactions } = await import("./lib/financial/nevlo-sync");
        const result = await syncNevloTransactions(getDatabase());
        console.info("Nevlo auto synchronization completed", {
          inserted: result.inserted,
          skipped: result.skipped,
        });
      } catch (error) {
        console.error("Failed to automatically synchronize Nevlo transactions", error);
      } finally {
        nevloSyncInFlight = false;
      }
    };

    void syncNevlo();
    const nevloTimer = setInterval(() => void syncNevlo(), 5 * 60_000);
    nevloTimer.unref?.();

    if (process.env.STARTUP_CHECKS_MODE !== "browser-test") {
      // Keep incoming-mail synchronization server-side so the AI question
      // check does not depend on a deployment-host cron job being configured.
      const { syncIncomingMail } = await import("./lib/inquiries/mailbox");
      let incomingMailSyncInFlight = false;
      const syncIncomingMailCycle = async () => {
        if (incomingMailSyncInFlight) return;
        incomingMailSyncInFlight = true;
        try {
          const result = await syncIncomingMail();
          if (result.checked > 0) {
            console.info("Incoming mail synchronization completed", {
              checked: result.checked,
              skipped: result.skipped,
              bookings: result.bookings.length,
            });
          }
        } catch (error) {
          console.error("Failed to synchronize incoming mail", error);
        } finally {
          incomingMailSyncInFlight = false;
        }
      };
      void syncIncomingMailCycle();
      const incomingMailTimer = setInterval(() => void syncIncomingMailCycle(), 60_000);
      incomingMailTimer.unref?.();

      // WhatsApp notifications must be processed by the server itself, not by
      // an open admin browser tab. The durable outbox and idempotency keys make
      // this safe alongside the optional deployment-host endpoint.
    const { whatsappConnection } = await import("./lib/whatsapp/connection");
    const { runWhatsAppNotificationCycle } = await import("./lib/whatsapp/notifications");
    const { runWebPushNotificationCycle } = await import("./lib/web-push/notifications");
      void whatsappConnection.start().catch((error) => {
        console.error("Failed to start WhatsApp connection", error);
      });
      let whatsappCycleInFlight = false;
      const runWhatsAppCycle = async () => {
        if (whatsappCycleInFlight) return;
        whatsappCycleInFlight = true;
        try {
          await runWhatsAppNotificationCycle();
        } catch (error) {
          console.error("Failed to process WhatsApp notifications", error);
        } finally {
          whatsappCycleInFlight = false;
        }
      };
      void runWhatsAppCycle();
    const whatsappTimer = setInterval(() => void runWhatsAppCycle(), 60_000);
    whatsappTimer.unref?.();

    let webPushCycleInFlight = false;
    const runWebPushCycle = async () => {
      if (webPushCycleInFlight) return;
      webPushCycleInFlight = true;
      try {
        await runWebPushNotificationCycle();
      } catch (error) {
        console.error("Failed to process browser push notifications", error);
      } finally {
        webPushCycleInFlight = false;
      }
    };
    void runWebPushCycle();
    const webPushTimer = setInterval(() => void runWebPushCycle(), 60_000);
    webPushTimer.unref?.();
  }
}
}
