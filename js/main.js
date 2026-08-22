// main.js — Bootstrap, caricamento dati, routing delle schermate (§15, §17).

import { DIFFICULTA, DIFFICOLTA_DEFAULT } from './config.js';
import { generaPuzzle } from './puzzle.js';
import { creaPartita } from './game.js';
import { renderCorona, montaAutocomplete, renderMiniMappa, el } from './ui.js';
import {
  dataOggi,
  rngGiornaliero,
  numeroSfida,
  testoCondivisione,
} from './daily.js';
import * as store from './storage.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const app = {
  countries: [],
  difficolta: DIFFICOLTA_DEFAULT,
  modalita: 'infinita',
  partita: null,
  puzzle: null,
  autocomplete: null,
  tickPunti: null,
  ultimiTarget: [], // iso dei target recenti (anti-ripetizione modalità Infinita)
};

// ---- Avvio ----

async function init() {
  applicaTema(store.caricaTema());
  caricaDifficoltaProfilo();

  try {
    app.countries = await caricaCountries();
  } catch (e) {
    mostraErroreCaricamento(e);
    return;
  }

  montaHome();
  montaGioco();
  montaFine();
  montaStatistiche();
  wireNavigazione();

  vaiA('home');
}

async function caricaCountries() {
  const res = await fetch('data/countries.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const dati = await res.json();
  if (!Array.isArray(dati) || dati.length === 0) throw new Error('dataset vuoto');
  return dati;
}

function mostraErroreCaricamento(e) {
  const home = $('#schermata-home');
  home.innerHTML = '';
  const box = el('div', { class: 'errore' });
  box.appendChild(el('h2', {}, 'Impossibile caricare i dati'));
  box.appendChild(
    el(
      'p',
      {},
      "Se stai aprendo il file direttamente dal disco (file://), il browser blocca il caricamento di data/countries.json. Avvia un piccolo server locale (es. «python3 -m http.server») e apri http://localhost:8000."
    )
  );
  box.appendChild(el('pre', {}, String(e && e.message ? e.message : e)));
  home.appendChild(box);
  home.classList.add('attiva');
}

// ---- Navigazione tra schermate ----

function vaiA(nome) {
  $$('.schermata').forEach((s) => s.classList.remove('attiva'));
  const target = $('#schermata-' + nome);
  if (target) target.classList.add('attiva');
  window.scrollTo(0, 0);
}

function wireNavigazione() {
  $$('[data-vai]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const dest = btn.dataset.vai;
      fermaTicker(); // uscendo dal gioco, ferma l'aggiornamento del punteggio
      // Aggiorna il contenuto della schermata di destinazione prima di mostrarla.
      if (dest === 'stats') aggiornaStatistiche();
      if (dest === 'home') {
        renderProfili();
        renderDifficolta();
        aggiornaProfiloBadge();
        aggiornaAnteprimaStatistiche();
      }
      vaiA(dest);
    })
  );
}

// ---- Home ----

function montaHome() {
  renderProfili();
  renderDifficolta();

  $('#btn-infinita').addEventListener('click', avviaInfinita);
  $('#btn-daily').addEventListener('click', avviaDaily);
  $('#btn-tema').addEventListener('click', cicloTema);

  aggiornaProfiloBadge();
  aggiornaAnteprimaStatistiche();
}

// Imposta app.difficolta dalla preferenza del profilo attivo.
function caricaDifficoltaProfilo() {
  const d = store.caricaImpostazioni().difficolta;
  app.difficolta = d in DIFFICULTA ? d : DIFFICOLTA_DEFAULT;
}

// ---- Profili (§14): due giocatori fissi con salvataggi separati ----

function renderProfili() {
  const cont = $('#selettore-profilo');
  if (!cont) return;
  cont.innerHTML = '';
  const attivo = store.profiloAttivo();
  store.profili().forEach((p) => {
    const b = el('button', {
      class: 'chip chip--profilo' + (p.id === attivo ? ' chip--attivo' : ''),
      type: 'button',
    });
    b.appendChild(el('span', { class: 'chip__emoji' }, p.emoji));
    b.appendChild(el('span', { class: 'chip__nome' }, p.nome));
    b.addEventListener('click', () => cambiaProfilo(p.id));
    cont.appendChild(b);
  });
}

function cambiaProfilo(id) {
  store.impostaProfilo(id);
  caricaDifficoltaProfilo(); // ogni profilo ha la sua difficoltà preferita
  renderProfili();
  renderDifficolta();
  aggiornaProfiloBadge();
  aggiornaAnteprimaStatistiche();
}

