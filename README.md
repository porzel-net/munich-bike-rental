# BikeRental

Next.js-App Router Projekt für einen Fahrradverleih mit SSR, Kontaktformular und gehärtetem Docker-Setup.

## Entwicklung

```bash
corepack enable
pnpm install
pnpm dev
```

## Produktion auf Ubuntu

Das Ziel-Setup ist:

- der Next.js-Container läuft nur intern auf `3000`
- der externe Zugriff läuft über einen Nginx Reverse Proxy auf dem Host
- der Container veröffentlicht keine `80`/`443`-Ports
- der Container läuft als Non-Root-User, mit Read-Only-Filesystem und ohne zusätzliche Capabilities
- Bike-Anfragen werden zusätzlich zum E-Mail-Versand in einer persistenten SQLite-Datenbank gespeichert

## Deployment-Flow

Der produktive Weg ist:

1. Docker-Image in GitHub bauen und in eine Registry pushen
2. Auf dem Ubuntu-Server die Registry-Zugangsdaten hinterlegen
3. Das Image per `docker compose pull` holen
4. Den Stack mit den produktiven Env-Variablen starten

Wichtig:

- `docker compose pull` funktioniert nur, wenn das Image wirklich in einer Registry liegt, z. B. GitHub Container Registry
- der lokale Build `docker build` ist nur für Tests oder ein manuelles Release-Image
- das Image selbst enthält keine SMTP- oder Domain-Konfiguration; die kommt erst zur Laufzeit über die `.env`

## Voraussetzungen auf dem Server

- Ubuntu Server
- Docker Engine
- Docker Compose Plugin
- Nginx auf dem Host
- optional: Firewall, z. B. `ufw`

Für lokale Builds und Deployments ist eine gepatchte Node-Linie sinnvoll:

- `22.23.1` oder neuer in der 22er-Linie
- `24.17.0` oder neuer in der 24er-Linie
- `26.3.1` oder neuer in der 26er-Linie

`v25.9.0` ist damit nicht die empfohlene Zielversion für dieses Projekt.

## Umgebungsvariablen

Lege auf dem Server eine `.env`-Datei neben der Compose-Datei an. Diese Datei steuert sowohl das zu ziehende Image als auch die produktive Laufzeitkonfiguration.

```dotenv
APP_IMAGE=ghcr.io/porzel-net/munich-bike-rental:latest
APP_PIDS_LIMIT=128
APP_MEMORY_LIMIT=512m
APP_CPU_LIMIT=1.0
SITE_URL=https://www.deine-domain.tld
APP_ORIGIN=https://www.deine-domain.tld
BETTER_AUTH_URL=https://www.deine-domain.tld
# Für jedes Token separat mit `openssl rand -base64 48` erzeugen; nie in Git einchecken.
BETTER_AUTH_SECRET=sehr-langes-zufälliges-geheimnis
MAIL_SYNC_TOKEN=separates-langes-zufälliges-mail-token
OUTBOX_DISPATCH_TOKEN=separates-langes-zufälliges-outbox-token
WHATSAPP_DISPATCH_TOKEN=separates-langes-zufälliges-whatsapp-token
# Der einmalige Bootstrap-Link für den ersten Admin wird beim Serverstart geloggt.
# Lokal: ./data/bikerental.db. Im Docker-Stack ist der feste, persistente Pfad /data/bikerental.db gesetzt.
DATABASE_URL=./data/bikerental.db
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
MAIL_USE_SSL=true
MAIL_USE_STARTTLS=false
MAIL_TIMEOUT_SECONDS=20
SMTP_REQUEST_USER=dein-request-user
# SMTP_REQUEST_PASSWORD=dein-request-passwort
SMTP_REQUEST_PASSWORD_FILE=/run/secrets/smtp_request_password
MAIL_REQUEST_FROM_ADDRESS=anfrage@deine-domain.tld
MAIL_REQUEST_TO_ADDRESS=hallo@deine-domain.tld
SMTP_MAIN_USER=dein-main-user
# SMTP_MAIN_PASSWORD=dein-main-passwort
SMTP_MAIN_PASSWORD_FILE=/run/secrets/smtp_main_password
MAIL_MAIN_FROM_ADDRESS=hallo@deine-domain.tld
IMAP_MAIN_HOST=imap.example.com
IMAP_MAIN_PORT=993
IMAP_MAIN_SECURE=true
IMAP_MAIN_USER=dein-main-user
IMAP_MAIN_PASSWORD_FILE=/run/secrets/imap_password
# Mail poller and AI review of incoming customer questions
OPENAI_API_KEY=sk-...
# Alternativ als Docker Secret: OPENAI_API_KEY_FILE=/run/secrets/openai_api_key
OPENAI_MODEL=gpt-5.6-luna
OPENAI_REASONING_EFFORT=middle
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID=AW-XXXXXXXXX
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL=XXXXXXXXXXXX
DEV_ALLOWED_ORIGINS=
# Nur für den Stripe-Sandbox-Test: serverseitiger Testschlüssel, niemals sk_live_ verwenden.
STRIPE_SECRET_KEY=sk_test_...
# Signaturgeheimnis des Stripe-Webhooks für bezahlte Angebote.
STRIPE_WEBHOOK_SECRET=whsec_...
```

