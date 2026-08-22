// ui.js — Rendering: corona hub-and-spoke, autocomplete, mini-mappa (§15).

import { isoToFlagEmoji, compassName, compassFullName, normalizzaNome } from './geo.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, testo) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v);
  }
  if (testo != null) n.textContent = testo;
  return n;
}

function svgEl(tag, attrs = {}) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

// ---- Corona hub-and-spoke (§2, §15) ----
// Sistema di coordinate 0..100 con centro (50,50). Le frecce puntano sempre
// all'angolo reale; solo l'etichetta può essere spostata per evitare collisioni (§7.5).

const HUB_R = 11;
const ARROW_START = 12.5;
const ARROW_END = 29;
const CARD_R = 39;

function polare(bearingDeg, raggio) {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: 50 + raggio * Math.sin(rad), y: 50 - raggio * Math.cos(rad) };
}

/**
 * Disegna la corona: hub centrale con `?` e le frecce verso gli indizi.
 * @param {HTMLElement} stage contenitore (position: relative, quadrato)
 * @param {{country:object,bearing:number}[]} indizi indizi visibili
 * @param {object} [opzioni] { rivela?: object } se presente, mostra il target nell'hub
 */
export function renderCorona(stage, indizi, opzioni = {}) {
  stage.innerHTML = '';
  stage.classList.add('stage');

  // Layer SVG per le frecce.
  const svg = svgEl('svg', {
    class: 'corona-svg',
    viewBox: '0 0 100 100',
    preserveAspectRatio: 'xMidYMid meet',
  });
  const defs = svgEl('defs');
  const marker = svgEl('marker', {
    id: 'freccia-punta',
    markerWidth: '5',
    markerHeight: '5',
    refX: '3.2',
    refY: '2.5',
    orient: 'auto',
    markerUnits: 'strokeWidth',
  });
  marker.appendChild(svgEl('path', { d: 'M0,0 L5,2.5 L0,5 Z', class: 'freccia-punta-path' }));
  defs.appendChild(marker);
  svg.appendChild(defs);

  const offset = calcolaOffsetEtichette(indizi);

  indizi.forEach((ind, i) => {
    const inizio = polare(ind.bearing, ARROW_START);
    const fine = polare(ind.bearing, ARROW_END);
    const linea = svgEl('line', {
      x1: inizio.x.toFixed(2),
      y1: inizio.y.toFixed(2),
      x2: fine.x.toFixed(2),
      y2: fine.y.toFixed(2),
      class: 'freccia' + (ind.extra ? ' freccia--extra' : ''),
      'marker-end': 'url(#freccia-punta)',
    });
    svg.appendChild(linea);

    // Etichetta (bandiera + nome + direzione), spostabile radialmente (§7.5).
    const pos = polare(ind.bearing, CARD_R + offset[i]);
    const card = el('div', { class: 'clue' + (ind.extra ? ' clue--extra' : '') });
    card.style.left = pos.x + '%';
    card.style.top = pos.y + '%';
    card.appendChild(el('span', { class: 'clue__flag' }, isoToFlagEmoji(ind.country.iso)));
    card.appendChild(el('span', { class: 'clue__nome' }, ind.country.nome));
    card.appendChild(
      el(
        'span',
        { class: 'clue__dir', title: compassFullName(ind.bearing) },
        `${compassName(ind.bearing)} · ${Math.round(ind.bearing)}°`
      )
    );
    stage.appendChild(card);
  });

  stage.appendChild(svg);

  // Hub centrale.
  const hub = el('div', { class: 'hub' });
  if (opzioni.rivela) {
    hub.classList.add('hub--rivelato');
    hub.appendChild(el('span', { class: 'hub__flag' }, isoToFlagEmoji(opzioni.rivela.iso)));
    hub.appendChild(el('span', { class: 'hub__nome' }, opzioni.rivela.nome));
  } else {
    hub.appendChild(el('span', { class: 'hub__q' }, '?'));
  }
  stage.appendChild(hub);
}

/** Anti-collisione: sposta radialmente le etichette troppo vicine tra loro (§7.5). */
function calcolaOffsetEtichette(indizi) {
  const ordine = indizi
    .map((ind, i) => ({ i, bearing: ind.bearing }))
    .sort((a, b) => a.bearing - b.bearing);
  const offset = new Array(indizi.length).fill(0);
  const SOGLIA = 26; // gradi
  const PASSO = 7; // unità radiali
  let cluster = 0;
  for (let k = 0; k < ordine.length; k++) {
    const cur = ordine[k];
    const prec = ordine[(k - 1 + ordine.length) % ordine.length];
    let gap = Math.abs(cur.bearing - prec.bearing);
    if (gap > 180) gap = 360 - gap;
    if (k > 0 && gap < SOGLIA) {
      cluster += 1;
    } else {
      cluster = 0;
    }
    offset[cur.i] = (cluster % 3) * PASSO;
  }
  return offset;
}

// ---- Autocomplete (§9) ----

