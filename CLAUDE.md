# Familienplaner – Steckbrief für Claude

Dieser Steckbrief wird von Claude Code (Handy-Cloud-Sitzung, Windows-Rechner) beim Start gelesen. Er sagt, was das hier ist und wie hier gearbeitet wird. Die ausführliche Geschichte steht in `STAND.md`, die Einrichtung in `ANLEITUNG.md`.

## Was ist das?
Eine Web-App für Familien: gemeinsame Aufgaben mit Punkten, Einkaufsliste, Chat, Termine, Essensplan, Wunschliste, Jobs, Spielhalle mit Minispielen und Bestenlisten. Dazu eine Wandanzeige für ein Tablet an der Wand (Raspberry Pi). Aktuell nutzen sie drei Familien, die sich per Code verbinden können.

## Wie wir arbeiten
- Der Besitzer ist kein Programmierer. Erklärungen in einfacher Sprache, Fachwörter kurz erklären. Sprache der App und der Antworten: Deutsch.
- Wunschweise: Ideen werden gesammelt und oft gebündelt umgesetzt. Neue Funktionen sollen den Erwachsenen keine zusätzliche Pflegearbeit machen.
- Nichts Eigenmächtiges Großes bauen. Bei unklaren Wünschen kurz nachfragen.

## Aufbau
- `site/` – die App selbst (reines HTML/CSS/JavaScript, kein Build-Schritt). Wichtige Dateien: `app.js` (Hauptteil, enthält `VERSION`), `extra.js`, `stimmung.js`, `feier.js`, `wand.html` / `wand.js` / `wand.css` (Wandanzeige), `sw.js` (Offline-Zwischenspeicher), `neuigkeiten.js` (Popup „Was ist neu?“), `spielhalle/` (eigene Seite mit `spiele/`), `spiele-test/` (Testseite, nicht verlinkt).
- `supabase/functions/` – Hilfsfunktionen in der Cloud: `ical-proxy`, `recipe-import`, `push-send`, `wall-data`, `alexa-skill`.
- `sql/` – Datenbank-Skripte (`update-N-….sql`), nummeriert in der Reihenfolge ihrer Entstehung.
- `pi/` – Hilfsprogramm für den Raspberry Pi der Wandanzeige. `alexa/` – Alexa-Skill (ruht, läuft nur im Simulator).
- Datenbank: Supabase-Projekt `wpiqwoprnoasuckrdwlr`. Hosting: Cloudflare Workers (`wrangler.jsonc`, Ordner `site/`), Adresse `familienplaner.pagemaster77.workers.dev`.
- Netlify gibt es nicht mehr. Hinweise dazu in `STAND.md` (zum Beispiel „Wo was liegt“) sind überholt.

## Update einspielen
1. Änderung in `site/` bzw. `supabase/functions/` machen.
2. `VERSION` in `site/app.js` hochzählen und den Cache-Namen `CACHE` in `site/sw.js` (zum Beispiel `familie-v84` → `familie-v85`). Sonst sehen die Geräte die neue Version nicht.
3. Eintrag oben in `site/neuigkeiten.js` nur bei neuen oder geänderten Funktionen, nicht bei Optik, Texten oder Fehlerbehebungen. Dieselbe Nummer wie `VERSION`.
4. Neue Zeile oben in `STAND.md` (gleiches Format wie die vorhandenen). Dort steht auch „Kein Neuigkeiten-Eintrag“, wenn keiner angelegt wurde.
5. Änderungen an der Datenbank: Skript in `sql/` ablegen und zusätzlich in Supabase einspielen. Edge Functions werden getrennt in Supabase veröffentlicht, sie gehören nicht zur automatischen Veröffentlichung.
6. Commit und Push auf `main`. Cloudflare veröffentlicht dann von selbst. Das ist sofort live für alle Familien. Größere Umbauten deshalb vorher mit dem Besitzer abstimmen.

## Zusammenarbeit mehrerer Claude-Sitzungen
Am selben Projekt arbeiten manchmal der Chat, Claude Code am Rechner und Claude Code vom Handy. Damit sie sich nicht in die Quere kommen:
- Vor jeder Arbeit den neuesten Stand holen (`git pull`) und `git log -5` ansehen.
- Kleine Commits mit verständlicher Beschreibung, direkt danach pushen.
- Wenn ein Push abgelehnt wird: erst holen, Unterschiede zusammenführen, nie den fremden Stand überschreiben (kein `--force`).
- Nicht gleichzeitig zwei Änderungen an `app.js` machen, sie ist sehr groß.

## Sicherheit
- Keine Passwörter, Zugangs-Token oder geheimen Schlüssel ins Repo (es ist öffentlich). Der öffentliche Supabase-Schlüssel in `site/config.js` ist so gewollt.
- Tabellen mit Push-Schlüsseln, Kopplungen und Alexa-Daten sind per Zugriffsregeln (RLS) gesperrt. Das nicht lockern.
- Daten von Kindern und Familien sparsam behandeln: keine neuen Auswertungen oder Weitergaben ohne Rückfrage.
