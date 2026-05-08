# Panini Code Extractor

Eine kleine Browser-App, die aus hochgeladenen Bildern von Panini-Kartenrückseiten per OCR Kartencodes erkennt und sauber als Liste ausgibt.

Die App extrahiert nur Codes. Es gibt keine Datenbank, keine Sammlungsliste, kein Abhaken und kein Backend.

## Funktionen

- Ein oder mehrere Bilder hochladen
- Bilder per Drag & Drop hinzufügen
- OCR lokal im Browser mit Tesseract.js ausführen
- Codes im Format `FRA14`, `ENG12`, `NOR2` oder `GER101` erkennen
- Varianten wie `FRA 14`, `fra14` und `FRA-14` normalisieren
- seitliche oder gedrehte Codes wie `QAT 20` erkennen
- Doppelte Codes entfernen
- Anzahl eindeutiger Codes anzeigen
- Codes in die Zwischenablage kopieren
- Ergebnisse zurücksetzen

## WM-2026-Teamcodes

Die App kennt die 48 Teamkürzel der FIFA Fussball-Weltmeisterschaft 2026 und nutzt sie beim Bereinigen von OCR-Fehlern:

| Team | Code |
| --- | --- |
| Algerien | `ALG` |
| Argentinien | `ARG` |
| Australien | `AUS` |
| Österreich | `AUT` |
| Belgien | `BEL` |
| Bosnien und Herzegowina | `BIH` |
| Brasilien | `BRA` |
| Kanada | `CAN` |
| Elfenbeinküste / Côte d'Ivoire | `CIV` |
| DR Kongo | `COD` |
| Kolumbien | `COL` |
| Kap Verde / Cabo Verde | `CPV` |
| Kroatien | `CRO` |
| Curaçao | `CUW` |
| Tschechien | `CZE` |
| Ecuador | `ECU` |
| Ägypten | `EGY` |
| England | `ENG` |
| Spanien | `ESP` |
| Frankreich | `FRA` |
| Deutschland | `GER` |
| Ghana | `GHA` |
| Haiti | `HAI` |
| Iran | `IRN` |
| Irak | `IRQ` |
| Jordanien | `JOR` |
| Japan | `JPN` |
| Republik Korea / Südkorea | `KOR` |
| Saudiarabien | `KSA` |
| Marokko | `MAR` |
| Mexiko | `MEX` |
| Niederlande | `NED` |
| Norwegen | `NOR` |
| Neuseeland | `NZL` |
| Panama | `PAN` |
| Paraguay | `PAR` |
| Portugal | `POR` |
| Katar | `QAT` |
| Südafrika | `RSA` |
| Schottland | `SCO` |
| Senegal | `SEN` |
| Schweiz | `SUI` |
| Schweden | `SWE` |
| Tunesien | `TUN` |
| Türkei | `TUR` |
| Uruguay | `URU` |
| USA | `USA` |
| Usbekistan | `UZB` |

## Lokaler Start

```bash
npm install
npm run dev
```

Danach zeigt Vite die lokale URL im Terminal an, meistens `http://localhost:5173`.

## Auf dem Handy testen

Starte die App im Netzwerkmodus:

```bash
npm run dev:host
```

Öffne auf dem Handy die Network-URL, die Vite im Terminal anzeigt, zum Beispiel:

```txt
http://192.168.0.42:5173/
```

Das Handy muss im selben WLAN sein wie der Computer. Wenn die Seite nicht lädt, blockiert wahrscheinlich die Windows-Firewall den Zugriff auf Port `5173`.

Auf dem Handy gibt es zusätzlich den Button `Kamera öffnen`, der die Rückkamera für ein neues Foto anbietet.

## Build

```bash
npm run build
```

Die statischen Dateien werden in `dist` erstellt.

## Deployment auf Vercel

1. Repository zu GitHub hochladen.
2. In Vercel ein neues Projekt importieren.
3. Framework Preset: `Vite`.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Deploy starten.

## Deployment auf Netlify

1. Repository zu GitHub hochladen.
2. In Netlify ein neues Site-Projekt aus GitHub importieren.
3. Build Command: `npm run build`.
4. Publish Directory: `dist`.
5. Deploy starten.

## OCR-Einschränkungen

OCR ist nie perfekt. Die Erkennung hängt stark von Bildqualität, Perspektive, Licht und Schärfe ab. Gute Ergebnisse gibt es eher, wenn:

- die Karte scharf fotografiert ist
- der Code oben rechts gut sichtbar ist
- das Bild gleichmässig beleuchtet ist
- wenig Schatten oder Spiegelung auf der Karte liegt
- die Karte möglichst gerade im Bild steht
- das Bild in einem browserlesbaren Format vorliegt, zum Beispiel JPG, PNG oder WebP

HEIC-Dateien werden nicht in jedem Desktop-Browser zuverlässig gelesen. Falls ein iPhone-Foto nicht funktioniert, exportiere oder teile es als JPG und lade diese Version hoch.

Die App nutzt eine robuste Code-Erkennung mit folgendem Muster:

```txt
\b[A-Z]{3}\s?[-]?\s?\d{1,3}\b
```

Gefundene Codes werden anschliessend normalisiert: Leerzeichen und Bindestriche werden entfernt, alles wird in Grossbuchstaben umgewandelt.

## Technik

- React
- Vite
- Tesseract.js
- Lokale Tesseract-Worker-, Core- und Englisch-Sprachdaten im `public/tesseract`-Ordner
- Kein Backend
- Keine API-Keys
- Keine kostenpflichtigen Dienste