Für produktive Zugänge sind `SMTP_REQUEST_PASSWORD_FILE`, `SMTP_MAIN_PASSWORD_FILE` und optional `IMAP_MAIN_PASSWORD_FILE` statt Klartext-Passwörtern vorzuziehen. Die App liest den Inhalt einer nur lesbaren Secret-Datei, wenn die entsprechende `*_FILE`-Variable gesetzt ist. Binde diese Dateien im Produktivbetrieb beispielsweise als Docker-Secrets oder schreibgeschützte Bind-Mounts ein.

Wichtig:

- `APP_IMAGE` muss auf das fertige Image aus deiner Registry zeigen
- `SITE_URL`, `APP_ORIGIN` und `BETTER_AUTH_URL` müssen zur echten HTTPS-Domain passen; Compose verweigert den Start, wenn sie fehlen
- `BETTER_AUTH_SECRET`, `MAIL_SYNC_TOKEN`, `OUTBOX_DISPATCH_TOKEN` und `WHATSAPP_DISPATCH_TOKEN` müssen jeweils eigene, mindestens 32 Zeichen lange Zufallswerte sein; die Anwendung verweigert schwache Feed-/Job-Tokens.
- Wenn die Datenbank noch keinen Benutzer enthält, wird der einmalige Ersteinladungslink nach dem Start als `BOOTSTRAP_ADMIN_INVITATION=...` im App-Log ausgegeben. Lies ihn mit `docker compose ... logs app` aus. Der Link ist ein Secret und sollte nicht dauerhaft in zentralen Logs gespeichert oder weitergegeben werden.
- Apple-Kalender-Feeds verwenden keine globalen Zugangsdaten aus `.env`. Jeder berechtigte Admin- oder Standortbenutzer kann im Adminbereich unter `Kalender` einen persönlichen read-only-Zugang erzeugen. Der zufällige Benutzername und das Passwort werden nur einmalig angezeigt; in der Datenbank bleibt ausschließlich ein scrypt-Hash. Rotation und Widerruf werden im Audit-Log protokolliert. Administratoren kopieren einen Gesamtlink für alle Standorte; Standortbenutzer erhalten serverseitig nur ihren zugewiesenen Standort. Jeder Feed enthält nur die Status `Anfrage eingegangen`, `Angebot versendet`, `Verbindlich gebucht` und `Abgeschlossen`; bei Änderungen aktualisieren `LAST-MODIFIED`, `SEQUENCE` und ETag den bestehenden Kalendereintrag.
- Der Kalender-Feed enthält nur die für die Einsatzplanung nötigen Daten (Name, Auftrag, Zeitraum, Standort, Fahrrad-/Ausstattungsdaten und Status). E-Mail, Telefonnummer, Kundennachricht, Rechnungs- und Preisdaten bleiben außerhalb des geschützten Feeds.
- `__NEXT_PRIVATE_ORIGIN` wird im Compose-Stack aus `APP_ORIGIN` gesetzt. Die Nginx-Vorlage pinnt zusätzlich `Host` und `X-Forwarded-Host` auf den konfigurierten Servernamen; übernimm diese Bindings unverändert in die produktive Konfiguration.
- SMTP-Daten niemals ins Image bake-en, nur zur Laufzeit setzen
- Die SQLite-Datei gehört niemals ins Image. Der Compose-Stack verwendet das Named Volume `app-data`; der Einmal-Service `database-init` setzt dessen Eigentümer auf den Non-Root-App-User und die Rechte auf `0700`.
- Vor dem Umschalten auf eine neue Admin-Version: verschlüsseltes Backup anlegen, `/api/admin/bookings/migration-preflight` als Administrator prüfen, dann Migration und Datenabgleich ausführen. Das Volume bleibt bei Image-Updates und Container-Neustarts erhalten. Lösche es nicht mit `docker compose down -v`, sofern die Anfragen erhalten bleiben sollen.
- SQLite ist für diesen einzelnen App-Container vorgesehen. Mehrere parallele App-Replikas dürfen nicht dasselbe SQLite-Volume beschreiben.
- `SMTP_SECURE` oder alternativ `MAIL_USE_SSL` steuern die TLS-Variante für den SMTP-Login
- `SMTP_REQUEST_*` steuert den Versand der Website-Anfragen; `SMTP_MAIN_*` steuert Buchungsbestätigungen und Ablehnungen aus dem Adminbereich
- `IMAP_MAIN_*` wird für die Suche automatischer Mailverläufe in allen IMAP-Postfächern einschließlich Papierkorb/Müll verwendet. Abgelehnte Buchungs-Mails werden automatisch in das feste Postfach `Abgelehnt` verschoben.
- Der geschützte Endpunkt `POST /api/internal/sync-incoming-mail` soll mit `Authorization: Bearer $MAIL_SYNC_TOKEN` regelmäßig (empfohlen: jede Minute) aufgerufen werden. Er synchronisiert neue Mailnachrichten, löst die Fragenprüfung aus und speichert das Ergebnis pro Buchung.
- Für die Fragenprüfung wird serverseitig die OpenAI Responses API mit `OPENAI_MODEL` (Standard `gpt-5.6-luna`) und dem Produktlabel `OPENAI_REASONING_EFFORT=middle` verwendet. Der öffentliche API-Parameter wird dafür auf `medium` abgebildet. Der alte Kurzname `gpt-luna` wird automatisch auf `gpt-5.6-luna` abgebildet. Der API-Key darf nicht mit `NEXT_PUBLIC_` beginnen.
- `MAIL_USE_STARTTLS` ist für klassische StartTLS-Setups gedacht
- `MAIL_TIMEOUT_SECONDS` begrenzt den Mail-Connect-Timeout in Sekunden
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` aktiviert Google Analytics erst nach Einwilligung in den Zweck „Analytics“
- `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID` und `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL` sind optional. Sind beide gesetzt, aktiviert die Einwilligung in den Zweck „Marketing“ die direkte Google-Ads-Conversion für das Lead-Event.
- Der öffentliche Angebotslink startet unter `/api/booking-confirmation-v2/checkout` eine Checkout-Session mit dem unveränderlichen Gesamtbetrag des versendeten Angebots. Die verbindliche Buchung und die vollständige Zahlung werden erst durch den signaturgeprüften Webhook `/api/stripe/webhook` verarbeitet. Dafür `STRIPE_WEBHOOK_SECRET` setzen.
- Der Nevlo-Sync läuft bei konfigurierten `NEVLO_*`-Zugangsdaten automatisch beim Serverstart und anschließend alle fünf Minuten. Wiederholte Läufe sind sicher; der Admin-Button bleibt für einen manuellen Sofortlauf verfügbar.
- WhatsApp wird serverseitig beim Start verbunden und prüft die Dashboard-Aktivitäten unabhängig von geöffneten Admin-Seiten minütlich. Neue oder geänderte Aktivitäten werden an den zuständigen Sachbearbeiter gesendet; nicht zugewiesene Buchungen gehen an Admins und den jeweiligen Standort. Banktransaktionen zur Prüfung gehen an Admins. Ab 12:00 Uhr Europe/Berlin wird pro Nutzer und Tag eine Übersicht aller nicht erledigten Aktivitäten inklusive „offen seit“ versendet. Dazu muss jeder Empfänger seine WhatsApp-Nummer unter `Einstellungen` hinterlegen und das WhatsApp-Konto einmalig unter `Einstellungen → WhatsApp` per QR-Code verbinden.
- Nevlo verwendet rotierende Refresh-Tokens. Nach dem einmaligen Bootstrap-Paar erneuert die Anwendung Access-Tokens automatisch vor Ablauf, speichert Access- und Refresh-Token nach jedem erfolgreichen Refresh verschlüsselt in `nevlo_oauth_tokens` und verwendet sie nach Neustarts weiter. Dafür wird `NEVLO_TOKEN_ENCRYPTION_KEY` oder `BETTER_AUTH_SECRET` verwendet; das SQLite-Volume muss persistent bleiben. Nur bei einer abgelaufenen oder widerrufenen Verbindung ist einmalig eine neue OAuth-Autorisierung nötig.
- der GitHub-Workflow pusht bei `push` auf `main` nach GHCR; Pull Requests bauen nur, ohne zu pushen
- wenn das GHCR-Package privat ist, brauchst du auf dem Server zum `docker login ghcr.io` einen GitHub PAT mit `read:packages`

Wenn du GitHub Container Registry verwendest, melde dich auf dem Server einmal an:

```bash
docker login ghcr.io
```

Danach kannst du das Image ziehen und den Stack starten:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml pull
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml up -d --build
```

