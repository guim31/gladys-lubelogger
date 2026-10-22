# LubeLogger

Verfolge deine Fahrzeuge in Gladys mit [LubeLogger](https://lubelogger.com),
dem selbst gehosteten Wartungsheft für Fahrzeuge: Kilometerstand,
Durchschnittsverbrauch, Ausgaben des Monats und vor allem die
**Wartungserinnerungen** (Ölwechsel, Reifen, Hauptuntersuchung, Versicherung)
als Szenenauslöser. Gladys spricht direkt mit deinem LubeLogger-Server, zu
Hause oder auf einem entfernten Server.

Getestet mit einem echten LubeLogger-1.7.4-Server (das offizielle
Docker-Image), Erinnerungen nach Datum und nach Kilometerstand eingeschlossen.
Rückmeldungen sind im Gladys-Forum willkommen.

## Voraussetzungen

- Gladys Assistant 5.1 oder neuer.
- LubeLogger **1.5.9 oder neuer**, vom Gladys-Rechner aus erreichbar
  (standardmäßig Port 8080, oder hinter einem Reverse-Proxy).
- Ist in LubeLogger die Anmeldung aktiv: ein **API-Schlüssel** (LubeLogger →
  Einstellungen → API Keys, Rechte **View** und **Edit**; View allein genügt,
  wenn du keine Kilometerstände hinzufügst), oder Benutzername und Passwort
  eines LubeLogger-Benutzers. Die Integration sieht die Fahrzeuge dieses
  Benutzers.

## Konfiguration

1. Öffne den Reiter **Konfiguration** der Integration.
2. Gib unter **LubeLogger-Adresse** die IP-Adresse des Servers ein, zum
   Beispiel `192.168.1.50`: die Integration nutzt dann Port 8080. Ergänze einen
   Port, wenn deiner abweicht (`192.168.1.50:8081`). Hinter einem
   Reverse-Proxy gibst du die vollständige Adresse ein
   (`https://example.org/lubelogger`).
3. Ist in LubeLogger die Anmeldung aktiv, füge einen **API-Schlüssel** ein,
   oder fülle **Benutzername** und **Passwort** aus. Der Schlüssel hat
   Vorrang, wenn beides ausgefüllt ist. Sonst lässt du diese Felder leer.
4. **In LubeLogger genutzte Entfernungseinheit**: LubeLogger speichert Zahlen
   ohne Einheit. Wähle **Kilometer** (Liter, L/100 km, kWh/100 km) oder
   **Meilen** (US-Gallonen, mpg, mi/kWh), wie in deinen Einträgen.
5. **LubeLogger lesen alle**: 5, 15 (Standard), 30 oder 60 Minuten.
6. **Sprache der Namen und Meldungen** legt die Namen der Funktionen fest (beim
   Hinzufügen des Geräts eingefroren), die Texte und die Daten der
   Szenenvariablen. Standardmäßig Französisch.
7. Speichere, dann nutze **Verbindung testen**: sie zeigt die Version von
   LubeLogger, die Anzahl der Fahrzeuge und Erinnerungen.
8. Füge im Reiter **Erkennung** die Fahrzeuge hinzu, die du verfolgen willst.

## Geräte

Ein Gerät pro LubeLogger-Fahrzeug, benannt nach Marke, Modell und Kennzeichen
(`Renault Clio (AA-000-AA)`). Verkaufte Fahrzeuge werden ausgelassen.

| Funktion                 | Wert                                                                          |
| ------------------------ | ----------------------------------------------------------------------------- |
| Kilometerstand           | letzter in LubeLogger bekannter Stand, in km oder Meilen                      |
| Durchschnittsverbrauch   | L/100 km (oder mpg); kWh/100 km (oder mi/kWh) bei einem Elektrofahrzeug       |
| Kosten diesen Monat      | Kraftstoff, Wartungen, Reparaturen, Umbauten und Steuern des laufenden Monats |
| Nächste Erinnerung       | die dringendste Erinnerung und ihre Fälligkeit (`Ölwechsel · 45.000 km`)      |
| Überfällige Erinnerungen | Erinnerungen, deren Datum oder Kilometerstand überschritten ist               |
| Dringende Erinnerungen   | dringende oder sehr dringende Erinnerungen                                    |

Der Verbrauch ist der Durchschnitt von LubeLogger: gefahrene Strecke geteilt
durch den verbrauchten Kraftstoff, über die Tankvorgänge, die es berechnen kann
(nicht der erste, nicht nach einem vergessenen Tankvorgang). Gladys kennt keine
Einheit „L/100 km" oder „mpg": der Wert wird in Litern (oder ohne Einheit)
veröffentlicht, die vollständige Einheit steht im Namen der Funktion. Die
Kosten sind in der Währung von LubeLogger (Euro, Dollar oder Pfund Sterling;
eine andere Währung erscheint im Namen). Ein Fahrzeug, das in Stunden zählt
(Boot, Traktor), zeigt seine **Betriebsstunden**, ohne Verbrauch.

Die Dringlichkeit der Erinnerungen ist die von LubeLogger (standardmäßig:
dringend ab 30 Tagen oder 100 km, sehr dringend ab 7 Tagen oder 50 km, in den
Einstellungen änderbar): Gladys und LubeLogger sind sich immer einig.

## Dashboard-Widget

**Anstehende Wartungen**: zwei Kacheln (überfällige Erinnerungen, dringende
Erinnerungen) und die Liste der Erinnerungen, die dringendsten zuerst, mit
ihrer Fälligkeit und einem farbigen Abzeichen. Einstellung **Fahrzeug**: leer
für alle Fahrzeuge, oder eines. Nur lesend.

## Szenenauslöser

- **Wartungserinnerung wird dringend**: eine Erinnerung wird dringend, dann
  sehr dringend. Einmal pro Stufe und Fälligkeit. Variablen: Fahrzeug,
  Erinnerung, Fällig, Dringlichkeit („Dringend" oder „Sehr dringend").
- **Wartungserinnerung überfällig**: eine Erinnerung überschreitet ihr Datum
  oder ihren Kilometerstand. Einmal pro Fälligkeit. Variablen: Fahrzeug,
  Erinnerung, Fällig.

Beide lassen sich nach **Fahrzeug** filtern (leer: alle). Das erste Lesen nach
der Installation ist still: was schon dringend oder überfällig ist, zeigt das
Gerät, es wird nicht gemeldet. Eine wiederkehrende Erinnerung, die in
LubeLogger als erledigt markiert wird, bekommt eine neue Fälligkeit: sie wird
zu gegebener Zeit erneut gemeldet. Die Auslöser feuern beim ersten Lesen nach
der Änderung.

## Szenenaktionen

- **Kilometerstand zu LubeLogger hinzufügen**: wähle das Fahrzeug und gib den
  Stand ein, eine Zahl oder eine Szenenvariable (zum Beispiel den
  Kilometerstand aus der Integration deines Autoherstellers). Die Aktion liest
  LubeLogger, fügt den Stand mit dem heutigen Datum hinzu und liest dann die
  Erinnerungen erneut (die nach Kilometerstand rücken mit). Ein gleicher Stand
  fügt nichts hinzu; ein niedrigerer, oder einer mehr als 10.000 darüber
  (falsche Einheit, Sensorfehler), wird abgelehnt. Ergebnisse: **Stand
  hinzugefügt** und **Kilometerstand**.
- **Fahrzeug in LubeLogger lesen**: liefert Fahrzeug, Kilometerstand,
  Durchschnittsverbrauch, Monatskosten, nächste Erinnerung und ihre
  Dringlichkeit, die Anzahl überfälliger und dringender Erinnerungen, für eine
  Nachricht oder eine Bedingung.

## Szenenbeispiele

- **Ölwechsel steht an**: Auslöser „Wartungserinnerung wird dringend" →
  Nachricht „{{triggerEvent.data.vehicle_name}}:
  {{triggerEvent.data.reminder}} fällig ({{triggerEvent.data.due}})".
- **Hauptuntersuchung überfällig**: Auslöser „Wartungserinnerung überfällig" →
  dringende Nachricht an die ganze Familie.
- **Automatischer Stand**: jeden Abend um 21 Uhr → „Kilometerstand
  hinzufügen" mit der Kilometerstand-Variable des Autos, dann „Fahrzeug lesen"
  → nur fortfahren, wenn Erinnerungen überfällig sind → Nachricht mit der
  nächsten Erinnerung.

## Fehlerbehebung

- **„Zugriff verweigert"**: prüfe den API-Schlüssel (er wurde vielleicht
  gelöscht), oder Benutzername und Passwort.
