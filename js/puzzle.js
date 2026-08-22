// puzzle.js — Generazione del puzzle: scelta target, selezione indizi con
// separazione angolare e copertura, controllo di univocità (§7).

import { bearingFlat, angularDistance, flatDistance } from './geo.js';
import { SELEZIONE, ANTISPIA } from './config.js';

/** Sceglie un elemento a caso da un array usando l'RNG dato. */
function scegli(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Conta i Paesi "rivali" di un indizio-spia (§7.4-bis): quante altre nazioni
 * hanno lo stesso Paese-indizio nella stessa direzione cardinale e a distanza
 * comparabile a quella del target. Pochissimi rivali ⇒ quell'indizio, da solo,
 * spiattella il target (es. «Stati Uniti a Sud» ⇒ solo il Canada).
 * Esce in anticipo appena supera la soglia: serve solo sapere SE è una spia.
 */
function contaRivali(target, clueCountry, bearing, dist, tutti) {
  let n = 0;
  for (const t of tutti) {
    if (t === target || t === clueCountry) continue;
    const d = flatDistance(t, clueCountry);
    if (d < SELEZIONE.minClueDist) continue;
    if (d > dist * ANTISPIA.distTol || d < dist / ANTISPIA.distTol) continue;
    if (angularDistance(bearingFlat(t, clueCountry), bearing) <= ANTISPIA.octantTol) {
      n += 1;
      if (n > ANTISPIA.maxRivali) return n; // non è una spia: basta così
    }
  }
  return n;
}

/**
 * Marca ogni candidato con due flag (§7.4-bis):
 * - `spia`   : indizio che da solo identifica il target (pochi rivali);
 * - `locale` : indizio dello stesso continente del target (rende la corona
 *              "regionale" se troppi indizi lo sono).
 * Il target è scelto una volta sola (FASE 1), quindi si marca il pool una volta.
 */
function marcaCandidati(target, candidati, tutti) {
  for (const c of candidati) {
    c.spia = contaRivali(target, c.country, c.bearing, c.dist, tutti) <= ANTISPIA.maxRivali;
    c.locale = c.country.continente === target.continente;
  }
}

/** Mescola un array (Fisher-Yates) con l'RNG dato, senza mutare l'originale. */
function mescola(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Selezione greedy di N indizi che massimizza il minimo gap angolare tra le
 * frecce (§7.3); se non riesce a rispettare `minGap`, lo allenta
 * progressivamente. `maxLocali` limita quanti indizi "regionali" (stesso
 * continente del target) possono entrare, così la corona non diventa un
 * grappolo di vicini (§7.4-bis). `pesoFama` (0..1) è la probabilità di
 * preferire, a parità di separazione, l'ancora meno famosa. La preferenza per
 * gli indizi NON-spia è gestita a monte da `generaPuzzle` (pool passato qui).
 */
function selezionaIndizi(candidati, n, minGap, maxLocali, pesoFama, rng) {
  let gap = minGap;
  while (gap >= 0) {
    const sel = provaSelezione(candidati, n, gap, maxLocali, pesoFama, rng);
    if (sel.length >= n) return sel.slice(0, n);
    if (gap === 0) return sel; // meglio di niente
    gap = Math.max(0, gap - 5);
  }
  return [];
}

function provaSelezione(candidati, n, gap, maxLocali, pesoFama, rng) {
  if (candidati.length === 0) return [];
  const pool = mescola(candidati, rng);
  // Semina con un indizio NON regionale, se c'è: non spreca subito il budget.
  const seed = pool.find((c) => !c.locale) || pool[0];
  const scelti = [seed];
  let nLocali = seed.locale ? 1 : 0;
  while (scelti.length < n) {
    // Tutti i candidati che rispettano il gap minimo, con la loro separazione.
    const validi = [];
    for (const c of pool) {
      if (scelti.includes(c)) continue;
      const minAngolo = Math.min(
        ...scelti.map((s) => angularDistance(s.bearing, c.bearing))
      );
      if (minAngolo < gap) continue;
      validi.push({ c, minAngolo });
    }
    if (validi.length === 0) break;
    // Buona separazione MA con varietà: scegli tra i migliori candidati, così la
    // stessa nazione non produce sempre gli stessi indizi.
    validi.sort((a, b) => b.minAngolo - a.minAngolo);
    // Preferisci i candidati che non sforano il tetto di indizi "regionali":
    // così la corona non diventa un grappolo di vicini dello stesso continente.
    const ammessi = validi.filter((v) => !v.c.locale || nLocali < maxLocali);
    const rosa = ammessi.length ? ammessi : validi;
    const k = Math.min(4, rosa.length);
    // A parità di buona separazione: con probabilità `pesoFama` scegli l'ancora
    // MENO famosa (tier più alto) tra le migliori; altrimenti a caso, per varietà.
    let scelto;
    if (pesoFama > 0 && rng() < pesoFama) {
      scelto = rosa.slice(0, k).reduce((a, b) => (b.c.country.tier > a.c.country.tier ? b : a));
    } else {
      scelto = rosa[Math.floor(rng() * k)];
    }
    scelti.push(scelto.c);
    if (scelto.c.locale) nLocali += 1;
  }
  return scelti;
}

/**
 * Estrae dall'rng un "profilo di varietà" UNA volta per puzzle (§7.4-ter): così
 * due partite con la stessa difficoltà scelta hanno corone diverse e imprevedibili
 * — a volte spietate (tutte cross-continente, ancore poco note), a volte morbide —
 * senza cambiare la difficoltà di base decisa dal giocatore (panel + n. indizi).
 * Deterministico per la Sfida del giorno (usa l'rng passato).
 */
function estraiProfilo(rng, difficolta) {
  const fr = ANTISPIA.fraLocaliMin + rng() * (ANTISPIA.fraLocaliMax - ANTISPIA.fraLocaliMin);
  const maxLocali = Math.max(1, Math.round(difficolta.clues * fr));
  // Ancore meno famose solo se il panel ha più tier (Estesa / Tutto il mondo).
  const pesoFama = difficolta.maxTier > 1 ? rng() * ANTISPIA.pesoFamaMax : 0;
  return { maxLocali, pesoFama };
}

/** Errore angolare medio di un candidato rispetto agli indizi mostrati (§7.4). */
function erroreMedio(candidato, indizi) {
  let somma = 0;
  for (const ind of indizi) {
    const b = bearingFlat(candidato, ind.country);
    somma += angularDistance(b, ind.bearing);
  }
  return somma / indizi.length;
}

/**
 * Valuta l'univocità del puzzle: trova il Paese rivale (diverso dal target)
 * che meglio combacerebbe con gli stessi indizi/angoli (§7.4).
 * @returns {{rivale: object|null, errore: number}}
 */
function valutaUnivocita(target, indizi, tutti) {
  let rivale = null;
  let erroreMin = Infinity;
  for (const c of tutti) {
    if (c === target) continue;
    const e = erroreMedio(c, indizi);
    if (e < erroreMin) {
      erroreMin = e;
      rivale = c;
    }
  }
  return { rivale, errore: erroreMin };
}

/**
 * Genera un puzzle per la difficoltà data (§7).
 *
 * Il numero di indizi è SEMPRE esattamente `difficolta.clues` (nessun indizio
 * aggiunto): l'univocità si ottiene provando target e set di indizi diversi
 * (rigenerazione), non allargando la corona. Gli indizi vengono scelti con una
 * componente casuale, quindi la stessa nazione produce corone diverse a ogni
 * partita.
 *
 * @param {object[]} countries dataset completo
 * @param {object} difficolta preset combinato (config.componiPreset)
 * @param {() => number} [rng] generatore [0,1); default Math.random (Infinita).
 *        Per la Sfida del giorno si passa un RNG deterministico (daily.js).
 * @param {{escludiTarget?: Iterable<string>}} [opzioni] iso dei target da evitare
 *        (anti-ripetizione tra partite consecutive in modalità Infinita).
 * @returns {{target:object, indizi:{country:object,bearing:number}[],
 *            difficolta:string, minAngularGap:number, univoco:boolean,
 *            indiziBase:number}}
 */
export function generaPuzzle(countries, difficolta, rng = Math.random, opzioni = {}) {
  const escludi = new Set(opzioni.escludiTarget || []);
  const targetPoolTutti = countries.filter((c) => c.tier <= difficolta.targetMaxTier);
  // Evita di ripetere i target recenti, a meno che non resti scelta sufficiente.
  const targetPoolFiltrato = targetPoolTutti.filter((c) => !escludi.has(c.iso));
  const targetPool = targetPoolFiltrato.length >= 3 ? targetPoolFiltrato : targetPoolTutti;
  const cluePoolTutti = countries.filter((c) => c.tier <= difficolta.maxTier);

  // FASE 1 — scelta del target PURAMENTE casuale e uniforme nel panel della
  // difficoltà, SENZA alcun bias: né verso i Paesi isolati (era il difetto della
  // vecchia logica: Canada/Russia quasi sempre), né in base ai candidati-indizio.
  // Il target è deciso PRIMA e da solo; gli indizi si scelgono nella FASE 2.
  const target = scegli(targetPool, rng);
  // Distanza minima degli indizi: per-livello (§7.4-ter). Alta a "Pochi" così gli
  // indizi non sono i confinanti ovvi (es. Estonia a 4° dalla Lituania) ma Paesi
  // più lontani, da triangolare davvero.
  const minDist = difficolta.minClueDist ?? SELEZIONE.minClueDist;
  const candidati = cluePoolTutti
    .filter((c) => c !== target)
    .map((c) => ({ country: c, bearing: bearingFlat(target, c), dist: flatDistance(target, c) }))
    .filter((c) => c.dist >= minDist)
    .filter((c) => SELEZIONE.maxClueDist === 0 || c.dist <= SELEZIONE.maxClueDist);
  // Se il vincolo di distanza lascia troppi pochi candidati (target molto
  // isolato a una soglia alta) si ripiega sulla soglia base, poi sul fallback.
  if (candidati.length < difficolta.clues) {
    const larghi = cluePoolTutti
      .filter((c) => c !== target)
      .map((c) => ({ country: c, bearing: bearingFlat(target, c), dist: flatDistance(target, c) }))
      .filter((c) => c.dist >= SELEZIONE.minClueDist);
    if (larghi.length < difficolta.clues) return fallbackPuzzle(countries, difficolta, rng);
    candidati.length = 0;
    candidati.push(...larghi);
  }

  // Marca spie e indizi "regionali" per il target scelto (§7.4-bis) ed estrai il
  // profilo di varietà per QUESTO puzzle (§7.4-ter): tetto "regionali" e preferenza
  // per ancore meno famose, casuali entro i limiti di config (dall'rng, quindi Sfida
  // del giorno deterministica). Il target non cambia: la varietà viene dagli indizi.
  marcaCandidati(target, candidati, countries);
  const { maxLocali, pesoFama } = estraiProfilo(rng, difficolta);

  // Livelli di rilassamento provati IN ORDINE (§7.4-bis/ter): dal più "vario e
  // difficile" al più disambiguante:
  //   1) senza indizi-spia, tetto "regionali" stretto  → massima varietà;
  //   2) spie ammesse, tetto stretto                    → certi Paesi (Canada)
  //      sono univoci solo grazie alla spia «USA a Sud»;
  //   3) spie ammesse, NESSUN tetto                      → recupera il potere
  //      disambiguante degli indizi vicini per i Paesi "fitti".
  // In modalità SFIDA (livello "Pochi") il livello 3 è DISATTIVATO: si tiene duro
  // il mix cross-continente accettando un po' di ambiguità (mitigata da caldo/freddo
  // e tentativi), invece di ripiegare sui vicini ovvi. Vera modalità difficile.
  const nonSpie = candidati.filter((c) => !c.spia);
  const fasi = [];
  if (nonSpie.length >= difficolta.clues) fasi.push({ pool: nonSpie, cap: maxLocali });
  fasi.push({ pool: candidati, cap: maxLocali });
  if (!difficolta.sfida) fasi.push({ pool: candidati, cap: difficolta.clues });

  // FASE 2 — per QUEL target, cerca il set di indizi meno ambiguo possibile,
  // mantenendo sempre esattamente `difficolta.clues` frecce.
  let migliorePuzzle = null;
  let miglioreErrore = -1;
  for (let k = 0; k < SELEZIONE.maxTentativiIndizi; k++) {
    for (const { pool, cap } of fasi) {
      const indizi = selezionaIndizi(
        pool, difficolta.clues, difficolta.minAngularGap, cap, pesoFama, rng
      );
      if (indizi.length < difficolta.clues) continue;

      const { errore } = valutaUnivocita(target, indizi, countries);
      // Univoco? Restituisci subito. Poiché i livelli "vari" sono provati per primi,
      // il primo puzzle univoco usa il minor numero di spie e di indizi regionali.
      if (errore >= SELEZIONE.tolleranzaUnivocita) {
        return costruisciPuzzle(target, indizi, difficolta, true);
      }
      if (errore > miglioreErrore) {
        miglioreErrore = errore;
        migliorePuzzle = costruisciPuzzle(target, indizi, difficolta, false);
      }
    }
  }

  // Target fitto/difficile da disambiguare: restituisci il set meno ambiguo
  // trovato per QUESTO target (non si cambia target: la varietà viene prima).
  return migliorePuzzle || fallbackPuzzle(countries, difficolta, rng);
}

function costruisciPuzzle(target, indizi, difficolta, univoco) {
  return {
    target,
    indizi,
    difficolta: difficolta.id,
    minAngularGap: difficolta.minAngularGap,
    univoco,
    indiziBase: indizi.length,
  };
}

/** Ultima spiaggia: un puzzle qualsiasi valido, senza garanzia di univocità. */
function fallbackPuzzle(countries, difficolta, rng) {
  const target = scegli(
    countries.filter((c) => c.tier <= difficolta.targetMaxTier),
    rng
  );
  const candidati = countries
    .filter((c) => c !== target)
    .map((c) => ({ country: c, bearing: bearingFlat(target, c) }));
  const indizi = selezionaIndizi(candidati, difficolta.clues, 0, difficolta.clues, 0, rng);
  return {
    target,
    indizi,
    difficolta: difficolta.id,
    minAngularGap: difficolta.minAngularGap,
    univoco: false,
    indiziBase: indizi.length,
  };
}