Wenn du eine neue Version veröffentlichst, ziehst du sie mit demselben Befehl erneut:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml pull
```

Das kombiniert:

- `docker-compose.yml`
- `docker-compose.server.yml`

Ergebnis:

- der App-Container ist nur auf `127.0.0.1:3000` erreichbar
- von außen ist nichts direkt aus dem Container exposed
- `docker compose pull` aktualisiert das App-Image; `up -d --build backup` baut den kleinen Backup-Container aus dem Repository und startet ihn mit den aktuellen Env-Werten

## Nginx Reverse Proxy

Auf dem Ubuntu-Host läuft Nginx vor dem Container und leitet auf `127.0.0.1:3000` weiter.

Beispiel:

```nginx
server {
  listen 80;
  server_name deine-domain.tld;
  return 308 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name deine-domain.tld;

  ssl_certificate /etc/letsencrypt/live/deine-domain.tld/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/deine-domain.tld/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;

  client_max_body_size 16m;
  client_header_timeout 10s;
  client_body_timeout 10s;
  keepalive_timeout 15s;
  server_tokens off;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
  }

  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;
  add_header Referrer-Policy strict-origin-when-cross-origin always;
  add_header Permissions-Policy "camera=(), geolocation=(), microphone=()" always;
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

Passe Zertifikatspfade und Domain an und nutze diese Konfiguration nur mit gültigem TLS-Zertifikat. Für die Limits der Anfrage-Endpunkte ist zusätzlich `docker/nginx-http-security.conf.example` im `http`-Block von Nginx einzubinden.
Übernimm außerdem die route-spezifischen Body-Limits für Auth, Checkout und Stripe aus `docker/nginx-site.conf.example`; der Beleg-Upload bleibt auf 16 MB begrenzt und wird zusätzlich in der Anwendung geprüft.

