// geo.js — Utilità geografiche su "mappa piatta" (proiezione equirettangolare, §4).
// Convenzione angoli: 0° = Nord, 90° = Est, 180° = Sud, 270° = Ovest (orario).

/**
 * Direzione (bearing) dal target verso l'indizio, su mappa piatta (§4).
 * Non è il great-circle della bussola: è la differenza semplice lat/long,
 * più intuitiva a occhio su un planisfero.
 * @param {{lat:number,lng:number}} target
 * @param {{lat:number,lng:number}} clue
 * @returns {number} gradi in [0, 360)
 */
export function bearingFlat(target, clue) {
  let dLon = clue.lng - target.lng;
  // Antimeridiano: scegli sempre il verso Est/Ovest più corto (§4).
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const dLat = clue.lat - target.lat;
  const deg = (Math.atan2(dLon, dLat) * 180) / Math.PI; // x = Est, y = Nord
  return (deg + 360) % 360;
}

/** Differenza angolare minima tra due bearing, in [0, 180]. */
export function angularDistance(a, b) {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

/** Normalizza un angolo in [0, 360). */
export function normalizeAngle(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Distanza approssimata su mappa piatta (in gradi), corretta per la latitudine.
 * Usata solo per il feedback caldo/freddo, non per i bearing (§10).
 */
export function flatDistance(a, b) {
  let dLon = b.lng - a.lng;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const dLat = b.lat - a.lat;
  const latMedia = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const x = dLon * Math.cos(latMedia);
  return Math.sqrt(x * x + dLat * dLat);
}

/** Nome cardinale italiano abbreviato per un bearing (8 settori). */
export function compassName(deg) {
  const settori = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const i = Math.round(normalizeAngle(deg) / 45) % 8;
  return settori[i];
}

/** Nome cardinale italiano esteso per un bearing (8 settori). */
export function compassFullName(deg) {
  const settori = [
    'Nord', 'Nord-Est', 'Est', 'Sud-Est',
    'Sud', 'Sud-Ovest', 'Ovest', 'Nord-Ovest',
  ];
  const i = Math.round(normalizeAngle(deg) / 45) % 8;
  return settori[i];
}

/**
 * Converte un codice ISO 3166-1 alpha-2 nell'emoji bandiera corrispondente
 * (coppia di "regional indicator symbols"). Vedi §16: in v1 usiamo le emoji.
 * @param {string} iso es. "IT"
 * @returns {string} es. "🇮🇹"
 */
export function isoToFlagEmoji(iso) {
  if (!iso || iso.length !== 2) return '🏳️';
  const base = 0x1f1e6; // 'A' regional indicator
  const codePoints = iso
    .toUpperCase()
    .split('')
    .map((c) => base + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

/**
 * Coordinate schermo (x, y) di un punto su una corona attorno a un centro,
 * dato un bearing (0° = su/Nord, orario) e un raggio.
 * y cresce verso il basso (convenzione SVG/DOM), quindi Nord = -cos.
 */
export function bearingToXY(cx, cy, radius, bearingDeg) {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(rad),
    y: cy - radius * Math.cos(rad),
  };
}

/**
 * Normalizza una stringa per confronti accent-insensitive e case-insensitive (§9).
 */
export function normalizzaNome(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
