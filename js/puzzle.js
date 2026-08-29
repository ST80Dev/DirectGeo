// puzzle.js — Generazione del puzzle: scelta target, selezione indizi con
// separazione angolare e copertura, controllo di univocità (§7).

import { bearingFlat, angularDistance, flatDistance } from './geo.js';
import { SELEZIONE } from './config.js';

/** Sceglie un elemento a caso da un array usando l'RNG dato. */
function scegli(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
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
 * Selezione greedy di N indizi ben distanziati (§7.3).
 * Massimizza il minimo gap angolare tra le frecce scelte; se non riesce a
 * rispettare `minGap`, lo allenta progressivamente.
 */
function selezionaIndizi(candidati, n, minGap, rng) {
  let gap = minGap;
  while (gap >= 0) {
    const sel = provaSelezione(candidati, n, gap, rng);
    if (sel.length >= n) return sel.slice(0, n);
    if (gap === 0) return sel; // meglio di niente
    gap = Math.max(0, gap - 5);
  }
  return [];
}

function provaSelezione(candidati, n, gap, rng) {
  if (candidati.length === 0) return [];
  const pool = mescola(candidati, rng);
  const scelti = [pool[0]];
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
    // Buona separazione MA con varietà: scegli a caso tra i migliori candidati,
    // così la stessa nazione non produce sempre gli stessi indizi.
    validi.sort((a, b) => b.minAngolo - a.minAngolo);
    const k = Math.min(3, validi.length);
    const scelto = validi[Math.floor(rng() * k)];
    scelti.push(scelto.c);
  }
  return scelti;
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

  // FASE 1 — scelta del target UNIFORME, indipendente dall'univocità.
  // È il punto chiave contro il bias: se scegliessimo il target e restituissimo
  // il primo "univoco", i Paesi isolati (Canada, Russia, Australia, ...) — facili
  // da rendere univoci — uscirebbero molto più spesso di quelli fitti (Europa,
  // Africa centrale). Qui ogni target ha la stessa probabilità; si riprova solo
  // se ha troppi pochi candidati-indizio (caso raro).
  // Distanza minima degli indizi dal target: per livello (leva di difficoltà della
  // triangolazione), con fallback al valore globale.
  const minDist = difficolta.minClueDist ?? SELEZIONE.minClueDist;

  let target = null;
  let candidati = null;
  for (let t = 0; t < 40; t++) {
    const cand = scegli(targetPool, rng);
    const lista = cluePoolTutti
      .filter((c) => c !== cand)
      .map((c) => ({ country: c, bearing: bearingFlat(cand, c), dist: flatDistance(cand, c) }))
      .filter((c) => c.dist >= minDist)
      .filter((c) => SELEZIONE.maxClueDist === 0 || c.dist <= SELEZIONE.maxClueDist);
    if (lista.length >= difficolta.clues) {
      target = cand;
      candidati = lista;
      break;
    }
  }
  if (!target) return fallbackPuzzle(countries, difficolta, rng);

  // FASE 2 — per QUEL target, cerca il set di indizi meno ambiguo possibile,
  // mantenendo sempre esattamente `difficolta.clues` frecce. La varietà degli
  // indizi resta garantita dalla selezione casuale (selezionaIndizi).
  let migliorePuzzle = null;
  let miglioreErrore = -1;
  for (let k = 0; k < SELEZIONE.maxTentativiIndizi; k++) {
    const indizi = selezionaIndizi(candidati, difficolta.clues, difficolta.minAngularGap, rng);
    if (indizi.length < difficolta.clues) continue;

    const { errore } = valutaUnivocita(target, indizi, countries);
    if (errore >= SELEZIONE.tolleranzaUnivocita) {
      return costruisciPuzzle(target, indizi, difficolta, true);
    }
    if (errore > miglioreErrore) {
      miglioreErrore = errore;
      migliorePuzzle = costruisciPuzzle(target, indizi, difficolta, false);
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
  const indizi = selezionaIndizi(candidati, difficolta.clues, 0, rng);
  return {
    target,
    indizi,
    difficolta: difficolta.id,
    minAngularGap: difficolta.minAngularGap,
    univoco: false,
    indiziBase: indizi.length,
  };
}
