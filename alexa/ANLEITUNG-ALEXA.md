# Alexa-Skill „Familien Planer“ einrichten

Mit dem Skill setzen die Kinder per Sprache Artikel auf die Einkaufsliste der App. Jede Familie richtet ihn einmal bei sich ein (ca. 30–45 Minuten).

Sprechen: **„Alexa, sag Familien Planer, setze Kaffee auf die Einkaufsliste“** oder **„Alexa, frag Familien Planer, was steht auf der Einkaufsliste“**.

## Einrichten
1. **Entwicklerkonto:** auf developer.amazon.com mit dem Amazon-Konto anmelden, das auch für Alexa genutzt wird (kostenlos, Bedingungen selbst bestätigen).
2. **Skill anlegen:** Alexa Developer Console → **Skill erstellen**. Name „Familien Planer“, Sprache **Deutsch (DE)**, Typ **Benutzerdefiniert**, Hosting **Eigenes Hosting / „Provision your own“**, Vorlage **Start from scratch**.
3. **Text einfügen:** Build → **Interaction Model → JSON Editor** → den Inhalt von `interaktionsmodell-de.json` einfügen → **Save** → **Build Skill**.
4. **Adresse eintragen:** Build → **Endpoint** → **HTTPS** →
   `https://wpiqwoprnoasuckrdwlr.supabase.co/functions/v1/alexa-skill`
   Darunter die Option „My development endpoint is a sub-domain of a domain that has a wildcard certificate from a certificate authority“ wählen → **Save**.
   (Für eine zweite Familie mit eigener Datenbank: deren eigene Funktions-Adresse.)
5. **Testen:** Reiter **Test** → „Development“ einschalten. Der Skill ist jetzt auf allen Echos nutzbar, die mit diesem Amazon-Konto verbunden sind.
6. **Koppeln:** „Alexa, öffne Familien Planer“. Alexa nennt einen 6-stelligen Code. In der App: **Familie → Alexa** → Code eingeben → **Koppeln**.

## Gut zu wissen
- Der Skill braucht keine Veröffentlichung bei Amazon.
- Jedes Echo-Konto wird einmal gekoppelt. „Alle Alexa-Geräte abmelden“ in der App setzt das zurück.
- Alexa versteht ungewöhnliche Wörter manchmal falsch.