function aggiornaProfiloBadge() {
  const p = store.profiloCorrente();
  const testo = `${p.emoji} ${p.nome}`;
  const badge = $('#profilo-badge');
  if (badge) badge.textContent = testo;
  const gioco = $('#gioco-profilo');
  if (gioco) gioco.textContent = testo;
}

function renderDifficolta() {
  const cont = $('#selettore-difficolta');
  if (!cont) return;
  cont.innerHTML = '';
  Object.values(DIFFICULTA).forEach((d) => {
    const b = el('button', {
      class: 'chip' + (d.id === app.difficolta ? ' chip--attivo' : ''),
      type: 'button',
      dataset: { diff: d.id },
    });
    b.appendChild(el('span', { class: 'chip__nome' }, d.nome));
    b.appendChild(el('span', { class: 'chip__meta' }, `${d.clues} indizi · ${d.tentativi} tentativi`));
    b.addEventListener('click', () => {
      app.difficolta = d.id;
      store.salvaImpostazioni({ difficolta: d.id });
      $$('#selettore-difficolta .chip').forEach((c) => c.classList.remove('chip--attivo'));
      b.classList.add('chip--attivo');
    });
    cont.appendChild(b);
  });
}

function aggiornaAnteprimaStatistiche() {
  const s = store.caricaStatistiche();
  const perc = s.giocate ? Math.round((s.vinte / s.giocate) * 100) : 0;
  const box = $('#home-stats');
  if (!box) return;
  box.innerHTML = '';
  box.appendChild(statPill('Partite', s.giocate));
  box.appendChild(statPill('Vittorie', `${perc}%`));
  box.appendChild(statPill('Streak', s.streakInfinita));
}

function statPill(label, valore) {
  const p = el('div', { class: 'pill' });
  p.appendChild(el('span', { class: 'pill__valore' }, String(valore)));
  p.appendChild(el('span', { class: 'pill__label' }, label));
  return p;
}

// ---- Avvio partite ----

function avviaInfinita() {
  app.modalita = 'infinita';
  const preset = DIFFICULTA[app.difficolta];
  // Evita di ripetere i target più recenti (varietà tra partite consecutive).
  app.puzzle = generaPuzzle(app.countries, preset, Math.random, {
    escludiTarget: app.ultimiTarget,
  });
  ricordaTarget(app.puzzle.target.iso);
  app.partita = creaPartita(app.puzzle, app.countries, preset, { modalita: 'infinita' });
  preparaGioco();
}

// Memoria dei target recenti per non riproporli subito.
function ricordaTarget(iso) {
  app.ultimiTarget.push(iso);
  const MAX = 8;
  if (app.ultimiTarget.length > MAX) app.ultimiTarget.splice(0, app.ultimiTarget.length - MAX);
}

function avviaDaily() {
  app.modalita = 'daily';
  const data = dataOggi();

  if (store.dailyGiocata(data)) {
    const d = store.caricaDaily();
    mostraDailyGiaGiocata(data, d.storico[data]);
    return;
  }

  // Difficoltà fissa per la Sfida del giorno: uguale per tutti (§13).
  const preset = DIFFICULTA.medio;
  const rng = rngGiornaliero(data);
  app.puzzle = generaPuzzle(app.countries, preset, rng);
  app.partita = creaPartita(app.puzzle, app.countries, preset, { modalita: 'daily' });
  preparaGioco();
}

function mostraDailyGiaGiocata(data, esito) {
  vaiA('fine');
  const box = $('#fine-contenuto');
  box.innerHTML = '';
  box.appendChild(el('h2', { class: 'fine-titolo' }, `Sfida #${numeroSfida(data)} già completata`));
  box.appendChild(
    el('p', { class: 'fine-sub' }, esito.vinta ? 'Hai già risolto la sfida di oggi. Torna domani!' : 'Hai già giocato la sfida di oggi. Ritenta domani!')
  );
  const d = store.caricaDaily();
  box.appendChild(el('p', { class: 'fine-sub' }, `Streak giornaliera: ${d.streak} 🔥 (record ${d.migliorStreak})`));
  $('#fine-azioni').innerHTML = '';
  const home = el('button', { class: 'btn btn--primario' }, 'Torna alla home');
  home.addEventListener('click', () => vaiA('home'));
  $('#fine-azioni').appendChild(home);
}

// ---- Schermata di gioco ----

