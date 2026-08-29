/**
 * Browser Push endpoints are supplied by the client, but the server later
 * makes an outbound request to them. Keep this allowlist deliberately narrow
 * so a forged subscription cannot turn notification delivery into SSRF.
 */
const allowedPushServiceDomains = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
] as const;

function normalizedHostname(hostname: string) {
  return hostname.toLowerCase().replace(/\.+$/u, "");
}

export function isAllowedWebPushEndpoint(endpoint: string) {
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return false;
    if (parsed.port && parsed.port !== "443") return false;

    const hostname = normalizedHostname(parsed.hostname);
    return allowedPushServiceDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}
