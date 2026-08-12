# Security-Audit – 2026-08-11

## Ergebnis

Der Code wurde statisch, anhand der aktuellen Security-Leitlinien und mit
lokalen Laufzeittests geprüft. Ein echter Berechtigungsfehler im Dashboard
wurde behoben: Standortnutzer konnten zuvor standortübergreifende aggregierte
Buchungs- und Umsatzkennzahlen erhalten. Zusätzlich werden produktive
WhatsApp-/Baileys-Logs jetzt unterdrückt und History-Sync-Payloads nicht
verarbeitet.

Eine pauschale Aussage „sicher für die Veröffentlichung“ wäre trotzdem nicht
seriös: Der externe Produktionsserver, Reverse Proxy, DNS/TLS, echte
Secrets, Backups und die Konfiguration der GitHub-Security-Features konnten
aus diesem Workspace nicht verifiziert werden. Vor dem Go-Live müssen die
offenen Punkte im Abschnitt „Freigabe-Gates“ erfüllt sein.

## Umfang und Methode

- Repository- und Git-Historie auf Secret-/Credential-Muster geprüft.
- Authentifizierung, Session-Cookies, 2FA/Passkeys, Origin-Schutz, Rollen,
  Standortgrenzen und Objektzugriffe gelesen.
- Alle API-Routen und Admin-Seiten auf explizite Guards geprüft.
- Public capability links, Stripe-Checkout/Webhook, interne Bearer-Token,
  Calendar-Basic-Auth, Uploads, PDF-Erzeugung, Mail- und AI-Datenflüsse
  geprüft.
- Dockerfile, Compose-Härtung, Nginx-Beispiel und CI geprüft.
- Laufzeittests gegen den lokalen Standalone-Produktionsbuild ausgeführt:
  unauthentifizierte Admin-/Internal-Zugriffe, falsche Origin, ungültige
  Tokens und Security-Header.
- Vergleich mit OWASP API Security Top 10, OWASP File Upload/CSP, Next.js
  Security Advisories, GitHub Dependency Review/Push Protection und Baileys
  Security-Hinweisen.

## Befunde

### SEC-01 – Standortübergreifende Dashboard-Aggregate (behoben, hoch)

`app/admin/page.tsx` lud mehrere Booking-Aggregate ohne Standortfilter. Ein
angemeldeter `standortuser` konnte dadurch fremde Umsatz-, Funnel-,
Nachfrage- und Auslastungskennzahlen sehen, obwohl die Detailseiten bereits
korrekt geschützt waren. Das ist ein Broken-Object-/Tenant-Level-Authorization-
Problem.

Behoben durch eine zentrale `getVisibleLocationScope`-Regel und explizite
Standortfilter für alle Dashboard-Booking-/Asset-Abfragen. Ein Test deckt
Admin-, gültige Standort- und ungültige Standortrollen ab.

### SEC-02 – WhatsApp-Metadaten in Logs und History-Sync (behoben, mittel)

Baileys kann standardmäßig JIDs und Nachrichtenmetadaten loggen. Der
Connector verwendet jetzt einen Silent Logger und
`shouldSyncHistoryMessage: () => false`. Der Auth-State liegt weiterhin als
hochwertiges WhatsApp-Credential im persistenten Datenvolume und muss wie ein
SSH-Key geschützt werden.

### SEC-03 – Baileys 6.x nicht mehr unterstützt (offen, mittel)

Die installierte Version `6.7.23` ist für das aktuelle kritische 6.x-Advisory
gepatcht, wird vom Maintainer aber als nicht mehr unterstützt geführt. Für
die Veröffentlichung sollte der Connector auf eine getestete Baileys-7.x-
Version migriert werden. Das ist wegen möglicher Breaking Changes nicht
automatisch in diesem Audit erzwungen worden.

### SEC-04 – Abhängigkeiten und externe Konfiguration (offen, release-blocking)

`pnpm audit --prod` konnte in dieser Umgebung wegen fehlender erreichbarer
Registry/Audit-Kommunikation nicht zuverlässig abgeschlossen werden. Die CI
führt deshalb zusätzlich `pnpm audit --prod --audit-level=high` und einen
Dependency-Review bei Pull Requests aus. Ein grüner CI-Lauf sowie die Prüfung
der aktuellen Advisories bleiben ein Go-Live-Gate.

## Positiv verifizierte Kontrollen

- Better Auth Secret in Produktion mindestens 32 Zeichen und HTTPS-Origin.
- `httpOnly`, `SameSite=Strict`, Secure-Cookies in Produktion, acht Stunden
  Session-Laufzeit und deaktivierter Cookie-Cache.
