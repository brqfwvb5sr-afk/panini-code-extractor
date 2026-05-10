# Panini Collection Sync

Eine cleane iPhone-Webapp zum gemeinsamen Abhaken der Panini-Sammlung. OCR wurde entfernt.

## Funktionen

- alle vorher verwendeten WM-2026-Kürzel
- Länder von `1` bis `20`, zum Beispiel `SUI1` bis `SUI20`
- `FWC1` bis `FWC19`
- `CC1` bis `CC12`
- Länder und Spezialgruppen als ausklappbare Bereiche
- Suche nach Land, Kürzel oder Karte, zum Beispiel `SUI`, `MAR12`, `FWC`
- Modus oben: `Alle`, `Fehlende`, `Doppelte`
- pro Karte Anzahl setzen
- `0` bedeutet fehlt, `1` bedeutet vorhanden, `2+` bedeutet doppelt oder mehrfach vorhanden
- Live-Sync zwischen mehreren Handys über den lokalen Sync-Server
- Speicherung in `data/state.json` auf dem Rechner, auf dem der Server läuft

## Lokal starten

```bash
npm install
npm run dev
```

Die App läuft dann normalerweise auf:

```txt
http://localhost:5173/
```

Für Handys im selben WLAN öffnest du die Network-URL, die Vite anzeigt, zum Beispiel:

```txt
http://192.168.0.42:5173/
```

Wichtig: Für Live-Sync muss der Sync-Server ebenfalls laufen. `npm run dev` startet automatisch beides:

- Webapp: Port `5173`
- Sync-Server: Port `4174`

Wenn ein Handy nicht synchronisiert, blockiert meistens die Windows-Firewall Port `4174` oder `5173`.

## Produktionsstart

```bash
npm run build
npm start
```

Danach serviert der Server die gebaute App und die Sync-API auf Port `4174`.

## Datenmodell

Die App speichert nur die Anzahl pro Karte:

```json
{
  "SUI15": 1,
  "MAR12": 3,
  "FWC1": 2
}
```

Damit ist klar:

- `SUI15: 1` ist vorhanden
- `MAR12: 3` ist vorhanden und zweimal doppelt
- Karten ohne Eintrag fehlen

## Live-Sync

Der Sync ist bewusst einfach und kostenlos:

- kein externer Dienst
- keine API-Keys
- keine Accounts
- Server-Sent Events für Live-Updates
- JSON-Datei als Speicher

Alle Geräte müssen dieselbe laufende App-URL benutzen. Wenn der Rechner mit dem Server ausgeschaltet ist, gibt es keinen Live-Sync.
