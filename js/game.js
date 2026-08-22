// game.js — Stato della partita: tentativi, feedback, punteggio, aiuti
// (§10 feedback/tentativi, §11 punteggio, §12 aiuti).

import { normalizzaNome, flatDistance, bearingFlat, angularDistance } from './geo.js';
import { PUNTEGGIO, AIUTI, CALDO_FREDDO } from './config.js';

/** Categoria caldo/freddo di un tentativo, in base alla distanza dal target (§10). */
function categoriaCaldoFreddo(distanza) {
  if (distanza <= CALDO_FREDDO.caldissimo) return 'caldissimo';
  if (distanza <= CALDO_FREDDO.caldo) return 'caldo';
  if (distanza <= CALDO_FREDDO.tiepido) return 'tiepido';
  return 'freddo';
}

const ETICHETTE_CALDO_FREDDO = {
  caldissimo: '🔥 Caldissimo!',
  caldo: '🌤️ Caldo',
  tiepido: '🌥️ Tiepido',
  freddo: '❄️ Freddo',
};

/**
 * Crea lo stato di una partita.
 * @param {object} puzzle output di generaPuzzle
 * @param {object[]} countries dataset completo (per il match del nome e gli indizi extra)
 * @param {object} difficolta preset da config.DIFFICULTA
 * @param {object} [opzioni] { modalita: 'infinita'|'daily', now?: () => number }
 */