function montaGioco() {
  const input = $('#input-risposta');
  const dropdown = $('#autocomplete');
  app.autocomplete = montaAutocomplete(input, dropdown, [], () => {});

  $('#btn-invia').addEventListener('click', () => {
    if ($('#input-risposta').value.trim()) tentativo($('#input-risposta').value.trim());
  });

  $('#aiuto-continente').addEventListener('click', () => usaAiuto('continente'));
  $('#aiuto-iniziale').addEventListener('click', () => usaAiuto('iniziale'));
  $('#aiuto-indizio').addEventListener('click', () => usaAiuto('indizio'));
}

function preparaGioco() {
  vaiA('gioco');
  const p = app.partita;

  // Autocomplete con l'elenco dei Paesi.
  const input = $('#input-risposta');
  const dropdown = $('#autocomplete');
  dropdown.innerHTML = '';
  input.value = '';
  input.disabled = false;
  $('#btn-invia').disabled = false;
  // Rimonta l'autocomplete con la conferma collegata al tentativo corrente.
  app.autocomplete = montaAutocomplete(input, dropdown, app.countries, (testo) => tentativo(testo));

  // Intestazione.
  $('#gioco-modalita').textContent =
    app.modalita === 'daily' ? `Sfida del giorno #${numeroSfida(dataOggi())}` : 'Modalità Infinita';
  $('#gioco-difficolta').textContent = DIFFICULTA[p.stato.difficolta.id].nome;
  aggiornaProfiloBadge();

  aggiornaContatori();
  $('#feedback').innerHTML = '';
  $('#feedback').className = 'feedback';
  $('#lista-tentativi').innerHTML = '';
  aggiornaBottoniAiuto();

  renderCorona($('#stage'), p.stato.indiziVisibili);
  avviaTicker();
  input.focus();
}

function aggiornaContatori() {
  const p = app.partita;
  const rimasti = p.stato.tentativiMax - p.stato.tentativiErrati;
  $('#contatore-tentativi').textContent = `${rimasti}/${p.stato.tentativiMax}`;
  aggiornaPunti();
  $('#contatore-indizi').textContent = String(p.stato.indiziVisibili.length);
}

// Mostra la proiezione live del punteggio (coincide col punteggio finale, §11).
function aggiornaPunti() {
  if (!app.partita) return;
  $('#contatore-punteggio').textContent = `~${app.partita.punteggioProiettato()}`;
}

// Ticker: il bonus velocità decade nel tempo, quindi il punteggio va aggiornato
// ogni secondo anche senza azioni del giocatore (calo coerente).
function avviaTicker() {
  fermaTicker();
  app.tickPunti = setInterval(() => {
    if (app.partita && !app.partita.terminata()) aggiornaPunti();
    else fermaTicker();
  }, 1000);
}

function fermaTicker() {
  if (app.tickPunti) {
    clearInterval(app.tickPunti);
    app.tickPunti = null;
  }
}

function tentativo(testo) {
  const p = app.partita;
  if (p.terminata()) return;
  const r = p.indovina(testo);

  switch (r.stato) {
    case 'nonValido':
      mostraFeedback('Paese non presente in elenco. Scegli dai suggerimenti.', 'avviso');
      return;
    case 'giaTerminata':
      return;
    case 'vinto':
      aggiungiTentativoChip(r.paese.nome, 'ok');
      concludi(r.riepilogo);
      return;
    case 'perso':
      aggiungiTentativoChip(r.paese.nome, 'ko');
      concludi(r.riepilogo);
      return;
    case 'sbagliato':
      aggiungiTentativoChip(r.paese.nome, 'ko');
      mostraFeedbackTentativo(r.feedback, r.tentativiRimasti);
      aggiornaContatori();
      aggiornaBottoniAiuto();
      app.autocomplete.reset();
      $('#input-risposta').focus();
      return;
  }
}

function mostraFeedbackTentativo(feedback, rimasti) {
  const box = $('#feedback');
  box.innerHTML = '';
  box.className = 'feedback feedback--' + feedback.categoria;
  box.appendChild(el('span', { class: 'feedback__cf' }, feedback.etichetta));
  if (feedback.aiutoGratuito) {
    const a = feedback.aiutoGratuito;
    const testo =
      a.tipo === 'continente'
        ? `Indizio: il continente è ${a.valore}.`
        : `Indizio: l'iniziale è ${a.valore}.`;
    box.appendChild(el('span', { class: 'feedback__aiuto' }, testo));
  }
  box.appendChild(el('span', { class: 'feedback__rimasti' }, `Tentativi rimasti: ${rimasti}`));
}

function mostraFeedback(testo, tipo) {
  const box = $('#feedback');
  box.innerHTML = '';
  box.className = 'feedback feedback--' + (tipo || 'info');
  box.appendChild(el('span', {}, testo));
}

