// storage.js — Persistenza locale via localStorage (§14).
// Funziona nativamente su GitHub Pages (storage per-origine). Tutti i dati sono
// LOCALI al dispositivo: nessun backend. Il gioco supporta due PROFILI fissi
// (es. Papà / Figlio, vedi config.PROFILI): ogni profilo ha i propri salvataggi.
//
// Struttura delle chiavi:
//   rosadeipaesi:profilo                -> id del profilo attivo   (globale)
//   rosadeipaesi:tema                   -> tema chiaro/scuro/auto   (globale, per dispositivo)
//   rosadeipaesi:<profilo>:impostazioni -> { difficolta }          (per profilo)
//   rosadeipaesi:<profilo>:statistiche  -> { giocate, vinte, ... }  (per profilo)
//   rosadeipaesi:<profilo>:record       -> { migliore, cumulativo } (per profilo)
//   rosadeipaesi:<profilo>:daily        -> { streak, storico, ... } (per profilo)

import { PROFILI, PROFILO_DEFAULT } from './config.js';

const PREFISSO = 'rosadeipaesi:';

// Chiavi globali (non legate al profilo).
const GK = {
  profilo: PREFISSO + 'profilo',
  tema: PREFISSO + 'tema',
  migrato: PREFISSO + 'migrato',
};

const IDS_VALIDI = new Set(PROFILI.map((p) => p.id));

const DISPONIBILE = (() => {
  try {
    const t = PREFISSO + 'test';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return true;
  } catch (e) {
    return false;
  }
})();

// Cache in memoria: fa da fallback se localStorage non è disponibile (es. modalità privata).
const memoria = new Map();

function leggi(chiave, fallback) {
  try {
    if (DISPONIBILE) {
      const raw = localStorage.getItem(chiave);
      return raw == null ? fallback : JSON.parse(raw);
    }
  } catch (e) {
    /* ignora: valore corrotto o storage bloccato */
  }
  return memoria.has(chiave) ? memoria.get(chiave) : fallback;
}

function scrivi(chiave, valore) {
  memoria.set(chiave, valore);
  try {
    if (DISPONIBILE) localStorage.setItem(chiave, JSON.stringify(valore));
  } catch (e) {
    /* ignora: quota piena o storage bloccato */
  }
}

function rimuovi(chiave) {
  memoria.delete(chiave);
  try {
    if (DISPONIBILE) localStorage.removeItem(chiave);
  } catch (e) {
    /* ignora */
  }
}

// ---- Profili ----

/** Id del profilo attivo (validato; default PROFILO_DEFAULT). */
export function profiloAttivo() {
  const id = leggi(GK.profilo, PROFILO_DEFAULT);
  return IDS_VALIDI.has(id) ? id : PROFILO_DEFAULT;
}

/** Imposta il profilo attivo. Ritorna l'id effettivamente impostato. */
export function impostaProfilo(id) {
  const valido = IDS_VALIDI.has(id) ? id : PROFILO_DEFAULT;
  scrivi(GK.profilo, valido);
  return valido;
}

/** Oggetto del profilo attivo ({ id, nome, emoji }). */
export function profiloCorrente() {
  const id = profiloAttivo();
  return PROFILI.find((p) => p.id === id) || PROFILI[0];
}

/** Elenco dei profili disponibili. */
export function profili() {
  return PROFILI;
}

// Chiave con namespace del profilo attivo.
function kp(base, id = profiloAttivo()) {
  return PREFISSO + id + ':' + base;
}

// ---- Tema (globale, per dispositivo) ----

export function caricaTema() {
  // Default 'chiaro': look colorato e luminoso all'avvio (niente sfondo scuro di default).
  return leggi(GK.tema, 'chiaro'); // 'auto' | 'chiaro' | 'scuro'
}

export function salvaTema(tema) {
  scrivi(GK.tema, tema);
  return tema;
}

// ---- Impostazioni per profilo (difficoltà preferita) ----

const IMPOSTAZIONI_DEFAULT = { indizi: 'medi', ampiezza: 'estesa' };

// Mappa il vecchio singolo asse "difficolta" nei due nuovi assi (retro-compatibilità).
const MAPPA_LEGACY = {
  facile: { indizi: 'molti', ampiezza: 'famose' },
  medio: { indizi: 'medi', ampiezza: 'estesa' },
  difficile: { indizi: 'pochi', ampiezza: 'mondiale' },
};

