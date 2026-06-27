# LTxLink (Flask)

Demo transplantní cesty - data pouze v paměti serveru (bez perzistence).

## Spuštění

```bash
pip install -r requirements.txt
python app.py
```

Otevřete [http://127.0.0.1:5000](http://127.0.0.1:5000)

### Google Maps (Síť pracovišť)

Záložka **Síť pracovišť** používá Google Maps JavaScript API. Před spuštěním nastavte API klíč:

**Windows (PowerShell):**
```powershell
$env:GOOGLE_MAPS_API_KEY="váš-api-klíč"
python app.py
```

**Linux / macOS:**
```bash
export GOOGLE_MAPS_API_KEY="váš-api-klíč"
python app.py
```

V [Google Cloud Console](https://console.cloud.google.com/google/maps-apis) povolte **Maps JavaScript API** a vytvořte klíč (pro localhost omezte doménu na `127.0.0.1` / `localhost`).

## Struktura

| Soubor / složka | Účel |
|-----------------|------|
| `app.py` | Flask server, `/api/bootstrap` a `/api/state` |
| `initial_state.json` | Výchozí `demoState` + `patients` |
| `templates/index.html` | HTML šablona |
| `static/css/main.css` | Styly |
| `static/js/app.js` | Logika UI (sync stavu na server) |

## Ladění

Upravujte přímo `static/js/app.js`, `static/css/main.css` a `templates/index.html`.

## API

- `GET /api/bootstrap` - celý stav v paměti
- `POST /api/state` - uloží `{ demoState, patients }` do paměti (JSON)
