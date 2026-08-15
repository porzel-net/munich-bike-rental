import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("CardDAV deployment hardening", () => {
  it("keeps Radicale private and strips client authorization before proxying", () => {
    const compose = readFileSync("docker-compose.server.yml", "utf8");
    const baseCompose = readFileSync("docker-compose.yml", "utf8");
    const nginx = readFileSync("docker/nginx-site.conf.example", "utf8");
    const radicale = readFileSync("radicale/config/config", "utf8");

    expect(compose).toContain('"127.0.0.1:5232:5232"');
    expect(baseCompose).toContain("./radicale/config:/config:ro");
    expect(baseCompose).toContain('TAKE_FILE_OWNERSHIP: "false"');
    expect(baseCompose).toContain("- SETUID");
    expect(baseCompose).toContain("- SETGID");
    expect(baseCompose).toContain("- KILL");
    expect(nginx).toContain("auth_request /_carddav_auth;");
    expect(nginx).toContain('proxy_set_header Authorization "";');
    expect(nginx).toContain("location = /_carddav_auth {");
    expect(nginx).toContain("internal;");
    expect(nginx).toContain("limit_conn connections_per_ip 10;");
    expect(nginx).toContain("location = /api/internal/carddav/auth {");
    expect(nginx).toContain("location = /.well-known/carddav {");
    expect(nginx).toContain("location = /.well-known/caldav {");
    expect(nginx).toContain("proxy_set_header X-Remote-User $carddav_user;");
    expect(radicale).toContain("type = http_x_remote_user");
    expect(radicale).toContain("type = owner_only");
    expect(radicale).not.toContain("filesystem_fsync");
  });
});