export function caricaImpostazioni() {
  const salvato = leggi(kp('impostazioni'), {});
  // Converte al volo un'impostazione vecchio stile { difficolta: '...' }.
  if (salvato && salvato.difficolta && !salvato.indizi) {
    const conv = MAPPA_LEGACY[salvato.difficolta] || {};
    return { ...IMPOSTAZIONI_DEFAULT, ...conv };
  }
  return { ...IMPOSTAZIONI_DEFAULT, ...salvato };
}

export function salvaImpostazioni(parziale) {
  const nuove = { ...caricaImpostazioni(), ...parziale };
  scrivi(kp('impostazioni'), nuove);
  return nuove;
}

// ---- Statistiche (partite giocate, % vittorie, tentativi medi) ----

const STATISTICHE_DEFAULT = {
  giocate: 0,
  vinte: 0,
  tentativiTotali: 0, // tentativi errati cumulativi, per la media
  puntiTotali: 0,
  streakInfinita: 0,
  migliorStreakInfinita: 0,
};

export function caricaStatistiche() {
  return { ...STATISTICHE_DEFAULT, ...leggi(kp('statistiche'), {}) };
}

/**
 * Registra l'esito di una partita nelle statistiche del profilo attivo.
 * @param {{vinta:boolean, tentativiErrati:number, punti:number}} esito
 * @param {{streak?:boolean}} [opzioni] streak=false per la Sfida del giorno,
 *        così non altera la streak della modalità Infinita.
 */
export function registraPartita(esito, opzioni = {}) {
  const streak = opzioni.streak !== false;
  const s = caricaStatistiche();
  s.giocate += 1;
  if (esito.vinta) {
    s.vinte += 1;
    if (streak) {
      s.streakInfinita += 1;
      s.migliorStreakInfinita = Math.max(s.migliorStreakInfinita, s.streakInfinita);
    }
  } else if (streak) {
    s.streakInfinita = 0;
  }
  s.tentativiTotali += esito.tentativiErrati || 0;
  s.puntiTotali += esito.punti || 0;
  scrivi(kp('statistiche'), s);
  return s;
}

export function azzeraStreakInfinita() {
  const s = caricaStatistiche();
  s.streakInfinita = 0;
  scrivi(kp('statistiche'), s);
  return s;
}

// ---- Record / migliori punteggi (classifica locale) ----

export function caricaRecord() {
  return { migliore: 0, cumulativo: 0, ...leggi(kp('record'), {}) };
}

export function aggiornaRecord({ punti = 0, cumulativo = 0 } = {}) {
  const r = caricaRecord();
  r.migliore = Math.max(r.migliore, punti);
  r.cumulativo = cumulativo || r.cumulativo;
  scrivi(kp('record'), r);
  return r;
}

// ---- Rating per difficoltà (media mobile, NON cumulativa) ----
// A differenza del totale accumulato, il rating misura "quanto giochi BENE",
// non "quanto giochi": è la media mobile esponenziale dei punti-partita per una
// data difficoltà. Le partite recenti pesano di più (forma attuale) e le
// sconfitte entrano come 0 punti, quindi abbassano il rating. Poiché i punti di
// una partita premiano già difficoltà (base) e velocità (bonus) meno errori e
// aiuti, il rating valorizza indovinare in fretta e a difficoltà alta.
//
// Struttura: rosadeipaesi:<profilo>:ratings -> { [presetId]: {rating, partite, migliore} }
// dove presetId è l'id della difficoltà combinata (es. 'medi-estesa').

// Peso delle partite recenti nella media mobile (0..1): 0.25 ≈ ultime ~4-7 partite.
const RATING_ALFA = 0.25;

export function caricaRatings() {
  return { ...leggi(kp('ratings'), {}) };
}

/** Rating di una singola difficoltà (o valori a zero se mai giocata). */
export function ratingDifficolta(presetId) {
  return caricaRatings()[presetId] || { rating: 0, partite: 0, migliore: 0 };
}

/**
 * Aggiorna il rating della difficoltà `presetId` con i punti di una partita
 * appena conclusa (0 se persa: le sconfitte abbassano il rating).
 * @returns {{rating:number, partite:number, migliore:number, delta:number}}
 *          `delta` = variazione del rating rispetto a prima di questa partita.
 */