## Härtung

Das Container-Setup ist absichtlich restriktiv:

- `read_only: true`
- `cap_drop: [ALL]`
- `security_opt: [no-new-privileges:true]`
- begrenzte Prozesse, Arbeitsspeicher, CPU-Zeit und Container-Logs
- schreibbares `/tmp` nur als `noexec,nosuid,nodev`-Tmpfs
- kein `privileged`
- kein Docker-Socket-Mount
- kein Host-Networking
- kein direktes Publizieren von `80`/`443` im App-Container

Zusätzlich sollte der Server so betrieben werden:

- nur `80`/`443` am Nginx offen
- `3000` nur lokal gebunden
- Updates für Docker, Nginx und Ubuntu regelmäßig einspielen
- Logs und Container-Status regelmäßig prüfen

## Kontakte und CardDAV

Die Admin-Seite `/admin/contacts` bildet die Kontakte aus den sichtbaren
Buchungen. Admins sehen alle Standorte; Standortuser sehen ausschließlich ihren
zugewiesenen Standort. Kontakte werden nach normalisierter E-Mail-Adresse
zusammengefasst und zeigen die zugehörigen Buchungen.

Für die iPhone-Synchronisierung läuft Radicale als separater, schlanker
Docker-Service. Radicale ist nicht direkt öffentlich erreichbar: Der
Produktions-Compose bindet Port 5232 nur an Loopback. Nginx nimmt HTTPS an,
prüft die individuellen CardDAV-Zugangsdaten über die interne Next.js-
Auth-Request-Route und reicht nur den geprüften Benutzer an Radicale weiter.

