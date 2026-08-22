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
    let migliore = null;
    let miglioreMinGap = -1;
    for (const c of pool) {
      if (scelti.includes(c)) continue;
      const minAngolo = Math.min(
        ...scelti.map((s) => angularDistance(s.bearing, c.bearing))
      );
      if (minAngolo < gap) continue;
      // Preferisci chi allarga di più la corona; a parità, i più noti (tier basso).
      if (
        minAngolo > miglioreMinGap ||
        (minAngolo === miglioreMinGap && c.country.tier < (migliore?.country.tier ?? 9))
      ) {
        migliore = c;
        miglioreMinGap = minAngolo;
      }
    }
    if (!migliore) break;
    scelti.push(migliore);
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
 * @param {object[]} countries dataset completo
 * @param {object} difficolta preset da config.DIFFICULTA
 * @param {() => number} [rng] generatore [0,1); default Math.random (Infinita).
 *        Per la Sfida del giorno si passa un RNG deterministico (daily.js).
 * @returns {{target:object, indizi:{country:object,bearing:number}[],
 *            difficolta:string, minAngularGap:number, univoco:boolean,
 *            indiziBase:number}}
 */
export function generaPuzzle(countries, difficolta, rng = Math.random) {
  const targetPool = countries.filter((c) => c.tier <= difficolta.targetMaxTier);
  const cluePoolTutti = countries.filter((c) => c.tier <= difficolta.maxTier);

  let ultimo = null;

  for (let tentativo = 0; tentativo < SELEZIONE.maxTentativiGenerazione; tentativo++) {
    const target = scegli(targetPool, rng);

    // Candidati indizio: entro i vincoli di distanza (§7).
    const candidati = cluePoolTutti
      .filter((c) => c !== target)
      .map((c) => ({ country: c, bearing: bearingFlat(target, c), dist: flatDistance(target, c) }))
      .filter((c) => c.dist >= SELEZIONE.minClueDist)
      .filter((c) => SELEZIONE.maxClueDist === 0 || c.dist <= SELEZIONE.maxClueDist);

    if (candidati.length < difficolta.clues) continue;

    let indizi = selezionaIndizi(candidati, difficolta.clues, difficolta.minAngularGap, rng);
    if (indizi.length < difficolta.clues) continue;

    const indiziBase = indizi.length;

    // Controllo univocità + riparazione con indizi extra (§7.4).
    let { rivale, errore } = valutaUnivocita(target, indizi, countries);
    let extraAggiunti = 0;
    while (
      errore < SELEZIONE.tolleranzaUnivocita &&
      extraAggiunti < SELEZIONE.maxIndiziExtra
    ) {
      const aggiunto = aggiungiIndizioDisambiguante(target, indizi, candidati, rivale);
      if (!aggiunto) break;
      indizi.push(aggiunto);
      extraAggiunti++;
      ({ rivale, errore } = valutaUnivocita(target, indizi, countries));
    }

    const univoco = errore >= SELEZIONE.tolleranzaUnivocita;
    const puzzle = {
      target,
      indizi,
      difficolta: difficolta.id,
      minAngularGap: difficolta.minAngularGap,
      univoco,
      indiziBase,
    };

    if (univoco) return puzzle;
    ultimo = puzzle; // tieni il migliore trovato finora
  }

  // Nessun puzzle perfettamente univoco: restituisci l'ultimo valido (raro).
  return ultimo || fallbackPuzzle(countries, difficolta, rng);
}

/**
 * Sceglie un indizio extra che massimizzi l'errore del rivale (lo allontana
 * dalla soluzione) mantenendo una buona separazione angolare (§7.4).
 */
function aggiungiIndizioDisambiguante(target, indiziAttuali, candidati, rivale) {
  const usati = new Set(indiziAttuali.map((i) => i.country));
  let migliore = null;
  let punteggioMax = -Infinity;
  for (const c of candidati) {
    if (usati.has(c.country)) continue;
    const minGap = Math.min(
      ...indiziAttuali.map((i) => angularDistance(i.bearing, c.bearing))
    );
    if (minGap < 15) continue; // non ammucchiare le frecce
    // Quanto questo indizio "sbugiarda" il rivale:
    const erroreRivale = rivale
      ? angularDistance(bearingFlat(rivale, c.country), c.bearing)
      : 0;
    const punteggio = erroreRivale + minGap * 0.2;
    if (punteggio > punteggioMax) {
      punteggioMax = punteggio;
      migliore = c;
    }
  }
  return migliore;
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
