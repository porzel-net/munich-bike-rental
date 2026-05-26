# BikeRental

Next.js-App Router Projekt für einen Fahrradverleih mit SSR, Kontaktformular und gehärtetem Docker-Setup.

## Entwicklung

```bash
npm install
npm run dev
```

## Produktion auf Ubuntu

Das Ziel-Setup ist:

- der Next.js-Container läuft nur intern auf `3000`
- der externe Zugriff läuft über einen Nginx Reverse Proxy auf dem Host
- der Container veröffentlicht keine `80`/`443`-Ports
- der Container läuft als Non-Root-User, mit Read-Only-Filesystem und ohne zusätzliche Capabilities

## Lokaler Build und Transfer

Das empfohlene Deployment ist:

1. Image lokal aus dem Repo bauen
2. Image als `.tar` exportieren
3. Datei per `scp` auf den Ubuntu-Server kopieren
4. Image auf dem Server mit `docker load` importieren
5. Stack mit Compose starten

Lokal bauen:

```bash
docker build -t bikerental:1.0.0 .
```

Als Datei exportieren:

```bash
docker save -o bikerental_1.0.0.tar bikerental:1.0.0
```

Auf den Server kopieren:

```bash
scp bikerental_1.0.0.tar user@dein-server:/tmp/
```

Auf dem Server importieren:

```bash
docker load -i /tmp/bikerental_1.0.0.tar
```

Wenn du später eine neue Version baust, wiederhole den Prozess mit einem neuen Tag.

## Voraussetzungen auf dem Server

- Ubuntu Server
- Docker Engine
- Docker Compose Plugin
- Nginx auf dem Host
- optional: Firewall, z. B. `ufw`

## Umgebungsvariablen

Lege auf dem Server eine `.env`-Datei neben der Compose-Datei an.

```dotenv
APP_IMAGE=bikerental:1.0.0
SITE_URL=https://www.deine-domain.tld
APP_ORIGIN=https://www.deine-domain.tld
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=dein-user
SMTP_PASSWORD=dein-passwort
MAIL_FROM_ADDRESS=anfrage@deine-domain.tld
MAIL_TO_ADDRESS=hallo@deine-domain.tld
```

Wichtig:

- `APP_IMAGE` muss auf das fertige Image aus deiner Registry zeigen
- `SITE_URL` und `APP_ORIGIN` müssen zur echten Domain passen
- SMTP-Daten niemals ins Image bake-en, nur zur Laufzeit setzen

## Container holen und starten

Dann den Stack starten:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.server.yml up -d
```

Das kombiniert:

- `docker-compose.yml`
- `docker-compose.server.yml`

Ergebnis:

- der App-Container ist nur auf `127.0.0.1:3000` erreichbar
- von außen ist nichts direkt aus dem Container exposed

## Nginx Reverse Proxy

Auf dem Ubuntu-Host läuft Nginx vor dem Container und leitet auf `127.0.0.1:3000` weiter.

Beispiel:

```nginx
server {
  listen 80;
  server_name deine-domain.tld;

  client_max_body_size 16k;

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

Wenn du TLS aktivierst, leite `80` nur auf `443` um und terminiert HTTPS im Nginx.

## Härtung

Das Container-Setup ist absichtlich restriktiv:

- `read_only: true`
- `cap_drop: [ALL]`
- `security_opt: [no-new-privileges:true]`
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

Gesundheitscheck:

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

## Hinweise

- Die App nutzt SSR und Node-Runtime für den Kontakt-Endpoint.
- `next dev` und Production sind getrennt gehärtet.
- Die Production-CSP ist aktiv, Dev bleibt für HMR entspannt.
