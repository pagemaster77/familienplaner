# Familienplaner – Stand 30.10.2026 (Version 10)

Zum Nachschlagen für spätere Updates. Keine Passwörter oder geheimen Schlüssel hier drin.

## Was die App kann
- Profile (Name, Farbe, kleines Foto oder Symbol), Familie per Einladungscode, Familienname änderbar (Admin)
- Admin-Rechte: wer die Familie anlegt, ist Admin; Admins vergeben Admin-Titel, ändern den Familiennamen, löschen Chat-Nachrichten, vergeben Punkte
- To-Do mit Punkten (Punkte nur durch Admins; selbst angelegte Aufgaben der Kinder zählen 0 Punkte)
- Einkaufsliste, Chat, Essensplan und -wünsche (Bild, Rezept, Zutaten → Einkaufsliste, Chefkoch-Link-Import)
- Kalender: eigene Termine plus Import per iCal-Link (Google/iCloud, nur lesend)
- Tablet-Ansicht `#display` (mit Anmeldung) mit großem Monats-/Wochenkalender
- Push-Meldungen (pro Gerät aktivieren; pro Art einstellbar: Einkauf, Aufgaben, Chat, Termine). iPhone nur mit App auf dem Home-Bildschirm. Importierte Google-Termine lösen keine Meldung aus.
- Wandanzeige `wand.html`: nur ansehen, ohne Anmeldung, Kopplung per 6-stelligem Code (Familie → Wandanzeige)

- Alexa-Skill „Familien Planer“: Einkaufsliste per Sprache (Artikel hinzufügen, vorlesen). Jede Familie legt ihn selbst in der Alexa-Entwicklerkonsole an (Entwicklungsphase, keine Veröffentlichung). Anleitung und Text: Ordner `alexa/`. Kopplung per Code (Familie → Alexa). Stand 30.10.: läuft und getestet im Alexa-Simulator (Skill „Familien Planer“, Entwicklungsphase, Konto des Nutzers; Kopplung klappt, Artikel landen in der App). Sprechen: „Alexa, sag Familien Planer, setze Kaffee auf die Einkaufsliste“ (Name muss immer mit). Echtheitsprüfung der Anfragen (verify.ts) liest Zertifikat selbst aus, weil die Supabase-Laufzeit X509-Felder nicht liefert. Echte Geräte (Echo, Alexa-App) antworten trotz Entwicklungsmodus und vollständiger Angaben mit „wird auf diesem Gerät nicht unterstützt“, Vermutung: Alexa+ führt Entwickler-Skills nicht aus (nicht bestätigt). Vergleichstest 30.10.: Auch Amazons eigener Hello-World-Beispielskill („test eins“) meldet auf allen Geräten dasselbe, also liegt es nicht am Skill. Amazons Hilfe nennt Alexa+ als Grund (Entwickler-Skills auf echten Geräten wohl nicht unterstützt, Simulator geht). Erneut testen, wenn Amazon das ändert. Entscheidung 30.10.: Alexa+ bleibt, kein Ersatz-Knopf in der App; Skill ruht. Aufrufname im Skill zuletzt „sascha planer“ (Modell-Datei im Ordner alexa/ nennt noch „familien planer“). Zweite Familie: erst anlegen, wenn der Test auf echten Geräten klappt.

## Wo was liegt
- Seite: https://family-kleiner-peters-siuda.netlify.app (Netlify, baut automatisch aus GitHub `pagemaster77/familienplaner`, Zweig `main`, Ordner `site/`)
- Datenbank/Funktionen: Supabase-Projekt `wpiqwoprnoasuckrdwlr`
- Edge Functions: `ical-proxy`, `recipe-import`, `push-send` (nur von der Datenbank aufgerufen), `wall-data` (Wandanzeige, ohne Login, geschützt durch Zugangs-Token), `alexa-skill` (ohne Login, prüft Amazon-Signatur)
- SQL-Änderungen: Ordner `sql/` (ältere Stände) plus Migrationen direkt in Supabase: `push_notifications`, `wall_token`, `wall_pairing`, `alexa_skill`
- Tabellen: families (mit `wall_token`), profiles, tasks, shopping_items, messages, meals, events, push_subs, push_config (gesperrt, enthält Push-Schlüssel), wall_pairings (gesperrt), alexa_links und alexa_pairings (gesperrt)

## Update einspielen (Ablauf)
1. Änderung im Ordner `site/` bzw. `supabase/functions/`, Datenbank per Supabase-Migration
2. Commit mit Autor `pagemaster77 <pagemaster77@users.noreply.github.com>` und Push auf `main` (sonst blockiert Netlify: „Unrecognized Git contributor“)
3. Netlify veröffentlicht nach ca. 1 Minute. Version steht unter Familie ganz unten; `VERSION` in `site/app.js` und Cache-Name in `site/sw.js` bei jedem Update erhöhen
4. Edge Functions separat über Supabase deployen (nicht Teil des Netlify-Baus)

## Bekannte Grenzen
- Kalender nur lesend (kein Zurückschreiben nach Google/iCloud)
- Netlify-Schild „Powered by Netlify“ kann unten rechts erscheinen (in Netlify abschaltbar)
- Nur ein Git-Nutzer im Netlify-Gratis-Tarif bei privaten Repos (Repo ist aktuell öffentlich)
- Push auf iPhone nur über Home-Bildschirm-App; Zustellung nicht von hier testbar

## Ideen für später
- Kalender zurückschreiben, Wandanzeige: Wetter / Schriftgrößen für das echte Tablet, Chat auf der Wand ausblendbar
