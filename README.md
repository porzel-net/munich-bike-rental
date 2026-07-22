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
IMAP_MAIN_SENT_MAILBOX=Sent
IMAP_MAIN_REJECTED_MAILBOX=Abgelehnt
IMAP_MAIN_PENDING_MAILBOX=Ausstehend
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID=AW-XXXXXXXXX
NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL=XXXXXXXXXXXX
DEV_ALLOWED_ORIGINS=
```

Für produktive Zugänge sind `SMTP_REQUEST_PASSWORD_FILE`, `SMTP_MAIN_PASSWORD_FILE` und optional `IMAP_MAIN_PASSWORD_FILE` statt Klartext-Passwörtern vorzuziehen. Die App liest den Inhalt einer nur lesbaren Secret-Datei, wenn die entsprechende `*_FILE`-Variable gesetzt ist. Binde diese Dateien im Produktivbetrieb beispielsweise als Docker-Secrets oder schreibgeschützte Bind-Mounts ein.

Wichtig:

- `APP_IMAGE` muss auf das fertige Image aus deiner Registry zeigen
- `SITE_URL` und `APP_ORIGIN` müssen zur echten Domain passen
- `CALENDAR_FEED_TOKEN` schützt den abonnierbaren Apple-Kalender-Feed. In Apple Kalender wird die angezeigte Webcal-URL aus der Buchungsseite abonniert.
- SMTP-Daten niemals ins Image bake-en, nur zur Laufzeit setzen
- Die SQLite-Datei gehört niemals ins Image. Der Compose-Stack verwendet das Named Volume `app-data`; der Einmal-Service `database-init` setzt dessen Eigentümer auf den Non-Root-App-User und die Rechte auf `0700`.
- Drizzle führt versionierte Migrationen aus `drizzle/` beim ersten Zugriff auf den Anfrage-Endpunkt aus. Das Volume bleibt bei Image-Updates und Container-Neustarts erhalten. Lösche es nicht mit `docker compose down -v`, sofern die Anfragen erhalten bleiben sollen.
- SQLite ist für diesen einzelnen App-Container vorgesehen. Mehrere parallele App-Replikas dürfen nicht dasselbe SQLite-Volume beschreiben.
- `SMTP_SECURE` oder alternativ `MAIL_USE_SSL` steuern die TLS-Variante für den SMTP-Login
- `SMTP_REQUEST_*` steuert den Versand der Website-Anfragen; `SMTP_MAIN_*` steuert Buchungsbestätigungen und Ablehnungen aus dem Adminbereich
- `IMAP_MAIN_*` wird für die Suche automatischer Mailverläufe sowie das Verschieben gesendeter Mails nach `Abgelehnt` bzw. `Ausstehend` verwendet
- `MAIL_USE_STARTTLS` ist für klassische StartTLS-Setups gedacht
- `MAIL_TIMEOUT_SECONDS` begrenzt den Mail-Connect-Timeout in Sekunden
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` aktiviert Google Analytics erst nach Einwilligung in den Zweck „Analytics“
- `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_ID` und `NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL` sind optional. Sind beide gesetzt, aktiviert die Einwilligung in den Zweck „Marketing“ die direkte Google-Ads-Conversion für das Lead-Event.
- der GitHub-Workflow pusht bei `push` auf `main` nach GHCR; Pull Requests bauen nur, ohne zu pushen
- wenn das GHCR-Package privat ist, brauchst du auf dem Server zum `docker login ghcr.io` einen GitHub PAT mit `read:packages`

Wenn du GitHub Container Registry verwendest, melde dich auf dem Server einmal an:

```bash
docker login ghcr.io
```

Danach kannst du das Image ziehen und den Stack starten:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml pull
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml up -d
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
- `docker compose pull` aktualisiert nur das Image, `up -d` startet den neuen Container mit den aktuellen Env-Werten

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

  client_max_body_size 16k;
  client_header_timeout 10s;
  client_body_timeout 10s;
  keepalive_timeout 15s;
  server_tokens off;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
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
}
```

Passe Zertifikatspfade und Domain an und nutze diese Konfiguration nur mit gültigem TLS-Zertifikat. Für die Limits der Anfrage-Endpunkte ist zusätzlich `docker/nginx-http-security.conf.example` im `http`-Block von Nginx einzubinden.

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

Im Docker-Setup wird `DATABASE_URL` bewusst auf `/data/bikerental.db` gesetzt und das Volume an genau diesem Pfad eingehängt. Dadurch gehen Anfragen weder bei einem Image-Neubau noch bei einem Container-Austausch verloren. Sichere das Volume regelmäßig, beispielsweise auf dem Host:

```bash
docker run --rm -v <compose-projekt>_app-data:/data -v "$PWD":/backup busybox \
  sh -c 'tar czf /backup/bikerental-db-backup.tgz -C /data .'
```

Die Datenbank enthält personenbezogene Kontakt- und Mietdaten. Backups gehören verschlüsselt abgelegt und sollten nur für berechtigte Personen zugänglich sein.

## Hinweise

- Die App nutzt SSR und Node-Runtime für den Kontakt-Endpoint.
- `next dev` und Production sind getrennt gehärtet.
- Die Production-CSP ist aktiv, Dev bleibt für HMR entspannt.

## Optionaler Offline-Transfer

Falls du kein Registry-Setup nutzen willst, kannst du das Image auch weiterhin als Tar-Datei exportieren und auf den Server kopieren. Das ist aber nur die Fallback-Variante und nicht der empfohlene Produktionsweg.
