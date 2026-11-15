# Familienplaner – Stand 2.11.2026 (Version 11)

Zum Nachschlagen für spätere Updates. Keine Passwörter oder geheimen Schlüssel hier drin.

## Version 18.0: Admin-Seite ⚙️ Verwalten, Oberfläche für alle gleich

## Version 17.1: Familien verbinden per Code (family_links, link_code; nur Wunschlisten geteilt)

## Version 17.0: Wunschliste (Reiter Wünsche, Tabellen wishes + wish_marks; Wünschender sieht Gekauft-Haken nicht, per RLS)

## Version 16.3: Tages-Chef für alle Familien (Reihenfolge: chef_order, dann übrige nach Beitritt; Funktion family_chef_order, App chefFor, wall-data)

## Version 16.2: Passwort vergessen (E-Mail-Link, supabase resetPasswordForEmail) + Passwort ändern unter Familie. Voraussetzung: in Supabase unter Authentication -> URL Configuration muss die Site URL auf https://familienplaner.pagemaster77.workers.dev stehen (und dort als Redirect URL erlaubt sein).

## Version 16.1: Krone über dem Profilbild des Tages-Chefs (window.CHEF_ID, crownWrap in stimmung.js)

## Version 16 (15.11.2026): Tages-Chef. Reihum Amy, Elena, Sophie, Meggy, Sascha (families.chef_order, Start 15.11.). Chef stellt Bild und/oder YouTube-Link ein, bekommt einmal pro Tag 5 Punkte. Bild erscheint nach 3 Min ohne Berührung als Bildschirmschoner auf der Wand (nachts und bei SOS nicht); in der App Karte auf Start. Bilder werden nach 14 Tagen gelöscht.

## Version 15.3 (15.11.2026): Neuigkeiten-Popup nach Updates. Datei site/neuigkeiten.js: Liste NEWS (neueste zuerst); bei jedem Update dort oben einen Eintrag mit neuer Version einfügen (gleiche Nummer wie VERSION in app.js). Das Fenster erscheint einmal pro Gerät (localStorage "newsSeen"), zeigt alles seit dem letzten Mal (max. 5), nicht auf Wandanzeige/Tablet-Ansicht.

## Version 15 (15.11.2026): Stimmung. Karte „Wie geht’s dir heute?“ auf Start; Ring um das Profilbild (gut = bunter Verlauf, geht so = gelb, schlecht = rot, Hilfe = blinkend rot mit SOS). Gilt 24 Stunden. Hilfe schickt nur den Eltern (Admins) eine Push-Meldung, Wand zeigt Banner und Ton. Dateien: site/stimmung.js, DB-Spalten profiles.mood/mood_at

## Version 14.10: Wandtöne deutlich lauter; rote Zahl + Blinken an To-Do/Einkauf/Chat bei Neuem (verschwindet beim Öffnen)

## Version 14.8: Wand-Klingeltöne: Chat (Zweiklang), Termin in 10 Min (Ding-Dong), neu auf Liste (Blubb), Punkte vergeben (Münze); nur Wand, nachts stumm, im Menü schaltbar

## Version 14.7: Pyramide spielt eigene Trompeten-Fanfare (laenger mit Thron)

## Version 14.6: Wandanzeige mit Tönen (Tick, Wusch beim Wischen/Blättern); im Menü ein-/ausschaltbar, nachts stumm

## Version 14.4: Wandanzeige-Menü (Familienname antippen): Seite neu laden, Kiosk beenden, Neustart; Hilfsprogramm pi/wand-helper.py auf dem Pi

## Version 14.3: Termine-Ansicht in der App beginnt mit HEUTE (7 Tage ab heute, heute farbig markiert); Wischen zurück = Rückblick

## Version 14 (6.11.2026)
- Wiederkehrende Aufgaben: in 14.2 wieder entfernt (nicht gewünscht); Cron-Job abgeschaltet
- Termin-Erinnerungen per Push (Cron `event-reminders`, alle 5 Min; nur eigene Termine, keine Google/iCloud-Termine)
- Geburtstage mit Geburtsjahr: Titel zeigt das Alter, z. B. „Oma (77)“ (App und Wandanzeige)
- Datensicherung: automatisch sonntags (Cron `weekly-backup`, Funktion `backup`, Bucket `backups`, letzte 12), plus Knopf „Sicherung herunterladen“ unter Familie (Admin)
- Wandanzeige-Nachtmodus: 22–6 Uhr dunkel mit schwacher Uhr nach 60 s ohne Berührung; Antippen weckt (Konstanten NIGHT_FROM/NIGHT_TO in wand.js)
- Belohnung erreicht: Konfetti, Banner und Trompeten-Fanfare (`feier.js`, selbst erzeugter Ton, einmal pro Belohnung und Gerät; nachts auf der Wand still). Ton wird nach der ersten Berührung freigeschaltet.
- SQL-Änderungen dieser Version wurden direkt per Supabase-Verbindung eingespielt (Tabelle `task_templates`, Spalte `events.birth_year`, pg_cron, Bucket `backups`).