/**
 * Monta l'autocomplete accent/case-insensitive su un input.
 * @param {HTMLInputElement} input
 * @param {HTMLElement} dropdown contenitore <ul> dei suggerimenti
 * @param {object[]} countries dataset
 * @param {(testo:string) => void} onConferma chiamata con il testo scelto (Invio/click)
 * @returns {{reset:()=>void, chiudi:()=>void}}
 */
export function montaAutocomplete(input, dropdown, countries, onConferma) {
  let evidenziato = -1;
  let correnti = [];

  function filtra(q) {
    const nq = normalizzaNome(q);
    if (!nq) return [];
    const risultati = [];
    for (const c of countries) {
      const chiavi = [c.nome, ...(c.alias || [])];
      const match = chiavi.some((k) => normalizzaNome(k).includes(nq));
      if (match) risultati.push(c);
      if (risultati.length >= 8) break;
    }
    // Priorità a chi inizia con la query.
    risultati.sort((a, b) => {
      const sa = normalizzaNome(a.nome).startsWith(nq) ? 0 : 1;
      const sb = normalizzaNome(b.nome).startsWith(nq) ? 0 : 1;
      return sa - sb;
    });
    return risultati;
  }

  function mostra(lista) {
    correnti = lista;
    evidenziato = -1;
    dropdown.innerHTML = '';
    if (lista.length === 0) {
      dropdown.classList.remove('aperta');
      return;
    }
    lista.forEach((c, i) => {
      const li = el('li', { class: 'ac-item', role: 'option', dataset: { i: String(i) } });
      li.appendChild(el('span', { class: 'ac-flag' }, isoToFlagEmoji(c.iso)));
      li.appendChild(el('span', { class: 'ac-nome' }, c.nome));
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        scegli(c);
      });
      dropdown.appendChild(li);
    });
    dropdown.classList.add('aperta');
  }

  function evidenzia(n) {
    const items = [...dropdown.querySelectorAll('.ac-item')];
    items.forEach((it) => it.classList.remove('evidenziato'));
    if (n >= 0 && n < items.length) {
      items[n].classList.add('evidenziato');
      items[n].scrollIntoView({ block: 'nearest' });
    }
    evidenziato = n;
  }

  function chiudi() {
    dropdown.classList.remove('aperta');
    dropdown.innerHTML = '';
    correnti = [];
    evidenziato = -1;
  }

  function scegli(c) {
    input.value = c.nome;
    chiudi();
    onConferma(c.nome);
  }

  input.addEventListener('input', () => mostra(filtra(input.value)));
  input.addEventListener('focus', () => {
    if (input.value) mostra(filtra(input.value));
  });
  input.addEventListener('keydown', (e) => {
    if (!dropdown.classList.contains('aperta')) {
      if (e.key === 'Enter' && input.value.trim()) {
        e.preventDefault();
        onConferma(input.value.trim());
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      evidenzia(Math.min(evidenziato + 1, correnti.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      evidenzia(Math.max(evidenziato - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (evidenziato >= 0) scegli(correnti[evidenziato]);
      else if (input.value.trim()) {
        chiudi();
        onConferma(input.value.trim());
      }
    } else if (e.key === 'Escape') {
      chiudi();
    }
  });
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== input) chiudi();
  });

  return {
    reset() {
      input.value = '';
      chiudi();
    },
    chiudi,
  };
}

// ---- Mini-mappa (§10, §15) ----

/**
 * Disegna una mini-mappa equirettangolare con un marcatore sulla posizione
 * del Paese rivelato a fine round.
 * @param {HTMLElement} container
 * @param {object} country
 */
export function renderMiniMappa(container, country) {
  container.innerHTML = '';
  const W = 360;
  const H = 180;
  const svg = svgEl('svg', {
    class: 'minimappa-svg',
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: 'xMidYMid meet',
  });
  svg.appendChild(svgEl('rect', { x: 0, y: 0, width: W, height: H, class: 'mm-bg' }));

  // Graticola ogni 30°.
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = lon + 180;
    svg.appendChild(svgEl('line', { x1: x, y1: 0, x2: x, y2: H, class: lon === 0 ? 'mm-grid mm-grid--asse' : 'mm-grid' }));
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const y = 90 - lat;
    svg.appendChild(svgEl('line', { x1: 0, y1: y, x2: W, y2: y, class: lat === 0 ? 'mm-grid mm-grid--asse' : 'mm-grid' }));
  }

  // Marcatore.
  const mx = country.lng + 180;
  const my = 90 - country.lat;
  svg.appendChild(svgEl('circle', { cx: mx, cy: my, r: 6, class: 'mm-marker-alone' }));
  svg.appendChild(svgEl('circle', { cx: mx, cy: my, r: 3, class: 'mm-marker' }));
  container.appendChild(svg);

  const cap = el('p', { class: 'minimappa-cap' });
  cap.appendChild(el('span', { class: 'mm-flag' }, isoToFlagEmoji(country.iso)));
  cap.appendChild(el('span', {}, ` ${country.nome} — ${country.continente}`));
  container.appendChild(cap);
}

export { el };
