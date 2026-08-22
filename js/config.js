// config.js — Parametri di gioco tarabili in un unico posto.
// Vedi §7 (generazione), §8 (difficoltà), §10-§12 (tentativi/aiuti), §11 (punteggio).

// La difficoltà è su DUE assi indipendenti, scelti separatamente dal giocatore (§8):
//   1) INDIZI  = quantità di frecce nella corona (+ tentativi, separazione).
//   2) AMPIEZZA = ampiezza del "panel" di nazioni in gioco, cioè quanto noto/insolito
//                 è l'insieme da cui si pescano SIA il target SIA gli indizi.
// Il preset effettivo usato dal motore è la combinazione dei due (componiPreset).

/**
 * Asse 1 — quantità di indizi (§8, §10).
 * - clues: numero di Paesi-indizio nella corona (più indizi = più facile).
 * - tentativi: tentativi consentiti.
 * - minAngularGap: separazione angolare minima tra frecce, in gradi (§7.3).
 * - liv: 1..3 solo per il codice colore in UI (1 facile → 3 difficile).
 */
export const LIVELLI_INDIZI = {
  molti: { id: 'molti', nome: 'Molti (7)', clues: 7, tentativi: 5, minAngularGap: 28, liv: 1 },
  medi: { id: 'medi', nome: 'Medi (5)', clues: 5, tentativi: 4, minAngularGap: 40, liv: 2 },
  pochi: { id: 'pochi', nome: 'Pochi (4)', clues: 4, tentativi: 3, minAngularGap: 55, liv: 3 },
};

/**
 * Asse 2 — ampiezza del panel di nazioni (§8, §19).
 * maxTier vale sia per il target sia per gli indizi: livelli più alti pescano da
 * un insieme via via più grande (fino alla totalità delle nazioni).
 */
export const LIVELLI_AMPIEZZA = {
  famose: { id: 'famose', nome: 'Solo famose', maxTier: 1, targetMaxTier: 1, liv: 1 },
  estesa: { id: 'estesa', nome: 'Estesa', maxTier: 2, targetMaxTier: 2, liv: 2 },
  mondiale: { id: 'mondiale', nome: 'Tutto il mondo', maxTier: 3, targetMaxTier: 3, liv: 3 },
};

export const INDIZI_DEFAULT = 'medi';
export const AMPIEZZA_DEFAULT = 'estesa';

/**
 * Combina i due assi nel preset usato dal generatore e dalla partita.
 * @param {string} indiziId chiave di LIVELLI_INDIZI
 * @param {string} ampiezzaId chiave di LIVELLI_AMPIEZZA
 */
export function componiPreset(indiziId = INDIZI_DEFAULT, ampiezzaId = AMPIEZZA_DEFAULT) {
  const ind = LIVELLI_INDIZI[indiziId] || LIVELLI_INDIZI[INDIZI_DEFAULT];
  const amp = LIVELLI_AMPIEZZA[ampiezzaId] || LIVELLI_AMPIEZZA[AMPIEZZA_DEFAULT];
  return {
    id: `${ind.id}-${amp.id}`,
    indizi: ind.id,
    ampiezza: amp.id,
    nomeIndizi: ind.nome,
    nomeAmpiezza: amp.nome,
    clues: ind.clues,
    tentativi: ind.tentativi,
    minAngularGap: ind.minAngularGap,
    maxTier: amp.maxTier,
    targetMaxTier: amp.targetMaxTier,
    // Punteggio base: più difficile su entrambi gli assi = più punti (§11).
    base: PUNTEGGIO.baseIndizi[ind.id] + PUNTEGGIO.bonusAmpiezza[amp.id],
  };
}

/**
 * Profili giocatore fissi (§14). Il gioco è pensato per due sole persone sullo
 * stesso dispositivo: ognuna ha salvataggi separati in localStorage.
 * Per rinominarli basta cambiare `nome`/`emoji` qui (gli `id` restano stabili,
 * così i salvataggi già presenti non si perdono).
 */
export const PROFILI = [
  { id: 'papa', nome: 'Papà', emoji: '👨' },
  { id: 'figlio', nome: 'Figlio', emoji: '🧒' },
];

export const PROFILO_DEFAULT = 'papa';

/** Vincoli geografici sulla selezione degli indizi (in gradi di mappa piatta, §7). */
export const SELEZIONE = {
  // Distanza minima di un indizio dal target: evita frecce "sopra" al target.
  minClueDist: 8,
  // Distanza massima: evita indizi troppo lontani/ambigui (0 = nessun limite).
  maxClueDist: 0,
  // Tolleranza di univocità (§7.4): un altro Paese è "troppo compatibile" se il suo
  // errore angolare medio con gli indizi è entro questo margine dal target.
  tolleranzaUnivocita: 22,
  // Numero massimo di (target + set di indizi) da provare per trovarne uno univoco
  // mantenendo SEMPRE il numero di indizi scelto (nessun indizio aggiunto).
  // Serve più alto con panel ampi (tante nazioni) e pochi indizi.
  maxTentativiGenerazione: 600,
};

/** Punteggio (§11). Formula tarabile. */
export const PUNTEGGIO = {
  // Base per asse "indizi" (meno indizi = più punti).
  baseIndizi: { molti: 100, medi: 200, pochi: 300 },
  // Bonus per asse "ampiezza" (panel più ampio/insolito = più punti).
  bonusAmpiezza: { famose: 0, estesa: 60, mondiale: 140 },
  penalitaTentativo: 15, // per ogni tentativo errato
  penalitaAiuto: 20, // per ogni aiuto usato
  penalitaIndizioExtra: 25, // per ogni indizio extra sbloccato
  bonusVelocitaMax: 100, // bonus velocità a inizio round
  bonusVelocitaPasso: 10, // punti persi a ogni blocco
  bonusVelocitaIntervallo: 10, // secondi per blocco: −10 punti ogni 10s (decadimento a scatti)
  minimo: 10, // punteggio minimo garantito per una vittoria
};

/** Costi degli aiuti in punti (§12). */
export const AIUTI = {
  continente: 20,
  iniziale: 30,
  indizioExtra: 25,
};

/** Distanze (in gradi di mappa piatta) per il feedback caldo/freddo (§10). */
export const CALDO_FREDDO = {
  caldissimo: 12,
  caldo: 30,
  tiepido: 60,
  // oltre => freddo
};
