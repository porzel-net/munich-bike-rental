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
  }
}
