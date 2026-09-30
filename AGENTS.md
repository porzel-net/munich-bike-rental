<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Vorgehen bei „Push“

Wenn der Nutzer in diesem Projekt „Push“, „pushe“, „Pushe jetzt“ oder eine sinngleiche Aufforderung schreibt, ist damit der vollständige Ablauf unten gemeint. Vorher nicht pushen. Ein Push auf `main` startet den Workflow `.github/workflows/docker-image.yml` und veröffentlicht bei Erfolg außerdem das Docker-Image in GHCR.

### 1. Arbeitsstand und Commits

- Zuerst `git status`, Branch, Remote und den vollständigen Diff prüfen. Änderungen, die schon vor Beginn der aktuellen Arbeit vorhanden waren, ausdrücklich als Nutzeränderungen behandeln.
- Offene, zum Projekt gehörende Codeänderungen einzeln und in nachvollziehbaren, logisch kleinen Commits festhalten. Zusammengehörige Änderungen dürfen einen Commit bilden; unabhängige Änderungen bekommen getrennte Commits. Jeden Commit einzeln erstellen und anschließend den Arbeitsstand erneut prüfen.
- Keine fremden oder nicht angefragten Änderungen, Secrets, lokalen Datenbanken, Backups, Build-Artefakte oder sonstigen unpassenden Dateien committen. Vorhandene Nutzeränderungen nicht verwerfen oder unbesehen zusammenfassen. Bei unklarer Zuordnung die betroffenen Dateien auslassen und den Nutzer fragen.
- Sicherheits- und Prüffixes jeweils nachvollziehbar committen. Vor dem Push prüfen, dass der Branch und das Ziel-Remote stimmen und der Push nur die geprüften Commits enthält.

### 2. Sicherheits- und Migrationsprüfung vor dem Push

- Den vollständigen Unterschied aller vorgesehenen Commits gegen deren Basis prüfen, nicht nur den zuletzt geänderten Ausschnitt. Bei Codeänderungen neue Angriffsflächen und Vertrauensgrenzen beurteilen, darunter Authentisierung und Autorisierung, Eingabevalidierung, SQL/Dateisystem/Prozess-Aufrufe, SSRF und externe Requests, Secrets und personenbezogene Daten, sichere Defaults, Fehlerbehandlung sowie Docker- und CI-Konfiguration. Die Prüfung an den konkret geänderten Bereichen ausrichten und angrenzende Aufrufer und Datenflüsse nachvollziehen.
- Alle geänderten Datenbankmigrationen in `drizzle/*.sql` samt passender `drizzle/meta/`-Snapshots und `drizzle/meta/_journal.json` einzeln lesen und fachlich prüfen. Prüfen, welche Datensätze und Werte hinzugefügt, geändert, zusammengeführt oder gelöscht werden, wie NULLs, Duplikate, Fremdschlüssel, Eindeutigkeit, Buchungen, Bestände und Geldbeträge behandelt werden und ob Mehrfachausführung oder Teilfehler Daten beschädigen können.
- Migrationsprüfungen nur auf wegwerfbaren lokalen SQLite-Datenbanken und repräsentativen Altbestand-Fixtures durchführen; niemals eine produktive Datenbank für Tests verwenden. Vorher-/Nachher-Zustände und kritische Summen/Beziehungen vergleichen und `PRAGMA integrity_check` sowie `PRAGMA foreign_key_check` einbeziehen. Bestehende Tests `tests/unit/migrations.test.ts` und `tests/unit/migration-edge-cases.test.ts` berücksichtigen und bei Bedarf gezielte zusätzliche Fixture-Prüfungen ausführen.
- Festgestellte Risiken zuerst mit Schweregrad, betroffenen Dateien/Daten, möglicher Auswirkung und empfohlenen Maßnahmen dokumentieren. Kritische oder hohe ungeklärte Risiken blockieren den Push. Mit einem Fix fortfahren, wenn er sicher und im Umfang der Aufgabe liegt; andernfalls den Nutzer informieren und seine ausdrückliche Entscheidung abwarten. Risiken, die der Nutzer ausdrücklich als irrelevant einstuft und trotz der Empfehlung pushen lassen möchte, samt Entscheidung festhalten. Nicht als behoben darstellen, was nur akzeptiert oder noch offen ist.

