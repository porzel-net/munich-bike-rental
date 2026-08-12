import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { getTableConfig } from "drizzle-orm/sqlite-core";
import { isTable, sql } from "drizzle-orm";

import { getBookingMigrationPreflight } from "./bookings/preflight";
import { getDatabase, getDatabasePath, type AppDatabase } from "./db/client";
import * as schema from "./db/schema";
import { checkNevloConnection } from "./financial/nevlo-sync";
import { seedRentalInventoryIfEmpty } from "./inventory/seed";
import { getMailConfig, readSecret, verifyMailConnection } from "./inquiries/server";
import { verifyImapConnection } from "./inquiries/mailbox";
import { listStripeCheckoutSessions } from "./stripe";

export type StartupCheckStatus = "ok" | "warn" | "skipped" | "failed";

export type StartupCheckResult = {
  name: string;
  status: StartupCheckStatus;
  critical: boolean;
  durationMs: number;
  message: string;
  details?: Record<string, unknown>;
};

export type StartupCheckReport = {
  ok: boolean;
  checkedAt: string;
  checks: StartupCheckResult[];
};

export class StartupCheckError extends Error {
  public readonly report: StartupCheckReport;

  constructor(report: StartupCheckReport) {
    super(
      `Startup-Checks fehlgeschlagen: ${report.checks
        .filter((check) => check.status === "failed")
        .map((check) => check.name)
        .join(", ")}`,
    );
    this.name = "StartupCheckError";
    this.report = report;
  }
}

let lastStartupCheckReport: StartupCheckReport | null = null;

export function getStartupCheckReport() {
  return lastStartupCheckReport;
}

function isProduction(environment: Partial<NodeJS.ProcessEnv>) {
  return (
    environment.NODE_ENV === "production" &&
    environment.NEXT_PHASE !== "phase-production-build" &&
    environment.STARTUP_CHECKS_MODE !== "browser-test"
  );
}

function isPresent(environment: Partial<NodeJS.ProcessEnv>, name: string) {
  return Boolean(environment[name]?.trim());
}

function hasAny(environment: Partial<NodeJS.ProcessEnv>, names: readonly string[]) {
  return names.some((name) => isPresent(environment, name));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

function assertUrl(environment: Partial<NodeJS.ProcessEnv>, name: string, production: boolean, errors: string[]) {
  const value = environment[name]?.trim();
  if (!value) {
    if (production) errors.push(`${name} fehlt`);
    return;
  }

  try {
    const url = new URL(value);
    if (production && url.protocol !== "https:") errors.push(`${name} muss in Produktion HTTPS verwenden`);
  } catch {
    errors.push(`${name} ist keine gültige URL`);
  }
}

function checkConfiguration(environment: Partial<NodeJS.ProcessEnv>) {
  const production = isProduction(environment);
  const errors: string[] = [];

  try {
    getDatabasePath(environment);
  } catch (error) {
    errors.push(errorMessage(error));
  }

  assertUrl(environment, "APP_ORIGIN", production, errors);
  assertUrl(environment, "BETTER_AUTH_URL", production, errors);
  assertUrl(environment, "SITE_URL", production, errors);

  const authSecret = environment.BETTER_AUTH_SECRET?.trim();
  if (production && (!authSecret || authSecret.length < 32)) {
    errors.push("BETTER_AUTH_SECRET muss mindestens 32 Zeichen enthalten");
  }

  const calendarToken = environment.CALENDAR_FEED_TOKEN?.trim();
  if (calendarToken && calendarToken.length < 32)
    errors.push("CALENDAR_FEED_TOKEN muss mindestens 32 Zeichen enthalten");

  const calendarUser = isPresent(environment, "CALENDAR_FEED_USERNAME");
  const calendarPassword = isPresent(environment, "CALENDAR_FEED_PASSWORD");
  if (calendarUser !== calendarPassword)
    errors.push("CALENDAR_FEED_USERNAME und CALENDAR_FEED_PASSWORD müssen gemeinsam gesetzt sein");
  if (calendarPassword && (environment.CALENDAR_FEED_PASSWORD?.length ?? 0) < 16) {
    errors.push("CALENDAR_FEED_PASSWORD muss mindestens 16 Zeichen enthalten");
  }

  const nevloNames = ["NEVLO_CLIENT_ID", "NEVLO_ACCESS_TOKEN", "NEVLO_REFRESH_TOKEN"] as const;
  const nevloConfigured = nevloNames.filter((name) => isPresent(environment, name)).length;
  if (nevloConfigured > 0 && nevloConfigured < nevloNames.length) {
    errors.push("NEVLO_CLIENT_ID, NEVLO_ACCESS_TOKEN und NEVLO_REFRESH_TOKEN müssen gemeinsam gesetzt sein");
  }

  const stripeSecret = environment.STRIPE_SECRET_KEY?.trim();
  const stripeWebhook = environment.STRIPE_WEBHOOK_SECRET?.trim();
  if (stripeSecret && !/^sk_(test_|live_)?[A-Za-z0-9]/u.test(stripeSecret))
    errors.push("STRIPE_SECRET_KEY hat kein gültiges Stripe-Format");
  if (stripeWebhook && !stripeWebhook.startsWith("whsec_"))
    errors.push("STRIPE_WEBHOOK_SECRET muss mit whsec_ beginnen");
  if (production && Boolean(stripeSecret) !== Boolean(stripeWebhook))
    errors.push("STRIPE_SECRET_KEY und STRIPE_WEBHOOK_SECRET müssen gemeinsam gesetzt sein");

  if (errors.length > 0) throw new Error(errors.join("; "));
  return {
    status: "ok" as const,
    message: production
      ? "Produktionskonfiguration und Secret-Formate sind plausibel"
      : "Konfiguration und Secret-Formate sind plausibel",
  };
}

function readMigrationJournal(migrationsFolder: string) {
  const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
    entries?: Array<{ idx?: number; when?: number; tag?: string }>;
  };
  return journal.entries ?? [];
}