export function registraRating(presetId, punti) {
  const tutti = caricaRatings();
  const cur = tutti[presetId] || { rating: 0, partite: 0, migliore: 0 };
  const p = Math.max(0, Math.round(punti || 0));
  const prima = cur.rating;
  // Prima partita: il rating parte dal punteggio; poi media mobile esponenziale.
  const nuovo = cur.partite === 0 ? p : cur.rating * (1 - RATING_ALFA) + p * RATING_ALFA;
  cur.rating = Math.round(nuovo);
  cur.partite += 1;
  cur.migliore = Math.max(cur.migliore, p);
  tutti[presetId] = cur;
  scrivi(kp('ratings'), tutti);
  return { ...cur, delta: cur.rating - Math.round(prima) };
}

// ---- Sfida del giorno (storico + streak giornaliera) ----

const DAILY_DEFAULT = {
  ultimaData: null, // 'YYYY-MM-DD'
  ultimoEsito: null, // { vinta, tentativiErrati, punti, target }
  streak: 0,
  migliorStreak: 0,
  storico: {}, // { 'YYYY-MM-DD': {vinta, tentativiErrati, punti} }
};

export function caricaDaily() {
  const salvato = leggi(kp('daily'), {});
  // `storico` va copiato a parte: altrimenti si condividerebbe il riferimento
  // dell'oggetto default tra profili/chiamate e le mutazioni si propagherebbero.
  return { ...DAILY_DEFAULT, ...salvato, storico: { ...(salvato.storico || {}) } };
}

/** True se la sfida del giorno per `data` è già stata completata dal profilo attivo. */
export function dailyGiocata(data) {
  const d = caricaDaily();
  return Boolean(d.storico[data]);
}

/**
 * Registra l'esito della Sfida del giorno per il profilo attivo,
 * aggiornando la streak giornaliera.
 * @param {string} data 'YYYY-MM-DD'
 * @param {{vinta:boolean, tentativiErrati:number, punti:number, target?:string}} esito
 */
export function registraDaily(data, esito) {
  const d = caricaDaily();
  if (d.storico[data]) return d; // già registrata: non duplicare

  const ieri = giornoPrecedente(data);
  if (esito.vinta) {
    d.streak = d.ultimaData === ieri && d.ultimoEsito?.vinta ? d.streak + 1 : 1;
  } else {
    d.streak = 0;
  }
  d.migliorStreak = Math.max(d.migliorStreak, d.streak);
  d.ultimaData = data;
  d.ultimoEsito = { ...esito, data };
  d.storico[data] = {
    vinta: esito.vinta,
    tentativiErrati: esito.tentativiErrati || 0,
    punti: esito.punti || 0,
  };
  scrivi(kp('daily'), d);
  return d;
}

function giornoPrecedente(data) {
  const [y, m, g] = data.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, g));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

// ---- Reset ----

/** Azzera i salvataggi di un singolo profilo (default: quello attivo). */
export function azzeraProfilo(id = profiloAttivo()) {
  for (const base of ['impostazioni', 'statistiche', 'record', 'daily', 'ratings']) {
    rimuovi(kp(base, id));
  }
}

/** Azzera TUTTI i dati salvati (entrambi i profili + impostazioni globali). */
export function azzeraTutto() {
  for (const p of PROFILI) azzeraProfilo(p.id);
  rimuovi(GK.profilo);
  rimuovi(GK.tema);
  rimuovi(GK.migrato);
  memoria.clear();
}

// ---- Migrazione una-tantum dalle vecchie chiavi senza profilo ----
// Sposta gli eventuali salvataggi "legacy" (rosadeipaesi:statistiche, ecc.)
// nel profilo di default, così i dati preesistenti non vanno persi.
function migraLegacy() {
  if (!DISPONIBILE) return;
  if (leggi(GK.migrato, false)) return;

  const legacy = {
    impostazioni: PREFISSO + 'impostazioni',
    statistiche: PREFISSO + 'statistiche',
    record: PREFISSO + 'record',
    daily: PREFISSO + 'daily',
  };

  for (const [base, chiaveVecchia] of Object.entries(legacy)) {
    const val = leggi(chiaveVecchia, null);
    if (val == null) continue;
    const chiaveNuova = kp(base, PROFILO_DEFAULT);
    if (leggi(chiaveNuova, null) == null) {
      if (base === 'impostazioni') {
        // Le vecchie impostazioni contenevano difficolta + tema: separali.
        if (val.tema && leggi(GK.tema, null) == null) scrivi(GK.tema, val.tema);
        scrivi(chiaveNuova, { difficolta: val.difficolta || 'medio' });
      } else {
        scrivi(chiaveNuova, val);
      }
    }
    rimuovi(chiaveVecchia);
  }
  scrivi(GK.migrato, true);
}

migraLegacy();

export const storageDisponibile = DISPONIBILE;