### 3. Lokale Nachbildung der GitHub-Checks

Die maßgebliche Workflow-Datei ist `.github/workflows/docker-image.yml`. Vor dem Push alle passenden lokalen Gegenstücke erfolgreich ausführen:

1. Abhängigkeiten mit `pnpm install --frozen-lockfile` installieren.
2. Produktions-Build mit `pnpm build` ausführen.
3. `pnpm format:check`, `pnpm typecheck`, `pnpm lint` und `pnpm test` ausführen. Das entspricht den Qualitätsschritten des Workflows; Formatierung muss ausdrücklich enthalten sein.
4. Browser-Tests mit installierter Chromium-Playwright-Laufzeit ausführen (`pnpm exec playwright install --with-deps chromium`, soweit auf dem Host möglich, danach `pnpm test:browser`). Diese testen Desktop- und Mobilansicht. Die Browser-Tests nutzen `scripts/start-browser-server.mjs` und eine Testdatenbank; lokale Integrationszugänge dürfen nicht unabsichtlich verwendet werden.
5. Den Produktions-Container lokal bauen (`docker build -t bikerental:local .`) und tatsächlich starten. Den Healthcheck unter `/api/health`, Containerstatus und Startlogs prüfen; auch sicherstellen, dass die App unter dem im Dockerfile gesetzten unprivilegierten Benutzer mit ihrem Read-only-Setup startet. Wenn Compose für einen vollständigen Stack verwendet wird, die nötigen Test-Umgebungsvariablen setzen und nur isolierte, wegwerfbare Volumes/Daten verwenden. Keine produktiven Volumes oder Secrets einbinden. Container und Testressourcen anschließend kontrolliert entfernen.
6. Den Workflow-Sicherheitsschritt lokal abbilden: `pnpm audit --prod --audit-level=high`. Findings prüfen und behandeln. Der GitHub-Schritt `actions/dependency-review-action` läuft nur für Pull Requests und hat kein identisches lokales Gegenstück; ihn nicht als lokal bestanden ausgeben. Ebenso lassen sich GitHub-Runner, GitHub-Berechtigungen, Registry-Login und GHCR-Veröffentlichung lokal nicht vollständig beweisen.

Wenn ein Schritt fehlschlägt, Ursache und betroffene Änderung ermitteln, im autorisierten Umfang beheben, die Korrektur separat committen und anschließend alle betroffenen Gates erneut ausführen. Nach Code-, Dependency-, Workflow-, Docker- oder Migrationsänderungen die vollständige relevante Checkfolge erneut laufen lassen. Keine lokalen Prüfungen überspringen oder als erfolgreich melden, wenn sie nicht tatsächlich erfolgreich waren.

### 4. Push und Remote-Ergebnis

- Erst pushen, wenn die Migrations- und Sicherheitsbefunde behoben oder ausdrücklich vom Nutzer als akzeptiertes Restrisiko freigegeben sind und die lokalen Checks erfolgreich waren. Vor dem Push noch einmal Branch, Remote, Commits und sauberen/erwarteten Arbeitsstand prüfen.
- Lokale Erfolge können nicht garantieren, dass GitHub Actions remote grün werden: Runner, Berechtigungen, Actions, Registry, Netzwerk und Secrets liegen außerhalb der lokalen Prüfung. Nach dem Push daher den tatsächlichen Lauf aller Checks für den Commit abwarten und deren Ergebnisse prüfen; Erfolg erst melden, wenn die erforderlichen Remote-Checks abgeschlossen und grün sind.
- Bei roten Remote-Checks Fehler einzeln untersuchen und beheben, jede unabhängige Korrektur nachvollziehbar committen, relevante lokale Checks erneut ausführen, dann pushen und die neuen Remote-Läufe wieder abwarten. Das Docker-Image wird bei einem Push auf `main` vom Workflow nach GHCR veröffentlicht; keine Veröffentlichung als erfolgreich melden, bevor auch der entsprechende Job grün ist.
- Wenn Remote-Status nicht zugänglich oder noch ausstehend ist, das klar als offen melden, nicht als grün oder garantiert erfolgreich.