function validateDatabase(db: AppDatabase, migrationsFolder: string, production: boolean) {
  const integrity = db.get<{ integrity_check: string }>(sql`PRAGMA integrity_check`);
  if (integrity?.integrity_check !== "ok")
    throw new Error(`SQLite integrity_check: ${integrity?.integrity_check ?? "kein Ergebnis"}`);

  const foreignKeyViolations = db.all(sql`PRAGMA foreign_key_check`);
  if (foreignKeyViolations.length > 0)
    throw new Error(`SQLite foreign_key_check meldet ${foreignKeyViolations.length} Verletzung(en)`);

  const foreignKeys = db.get<{ foreign_keys: number }>(sql`PRAGMA foreign_keys`);
  if (foreignKeys?.foreign_keys !== 1) throw new Error("SQLite foreign_keys ist nicht aktiviert");

  const journalEntries = readMigrationJournal(migrationsFolder);
  const appliedMigrations = db.all<{ created_at: number; hash: string }>(sql`
    SELECT created_at, hash FROM __drizzle_migrations ORDER BY created_at
  `);
  const appliedByCreatedAt = new Map(appliedMigrations.map((migration) => [migration.created_at, migration.hash]));
  const missingMigrations: string[] = [];
  const migrationHashMismatches: string[] = [];
  for (const entry of journalEntries) {
    if (!entry.tag) {
      missingMigrations.push(`Index ${entry.idx ?? "unbekannt"} ohne Migrationstag`);
      continue;
    }
    if (entry.when === undefined) {
      missingMigrations.push(`${entry.tag} ohne Zeitstempel`);
      continue;
    }
    const migrationPath = join(migrationsFolder, `${entry.tag}.sql`);
    const expectedHash = createHash("sha256").update(readFileSync(migrationPath)).digest("hex");
    const appliedHash = appliedByCreatedAt.get(entry.when);
    if (!appliedHash) {
      missingMigrations.push(`${entry.tag} (nicht angewendet)`);
    } else if (appliedHash !== expectedHash) {
      migrationHashMismatches.push(entry.tag);
    }
  }
  if (missingMigrations.length > 0) {
    throw new Error(`Migrationen fehlen: ${missingMigrations.join(", ")}`);
  }
  if (production && migrationHashMismatches.length > 0) {
    throw new Error(`Migration-Hash passt nicht zur ausgelieferten Datei: ${migrationHashMismatches.join(", ")}`);
  }

  const tableDefinitions = Object.values(schema).filter((value) => isTable(value)) as Array<
    Parameters<typeof getTableConfig>[0]
  >;
  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  for (const table of tableDefinitions) {
    const tableConfig = getTableConfig(table);
    const tableName = tableConfig.name;
    const tableExists = db.get<{ present: number }>(sql`
      SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ${tableName}
    `);
    if (!tableExists) {
      missingTables.push(tableName);
      continue;
    }

    const actualColumns = new Set(
      db
        .all<{ name: string }>(sql.raw(`PRAGMA table_info("${tableName.replaceAll('"', '""')}")`))
        .map((column) => column.name),
    );
    for (const column of tableConfig.columns) {
      if (!actualColumns.has(column.name)) missingColumns.push(`${tableName}.${column.name}`);
    }
  }
  if (missingTables.length > 0 || missingColumns.length > 0) {
    throw new Error(
      `Schema unvollständig: fehlende Tabellen [${missingTables.join(", ") || "keine"}], ` +
        `fehlende Spalten [${missingColumns.join(", ") || "keine"}]`,
    );
  }

  return {
    status: "ok" as const,
    message: "SQLite, Migrationen und Drizzle-Schema sind vollständig geprüft",
    details: { migrations: appliedMigrations.length, tables: tableDefinitions.length },
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 15_000) {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Zeitüberschreitung nach ${timeoutMs} ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function runCheck(
  checks: StartupCheckResult[],
  name: string,
  critical: boolean,
  check: () =>
    | Promise<{ status: StartupCheckStatus; message: string; details?: Record<string, unknown> }>
    | { status: StartupCheckStatus; message: string; details?: Record<string, unknown> },
) {
  const startedAt = Date.now();
  console.info("[startup] check_started", { check: name });
  try {
    const outcome = await check();
    const result = { name, critical, durationMs: Date.now() - startedAt, ...outcome } satisfies StartupCheckResult;
    checks.push(result);
    const log = result.status === "failed" ? console.error : result.status === "warn" ? console.warn : console.info;
    log(`[startup] check_${result.status}`, {
      check: name,
      durationMs: result.durationMs,
      message: result.message,
      ...result.details,
    });
  } catch (error) {
    const result: StartupCheckResult = {
      name,
      critical,
      durationMs: Date.now() - startedAt,
      status: "failed",
      message: errorMessage(error),
    };
    checks.push(result);
    console.error("[startup] check_failed", { check: name, durationMs: result.durationMs, message: result.message });
  }
}

export async function runStartupChecks(
  environment: Partial<NodeJS.ProcessEnv> = process.env,
): Promise<StartupCheckReport> {
  const checks: StartupCheckResult[] = [];
  await runCheck(checks, "configuration", true, () => checkConfiguration(environment));

  let db: AppDatabase | null = null;
  await runCheck(checks, "database", true, () => {
    db = getDatabase();
    const result = validateDatabase(db, resolve(process.cwd(), "drizzle"), production);
    seedRentalInventoryIfEmpty(db);
    return {
      ...result,
      message: `${result.message}; Mietinventar-Seed ist angewendet`,
    };
  });

  await runCheck(checks, "browser-fixture", false, () => {
    if (environment.STARTUP_CHECKS_MODE !== "browser-test") {
      return { status: "skipped", message: "Nur im browser-test-Modus aktiviert" };
    }
    if (!db) return { status: "failed", message: "Browser-Fixture kann ohne Datenbank nicht angelegt werden" };
    seedRentalInventoryIfEmpty(db);
    return { status: "ok", message: "Browser-Testdaten für das Mietinventar sind vorbereitet" };
  });

  await runCheck(checks, "booking-data-preflight", false, () => {
    if (!db) return { status: "skipped", message: "Übersprungen, weil die Datenbank nicht verfügbar ist" };
    const preflight = getBookingMigrationPreflight(db);
    if (preflight.ok) return { status: "ok", message: "Keine offenen Buchungs-/Asset-Konflikte gefunden" };
    return {
      status: "warn",
      message: "Buchungsdaten benötigen fachliche Nachbearbeitung",
      details: {
        unmappedBookings: preflight.unmapped.length,
        allocationConflicts: preflight.allocationConflicts.length,
      },
    };
  });

  const sharedMailNames = [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_PASSWORD_FILE",
    "SMTP_PORT",
    "SMTP_SECURE",
    "MAIL_USE_SSL",
    "MAIL_USE_STARTTLS",
  ] as const;
  const accountMailNames = {
    request: [
      "SMTP_REQUEST_HOST",
      "SMTP_REQUEST_USER",
      "SMTP_REQUEST_PASSWORD",
      "SMTP_REQUEST_PASSWORD_FILE",
      "SMTP_REQUEST_PORT",
      "SMTP_REQUEST_SECURE",
      "MAIL_REQUEST_FROM_ADDRESS",
      "MAIL_REQUEST_TO_ADDRESS",
    ],
    main: [
      "SMTP_MAIN_HOST",
      "SMTP_MAIN_USER",
      "SMTP_MAIN_PASSWORD",
      "SMTP_MAIN_PASSWORD_FILE",
      "SMTP_MAIN_PORT",
      "SMTP_MAIN_SECURE",
      "MAIL_MAIN_FROM_ADDRESS",
    ],
  } as const;
  for (const account of ["request", "main"] as const) {
    const accountHasConfiguration =
      hasAny(environment, sharedMailNames) || hasAny(environment, accountMailNames[account]);
    await runCheck(checks, `smtp-${account}`, accountHasConfiguration, async () => {
      if (!accountHasConfiguration) {
        return { status: "skipped", message: "SMTP ist nicht konfiguriert" };
      }
      const configured = await getMailConfig(environment, account);
      if (!configured) {
        return {
          status: "failed",
          message: `SMTP-Konfiguration für ${account} ist unvollständig`,
        };
      }
      await withTimeout(verifyMailConnection(account, environment));
      return {
        status: "ok",
        message: `SMTP-Verbindung für ${account} ist erreichbar`,
        details: { host: configured.host, port: configured.port },
      };
    });
  }

  const imapNames = ["IMAP_MAIN_HOST", "IMAP_MAIN_USER", "IMAP_MAIN_PASSWORD", "IMAP_MAIN_PASSWORD_FILE"] as const;
  await runCheck(checks, "imap-main", true, async () => {
    if (!hasAny(environment, imapNames)) return { status: "skipped", message: "IMAP ist nicht konfiguriert" };
    const result = await withTimeout(verifyImapConnection(environment));
    return { status: "ok", message: "IMAP-Verbindung ist erreichbar", details: result };
  });

  await runCheck(checks, "nevlo", true, async () => {
    const configured = ["NEVLO_CLIENT_ID", "NEVLO_ACCESS_TOKEN", "NEVLO_REFRESH_TOKEN"].every((name) =>
      isPresent(environment, name),
    );
    if (!configured) return { status: "skipped", message: "Nevlo ist nicht aktiviert" };
    if (!db) return { status: "failed", message: "Nevlo kann ohne Datenbank nicht geprüft werden" };
    const result = await withTimeout(checkNevloConnection(db));
    return { status: "ok", message: "Nevlo API-Verbindung und Token sind gültig", details: result };
  });

  await runCheck(checks, "stripe", true, async () => {
    if (!isPresent(environment, "STRIPE_SECRET_KEY") && !isPresent(environment, "STRIPE_WEBHOOK_SECRET")) {
      return { status: "skipped", message: "Stripe ist nicht konfiguriert" };
    }
    const result = await withTimeout(listStripeCheckoutSessions({ limit: 1 }));
    return {
      status: "ok",
      message: "Stripe API-Verbindung und Secret sind gültig",
      details: { sessions: result.data.length },
    };
  });

  await runCheck(checks, "openai", true, async () => {
    if (!hasAny(environment, ["OPENAI_API_KEY", "OPENAI_API_KEY_FILE"])) {
      return { status: "skipped", message: "OpenAI ist nicht konfiguriert" };
    }
    const apiKey = await readSecret(environment, "OPENAI_API_KEY");
    if (!apiKey?.trim()) return { status: "failed", message: "OPENAI_API_KEY ist nicht lesbar" };
    if (!apiKey.trim().startsWith("sk-"))
      return { status: "failed", message: "OPENAI_API_KEY hat kein gültiges Format" };
    const response = await withTimeout(
      fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        cache: "no-store",
      }),
    );
    if (!response.ok) return { status: "failed", message: `OpenAI API antwortet mit HTTP ${response.status}` };
    return { status: "ok", message: "OpenAI API-Verbindung und API-Key sind gültig" };
  });

  const report: StartupCheckReport = {
    ok: checks.every((check) => check.status !== "failed" || !check.critical),
    checkedAt: new Date().toISOString(),
    checks,
  };
  lastStartupCheckReport = report;
  console.info("[startup] checks_completed", {
    ok: report.ok,
    failed: checks.filter((check) => check.status === "failed").map((check) => check.name),
    warnings: checks.filter((check) => check.status === "warn").map((check) => check.name),
  });
  if (!report.ok) throw new StartupCheckError(report);
  return report;
}