- Pflicht-2FA; TOTP-Trust-Device wird nicht als dauerhafte Abkürzung erlaubt;
  Passkeys verlangen User Verification.
- Rollen `admin`/`standortuser`, Standortgrenzen und Assignee-Prüfungen sind
  in den mutation-/objektbezogenen APIs vorhanden.
- Origin-Prüfung bei Browser-Mutationen, begrenzte Request-Bodies und
  Rate-Limits bei Public-Flows.
- Stripe-Webhooks prüfen HMAC-Signatur und Zeitfenster; die Buchungs-/Betrags-
  prüfung ist serverseitig und idempotent.
- Uploads sind auf autorisierte Admins, 15 MB und erlaubte Magic Bytes
  begrenzt, liegen außerhalb des Webroots und werden als Download ausgeliefert.
- Invoice-LaTeX nutzt `execFile` ohne Shell und escaped Benutzerdaten.
- Docker: non-root, read-only root filesystem, kein Netzwerk-Port nach außen
  im Compose-App-Service, `cap_drop: ALL`, `no-new-privileges`, Limits und
  verschlüsselte Restic-Backups.
- Produktionsheader: CSP mit Nonce, HSTS, `nosniff`, `DENY`, strikte
  Referrer-Policy, Permissions-Policy, CORP und private/no-store für sensible
  Bereiche.
- Git-Scan fand keine echten Stripe-/Cloud-/SSH-Secrets. Die Test-Fixture
  `tests/fixtures/smtp-password.txt` enthält nur einen ausdrücklich
  synthetischen Testwert.

## Tests

- `pnpm typecheck` – bestanden
- `pnpm lint` – bestanden
- `pnpm test` – 28 Testdateien, 126 Tests bestanden, 1 Test übersprungen
- `pnpm exec next build --webpack` – bestanden; 77 statische Seiten erzeugt
- Standalone-DAST-Smoke-Test – bestanden:
  - `/api/health` liefert 200 ohne sensitive Details.
  - `/admin` redirectet unauthentifiziert zu `/admin/login`.
  - geschützte Finanz- und interne APIs liefern ohne Session/Token 401.
  - falsche Origin wird bei Admin-Mutation mit 403 abgewiesen.
  - ungültiger Calendar-Capability-Token liefert 404.
  - Produktionsantworten enthalten CSP, HSTS, `nosniff`, `DENY`, Referrer- und
    Permissions-Policy; `X-Powered-By` fehlt.

## Freigabe-Gates

1. `pnpm audit --prod --audit-level=high` und Dependency Review in GitHub grün.
2. Baileys 7.x in einer Staging-Instanz mit WhatsApp-Reconnect, QR, Auth-State
   und Logout getestet; danach Auth-State/Session bei Bedarf rotieren.
3. GitHub Secret Scanning und Push Protection aktivieren; bei einem echten
   historischen Leak sofort beim Provider widerrufen und ersetzen.
4. Reverse Proxy strikt auf die echten Hostnamen konfigurieren, `X-Real-IP`
   überschreiben, HTTP zu HTTPS umleiten, TLS-Zertifikate prüfen und Port 3000
   nicht öffentlich exponieren.
5. Produktionswerte prüfen: HTTPS für alle Origins, zufällige mindestens
   32-Byte-Secrets, separate Tokens je Job, restriktive Basic-Auth für den
   Kalender, verschlüsseltes Backup-Passwort und sichere Secret-Dateirechte.
6. Staging-DAST mit echten Rollen ausführen: anonymous, Standort A,
   Standort B, Admin; IDs, Methoden, `Origin`, Prefetch-/RSC-Varianten,
   Uploads, Rate-Limits, Stripe-Testevents und interne Jobs prüfen.
7. Logging/Monitoring auf Auth-Fehler, 401/403-Spikes, Webhook-Replay,
   Job-Fehler, Backup-Fehler und ungewöhnliche Public-Token-Zugriffe einrichten.
8. Datenschutz/Retention für Buchungen, Mailinhalte, AI-Logs, WhatsApp-State,
   Finanzbelege und Backups fachlich/organisatorisch freigeben.

## Quellen

- [OWASP API Security Top 10 – BOLA](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP CSP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [Next.js Proxy-Dokumentation](https://nextjs.org/docs/app/getting-started/proxy)
- [Next.js Proxy-Bypass-Advisory GHSA-26hh-7cqf-hhc6](https://github.com/vercel/next.js/security/advisories/GHSA-26hh-7cqf-hhc6)
- [GitHub Dependency Review](https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review)
- [GitHub Push Protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)
- [Baileys Security Advisory GHSA-qvv5-jq5g-4cgg](https://github.com/WhiskeySockets/Baileys/security/advisories/GHSA-qvv5-jq5g-4cgg)
