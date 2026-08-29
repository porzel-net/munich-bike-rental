/* Dashboard Web Push service worker. Keep this file framework-independent so
 * browsers can execute it before the Next.js app has loaded. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Dashboard", body: event.data ? event.data.text() : "Neue Aktivität" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Dashboard", {
      body: data.body || "Neue Aktivität im Dashboard",
      icon: "/favicon-192.png",
      badge: "/favicon-96.png",
      tag: data.tag || "dashboard-activity",
      data: { url: data.url || "/admin" },
      requireInteraction: Boolean(data.requireInteraction),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/admin", self.location.origin).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => "focus" in client);
        if (existing) {
          existing.navigate(targetUrl);
          return existing.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