Zusätzlich zu den bestehenden Variablen müssen produktiv nur diese Werte
gesetzt werden:

```dotenv
CARDDAV_PUBLIC_URL=https://contacts.deine-domain.tld
CARDDAV_INTERNAL_URL=http://radicale:5232
```

`CARDDAV_INTERNAL_URL` kann beim Standard-Compose unverändert bleiben.
Die Anwendung akzeptiert standardmäßig nur interne Ziele (`radicale`, Loopback).
Bei einem abweichenden internen Service-Namen muss zusätzlich der Host explizit
über `CARDDAV_INTERNAL_ALLOWED_HOSTS` freigegeben werden; öffentliche Hosts,
URL-Credentials und externe Pfade werden abgewiesen.
`CARDDAV_PUBLIC_URL` muss der HTTPS-Host sein, den Nginx auf Radicale
weiterleitet. Die Datei `docker/nginx-site.conf.example` enthält dafür einen
separaten Server-Block. Den Hostnamen und die Zertifikatspfade ersetzen, den
HTTP-Sicherheitsblock aus `docker/nginx-http-security.conf.example` in den
Nginx-`http`-Block aufnehmen und anschließend die Konfiguration testen:

```bash
nginx -t
docker compose -f docker-compose.yml -f docker-compose.server.yml pull radicale
docker compose -f docker-compose.yml -f docker-compose.server.yml up -d
```

Die CardDAV-Passwörter werden ausschließlich als scrypt-Hashes in der
Anwendungsdatenbank gespeichert. Der Klartext wird beim Erzeugen oder Rotieren
einmalig im Dialog angezeigt. Widerruf und Rotation werden im Audit-Log
protokolliert. Das Radicale-Volume `radicale-data` muss zusammen mit dem
`app-data`-Volume in die verschlüsselten Backups aufgenommen werden.

Nach erfolgreichem Erstellen, Ändern oder Löschen einer Buchung legt SQLite
automatisch ein zusammengefasstes CardDAV-Sync-Event in der Datenbank an. Ein
interner Worker im laufenden Next.js-Prozess verarbeitet diese Queue innerhalb
weniger Sekunden; ein Cronjob ist dafür nicht erforderlich. Nicht abgearbeitete
Events bleiben bei einem Neustart erhalten.

Auf dem iPhone: Einstellungen → Apps → Kontakte → Kontakteaccounts → Account
hinzufügen → Anderen Account hinzufügen → CardDAV-Account hinzufügen. Server,
Benutzername und das einmalig angezeigte Passwort aus dem Kontakte-Dialog
verwenden. Der Button „Kontakte synchronisieren“ überträgt den für den Nutzer
sichtbaren Buchungsbestand in sein persönliches Radicale-Adressbuch.

## Prüfen

Gesundheitscheck auf dem Server:

```bash
curl http://127.0.0.1:3000/api/health
```

Status des Stacks:

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml ps
```

Logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml logs -f
```

