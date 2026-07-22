/**
 * Initialize the auth store when the Node.js server starts. This prints the
 * first-admin invitation if the database has no users, without creating one.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/auth");

    const [{ getDatabase }, { expirePendingBookingConfirmations }] = await Promise.all([
      import("./lib/db/client"),
      import("./lib/inquiries/confirmation"),
    ]);
    const sweep = () => {
      try {
        expirePendingBookingConfirmations(getDatabase());
      } catch (error) {
        console.error("Failed to expire pending booking confirmations", error);
      }
    };

    sweep();
    const timer = setInterval(sweep, 60_000);
    timer.unref?.();
  }
}
