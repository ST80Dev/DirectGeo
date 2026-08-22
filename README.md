# 🧭 Rosa dei Paesi

Gioco geografico **a direzioni**: indovina la **nazione nascosta** al centro di
una corona di **Paesi-indizio**, ciascuno collocato nella **direzione cardinale
reale** in cui si trova rispetto al target. Triangola la posizione e digita il
nome del Paese.

Sito **statico** (vanilla HTML/CSS/JS, nessun framework), pensato per **GitHub
Pages**. Interfaccia interamente in italiano.

> Il piano completo del progetto è in **[`docs/PIANO.md`](docs/PIANO.md)**: le
> sezioni citate qui sotto (§4, §7, ecc.) fanno riferimento a quel documento.

---

## Come giocare

1. Al centro c'è un cerchio con `?`: è la nazione da indovinare.
2. Attorno, delle frecce puntano verso Paesi noti (bandiera + nome), ognuna
   all'angolo **reale** in cui quel Paese si trova rispetto al target.
3. Non contano i confini, solo le **direzioni**: triangola.
4. Scrivi il nome del Paese (con autocomplete). Hai un numero limitato di tentativi.
5. A ogni errore ricevi un piccolo aiuto (continente, poi iniziale, e sempre un
   segnale "caldo/freddo"); puoi sbloccarne altri a costo di punti.

### Modalità

- **Infinita** — puzzle a raffica, streak e statistiche salvate in locale.
- **Sfida del giorno** — un puzzle deterministico uguale per tutti (seed = data),
  con streak giornaliera e condivisione in stile Wordle (frecce in emoji, senza spoiler).

---

## Avvio in locale

Il gioco carica `data/countries.json` via `fetch`, quindi **va servito da un
web server** (aprendo `index.html` con `file://` il browser blocca il caricamento).

```bash
# dalla cartella del progetto
python3 -m http.server 8000
# poi apri http://localhost:8000
```

In alternativa: `npx serve` oppure l'estensione "Live Server" di VS Code.

## Pubblicazione su GitHub Pages

1. Repo → **Settings → Pages**.
2. *Source*: **Deploy from a branch**, branch `main` (o quello scelto), cartella `/root`.
3. Il file `.nojekyll` (già incluso) evita che Jekyll interferisca con i file.

---

## Struttura del repository

```
/
├─ index.html                 # markup delle schermate (home, gioco, fine, stats)
├─ css/
│  └─ style.css               # tema chiaro/scuro, layout hub-and-spoke, responsive
├─ js/
│  ├─ main.js                 # bootstrap, routing schermate, orchestrazione
│  ├─ config.js               # parametri tarabili (difficoltà, punteggio, aiuti)
│  ├─ geo.js                  # bearingFlat + utilità geografiche (§4)
│  ├─ puzzle.js               # generazione puzzle + separazione angolare + univocità (§7)
│  ├─ game.js                 # stato partita, tentativi, punteggio, aiuti (§10-§12)
│  ├─ ui.js                   # rendering corona/frecce, autocomplete, mini-mappa (§15)
│  ├─ storage.js              # localStorage: record, statistiche, impostazioni (§14)
│  └─ daily.js                # seed per data (mulberry32) + condivisione (§13)
├─ data/
│  └─ countries.json          # dataset precalcolato: ~65 Paesi (§6)
├─ assets/
│  └─ flags/                  # (opzionale) SVG bandiere; in v1 si usano le emoji
├─ tools/
│  └─ build-centroids.mjs     # pipeline OFFLINE per i baricentri, non usata a runtime (§5-§6)
└─ docs/
   └─ PIANO.md                # specifiche complete del progetto
```

---

## Dataset e baricentri

Ogni Paese ha un punto di riferimento = **baricentro del landmass contiguo più
grande**, con esclusione di isole e territori oltremare (§5). I punti sono
**precalcolati** e serviti in `data/countries.json`; a runtime non c'è calcolo
geometrico pesante.

Per rigenerare/ampliare i centroidi da dati Natural Earth:

```bash
# 1. scarica ne_110m_admin_0_countries.geojson in tools/ (vedi header dello script)
# 2. esegui la pipeline offline
node tools/build-centroids.mjs
```

Lo script riusa i campi curati a mano (nome IT, alias, tier, continente) già
presenti in `data/countries.json` e ricalcola solo `lat`/`lng`.

---

## Configurazione rapida

Tutti i parametri di bilanciamento stanno in **`js/config.js`**:

- difficoltà (`DIFFICULTA`): numero di indizi, tier ammessi, tentativi, `minAngularGap`;
- selezione indizi (`SELEZIONE`): distanze min/max, tolleranza di univocità;
- punteggio (`PUNTEGGIO`) e costi degli aiuti (`AIUTI`).

Sono i valori "da tarare giocando" citati in §7, §8, §16.

---

## Stato roadmap (§18)

| Milestone | Descrizione | Stato |
|-----------|-------------|-------|
| M1 | Fondamenta: dataset + `geo.js` + rendering corona | ✅ |
| M2 | Interazione: autocomplete, validazione, tentativi + feedback | ✅ |
| M3 | Generatore: selezione indizi, separazione angolare, univocità, difficoltà | ✅ |
| M4 | Progressione: punteggio + aiuti a costo di punti | ✅ |
| M5 | Modalità Infinita + persistenza (record, statistiche) | ✅ |
| M6 | Sfida del giorno: seed per data + condivisione in emoji | ✅ |
| M7 | Rifinitura: tema chiaro/scuro, accessibilità, mobile | 🟡 in corso |
| Futuro | Leaderboard online con Supabase | ⬜ |

## Decisioni ancora aperte (§16)

- **Bandiere:** in v1 si usano le **emoji** (nessun asset da gestire). La
  raccomandazione del piano è passare a **SVG** (es. *flag-icons*) per coerenza
  cross-device; la cartella `assets/flags/` è pronta.
- **Nome del gioco:** attualmente *Rosa dei Paesi* (alternative: *Triangola*,
  *Orientati*, *DoveSono*).
- **Numero di tentativi** e valori di `minAngularGap` / tolleranza univocità:
  primi valori impostati in `js/config.js`, da rifinire giocando.
- **Classifica online (Supabase):** rimandata a una versione futura; in v1 tutto
  è locale (`localStorage`).
