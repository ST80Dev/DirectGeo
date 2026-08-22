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
// `minClueDist` e `sfida` sono per-livello (§7.4-ter):
// - minClueDist: distanza minima di un indizio dal target. Bassa (3°) ai livelli
//   accessibili — gli indizi vicini disambiguano bene. ALTA a "Pochi": la
//   PROSSIMITÀ non è mai un criterio di scelta, quindi i confinanti (es. Estonia
//   a 4° dalla Lituania) non compaiono perché vicini; un Paese poco distante può
//   uscire solo come raro residuo casuale, non per la sua vicinanza. Gli indizi
//   sono Paesi lontani da triangolare: concetto Hard / Very Hard.
//   (10° è l'ottimo misurato: azzera i confinanti minimizzando i casi degeneri.)
// - sfida: a true (solo "Pochi") il generatore NON ripiega sui vicini dello
//   stesso continente per forzare l'univocità: tiene duro il mix cross-continente
//   e accetta un po' di ambiguità (mitigata da caldo/freddo e tentativi). A false
//   (Molti/Medi) l'univocità viene prima e gli indizi vicini sono ammessi.
export const LIVELLI_INDIZI = {
  molti: { id: 'molti', nome: 'Molti (7)', clues: 7, tentativi: 5, minAngularGap: 28, liv: 1, minClueDist: 3, sfida: false },
  medi: { id: 'medi', nome: 'Medi (5)', clues: 5, tentativi: 4, minAngularGap: 40, liv: 2, minClueDist: 3, sfida: false },
  pochi: { id: 'pochi', nome: 'Pochi (4)', clues: 4, tentativi: 3, minAngularGap: 55, liv: 3, minClueDist: 10, sfida: true },
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
    minClueDist: ind.minClueDist,
    sfida: ind.sfida,
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
  // Bassa apposta: gli indizi VICINI sono quelli che meglio distinguono un Paese
  // dai suoi confinanti (bearing molto diverso tra target e vicino). Non troppo
  // bassa però: con baricentri approssimati, indizi <~3° darebbero bearing instabili.
  minClueDist: 3,
  // Distanza massima: evita indizi troppo lontani/ambigui (0 = nessun limite).
  maxClueDist: 0,
  // Tolleranza di univocità (§7.4): un altro Paese è "troppo compatibile" se il suo
  // errore angolare medio con gli indizi è entro questo margine dal target.
  tolleranzaUnivocita: 22,
  // Quanti set di indizi provare PER IL TARGET GIÀ SCELTO, per trovarne uno
  // univoco mantenendo il numero di indizi scelto. Il target è scelto prima e in
  // modo uniforme (niente bias verso i Paesi isolati), quindi qui variano solo gli indizi.
  maxTentativiIndizi: 300,
};

/**
 * Anti-"indizio servito" (§7.4-bis): due categorie di indizi troppo rivelatori,
 * da EVITARE quando possibile ma da riammettere se un target isolato/incastrato
 * non consente altrimenti di comporre gli N indizi richiesti (evitamento morbido).
 *
 * 1) INDIZIO-SPIA — un singolo indizio «Paese + direzione» identifica il target
 *    quasi da solo. Es.: «Stati Uniti a Sud» ⇒ per forza Canada; «Corea del Sud
 *    a Ovest» ⇒ Giappone. Si riconosce contando i Paesi "rivali": quante altre
 *    nazioni hanno quello stesso Paese-indizio nella stessa direzione cardinale e
 *    a distanza comparabile. Pochissimi rivali ⇒ è una spia.
 *
 * 2) CORONA TROPPO REGIONALE — troppi indizi sono vicini dello stesso continente
 *    del target (quasi confinanti): basta riconoscere il "grappolo" regionale,
 *    non serve triangolare. Si mette un tetto al numero di indizi "regionali".
 */
export const ANTISPIA = {
  // --- Indizio-spia ---
  // Un rivale condivide col target la direzione verso l'indizio se sta nello
  // stesso settore cardinale (±gradi) e a distanza comparabile (entro ±fattore).
  octantTol: 22.5,
  distTol: 1.6,
  // Numero massimo di rivali perché l'indizio sia ancora una "spia" da evitare
  // (0 = spia assoluta, 1 = una sola alternativa plausibile). Le spie vengono
  // evitate SOLO quando il target resta comunque univoco senza di esse: per certi
  // Paesi (es. Canada) la spia «USA a Sud» è l'unico modo di renderli univoci, e
  // in quei casi si tiene. Vedi la logica a due fasi in puzzle.js.
  maxRivali: 1,

  // --- Corona troppo regionale (tetto VARIABILE per varietà) ---
  // Frazione massima di indizi dello stesso continente del target: il resto deve
  // venire da altri continenti, così bisogna triangolare e non basta riconoscere
  // il "grappolo" regionale (es. Bolivia+Cile+Uruguay ⇒ per forza Argentina).
  // Per OGNI puzzle il tetto viene estratto a caso in questo intervallo (dall'rng,
  // quindi deterministico per la Sfida del giorno): così due partite con la stessa
  // difficoltà scelta hanno corone diverse — a volte spietate tutte cross-continente
  // (~1/3), a volte più morbide (~1/2). Vedi `estraiProfilo` in puzzle.js.
  fraLocaliMin: 0.3,
  fraLocaliMax: 0.5,

  // --- Ancore meno famose (preferenza VARIABILE per varietà) ---
  // Solo quando il panel scelto contiene più di un tier (Estesa / Tutto il mondo):
  // per ogni puzzle si estrae un "peso fama" casuale in [0, pesoFamaMax]; più alto è,
  // più spesso, a parità di buona separazione angolare, si preferisce come indizio
  // la nazione MENO nota (tier più alto). Aggiunge varietà e difficoltà senza toccare
  // la geometria né l'univocità. 0 disattiva del tutto la preferenza.
  pesoFamaMax: 0.8,
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