Beim Node-Serverstart laufen zusätzlich strukturierte Startup-Checks mit dem Präfix `[startup]`. Geprüft werden die produktionsrelevante Konfiguration, Secret-Formate, SMTP/IMAP, aktivierte OpenAI-, Stripe- und Nevlo-Verbindungen sowie die SQLite-Datenbank. Die Datenbankprüfung umfasst SQLite-Integrität, Foreign Keys, den vollständigen Drizzle-Migrationsstand inklusive Hash-Abgleich und alle erwarteten Tabellen und Spalten. Ein fachlicher Buchungs-/Asset-Preflight wird als Warnung geloggt.

Fehlende oder ungültige Pflichtkonfiguration, nicht erreichbare aktivierte Integrationen und fehlerhafte Migrationen verhindern den Serverstart. Der Health-Endpunkt antwortet in diesem Fall mit HTTP 503. Secrets und Tokens werden nicht geloggt; die Logs enthalten nur Checkname, Status, Laufzeit und nicht-sensitive Details.

Registry-Status prüfen:

```bash
docker images | grep bikerental
```

## Datenbank und Migrationen

Das Drizzle-Schema liegt in `lib/db/schema.ts`; die generierten SQL-Migrationen werden mit versioniert. Neue Schemaänderungen werden lokal so erstellt:

```bash
pnpm db:generate
DATABASE_URL=./data/bikerental.db pnpm db:migrate
```

Im Docker-Setup wird `DATABASE_URL` bewusst auf `/data/bikerental.db` gesetzt und das Volume an genau diesem Pfad eingehängt. Dadurch gehen Anfragen weder bei einem Image-Neubau noch bei einem Container-Austausch verloren. Für produktive Backups wird der unten beschriebene, verschlüsselte `backup`-Service verwendet.

Die Datenbank enthält personenbezogene Kontakt- und Mietdaten. Backups gehören verschlüsselt abgelegt und sollten nur für berechtigte Personen zugänglich sein.

### Automatische verschlüsselte Vollbackups

Der Compose-Stack enthält einen separaten `backup`-Service. Er erstellt täglich um `02:30` Uhr (Zeitzone `Europe/Berlin`) einen konsistenten SQLite-Snapshot und sichert zusätzlich die Verzeichnisse für Finanzbelege, WhatsApp-Authentifizierung und das Radicale-Volume. Die Sicherung wird mit Restic komprimiert, verschlüsselt und als vollständiger wiederherstellbarer Snapshot abgelegt.

Die Aufbewahrung ist fest eingestellt auf:

- 14 tägliche Backups
- 8 wöchentliche Backups
- 12 monatliche Backups

Der Repository-Ordner muss außerhalb des `app-data`-Volumes liegen. Auf dem Server beispielsweise:

```bash
sudo install -d -m 700 /srv/bikerental-backups /srv/bikerental-secrets
openssl rand -base64 48 | sudo tee /srv/bikerental-secrets/restic-password >/dev/null
sudo chmod 600 /srv/bikerental-secrets/restic-password
```

Setze anschließend in `.env` mindestens:

```dotenv
BACKUP_DIR=/srv/bikerental-backups
BACKUP_RESTIC_PASSWORD_FILE=/srv/bikerental-secrets/restic-password
BACKUP_TIMEZONE=Europe/Berlin
BACKUP_SCHEDULE=30 2 * * *
```

Der erste Stack-Start initialisiert das verschlüsselte Repository automatisch:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml up -d --build backup
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml logs -f backup
```

Ein manuelles Backup kann jederzeit ausgeführt werden:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml run --rm backup run
```

Der Service prüft das Repository zusätzlich jeden Sonntag um `04:00` Uhr. Eine manuelle Prüfung ist möglich mit:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml run --rm backup check
```

Verfügbare Snapshots können vor einem Restore aufgelistet werden:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml run --rm backup snapshots
```

#### Restore