export function creaPartita(puzzle, countries, difficolta, opzioni = {}) {
  const now = opzioni.now || (() => Date.now());
  const modalita = opzioni.modalita || 'infinita';

  const stato = {
    puzzle,
    difficolta,
    modalita,
    tentativiMax: difficolta.tentativi,
    tentativiErrati: 0,
    tentativi: [], // { nome, corretto, distanza, categoria }
    indiziVisibili: puzzle.indizi.slice(), // include gli extra man mano
    indiziExtraSbloccati: 0,
    aiutiUsati: [], // ['continente', 'iniziale']
    costiAiuti: 0,
    risolta: false,
    persa: false,
    inizio: now(),
    fine: null,
  };

  // Pool di possibili indizi extra (non già mostrati, non il target).
  const giaMostrati = new Set(puzzle.indizi.map((i) => i.country));
  const poolExtra = countries
    .filter((c) => c !== puzzle.target && !giaMostrati.has(c))
    .filter((c) => c.tier <= difficolta.maxTier)
    .map((c) => ({ country: c, bearing: bearingFlat(puzzle.target, c) }));

  // Indice dei nomi/alias -> country per il match della risposta (§9).
  const indice = new Map();
  for (const c of countries) {
    indice.set(normalizzaNome(c.nome), c);
    for (const a of c.alias || []) indice.set(normalizzaNome(a), c);
  }

  function trovaPaese(input) {
    return indice.get(normalizzaNome(input)) || null;
  }

  function terminata() {
    return stato.risolta || stato.persa;
  }

  /**
   * Prova un tentativo. Rifiuta input non presenti in lista (§9).
   * @returns {object} esito con `stato`:
   *   'nonValido' | 'giaTerminata' | 'vinto' | 'sbagliato' | 'perso'
   */
  function indovina(input) {
    if (terminata()) return { stato: 'giaTerminata' };
    const paese = trovaPaese(input);
    if (!paese) return { stato: 'nonValido' };

    if (paese === stato.puzzle.target) {
      stato.risolta = true;
      stato.fine = now();
      stato.tentativi.push({ nome: paese.nome, corretto: true, distanza: 0, categoria: 'caldissimo' });
      return { stato: 'vinto', paese, punteggio: calcolaPunteggio(), riepilogo: riepilogo() };
    }

    // Tentativo errato: feedback caldo/freddo + aiuto progressivo gratuito (§10).
    stato.tentativiErrati += 1;
    const distanza = flatDistance(paese, stato.puzzle.target);
    const categoria = categoriaCaldoFreddo(distanza);
    stato.tentativi.push({ nome: paese.nome, corretto: false, distanza, categoria });

    const aiutoGratuito = aiutoProgressivo(stato.tentativiErrati);
    const tentativiRimasti = stato.tentativiMax - stato.tentativiErrati;

    if (tentativiRimasti <= 0) {
      stato.persa = true;
      stato.fine = now();
      return {
        stato: 'perso',
        paese,
        feedback: { categoria, etichetta: ETICHETTE_CALDO_FREDDO[categoria] },
        target: stato.puzzle.target,
        riepilogo: riepilogo(),
      };
    }

    return {
      stato: 'sbagliato',
      paese,
      feedback: {
        categoria,
        etichetta: ETICHETTE_CALDO_FREDDO[categoria],
        aiutoGratuito,
      },
      tentativiRimasti,
    };
  }

  /** Aiuto gratuito crescente a ogni errore (§10): continente, poi iniziale. */
  function aiutoProgressivo(nErrori) {
    const t = stato.puzzle.target;
    if (nErrori === 1) return { tipo: 'continente', valore: t.continente };
    if (nErrori === 2) return { tipo: 'iniziale', valore: t.nome.charAt(0).toUpperCase() };
    return null; // dal 3° in poi resta solo il caldo/freddo
  }

  // ---- Aiuti a pagamento (§12) ----

  function aiutoContinente() {
    if (!stato.aiutiUsati.includes('continente')) {
      stato.aiutiUsati.push('continente');
      stato.costiAiuti += AIUTI.continente;
    }
    return { tipo: 'continente', valore: stato.puzzle.target.continente, costo: AIUTI.continente };
  }

  function aiutoIniziale() {
    if (!stato.aiutiUsati.includes('iniziale')) {
      stato.aiutiUsati.push('iniziale');
      stato.costiAiuti += AIUTI.iniziale;
    }
    return {
      tipo: 'iniziale',
      valore: stato.puzzle.target.nome.charAt(0).toUpperCase(),
      costo: AIUTI.iniziale,
    };
  }

  /** Sblocca un indizio extra: aggiunge una freccia alla corona (§12). */
  function aiutoIndizioExtra() {
    if (poolExtra.length === 0) return null;
    // Scegli l'indizio che riempie meglio i "buchi" della corona attuale.
    let migliore = null;
    let idxMigliore = -1;
    let minGapMax = -1;
    poolExtra.forEach((c, i) => {
      const minGap = Math.min(
        ...stato.indiziVisibili.map((v) => angularDistance(v.bearing, c.bearing))
      );
      if (minGap > minGapMax) {
        minGapMax = minGap;
        migliore = c;
        idxMigliore = i;
      }
    });
    poolExtra.splice(idxMigliore, 1);
    stato.indiziVisibili.push(migliore);
    stato.indiziExtraSbloccati += 1;
    stato.costiAiuti += AIUTI.indizioExtra;
    return { indizio: migliore, costo: AIUTI.indizioExtra };
  }

  function indiziExtraDisponibili() {
    return poolExtra.length;
  }

  // ---- Punteggio (§11) ----

  function bonusVelocita() {
    const secondi = ((stato.fine || now()) - stato.inizio) / 1000;
    const frazione = Math.max(0, 1 - secondi / PUNTEGGIO.bonusVelocitaFinestra);
    return Math.round(PUNTEGGIO.bonusVelocitaMax * frazione);
  }

  function calcolaPunteggio() {
    if (!stato.risolta) return 0;
    const base = PUNTEGGIO.base[stato.difficolta.id] ?? 100;
    let p = base;
    p -= PUNTEGGIO.penalitaTentativo * stato.tentativiErrati;
    p -= PUNTEGGIO.penalitaIndizioExtra * stato.indiziExtraSbloccati;
    p -= stato.costiAiuti;
    p += bonusVelocita();
    return Math.max(PUNTEGGIO.minimo, Math.round(p));
  }

  function riepilogo() {
    return {
      vinta: stato.risolta,
      persa: stato.persa,
      tentativiErrati: stato.tentativiErrati,
      tentativiMax: stato.tentativiMax,
      indiziExtraSbloccati: stato.indiziExtraSbloccati,
      aiutiUsati: stato.aiutiUsati.slice(),
      punti: calcolaPunteggio(),
      bonusVelocita: bonusVelocita(),
      target: stato.puzzle.target,
      bearings: stato.indiziVisibili.map((i) => i.bearing),
      tempoSecondi: Math.round(((stato.fine || now()) - stato.inizio) / 1000),
    };
  }

  return {
    stato,
    indovina,
    aiutoContinente,
    aiutoIniziale,
    aiutoIndizioExtra,
    indiziExtraDisponibili,
    calcolaPunteggio,
    bonusVelocita,
    riepilogo,
    trovaPaese,
    terminata,
  };
}
