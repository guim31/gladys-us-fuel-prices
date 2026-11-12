# US Fuel Prices (EIA)

Die wöchentlichen Durchschnittspreise für Benzin und Diesel in den USA in
Gladys, von der U.S. Energy Information Administration (EIA): der
US-Durchschnitt, die PADD-Regionen sowie die Staaten und Städte, die die EIA
veröffentlicht.

Das sind **Durchschnitte der Montagserhebung, keine Tankstellenpreise**: Die
EIA befragt jeden Montagmorgen eine Stichprobe von Tankstellen und
veröffentlicht die Durchschnitte am selben Nachmittag (Ostküstenzeit).
GasBuddy und AAA werden nicht genutzt: Beide bieten keine offene API.

Nicht mit der EIA verbunden. Aus Europa entwickelt, mit den öffentlichen
Daten der EIA: Rückmeldungen willkommen.

## Was du bekommst

- Ein Gerät pro verfolgtem **Gebiet**, mit für jeden Kraftstoff (Benzin
  Regular, Midgrade, Premium und Diesel): dem Preis in $/gal, seiner
  Änderung in einer Woche und in einem Jahr (52 Wochen, wie bei der EIA) und
  dem Datum der Erhebung.
- Einen Szenen-Auslöser **Neue Wochenpreise für Kraftstoff (EIA)** mit einer
  fertigen Zusammenfassung für eine Nachricht.
- Ein Dashboard-Widget mit den Preisen eines beliebigen Gebiets und ihren
  Änderungen.

## Voraussetzungen

- Gladys 5.3.0 oder neuer.
- Internetzugang von Gladys aus (`api.eia.gov`).
- Ein kostenloser **EIA-API-Schlüssel**: Melde dich auf
  https://www.eia.gov/opendata/register.php an (Name und E-Mail-Adresse), der
  Schlüssel kommt sofort per E-Mail. Ohne Schlüssel nutzt die Integration
  `DEMO_KEY`, den geteilten Demoschlüssel der EIA: Er ist auf wenige Anfragen
  pro Stunde und Tag begrenzt, oft schon aufgebraucht.

## Installation

Öffne in Gladys **Integrationen → Von GitHub installieren** und gib die
Adresse des Repositorys ein: `https://github.com/guim31/gladys-us-fuel-prices`.

## Konfiguration

| Feld              | Wirkung                                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EIA-API-Schlüssel | Dein kostenloser Schlüssel. Leer: `DEMO_KEY`. Von Gladys gespeichert, nie in den Protokollen.                                                                                      |
| Gebiete           | Ein Gerät pro Gebiet: der US-Durchschnitt (Standard), die 7 PADD-Regionen und 3 Teilregionen, 9 Staaten, 10 Städte. Diesel gibt es nur für das Land, die Regionen und Kalifornien. |
| Kraftstoffe       | Die Kraftstoffe auf jedem Gerät und im Widget. Leer: alle vier.                                                                                                                    |
| Sprache der Namen | Sprache der Geräte- und Funktionsnamen (beim Hinzufügen festgelegt), des Erhebungsdatums und der Zusammenfassung des Auslösers. Standard: Französisch.                             |

Öffne dann den Tab **Erkennung** der Integration und füge die Geräte hinzu.

## Geräte

### Kraftstoffpreise – Gebiet

| Funktion                      | Typ                              | Beispiel (USA, 09.11.2026) |
| ----------------------------- | -------------------------------- | -------------------------- |
| Normal ($/gal)                | Währung, Dollar                  | 3,995                      |
| Normal, Änderung in 1 Woche   | Währung, Dollar (mit Vorzeichen) | −0,158                     |
| Normal, Änderung in 1 Jahr    | Währung, Dollar (mit Vorzeichen) | 0,939                      |
| … ebenso für jeden Kraftstoff |                                  |                            |
| Erhebungsdatum                | Text                             | 09.11.2026                 |

Gladys hat keine Einheit $/gal: Die Preisfunktion zeigt ein Dollarzeichen,
und ihr Name sagt „pro Gallone“. Eine Änderung von −0,158 ist ein Rückgang
um 15,8 Cent.

## Szenen

### Preis unter einer Schwelle

Kein eigener Auslöser nötig: Wähle in einer Szene **Gerätewert** auf der
Preisfunktion, zum Beispiel „Normal ($/gal) kleiner als 3,50“.

### Ein Rückgang um N Cent

Dasselbe mit der Wochenänderung: „Normal, Änderung in 1 Woche kleiner als
−0,10“ startet die Szene, wenn der Preis in der Woche um mehr als 10 Cent
gefallen ist.

### Neue Wochenpreise für Kraftstoff (EIA)

Wird einmal pro Woche und verfolgtem Gebiet ausgelöst, wenn die EIA eine neue
Erhebung veröffentlicht (nie für die Erhebung, die beim Start der
Integration schon bekannt ist). Filter: die Gebiete. Variablen: `zone`
(EIA-Kennung, z. B. `NUS`), `zone_name`, `survey_date` (`JJJJ-MM-TT`) und
`summary`, z. B. „Normal 3,995 $ (−15,8 ¢), Diesel 6,127 $ (−16,5 ¢)“,
fertig für eine Nachricht.

## Dashboard

### Widget Spritpreise USA

Einstellungen: das Gebiet (jedes, verfolgt oder nicht; standardmäßig der
US-Durchschnitt) und ob die Änderungen angezeigt werden. Eine Kachel pro
Kraftstoff, grün, wenn der Preis in der Woche gefallen ist, orange, wenn er
gestiegen ist; dann die Änderungen in einer Woche und einem Jahr in Cent und
das Datum der Erhebung.

## Aktionen

**Verbindung zur EIA testen** (Tab Konfiguration) liest sofort die letzte
Erhebung mit dem Schlüssel der Konfiguration und antwortet mit einem Preis.

## Daten und Grenzen

- Wöchentliche Daten: Die Integration liest die EIA alle 6 Stunden und ab
  Montag 21:00 UTC stündlich, bis die neue Erhebung da ist (dienstags nach
  einem Bundesfeiertag). Einige Dutzend Anfragen pro Woche, weit unter den
  Grenzen eines kostenlosen Schlüssels.
- Eine Erhebung, die älter als 15 Tage ist, wird nicht angezeigt: lieber kein
  Wert als ein alter.
- Diesel wird nur für das Land, die Regionen und Kalifornien veröffentlicht.
- In manchen Wochen hält die EIA einen Wert zurück: Die Funktion behält dann
  ihren letzten Wert.
- Die Preise enthalten alle Steuern.

## Fehlerbehebung

- **„Die EIA lehnt den API-Schlüssel ab“**: Prüfe den Schlüssel (kopiere ihn
  erneut aus der E-Mail) und starte dann **Verbindung zur EIA testen**.
- **„Das Limit des EIA-Demoschlüssels ist erreicht“**: Gib deinen eigenen
  kostenlosen Schlüssel ein.
- **Kein Wert**: Füge zuerst die Geräte im Tab Erkennung hinzu; die Werte
  kommen innerhalb einer Minute.
- Mehr Details in den Protokollen der Integration (`LOG_LEVEL=debug`).

## Danksagung

Daten: U.S. Energy Information Administration, Open Data API v2
(`petroleum/pri/gnd`), gemeinfrei (Werk der US-Regierung). Integration unter
der Apache-2.0-Lizenz.