Ein Restore wird zuerst immer in ein separates Verzeichnis geschrieben und dort geprüft. Die produktive App bleibt dabei unverändert:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml run --rm backup restore latest
```

Das Ergebnis liegt anschließend unter `${BACKUP_DIR}/restore/`. Der Restore prüft die SQLite-Integrität automatisch. Vor dem produktiven Einsetzen muss der App-Container gestoppt werden. Der Live-Restore ist absichtlich geschützt und darf nur kontrolliert ausgeführt werden:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml stop app
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml run --rm \
  -e ALLOW_LIVE_RESTORE=true backup restore-live latest
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml start app
```

Der Live-Restore legt vor dem Ersetzen eine Kopie unter `${BACKUP_DIR}/state/before-restore-*` ab. Das Radicale-Volume wird bei einem Live-Restore bewusst nicht automatisch überschrieben; stelle die restaurierte `radicale-data`-Directory nach dem Stoppen von App und Radicale kontrolliert in das Named Volume zurück. Wenn möglich, sollte zusätzlich mindestens eine Kopie des verschlüsselten Restic-Repositorys auf einem zweiten Server oder externen Speicher liegen. Die Restic-Passwortdatei muss getrennt vom Repository aufbewahrt werden; ohne sie ist das Backup nicht entschlüsselbar.

### Buchungs-Umstellung und Outbox

Nach einem Upgrade mit Bestandsdaten zuerst den geschützten Preflight aufrufen. Er muss `{ "ok": true }` liefern; andernfalls müssen die aufgeführten aktiven Altbuchungen vor dem Umschalten konkreten Assets zugeordnet werden. Der Inventar-Bootstrap ist eine einmalige Administratoraktion über `POST /api/admin/inventory/bootstrap`; er wird bewusst nicht mehr beim Start oder in einem öffentlichen Request ausgeführt.

Der Outbox-Dispatcher wird minütlich vom Host ausgelöst. Setze `OUTBOX_DISPATCH_TOKEN` und verwende beispielsweise:

```bash
* * * * * curl --fail --silent --show-error -X POST \
  -H "Authorization: Bearer $OUTBOX_DISPATCH_TOKEN" \
  https://deine-domain.tld/api/internal/dispatch-mail-outbox >/dev/null
```

Der Dispatcher verwendet Leasing und Backoff. Bei IMAP-Ausfall bleibt der archivierte Plain-Text-Verlauf in der Buchungsansicht sichtbar.

Der WhatsApp-Dispatcher läuft zusätzlich als Teil des App-Servers. Für eine unabhängige Auslösung vom Deployment-Host kann derselbe Zyklus minütlich über den geschützten Endpoint angestoßen werden:

```bash
* * * * * curl --fail --silent --show-error -X POST \
  -H "Authorization: Bearer $WHATSAPP_DISPATCH_TOKEN" \
  https://deine-domain.tld/api/internal/dispatch-whatsapp-notifications >/dev/null
```

Nachrichten werden persistent geleast und mit Backoff wiederholt. Der tägliche Versand holt einen verpassten 12-Uhr-Lauf beim nächsten Scheduler-Aufruf am selben Tag nach.

Die AfA wird beim Aufruf des Anlageverzeichnisses automatisch bis zum aktuellen Monat nachgebucht. Für einen vollständig unabhängigen Hintergrundlauf setze `FIXED_ASSET_DEPRECIATION_TOKEN` und rufe den Endpoint täglich auf:

```bash
5 0 * * * curl --fail --silent --show-error -X POST \
  -H "Authorization: Bearer $FIXED_ASSET_DEPRECIATION_TOKEN" \
  https://deine-domain.tld/api/internal/fixed-assets/depreciation >/dev/null
```

## Hinweise

- Die App nutzt SSR und Node-Runtime für den Kontakt-Endpoint.
- `next dev` und Production sind getrennt gehärtet.
- Die Production-CSP ist aktiv, Dev bleibt für HMR entspannt.

## Optionaler Offline-Transfer

Falls du kein Registry-Setup nutzen willst, kannst du das Image auch weiterhin als Tar-Datei exportieren und auf den Server kopieren. Das ist aber nur die Fallback-Variante und nicht der empfohlene Produktionsweg.
