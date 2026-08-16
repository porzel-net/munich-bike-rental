import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("calendar deployment hardening", () => {
  it("does not retain the legacy global calendar credentials or token", () => {
    const files = [
      ".env.example",
      "docker-compose.yml",
      "lib/startup-check.ts",
      "app/admin/calendar/page.tsx",
      "lib/calendar/basic-auth.ts",
    ];
    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      expect(contents, file).not.toContain("CALENDAR_FEED_");
    }
    expect(existsSync("app/api/calendar/[token]/route.ts")).toBe(false);
  });

  it("rate-limits the Basic Auth feed and varies caches by credentials", () => {
    const security = readFileSync("docker/nginx-http-security.conf.example", "utf8");
    const nginx = readFileSync("docker/nginx-site.conf.example", "utf8");
    const route = readFileSync("app/api/calendar/feed.ics/route.ts", "utf8");

    expect(security).toContain("zone=calendar_auth_per_ip");
    expect(nginx).toContain("location = /api/calendar/feed.ics");
    expect(nginx).toContain("limit_req zone=calendar_auth_per_ip");
    expect(route).toContain('Vary: "Authorization"');
    expect(route).toContain('"Cache-Control": "private, no-cache, must-revalidate"');
  });
});
