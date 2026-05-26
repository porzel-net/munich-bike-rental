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

## Build und Publish per GitHub Actions

Das empfohlene Deployment ist:

1. Code nach GitHub pushen
2. GitHub Actions baut das Image aus [`Dockerfile`](/Users/juliusporzel/Development/NextJS/BikeRental/Dockerfile)
3. GitHub Actions pusht das Image nach GHCR (`ghcr.io`)
4. Der Ubuntu-Server zieht später nur noch das fertige Image per `docker pull`

Der Workflow liegt unter:

- [`.github/workflows/docker-publish.yml`](/Users/juliusporzel/Development/NextJS/BikeRental/.github/workflows/docker-publish.yml)

Das Image wird in GHCR als privates Package publiziert. GitHub legt neue Container-Packages beim ersten Publish standardmäßig privat an, wenn sie deinem Account oder einer Organisation zugeordnet sind. Der Workflow setzt zusätzlich die Source-Referenz, damit das Package sauber mit dem Repository verknüpft ist.

Er erzeugt Image-Tags für:

- den Branch
- Git-Tags wie `v1.0.0`
- den Commit-SHA
- `latest` auf dem Default-Branch

Auf dem Server kannst du dann zum Beispiel so ziehen:

```bash
docker login ghcr.io
docker pull ghcr.io/juliusporzel/bikerental:latest
```

Für den Login brauchst du auf dem Server einen GitHub Personal Access Token mit `read:packages`. Ein normales GitHub-Passwort reicht nicht.

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u "dein-github-username" --password-stdin
```

Wenn du das Package im GitHub-Web-UI nachträglich prüfst, findest du die Visibility in den Package-Settings. Für den Serverbetrieb solltest du das Image aber immer als private Registry-Ressource behandeln.

## Voraussetzungen auf dem Server

- Ubuntu Server
- Docker Engine
- Docker Compose Plugin
- Nginx auf dem Host
- optional: Firewall, z. B. `ufw`

## Umgebungsvariablen

Lege auf dem Server eine `.env`-Datei neben der Compose-Datei an.

```dotenv
APP_IMAGE=ghcr.io/juliusporzel/bikerental:tag
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

Wenn das Image in einer Registry liegt, ziehe es auf dem Server:

```bash
docker pull ghcr.io/juliusporzel/bikerental:tag
```

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