function aggiungiTentativoChip(nome, esito) {
  const chip = el('span', { class: 'tentativo tentativo--' + esito }, nome);
  $('#lista-tentativi').appendChild(chip);
}

// ---- Aiuti (§12) ----

function usaAiuto(tipo) {
  const p = app.partita;
  if (p.terminata()) return;
  if (tipo === 'continente') {
    const a = p.aiutoContinente();
    mostraFeedback(`Aiuto (−${a.costo}): il continente è ${a.valore}.`, 'aiuto');
  } else if (tipo === 'iniziale') {
    const a = p.aiutoIniziale();
    mostraFeedback(`Aiuto (−${a.costo}): l'iniziale è ${a.valore}.`, 'aiuto');
  } else if (tipo === 'indizio') {
    const a = p.aiutoIndizioExtra();
    if (!a) {
      mostraFeedback('Nessun altro indizio disponibile.', 'avviso');
      return;
    }
    a.indizio.extra = true;
    renderCorona($('#stage'), p.stato.indiziVisibili);
    mostraFeedback(`Aiuto (−${a.costo}): aggiunta una freccia verso ${a.indizio.country.nome}.`, 'aiuto');
  }
  aggiornaContatori();
  aggiornaBottoniAiuto();
}

function aggiornaBottoniAiuto() {
  const p = app.partita;
  $('#aiuto-continente').disabled = p.stato.aiutiUsati.includes('continente');
  $('#aiuto-iniziale').disabled = p.stato.aiutiUsati.includes('iniziale');
  $('#aiuto-indizio').disabled = p.indiziExtraDisponibili() === 0;
}

// ---- Fine round ----

function montaFine() {
  // Le azioni vengono ricostruite a ogni fine round in `concludi`.
}

function concludi(riepilogo) {
  const p = app.partita;
  fermaTicker();
  $('#input-risposta').disabled = true;
  $('#btn-invia').disabled = true;

  const data = dataOggi();
  const esito = {
    vinta: riepilogo.vinta,
    tentativiErrati: riepilogo.tentativiErrati,
    punti: riepilogo.punti,
    target: p.stato.puzzle.target.nome,
  };

  if (app.modalita === 'daily') {
    store.registraPartita(esito, { streak: false });
    store.registraDaily(data, esito);
  } else {
    store.registraPartita(esito, { streak: true });
  }
  if (riepilogo.vinta) {
    const s = store.caricaStatistiche();
    store.aggiornaRecord({ punti: riepilogo.punti, cumulativo: s.puntiTotali });
  }

  mostraFine(riepilogo);
}

function mostraFine(riepilogo) {
  vaiA('fine');
  const p = app.partita;
  const target = riepilogo.target;

  const box = $('#fine-contenuto');
  box.innerHTML = '';

  box.appendChild(
    el('h2', { class: 'fine-titolo' }, riepilogo.vinta ? '🎉 Indovinato!' : '😞 Peccato!')
  );
  box.appendChild(
    el(
      'p',
      { class: 'fine-sub' },
      riepilogo.vinta
        ? `Hai trovato il Paese in ${riepilogo.tentativiErrati + 1} tentativi.`
        : `La risposta era ${target.nome}.`
    )
  );

  // Corona rivelata con il target al centro.
  const stage = el('div', { class: 'stage stage--mini', id: 'stage-fine' });
  box.appendChild(stage);
  renderCorona(stage, p.stato.indiziVisibili, { rivela: target });

  // Mini-mappa.
  const mm = el('div', { class: 'minimappa' });
  box.appendChild(mm);
  renderMiniMappa(mm, target);

  // Dettaglio punteggio.
  if (riepilogo.vinta) {
    const det = el('div', { class: 'punteggio-dettaglio' });
    det.appendChild(el('div', { class: 'punteggio-totale' }, `${riepilogo.punti} punti`));
    const righe = el('ul', { class: 'punteggio-righe' });
    righe.appendChild(el('li', {}, `Tentativi errati: ${riepilogo.tentativiErrati}`));
    righe.appendChild(el('li', {}, `Indizi extra: ${riepilogo.indiziExtraSbloccati}`));
    righe.appendChild(el('li', {}, `Aiuti usati: ${riepilogo.aiutiUsati.length}`));
    righe.appendChild(el('li', {}, `Bonus velocità: +${riepilogo.bonusVelocita} (${riepilogo.tempoSecondi}s)`));
    det.appendChild(righe);
    box.appendChild(det);
  }

  // Azioni.
  const azioni = $('#fine-azioni');
  azioni.innerHTML = '';

  if (app.modalita === 'infinita') {
    const next = el('button', { class: 'btn btn--primario' }, 'Prossimo puzzle');
    next.addEventListener('click', avviaInfinita);
    azioni.appendChild(next);
  } else {
    const cond = el('button', { class: 'btn btn--daily' }, '📋 Condividi risultato');
    cond.addEventListener('click', () => condividi(riepilogo));
    azioni.appendChild(cond);
  }

  const home = el('button', { class: 'btn' }, 'Home');
  home.addEventListener('click', () => {
    aggiornaAnteprimaStatistiche();
    vaiA('home');
  });
  azioni.appendChild(home);

  const stats = el('button', { class: 'btn' }, 'Statistiche');
  stats.addEventListener('click', () => {
    aggiornaStatistiche();
    vaiA('stats');
  });
  azioni.appendChild(stats);
}

