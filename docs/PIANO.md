# Gioco geografico a direzioni — Specifiche di progetto

> Documento di base per lo sviluppo del repository GitHub. Pensato per essere
> letto da Claude Code come punto di partenza per costruire il sito.
> **Nome di lavoro:** *Rosa dei Paesi* (da confermare — vedi §16).

---

## 1. In una frase

Gioco browser in cui devi indovinare una **nazione nascosta** partendo da una
corona di **Paesi-indizio** disposti attorno ad essa: ogni indizio è collocato
nella **direzione cardinale reale** in cui si trova rispetto alla nazione da
trovare. Il giocatore *triangola* la posizione e digita il nome del Paese.

## 2. Concept

- Al centro un cerchio con `?` (la nazione nascosta).
- Attorno, N frecce; ogni freccia punta verso un Paese-indizio noto (bandiera +
  nome in italiano), all'angolo reale in cui quel Paese si trova rispetto al
  target.
- Esempio (dall'immagine originale): USA a nord, Irlanda a nord-est, Messico a
  ovest, Guatemala a sud-ovest, Paraguay a sud-est → si triangola la nazione.
- Non c'entrano i **confini**: contano solo le **direzioni**.

## 3. Meccanica di un puzzle

1. Il gioco sceglie una **nazione target** dal pool.
2. Sceglie **N Paesi-indizio** (N = difficoltà) ben distribuiti attorno al target.
3. Per ciascun indizio calcola la direzione (bearing) dal target verso l'indizio.
4. Disegna la corona di frecce agli angoli reali.
5. Il giocatore digita il nome della nazione (autocomplete). Ha tentativi limitati.
6. A ogni errore riceve un piccolo aiuto; può spendere punti per indizi/suggerimenti extra.
7. Alla risoluzione (o esaurimento tentativi) si rivela il Paese e si assegna il punteggio.

## 4. Calcolo delle direzioni — "mappa piatta"

Si usa la proiezione piatta (equirettangolare): differenza semplice di
lat/long, **non** la bussola great-circle. È meno "corretta" sulle lunghe
distanze ma più intuitiva a occhio su un planisfero, che è ciò che vogliamo.

Convenzione angoli: **0° = Nord, 90° = Est, 180° = Sud, 270° = Ovest** (orario).

```js
// Direzione dal target verso l'indizio, su mappa piatta.
function bearingFlat(target, clue) {
  let dLon = clue.lng - target.lng;
  // Antimeridiano: scegli sempre il verso Est/Ovest più corto
  if (dLon > 180)  dLon -= 360;
  if (dLon < -180) dLon += 360;
  const dLat = clue.lat - target.lat;
  const deg = Math.atan2(dLon, dLat) * 180 / Math.PI; // x = Est, y = Nord
  return (deg + 360) % 360;
}
```

Note tecniche:
- **Antimeridiano (180°):** gestito dalla normalizzazione di `dLon` sopra.
- **Poli:** distorsione trascurabile, pochissimi Paesi vicini ai poli.

## 5. Punto di riferimento di ogni Paese

- Si usa il **baricentro** (centro di massa dell'area) del **solo landmass
  contiguo più grande**.
- Si **escludono** isole e territori staccati/oltremare.
  - USA → solo i 48 stati contigui (**via Hawaii e Alaska**).
  - Francia → métropole (via Guyana, Réunion, ecc.).
  - Spagna → penisola iberica (via Canarie).
  - Portogallo → continente (via Azzorre/Madeira).
  - Paesi Bassi → parte europea (via Caraibi).
- Questi punti si **precalcolano una volta sola offline** e si spediscono in un
  JSON statico: a runtime nessun calcolo geometrico pesante.

## 6. Modello dati

Dataset statico `data/countries.json`, un record per Paese:

```json
{
  "iso": "IT",
  "nome": "Italia",
  "alias": ["Italia"],
  "continente": "Europa",
  "lat": 42.8,
  "lng": 12.6,
  "tier": 1,
  "bandiera": "assets/flags/it.svg"
}
```

Campi:
- `nome` — nome ufficiale in **italiano** (chiave per il confronto della risposta).
- `alias` — varianti accettate dall'autocomplete (es. "Stati Uniti", "USA", "America").
- `lat`/`lng` — baricentro precalcolato (§5).
- `tier` — livello di notorietà (1 = molto noto … 3 = poco noto), usato dalla difficoltà.
- `bandiera` — percorso all'asset o emoji (vedi §16, decisione aperta).

### Pipeline offline di pre-calcolo (`tools/build-centroids.mjs`)

- Fonte geometrie: **Natural Earth – Admin 0 Countries** (GeoJSON).
- Per ogni Paese: prendi il **poligono di area maggiore** (landmass principale),
  applica le esclusioni manuali del §5, calcola il centroide area-pesato.
- Aggiungi a mano nomi italiani + alias + tier.
- Output: `data/countries.json`. Lo script **non** gira nel sito, solo in build.

## 7. Generazione del puzzle

Input: difficoltà (→ N indizi, tier ammessi). Output: target + lista indizi con angoli.

1. **Scelta target** dal pool ammesso per la difficoltà.
2. **Calcolo bearing** dal target verso tutti i candidati-indizio.
3. **Selezione di N indizi** con questi vincoli:
   - notorietà adeguata al livello (usa `tier`);
   - **separazione angolare minima** tra gli indizi (es. ≥ 30°; più alta con
     pochi indizi) → frecce già ben distanziate, triangolazione migliore;
   - buona **copertura direzionale** (evita tutti gli indizi dallo stesso lato).
4. **Controllo di univocità:** simula la risposta — per ogni altro Paese misura
   quanto bene combacerebbe con gli stessi indizi/angoli. Se un Paese diverso è
   troppo compatibile (risposta ambigua), **aggiungi un indizio** o **sostituiscine**
   uno finché il target è (quasi) univoco; altrimenti rigenera.
5. **Anti-collisione grafica:** se due etichette/bandiere si sovrappongono nella
   corona, sposta l'**etichetta** (raggio/offset), **mai** l'angolo della freccia:
   la direzione resta sempre onesta.

### 7.4-bis — Anti-"indizio servito" (casi limite troppo facili)

Alcuni indizi rendono il puzzle banale. Vanno **evitati quando possibile**, ma
sempre **subordinati all'univocità** (meglio un puzzle univoco con un indizio
rivelatore che uno ambiguo). Due categorie (config `ANTISPIA`, vedi `config.js`):

1. **Indizio-spia** — un singolo indizio «Paese + direzione» identifica il target
   quasi da solo (es. «Stati Uniti a Sud» ⇒ per forza Canada). Si riconosce
   contando i Paesi *rivali* che hanno quello stesso Paese-indizio nella stessa
   direzione cardinale e a distanza comparabile: pochissimi rivali ⇒ spia. Il
   generatore prova **due fasi**: prima seleziona gli indizi *senza* spie; se il
   set così ottenuto non è univoco (per certi Paesi la spia è l'unico ancoraggio
   possibile) riprova ammettendole. Così le spie spariscono dove non servono e
   restano solo dove sono indispensabili.
2. **Corona troppo regionale** — troppi indizi dello stesso continente del target
   (quasi confinanti): basta riconoscere il "grappolo", non serve triangolare
   (es. Bolivia+Cile+Uruguay ⇒ Argentina). Si mette un **tetto** al numero di
   indizi dello stesso continente, così il resto viene da altri continenti e la
   triangolazione resta necessaria.

### 7.4-ter — Profilo di varietà (imprevedibilità a parità di difficoltà)

La difficoltà di *base* la sceglie il giocatore con i due assi (panel + numero
indizi). Dentro quella scelta, ogni puzzle estrae dall'RNG un **profilo di
varietà** (`estraiProfilo` in `puzzle.js`) che rende le corone diverse e
imprevedibili — a volte spietate, a volte morbide:

- **Tetto "regionali" variabile** — la frazione massima di indizi dello stesso
  continente è estratta a caso in `[fraLocaliMin, fraLocaliMax]`: certi puzzle
  sono quasi tutti cross-continente, altri più raccolti.
- **Ancore meno famose (variabile)** — solo sui panel con più tier: si estrae un
  "peso fama" casuale; più è alto, più spesso — a parità di buona separazione
  angolare — si preferisce come indizio la nazione meno nota.

Poiché il profilo esce dall'RNG passato, la **Sfida del giorno resta
deterministica** (stessa data ⇒ stesso puzzle).

Parametri iniziali da tarare (in un file di config):
`minAngularGap`, `tolleranzaUnivocità`, distanza min/max degli indizi,
`ANTISPIA` (soglie spie + tetto indizi dello stesso continente).

## 8. Difficoltà

- **Numero di indizi** = leva principale: **min 4, max 7–8**. Più indizi = più facile.
- Modula anche la **notorietà** dei Paesi coinvolti (target e indizi) via `tier`.
- Preset consigliati: *Facile* (7–8 indizi, tier 1) · *Medio* (5–6, tier 1–2) ·
  *Difficile* (4, tier 1–3).

## 9. Input e risposta

- **Campo di testo con autocomplete** dei nomi Paese in italiano.
- Match su `nome` + `alias`, **accent-insensitive** e case-insensitive.
- Suggerimenti a discesa mentre si digita; invio o click per confermare.
- Rifiuta input non presenti in lista (nessun "falso positivo").

## 10. Feedback e tentativi

- Numero di **tentativi limitato** per puzzle (valore iniziale da decidere, es. 3–5).
- A ogni errore, un piccolo aiuto crescente: es. *continente*, poi *iniziale*,
  poi indicazione "caldo/freddo" (vicino/lontano dal target).
- Alla fine: rivela il Paese, mostralo su una **mini-mappa** con la sua posizione.

## 11. Punteggio

Formula tarabile, del tipo:

```
punteggio = base(difficoltà)
          − penalità_indizi   × indizi_extra_sbloccati
          − penalità_tentativi × tentativi_errati
          − penalità_aiuti     × aiuti_usati
          + bonus_velocità(tempo)
```

- Meno indizi usati, meno tentativi, più velocità → più punti.
- I costi degli aiuti si scalano dal punteggio del round.

## 12. Aiuti / suggerimenti

- **Indizio extra:** aggiunge una freccia (spende punti).
- **Suggerimento:** iniziale del nome, oppure continente (spende punti).
- Ogni aiuto è opzionale e ha un costo, per bilanciare facilità e punteggio.

## 13. Modalità di gioco

- **Infinita:** puzzle a raffica, streak e punteggio cumulativo, record salvato.
- **Sfida del giorno:** un puzzle deterministico uguale per tutti, generato da un
  seed = data (`YYYY-MM-DD`) con PRNG deterministico (es. *mulberry32*). Un
  risultato al giorno, **streak giornaliera** e **condivisione** in stile Wordle
  (griglia/frecce in emoji, senza spoiler).

## 14. Persistenza (`localStorage`)

Funziona nativamente su GitHub Pages (storage per-origine). Chiavi previste:
- record e migliori punteggi (classifica **locale**);
- storico Sfida del giorno + streak giornaliera;
- statistiche (partite giocate, % vittorie, tentativi medi);
- impostazioni (difficoltà preferita, tema).

> **Classifica online (futuro, opzionale):** una leaderboard condivisa non è
> possibile con solo file statici. Se in futuro la vuoi, si può agganciare
> **Supabase** (già nel tuo stack) senza stravolgere il resto. In v1 resta locale.

## 15. UI / UX

Schermate:
- **Home:** scelta modalità (Infinita / Sfida del giorno), difficoltà, statistiche, "come si gioca".
- **Gioco:** cerchio-hub centrale con `?`, corona di frecce (bandiera + nome + angolo reale),
  campo risposta con autocomplete, pulsanti aiuto, contatore tentativi/indizi, punteggio.
- **Fine round:** Paese rivelato, mini-mappa, punteggio, "prossimo" / condividi (daily).
- **Statistiche / classifica locale.**

Stile: layout hub-and-spoke come nell'immagine di riferimento, pulito, tema chiaro/scuro,
responsive (mobile-first). Interfaccia interamente in **italiano**.

## 16. Decisioni ancora aperte

- **Bandiere:** emoji flag (semplici ma rese in modo incoerente su alcune piattaforme,
  Windows in primis) **oppure** asset SVG (es. libreria *flag-icons*, resa uniforme).
  → Raccomandazione: **SVG** per coerenza cross-device.
- **Numero di tentativi** per puzzle.
- **Valori iniziali** di `minAngularGap` e tolleranza di univocità (da tarare giocando).
- **Nome del gioco** (proposte: *Rosa dei Paesi*, *Triangola*, *Orientati*, *DoveSono*).
- **Classifica online** con Supabase: v1 no, valutare per una versione successiva.

## 17. Stack tecnico e struttura repo

- **Vanilla HTML/CSS/JS**, nessun framework. Sito statico, **GitHub Pages**.
- Dataset precalcolato servito come JSON statico.

```
/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ main.js        # bootstrap, routing schermate
│  ├─ geo.js         # bearingFlat + utilità geografiche
│  ├─ puzzle.js      # generazione puzzle + controllo univocità
│  ├─ game.js        # stato partita, tentativi, punteggio, aiuti
│  ├─ ui.js          # rendering hub/frecce, autocomplete, mini-mappa
│  ├─ storage.js     # localStorage: record, statistiche, impostazioni
│  └─ daily.js       # seed per data (PRNG deterministico) + condivisione
├─ data/
│  └─ countries.json # dataset precalcolato (§6)
├─ assets/
│  └─ flags/         # SVG bandiere (se non emoji)
└─ tools/
   └─ build-centroids.mjs  # pipeline OFFLINE, non usata a runtime
```

## 18. Roadmap incrementale

Ordine consigliato per lo sviluppo con Claude Code, un passo per volta:

- **M1 — Fondamenta:** dataset `countries.json` + `geo.js` + rendering statico
  della corona per un puzzle fisso di prova.
- **M2 — Interazione:** input con autocomplete, validazione risposta, tentativi + feedback.
- **M3 — Generatore:** `puzzle.js` (scelta indizi, separazione angolare, univocità) + difficoltà.
- **M4 — Progressione:** punteggio + aiuti a costo di punti.
- **M5 — Modalità Infinita + persistenza:** `storage.js`, record, statistiche.
- **M6 — Sfida del giorno:** seed per data + condivisione in emoji.
- **M7 — Rifinitura:** tema chiaro/scuro, accessibilità, ottimizzazione mobile.
- **(Futuro) — Leaderboard online** con Supabase.

## 19. Casi limite da tenere presenti

- Antimeridiano (gestito nel bearing).
- Micro-stati come target: meglio in tier alto o esclusi dai target.
- Paesi enormi come indizi (Russia, Canada): il baricentro li rende coerenti, ma
  la direzione può risultare controintuitiva → valutarli per tier.
- Nomi italiani e alias curati a mano per un autocomplete solido.
