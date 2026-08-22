// build-centroids.mjs — Pipeline OFFLINE per pre-calcolare i baricentri (§5, §6).
//
// NON gira nel sito: si esegue una volta in fase di build per generare
// data/countries.json. Il gioco a runtime carica solo il JSON risultante.
//
// USO:
//   1. Scarica le geometrie Natural Earth "Admin 0 – Countries" in formato
//      GeoJSON (es. ne_110m_admin_0_countries.geojson) e mettile in tools/.
//         https://www.naturalearthdata.com/downloads/110m-cultural-vectors/
//   2. node tools/build-centroids.mjs [input.geojson] [output.json]
//
// Per ogni Paese prende il poligono di AREA MAGGIORE (landmass principale),
// applica le esclusioni manuali del §5 (isole/territori oltremare), calcola il
// centroide area-pesato e fonde i campi curati a mano (nome IT, alias, tier,
// continente) letti dall'attuale data/countries.json, se presente.

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const IN = process.argv[2] || 'tools/ne_110m_admin_0_countries.geojson';
const OUT = process.argv[3] || 'data/countries.json';

// Esclusioni manuali (§5): per alcuni Paesi il "poligono maggiore" da solo non
// basta — si vincola il centroide a una bounding box del landmass principale.
// bbox = [lngMin, latMin, lngMax, latMax]
const ESCLUSIONI = {
  US: { bbox: [-125, 24, -66, 50] }, // 48 stati contigui (via Hawaii e Alaska)
  FR: { bbox: [-5, 41, 10, 52] }, // métropole (via Guyana, Réunion, ecc.)
  ES: { bbox: [-10, 35, 4, 44] }, // penisola iberica (via Canarie)
  PT: { bbox: [-10, 36, -6, 42] }, // continente (via Azzorre/Madeira)
  NL: { bbox: [3, 50, 8, 54] }, // parte europea (via Caraibi)
  NO: { bbox: [4, 57, 32, 71] }, // continente (via Svalbard)
};

function carica(file) {
  if (!fs.existsSync(file)) {
    console.error(`File non trovato: ${file}`);
    console.error('Scarica il GeoJSON Natural Earth Admin 0 e riprova (vedi header dello script).');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Curatela esistente (nome IT, alias, tier, continente) da riusare, se c'è.
function caricaCuratela(file) {
  const mappa = new Map();
  if (fs.existsSync(file)) {
    try {
      const arr = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const c of arr) mappa.set(c.iso, c);
    } catch (e) {
      console.warn('Curatela esistente non leggibile, procedo senza:', e.message);
    }
  }
  return mappa;
}

// Area (shoelace) e centroide di un anello poligonale [ [lng,lat], ... ].
function areaCentroide(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % n];
    const f = x0 * y1 - x1 * y0;
    area += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  area /= 2;
  if (area === 0) {
    // Anello degenere: media semplice dei vertici.
    const m = ring.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
    return { area: 0, lng: m[0] / ring.length, lat: m[1] / ring.length };
  }
  cx /= 6 * area;
  cy /= 6 * area;
  // Area corretta per la latitudine, per confrontare landmass in modo più equo.
  const areaReale = Math.abs(area) * Math.cos((cy * Math.PI) / 180);
  return { area: areaReale, lng: cx, lat: cy };
}

// Ritorna la lista di anelli esterni dai geometrie GeoJSON (Polygon/MultiPolygon).
function anelliEsterni(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates[0]];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((poly) => poly[0]);
  return [];
}

function dentroBbox(lng, lat, bbox) {
  const [x0, y0, x1, y1] = bbox;
  return lng >= x0 && lng <= x1 && lat >= y0 && lat <= y1;
}

function isoDaFeature(props) {
  const cand = [props.ISO_A2, props.ISO_A2_EH, props.WB_A2, props.iso_a2];
  const iso = cand.find((v) => v && v !== '-99');
  return iso ? String(iso).toUpperCase() : null;
}

function main() {
  const geo = carica(IN);
  const curatela = caricaCuratela(OUT);

  // Indicizza le feature per ISO A2.
  const perIso = new Map();
  for (const f of geo.features || []) {
    const iso = isoDaFeature(f.properties || {});
    if (iso) perIso.set(iso, f);
  }

  // Se abbiamo una curatela, generiamo solo per quei Paesi; altrimenti tutti.
  const isoDaGenerare = curatela.size ? [...curatela.keys()] : [...perIso.keys()];

  const risultato = [];
  const mancanti = [];

  for (const iso of isoDaGenerare) {
    const f = perIso.get(iso);
    if (!f) {
      mancanti.push(iso);
      continue;
    }
    let anelli = anelliEsterni(f.geometry).map(areaCentroide);
    if (anelli.length === 0) {
      mancanti.push(iso);
      continue;
    }

    const escl = ESCLUSIONI[iso];
    if (escl && escl.bbox) {
      const filtrati = anelli.filter((a) => dentroBbox(a.lng, a.lat, escl.bbox));
      if (filtrati.length) anelli = filtrati;
    }

    // Landmass principale = poligono di area maggiore.
    anelli.sort((a, b) => b.area - a.area);
    const principale = anelli[0];

    const cur = curatela.get(iso) || {};
    risultato.push({
      iso,
      nome: cur.nome || f.properties.NAME_IT || f.properties.NAME || iso,
      alias: cur.alias || [cur.nome || f.properties.NAME].filter(Boolean),
      continente: cur.continente || f.properties.CONTINENT || 'Sconosciuto',
      lat: Number(principale.lat.toFixed(2)),
      lng: Number(principale.lng.toFixed(2)),
      tier: cur.tier || 3,
    });
  }

  risultato.sort((a, b) => a.iso.localeCompare(b.iso));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(risultato, null, 2) + '\n', 'utf8');

  console.log(`Scritti ${risultato.length} Paesi in ${OUT}.`);
  if (mancanti.length) {
    console.warn(`Non trovati nel GeoJSON (${mancanti.length}): ${mancanti.join(', ')}`);
  }
}

main();
