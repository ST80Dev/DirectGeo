// config.js — Parametri di gioco tarabili in un unico posto.
// Vedi §7 (generazione), §8 (difficoltà), §10-§12 (tentativi/aiuti), §11 (punteggio).

/**
 * Preset di difficoltà (§8).
 * - clues: numero di Paesi-indizio nella corona (leva principale).
 * - maxTier: notorietà massima ammessa per target e indizi (1 = solo molto noti).
 * - targetMaxTier: notorietà massima del solo target (i micro/poco noti si evitano come target, §19).
 * - tentativi: numero di tentativi consentiti (§10).
 * - minAngularGap: separazione angolare minima tra frecce, in gradi (§7.3).
 */
export const DIFFICULTA = {
  facile: {
    id: 'facile',
    nome: 'Facile',
    clues: 7,
    maxTier: 1,
    targetMaxTier: 1,
    tentativi: 5,
    minAngularGap: 28,
  },
  medio: {
    id: 'medio',
    nome: 'Medio',
    clues: 5,
    maxTier: 2,
    targetMaxTier: 2,
    tentativi: 4,
    minAngularGap: 40,
  },
  difficile: {
    id: 'difficile',
    nome: 'Difficile',
    clues: 4,
    maxTier: 3,
    targetMaxTier: 2,
    tentativi: 3,
    minAngularGap: 55,
  },
};

export const DIFFICOLTA_DEFAULT = 'medio';

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
  maxTentativiGenerazione: 200,
};

/** Punteggio (§11). Formula tarabile. */
export const PUNTEGGIO = {
  base: { facile: 100, medio: 200, difficile: 300 },
  penalitaTentativo: 15, // per ogni tentativo errato
  penalitaAiuto: 20, // per ogni aiuto usato
  penalitaIndizioExtra: 25, // per ogni indizio extra sbloccato
  bonusVelocitaMax: 100, // bonus massimo se risolto istantaneamente
  bonusVelocitaFinestra: 120, // secondi entro cui decade il bonus velocità
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
