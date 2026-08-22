// daily.js — Sfida del giorno: seed deterministico per data + condivisione (§13).

/** Data di oggi come 'YYYY-MM-DD' in orario locale. */
export function dataOggi(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${g}`;
}

/** Trasforma una stringa (es. 'YYYY-MM-DD') in un seed intero a 32 bit. */
export function seedDaData(dataStr) {
  let h = 1779033703 ^ dataStr.length;
  for (let i = 0; i < dataStr.length; i++) {
    h = Math.imul(h ^ dataStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/**
 * PRNG deterministico mulberry32 (§13): stesso seed => stessa sequenza.
 * @param {number} seed intero 32 bit
 * @returns {() => number} funzione che ritorna un float in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RNG deterministico per la sfida di una data specifica. */
export function rngGiornaliero(dataStr) {
  return mulberry32(seedDaData(dataStr));
}

/** Numero progressivo della sfida (giorni dall'epoca del gioco). */
export function numeroSfida(dataStr, epoca = '2026-01-01') {
  const a = Date.parse(dataStr + 'T00:00:00Z');
  const b = Date.parse(epoca + 'T00:00:00Z');
  return Math.floor((a - b) / 86400000) + 1;
}

/**
 * Testo condivisibile in stile Wordle, senza spoiler (§13).
 * Mostra la corona delle frecce in emoji e l'esito in quadratini.
 * @param {object} opts
 * @param {string} opts.data 'YYYY-MM-DD'
 * @param {number[]} opts.bearings angoli reali degli indizi mostrati
 * @param {boolean} opts.vinta
 * @param {number} opts.tentativiErrati
 * @param {number} opts.tentativiMax
 * @param {number} [opts.punti]
 */
export function testoCondivisione({
  data,
  bearings = [],
  vinta,
  tentativiErrati,
  tentativiMax,
  punti,
}) {
  const n = numeroSfida(data);
  const frecce = bearings.map(frecciaEmoji).join('');
  const usati = vinta ? tentativiErrati + 1 : tentativiMax;
  const esito = vinta ? `${usati}/${tentativiMax}` : `X/${tentativiMax}`;
  const righe = [];
  righe.push(`Rosa dei Paesi — Sfida #${n}`);
  righe.push(`${esito}  ${frecce}`);
  righe.push(quadratiniEsito(vinta, tentativiErrati, tentativiMax));
  if (typeof punti === 'number') righe.push(`⭐ ${punti} punti`);
  return righe.join('\n');
}

/** Freccia emoji più vicina a un bearing (8 direzioni). */
export function frecciaEmoji(deg) {
  const frecce = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return frecce[i];
}

function quadratiniEsito(vinta, tentativiErrati, tentativiMax) {
  const rossi = '🟥'.repeat(Math.min(tentativiErrati, tentativiMax));
  const verde = vinta ? '🟩' : '';
  const vuoti = '⬛'.repeat(
    Math.max(0, tentativiMax - tentativiErrati - (vinta ? 1 : 0))
  );
  return rossi + verde + vuoti;
}
