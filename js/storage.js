// storage.js — Persistenza locale via localStorage (§14).
// Funziona nativamente su GitHub Pages (storage per-origine). Tutto è locale in v1;
// una leaderboard online (Supabase) è rimandata a una versione futura (§14, §16).

const PREFISSO = 'rosadeipaesi:';
const K = {
  impostazioni: PREFISSO + 'impostazioni',
  statistiche: PREFISSO + 'statistiche',
  record: PREFISSO + 'record',
  daily: PREFISSO + 'daily',
};

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

// ---- Impostazioni (difficoltà preferita, tema) ----

const IMPOSTAZIONI_DEFAULT = {
  difficolta: 'medio',
  tema: 'auto', // 'auto' | 'chiaro' | 'scuro'
};

export function caricaImpostazioni() {
  return { ...IMPOSTAZIONI_DEFAULT, ...leggi(K.impostazioni, {}) };
}

export function salvaImpostazioni(parziale) {
  const nuove = { ...caricaImpostazioni(), ...parziale };
  scrivi(K.impostazioni, nuove);
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
  return { ...STATISTICHE_DEFAULT, ...leggi(K.statistiche, {}) };
}

/**
 * Registra l'esito di una partita nelle statistiche generali.
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
  scrivi(K.statistiche, s);
  return s;
}

export function azzeraStreakInfinita() {
  const s = caricaStatistiche();
  s.streakInfinita = 0;
  scrivi(K.statistiche, s);
  return s;
}

// ---- Record / migliori punteggi (classifica locale) ----

export function caricaRecord() {
  return leggi(K.record, { migliore: 0, cumulativo: 0 });
}

export function aggiornaRecord({ punti = 0, cumulativo = 0 } = {}) {
  const r = caricaRecord();
  r.migliore = Math.max(r.migliore, punti);
  r.cumulativo = cumulativo || r.cumulativo;
  scrivi(K.record, r);
  return r;
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
  return { ...DAILY_DEFAULT, ...leggi(K.daily, {}) };
}

/** True se la sfida del giorno per `data` è già stata completata. */
export function dailyGiocata(data) {
  const d = caricaDaily();
  return Boolean(d.storico[data]);
}

/**
 * Registra l'esito della Sfida del giorno, aggiornando la streak giornaliera.
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
  scrivi(K.daily, d);
  return d;
}

function giornoPrecedente(data) {
  const [y, m, g] = data.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, g));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

/** Azzera tutti i dati salvati (utile per debug/impostazioni). */
export function azzeraTutto() {
  memoria.clear();
  if (!DISPONIBILE) return;
  for (const chiave of Object.values(K)) {
    try {
      localStorage.removeItem(chiave);
    } catch (e) {
      /* ignora */
    }
  }
}

export const storageDisponibile = DISPONIBILE;
