# Familienplaner – Einrichtung Schritt für Schritt

Die App besteht aus zwei Teilen:
- **Datenbank in der Cloud (Supabase):** der „Schaltschrank“, in dem alle Daten liegen (kostenlos für eine Familie).
- **Die App-Dateien (dieser Ordner):** werden im Internet bereitgestellt (Hosting). Danach rufst du sie auf Handy und Tablet wie eine Webseite auf und legst sie auf den Startbildschirm.

## Teil 1: Datenbank einrichten (ca. 10 Minuten)

1. Auf **supabase.com** ein kostenloses Konto anlegen, dann „New project“. Name z. B. „familie“, Passwort notieren, Region „Frankfurt“.
2. Links im Menü **SQL Editor** → „New query“ → den kompletten Inhalt der Datei `schema.sql` einfügen → **Run**. Es sollte „Success“ erscheinen.
3. Links **Authentication** → **Providers** → **Email**: den Schalter **„Confirm email“ ausschalten** (sonst muss jeder erst eine Bestätigungsmail anklicken).
4. Links **Project Settings → API**: zwei Werte kopieren
   - **Project URL**
   - **anon public key** (der lange Schlüssel)
5. In der Datei `config.js` die beiden Platzhalter ersetzen und speichern.

## Teil 2: Kalender-Helfer (nur nötig für Google-/iCloud-Kalender)

Google und iCloud erlauben den Abruf nicht direkt aus der App. Ein kleiner Helfer holt die Kalender stellvertretend ab.

1. In Supabase links **Edge Functions** → „Deploy a new function“ → „Via Editor“.
2. Name: **ical-proxy** (genau so).
3. Den Inhalt der Datei `supabase/functions/ical-proxy/index.ts` einfügen → **Deploy**.

Ohne diesen Schritt läuft alles andere trotzdem. Es fehlen nur die importierten Kalender.

## Teil 3: App ins Internet stellen (Hosting)

Die Dateien müssen irgendwo online liegen, damit Handy und Tablet sie öffnen können. Am einfachsten und kostenlos:

- **Netlify Drop:** auf app.netlify.com/drop den ganzen Ordner `familienplaner` ins Fenster ziehen. Du bekommst sofort eine Adresse wie `https://xyz.netlify.app`.
- Alternativen: Cloudflare Pages, GitHub Pages.

Wichtig: Die Adresse beginnt mit **https**. Nur dann funktioniert „Zum Startbildschirm hinzufügen“.

## Teil 4: Auf Handy und Tablet installieren

- **iPhone (Safari):** Teilen-Symbol → „Zum Home-Bildschirm“.
- **Android (Chrome):** Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.

## Teil 5: Familie anlegen

1. Erste Person: Konto erstellen → „Neue Familie“ → Name, Farbe, Symbol wählen.
2. Unter **Familie** steht der **Einladungscode** (8 Zeichen).
3. Alle anderen: Konto erstellen → „Mit Code beitreten“ → Code eingeben.

## Das Tablet als Familien-Display

Auf dem Tablet einmal anmelden, dann unter **Familie** auf „Tablet-Ansicht starten“ tippen. Oder direkt die Adresse mit `#display` am Ende öffnen, z. B. `https://xyz.netlify.app/#display`. Die Ansicht zeigt Punktestand, Termine, Essen heute, Aufgaben, Einkaufsliste und Nachrichten und aktualisiert sich selbst, sobald jemand am Handy etwas ändert. Tipp: Tablet am Strom lassen und in den Einstellungen die Bildschirmsperre verlängern.

## Kalender verbinden

Jede Person trägt unter **Familie → Mein Profil** ihren Kalender-Link ein:
- **Google:** Kalender-Einstellungen → „Geheime Adresse im iCal-Format“ kopieren.
- **iCloud:** Kalender-App → Kalender teilen → „Öffentlicher Kalender“ → Link kopieren.

Das ist eine **Leseverbindung**: Termine erscheinen in der App, werden aber nicht zurück in Google/iCloud geschrieben. Wer den Link kennt, kann den Kalender sehen. Deshalb nicht weitergeben.

## Gut zu wissen (Grenzen dieser Version)

- Kalender werden alle paar Minuten neu geladen, nicht sofort.
- Sehr komplizierte Wiederholungen („jeden 2. Dienstag im Monat“) werden eventuell nicht richtig angezeigt.
- Es gibt keine Push-Benachrichtigungen. Nachrichten sieht man beim Öffnen der App.
- Echte Zwei-Wege-Synchronisation mit Google/iCloud wäre ein späterer Ausbau.

---

## Nachträge (Update 2): Admin-Rechte und Rezept-Import

Wer eine Familie neu einrichtet, führt nach `schema.sql` auch diese Datei aus:
1. Supabase → SQL Editor → Inhalt von `update-2-admin-chefkoch.sql` einfügen → Run.
   (Bei bestehenden Familien reicht dieser Schritt allein. `aenderung-familienname.sql` ist darin schon enthalten.)

Rezept-Import per Link (z. B. Chefkoch):
1. Supabase → Edge Functions → Deploy a new function → Via Editor.
2. Name: `recipe-import`. Inhalt aus `supabase/functions/recipe-import/index.ts` einfügen → Deploy.
3. In der App unter „Essen“ den Link einfügen und auf „Holen“ tippen.

Admin-Rechte:
- Wer die Familie anlegt, ist Admin.
- Admins sehen unter „Familie“ bei jedem Mitglied den Knopf „Zum Admin machen“ bzw. „Admin entziehen“, dürfen den Familiennamen ändern und Chat-Nachrichten löschen (× an der Nachricht).
- Es bleibt immer mindestens ein Admin.
