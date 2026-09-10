# LTxLink (Flask)

Demo transplantační cesty - data pouze v paměti serveru (bez perzistence).

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
| `app.py` | Flask server, `/api/bootstrap`, `/api/state`, `/api/reset`, `/api/health` |
| `demo_dates.py` | Posun demo dat relativně k dnešku + živá nabídka orgánu |
| `initial_state.json` | Výchozí `demoState` + `patients` |
| `templates/index.html` | HTML šablona |
| `static/css/main.css` | Styly |
| `static/js/app.js` | Logika UI (sync stavu na server) |

## Provoz dema

### Data jsou vždy relativní k dnešku

Seed data v `initial_state.json` jsou psaná k pevnému referenčnímu dni
`demoAnchorDate` (`27. 6. 2026`). Při každém načtení stavu je `demo_dates.py`
posune tak, aby referenční den odpovídal dnešku - plánovaná vyšetření tedy
nikdy nespadnou do minulosti, ať se demo prezentuje kdykoliv.

Nová data proto zadávejte **vůči kotvě**, ne vůči skutečnému dnešku:
- co se má ukázat jako minulé, dejte před `27. 6. 2026`,
- co se má ukázat jako plánované, dejte za `27. 6. 2026`.

Aktivní nabídka orgánu se přerazítkuje při každém `GET /api/bootstrap`, aby
během prezentace nevypršela.

### Před prezentací

1. Otevřete demo aspoň 10 minut předem - bezplatná instance na Renderu se po
   ~15 minutách nečinnosti uspí a první načtení pak trvá skoro minutu.
   Dokud je demo otevřené v prohlížeči, drží se server vzhůru vlastním pingem
   na `/api/health` každých 8 minut. Spolehlivější je externí ping (UptimeRobot
   a podobné) nebo placený tarif bez uspávání.
2. V **Nastavení → Obnovit demo data** vraťte data do výchozího stavu
   (odpovídá `POST /api/reset`).

### Prohlížecí režim pro návštěvníky (QR kód)

Data jsou sdílená v paměti serveru - kdokoliv si demo otevře, může je měnit
pro všechny. Pro odkaz z QR kódu proto použijte:

```
https://…/?readonly=1
```

V tomto režimu se změny neukládají na server, zůstanou jen v prohlížeči
návštěvníka. Nahoře se zobrazí vysvětlující pruh.

### Přepínání rolí

Tlačítko **Přepnout roli (demo)** v hlavičce, případně klepnutí na fotku
uživatele. Funguje jedním klepnutím i na telefonu.

## Ladění

Upravujte přímo `static/js/app.js`, `static/css/main.css` a `templates/index.html`.

## API

- `GET /api/bootstrap` - celý stav v paměti (data posunutá k dnešku)
- `POST /api/state` - uloží `{ demoState, patients }` do paměti (JSON)
- `POST /api/reset` - vrátí data do výchozího stavu
- `GET /api/health` - lehký endpoint pro keep-alive ping