async function condividi(riepilogo) {
  const data = dataOggi();
  const testo = testoCondivisione({
    data,
    bearings: riepilogo.bearings,
    vinta: riepilogo.vinta,
    tentativiErrati: riepilogo.tentativiErrati,
    tentativiMax: riepilogo.tentativiMax,
    punti: riepilogo.vinta ? riepilogo.punti : undefined,
  });
  try {
    if (navigator.share) {
      await navigator.share({ text: testo });
      return;
    }
    await navigator.clipboard.writeText(testo);
    mostraFeedback('Risultato copiato negli appunti!', 'aiuto');
    // Il feedback vive nella schermata di gioco; qui mostra un avviso a video.
    avvisoTemporaneo('Risultato copiato negli appunti!');
  } catch (e) {
    avvisoTemporaneo('Copia manuale:\n' + testo, 6000);
  }
}

function avvisoTemporaneo(testo, ms = 2500) {
  let t = $('#toast');
  if (!t) {
    t = el('div', { class: 'toast', id: 'toast' });
    document.body.appendChild(t);
  }
  t.textContent = testo;
  t.classList.add('visibile');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('visibile'), ms);
}

// ---- Statistiche ----

function montaStatistiche() {
  $('#btn-azzera').addEventListener('click', () => {
    const p = store.profiloCorrente();
    if (confirm(`Azzerare le statistiche e i record di ${p.nome}?`)) {
      store.azzeraProfilo();
      aggiornaStatistiche();
      aggiornaAnteprimaStatistiche();
    }
  });
}

function aggiornaStatistiche() {
  const s = store.caricaStatistiche();
  const d = store.caricaDaily();
  const r = store.caricaRecord();
  const perc = s.giocate ? Math.round((s.vinte / s.giocate) * 100) : 0;
  const mediaTent = s.giocate ? (s.tentativiTotali / s.giocate).toFixed(1) : '0';

  const intest = $('#stats-profilo');
  if (intest) {
    const p = store.profiloCorrente();
    intest.textContent = `${p.emoji} ${p.nome}`;
  }

  const griglia = $('#stats-griglia');
  griglia.innerHTML = '';
  const voci = [
    ['Partite giocate', s.giocate],
    ['Vittorie', `${s.vinte} (${perc}%)`],
    ['Tentativi medi', mediaTent],
    ['Streak infinita', `${s.streakInfinita} (record ${s.migliorStreakInfinita})`],
    ['Streak giornaliera', `${d.streak} (record ${d.migliorStreak})`],
    ['Miglior punteggio', r.migliore],
    ['Punti totali', s.puntiTotali],
  ];
  for (const [label, valore] of voci) {
    const card = el('div', { class: 'stat-card' });
    card.appendChild(el('span', { class: 'stat-card__valore' }, String(valore)));
    card.appendChild(el('span', { class: 'stat-card__label' }, label));
    griglia.appendChild(card);
  }
}

// ---- Tema (§15) ----

function applicaTema(tema) {
  const root = document.documentElement;
  if (tema === 'chiaro') root.setAttribute('data-tema', 'chiaro');
  else if (tema === 'scuro') root.setAttribute('data-tema', 'scuro');
  else root.removeAttribute('data-tema'); // auto: segue il sistema
  const btn = $('#btn-tema');
  if (btn) btn.textContent = tema === 'chiaro' ? '☀️' : tema === 'scuro' ? '🌙' : '🌗';
}

function cicloTema() {
  const attuale = store.caricaTema();
  const prossimo = attuale === 'auto' ? 'chiaro' : attuale === 'chiaro' ? 'scuro' : 'auto';
  store.salvaTema(prossimo);
  applicaTema(prossimo);
}

// Avvio.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