## Was die App kann
- Profile (Name, Farbe, kleines Foto oder Symbol), Familie per Einladungscode, Familienname änderbar (Admin)
- Admin-Rechte: wer die Familie anlegt, ist Admin; Admins vergeben Admin-Titel, ändern den Familiennamen, löschen Chat-Nachrichten, vergeben Punkte
- To-Do mit Punkten (Punkte nur durch Admins; selbst angelegte Aufgaben der Kinder zählen 0 Punkte)
- Aufgaben können mehreren ausgewählten Mitgliedern zugewiesen werden (nichts gewählt = für alle); Aufgaben, Einkaufseinträge und Gerichte sind über ✎ änderbar (abgehakte Einkaufseinträge: ✎ → „Wieder auf die Liste“ mit neuer Menge)
- Belohnungen: Admins legen pro Mitglied fest, was es bei X Punkten bekommt (Karte „Belohnungen“ im To-Do-Tab); „Übergeben“ hakt sie ab
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
- SQL-Änderungen: Ordner `sql/` (ältere Stände) plus Migrationen direkt in Supabase: `push_notifications`, `wall_token`, `wall_pairing`, `alexa_skill`, `tasks_assignees_rewards`
- Tabellen: families (mit `wall_token`), profiles, tasks, shopping_items, messages, meals, events, push_subs, push_config (gesperrt, enthält Push-Schlüssel), wall_pairings (gesperrt), alexa_links und alexa_pairings (gesperrt), rewards (Belohnungen; tasks hat zusätzlich `assignees`)

## Update einspielen (Ablauf)
1. Änderung im Ordner `site/` bzw. `supabase/functions/`, Datenbank per Supabase-Migration
2. Commit mit Autor `pagemaster77 <pagemaster77@users.noreply.github.com>` und Push auf `main` (sonst blockiert Netlify: „Unrecognized Git contributor“)
3. Netlify veröffentlicht nach ca. 1 Minute, aber nur bei Änderungen in `site/` oder `netlify.toml` (spart Credits; Gratis-Tarif hat 300 Credits pro Monat, jede Veröffentlichung kostet welche). Am 30.10. waren 75 % verbraucht. Version steht unter Familie ganz unten; `VERSION` in `site/app.js` und Cache-Name in `site/sw.js` bei jedem Update erhöhen
4. Edge Functions separat über Supabase deployen (nicht Teil des Netlify-Baus)

## Bekannte Grenzen
- Kalender nur lesend (kein Zurückschreiben nach Google/iCloud)
- Netlify-Schild „Powered by Netlify“ kann unten rechts erscheinen (in Netlify abschaltbar)
- Nur ein Git-Nutzer im Netlify-Gratis-Tarif bei privaten Repos (Repo ist aktuell öffentlich)
- Push auf iPhone nur über Home-Bildschirm-App; Zustellung nicht von hier testbar

## Ideen für später
- Kalender zurückschreiben, Wandanzeige: Wetter / Schriftgrößen für das echte Tablet, Chat auf der Wand ausblendbar


## Version 12.2: Termine ganztägig (events.all_day), Geburtstage ohne Uhrzeit

## Version 12.1 (3.11.2026): Termine lange gedrückt halten = ändern oder löschen, Wiederholungs-Text entfernt

## Version 12 (3.11.2026)
- Erledigte Aufgaben warten auf Freigabe ("Wartet auf Freigabe"). Punkte zaehlen erst, wenn ein Admin "Freigeben" drueckt (tasks.approved). Admin-Haken = sofort freigegeben. Kinder koennen Freigegebenes nicht zuruecknehmen.
- Beim Aendern einer Aufgabe (Stift) koennen Admins die Punkte aendern.
- Termine: Wiederholung Nein / jede Woche / jeden Monat / jedes Jahr (events.recurrence), in App und Wandanzeige. Loeschen entfernt alle Wiederholungen.
- Hosting: Cloudflare Workers (familienplaner.pagemaster77.workers.dev), Deploy automatisch bei Push auf main (wrangler.jsonc). Netlify noch nicht abgeschaltet.