- **„LubeLogger hat das Schreiben abgelehnt"** beim Hinzufügen eines Stands:
  der API-Schlüssel hat nur das Recht View; erstelle einen mit View und Edit.
- **„LubeLogger antwortet nicht"**: prüfe Adresse und Port vom Gladys-Rechner
  aus. Der Container läuft in einem Bridge-Netzwerk: `localhost` ist der
  Container selbst, gib stattdessen die IP-Adresse des Servers ein.
- **„Diese Adresse antwortet nicht wie LubeLogger 1.5.9 oder neuer"**: eine
  Anmeldeseite eines Proxys antwortet statt LubeLogger, oder seine Version ist
  zu alt.
- Kilometerstand oder Verbrauch stimmen nicht: prüfe die
  **Entfernungseinheit**.
- Für mehr Details in den Protokollen der Integration setze `LOG_LEVEL=debug`.

## Einschränkungen

- Jedes Lesen macht sieben Anfragen, darunter die Liste aller Tankvorgänge
  (für den Verbrauch): wähle bei einer sehr langen Historie ein langes
  Intervall.
- Das einzige Schreiben ist der Kilometerstand der Szenenaktion; es wird nie
  etwas gelöscht.
- Erinnerungen „nach Datum oder Kilometerstand" lassen sich nicht miteinander
  vergleichen: bei gleicher Dringlichkeit kommen die mit Datum vor denen nur
  nach Kilometerstand.
- Nicht mit dem LubeLogger-Projekt verbunden.
