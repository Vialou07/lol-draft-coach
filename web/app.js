// Live page: receives the companion's state over a websocket and renders one screen per moment.

const app = document.getElementById('app');
const linkLost = document.getElementById('link');

const QUEUES = {
  400: 'Normale draft', 420: 'Classée solo/duo', 430: 'Normale aveugle', 440: 'Classée flexible', 450: 'ARAM',
  480: 'Swiftplay', 490: 'Partie rapide', 700: 'Clash', 1700: 'Arena', 1710: 'Arena', 1750: 'Arena', 2400: 'ARAM du Chaos',
};
const COLS = ['top', 'jungle', 'mid', 'bot', 'support'];
const COL_LABELS = { top: 'TOP', jungle: 'JGL', mid: 'MID', bot: 'ADC', support: 'SUP' };
const ROLE_NAMES = { top: 'Top', jungle: 'Jungle', mid: 'Mid', bot: 'ADC', support: 'Support' };
const DDRAGON = '16.21.1';
const SCALE = [0.42, 0.62]; // every gauge shares one scale, so gaps between cards are visible
const LEGAL = 'LoL Draft Coach isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.';
const onPc = ['localhost', '127.0.0.1'].includes(location.hostname);

let state = null;
let lastKey = '';
let deadline = null;
let phaseTotal = null;
let phone = null;
const opened = new Set();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const champ = (id) => state?.champions?.[id];
const champName = (id) => champ(id)?.name ?? `#${id}`;
const img = (id, cls = '') =>
  id > 0 ? `<img class="${cls}" src="/icon/${id}" alt="${esc(champName(id))}" data-alias="${esc(champ(id)?.alias ?? '')}">` : '';

// The companion proxies icons from the client; outside a game, fall back to Data Dragon.
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el.tagName !== 'IMG' || !el.dataset.alias || el.dataset.fallback) return;
  el.dataset.fallback = '1';
  el.src = `https://ddragon.leagueoflegends.com/cdn/${state?.assets?.ddragon ?? DDRAGON}/img/champion/${el.dataset.alias}.png`;
}, true);

const pts = (x, digits = 1) => {
  const v = Math.abs(x * 100).toFixed(digits).replace('.', ',');
  return x * 100 >= 0.05 ? `+${v}` : x * 100 <= -0.05 ? `−${v}` : (0).toFixed(digits).replace('.', ',');
};
const trend = (x, min = 0.05) => (x * 100 >= min ? 'up' : x * 100 <= -min ? 'down' : 'flat');
const pct = (x) => `${Math.round(x * 100)} %`;

function headline(d, a, me) {
  if (d.kind === 'aram') return { text: a?.verb ?? 'ARAM', mine: false };
  if (d.kind === 'arena') return { text: 'Arena', mine: false };
  if (d.myTurn === 'pick') return { text: 'À toi', mine: true };
  if (d.myTurn === 'ban') return { text: 'Ton ban', mine: true };
  if (d.phase === 'FINALIZATION' || d.phase === 'GAME_STARTING') return { text: 'Finalisation', mine: false };
  if (me?.championId) return { text: 'Verrouillé', mine: false };
  if (d.phase === 'PLANNING') return { text: 'Déclare ton pick', mine: false };
  return { text: d.acting === 'enemy' ? 'Les adversaires choisissent' : 'Prépare ton pick', mine: false };
}

function renderWaiting() {
  const who = state?.summoner ? `<div class="who">Compte <b>${esc(state.summoner.gameName)}</b></div>` : '';
  let body;
  if (!state || state.status === 'no-client') {
    body = `<div class="pulse"></div><h1>Lance League of Legends</h1><p>La page se met à jour toute seule dès que le client est ouvert.</p>`;
  } else if (state.gameflow === 'InProgress' || state.gameflow === 'GameStart') {
    body = `<div class="pulse ok"></div><h1>Partie en cours</h1><p>Bonne game.</p>`;
  } else {
    const text = { Matchmaking: 'Recherche de partie', ReadyCheck: 'Partie trouvée', Lobby: 'Dans le salon' }[state.gameflow] ?? 'Connecté';
    body = `<div class="pulse ok"></div><h1>${text}</h1><p>Les conseils apparaissent dès la sélection des champions.</p>`;
  }
  const demo = `<section class="tile">
      <div class="tile-title">Voir une démo</div>
      <p>Rejoue une de tes vraies sélections, pour voir l'écran avant une partie.</p>
      <div class="buttons"><button data-demo="ranked">Ranked solo</button><button data-demo="aram">ARAM du Chaos</button></div>
    </section>`;
  const qr = onPc && phone?.qr
    ? `<section class="tile phone"><div class="qr">${phone.qr}</div><div>
        <div class="tile-title">Sur ton téléphone</div>
        <p>Scanne ce code avec l'appareil photo, sur le même Wi-Fi. Ensuite « Ajouter à l'écran d'accueil » et c'est réglé.</p>
        <p class="url">${esc(phone.url)}</p></div></section>`
    : '';
  return `<section class="wait">${body}</section>${who}${demo}${qr}<p class="legal">${LEGAL}</p>`;
}

function pic(id, { hover = false, me = false, empty = false } = {}) {
  const cls = ['pic', hover ? 'hover' : '', me ? 'me' : '', empty && !id ? 'empty' : ''].join(' ');
  return `<div class="${cls}">${id ? img(id) : empty ? '?' : ''}</div>`;
}

function renderGrid(d, a) {
  const me = d.allies.find((p) => p.me);
  if (d.kind === 'aram' || d.kind === 'arena' || !d.allies.some((p) => p.role)) {
    const allies = d.allies.map((p) => `<div class="cell">${pic(p.championId || p.hoverId, { hover: !p.championId, me: p.me })}</div>`).join('');
    const bench = d.kind === 'aram'
      ? `<div class="rl">BANC</div><div class="bench">${d.bench.map((id) => pic(id)).join('') || '<span class="note">vide</span>'}</div>`
      : '';
    return `<section class="grid"><div class="rl">NOUS</div>${allies}${bench}</section>`;
  }
  const mineCol = COLS.indexOf(me?.role);
  const head = `<div></div>${COLS.map((c, i) => `<div class="h ${i === mineCol ? 'mine' : ''}">${COL_LABELS[c]}</div>`).join('')}`;
  const ours = COLS.map((c, i) => {
    const p = d.allies.find((x) => x.role === c);
    const id = p ? p.championId || p.hoverId : 0;
    return `<div class="cell ${i === mineCol ? 'mine top' : ''}">${pic(id, { hover: p && !p.championId, me: p?.me, empty: true })}</div>`;
  }).join('');
  // Enemy roles are hidden: place each locked enemy in its most likely role.
  const placed = Array(5).fill(0);
  const locked = d.enemies.filter((p) => p.championId);
  const roles = a?.enemyRoles ?? {};
  for (const p of locked) {
    const r = roles[p.championId];
    if (r != null && !placed[r]) placed[r] = p.championId;
  }
  for (const p of locked) if (!placed.includes(p.championId)) placed[placed.indexOf(0)] = p.championId;
  const theirs = placed.map((id, i) => `<div class="cell ${i === mineCol ? 'mine bottom' : ''}">${pic(id, { empty: true })}</div>`).join('');
  return `<section class="grid">${head}<div class="rl">NOUS</div>${ours}<div class="rl">EUX</div>${theirs}</section>`;
}

function card(o, { flat = false, ref = false, best = false } = {}) {
  const isBan = o.gain != null;
  const showNumber = !flat && (isBan || o.p != null);
  const pos = (x) => Math.max(0, Math.min(100, ((x - SCALE[0]) / (SCALE[1] - SCALE[0])) * 100));
  const number = isBan
    ? `<span class="big ${trend(o.gain, 0.05)}">${pts(o.gain)}<small>pt</small></span>`
    : `<span class="big">${Math.round(o.p * 100)}<small>%</small></span>`;
  const gauge = showNumber && !isBan
    ? `<div class="gauge ${best ? 'best' : ''}"><i class="range" style="left:${pos(o.low ?? o.p)}%;right:${100 - pos(o.high ?? o.p)}%"></i><i class="fill" style="width:${pos(o.p)}%"></i><i class="mid" style="left:${pos(0.5)}%"></i></div>`
    : '';
  const chips = (o.reasons ?? []).map((r) => `<span class="chip ${trend(r.delta)}">${esc(r.label)}<b>${pts(r.delta)}</b></span>`).join('');
  // A long tag (bans) moves to the second line so the name never gets cut.
  const tagInTitle = chips || (o.tag ?? '').length <= 12;
  const detail = !isBan && o.p != null
    ? `<div class="abs">
        ${o.vsId && o.delta != null ? `<div><b>${pts(o.delta)} pt</b> face à ${esc(champName(o.vsId))}</div>` : ''}
        ${(o.detail ?? []).length ? `<div>${o.detail.map((r) => `${esc(r.label)} ${pts(r.delta)}`).join(' · ')}</div>` : ''}
        <div>Entre ${pct(o.low)} et ${pct(o.high)}${o.n ? ` · ${o.n.toLocaleString('fr-FR')} parties analysées` : ''}</div>
      </div>`
    : '';
  return `<article class="card ${ref ? 'ref' : ''} ${opened.has(o.championId) ? 'open' : ''}" data-id="${o.championId}">
    ${o.close ? '<span class="eq">≈ égalité</span>' : ''}
    ${img(o.championId, 'portrait')}
    <div class="title"><span class="name">${esc(champName(o.championId))}</span>${tagInTitle ? `<span class="tag">${esc(o.tag ?? '')}</span>` : ''}</div>
    <div class="num">${showNumber ? number : ''}</div>
    <div class="chips">${tagInTitle ? chips : `<span class="tag">${esc(o.tag)}</span>`}</div>
    ${gauge}
    ${o.warn ? `<div class="warn">${esc(o.warn)}</div>` : ''}
    ${detail}
  </article>`;
}

function renderAdvice(d, a) {
  if (!a) return '';
  if (!a.options?.length) return a.note ? `<p class="note">${esc(a.note)}</p>` : '';
  const flat = Boolean(a.flat);
  let title = 'Tes meilleurs choix';
  let right = 'chance de gagner';
  if (d.myTurn === 'ban') [title, right] = ['Bans conseillés', 'gain estimé'];
  if (d.kind === 'aram') title = 'Sur le banc';
  if (a.verb === 'Verrouillé') title = 'Ton champion';
  if (a.allClose) right = '≈ les 3 se valent';
  if (flat) right = '';
  const topP = Math.max(...a.options.map((o) => o.p ?? -1));
  const cards = a.options.map((o) => card(o, { flat, best: o.p != null && o.p === topP && a.options.length > 1 })).join('');
  const legend = !flat && d.myTurn !== 'ban' && a.options.some((o) => o.p != null)
    ? '<p class="legend">Ligne blanche = 50 %. Un point de plus = une victoire de plus sur 100 parties. Entre deux bons choix, l’écart est souvent de 1 à 4 points.</p>'
    : '';
  const refCard = a.hover
    ? `<div class="label"><span>Ton survol dans le client</span></div>${card(a.hover, { ref: true })}`
    : a.current
      ? `<div class="label"><span>Ton champion</span></div>${card(a.current, { ref: true, flat })}`
      : '';
  return `<div class="label"><span>${title}</span><b>${esc(right)}</b></div>${cards}${legend}${refCard}${a.note ? `<p class="note">${esc(a.note)}</p>` : ''}`;
}

function render() {
  if (state?.status !== 'champ-select' || !state.draft) {
    app.innerHTML = renderWaiting();
    return;
  }
  const d = state.draft;
  const a = state.advice;
  const me = d.allies.find((p) => p.me);
  const h = headline(d, a, me);
  const mode = state.queue?.name || QUEUES[d.queueId] || 'Partie';
  const sub = [ROLE_NAMES[me?.role], mode].filter(Boolean).join(' · ');
  const who = state.demo?.profile === 'real' ? 'ton profil' : 'un profil d’exemple (ouvre le client LoL pour le tien)';
  const demo = !state.demo
    ? ''
    : state.demo.caption
      ? `<div class="demo-bar step"><span>${esc(state.demo.caption)}</span><button data-demo="next">Continuer</button></div>`
      : `<div class="demo-bar"><span>Démo d’une de tes vraies sélections, avec ${who}</span><button data-demo="stop">Arrêter</button></div>`;
  app.innerHTML = `${demo}
    <header class="head">
      <div><h1 class="${h.mine ? 'mine' : ''} ${h.text.length > 14 ? 'long' : ''}">${esc(h.text)}</h1><div class="sub"><i class="dot"></i>${esc(sub)}</div></div>
      <div class="ring" id="ring"><svg viewBox="0 0 58 58"><circle class="track" cx="29" cy="29" r="25"/><circle class="left" cx="29" cy="29" r="25" stroke-dasharray="157.1" stroke-dashoffset="0"/></svg><span></span></div>
    </header>
    ${renderGrid(d, a)}
    ${renderAdvice(d, a)}
    <p class="legal">${LEGAL}</p>`;
  tick();
}

app.addEventListener('click', (e) => {
  const button = e.target.closest('[data-demo]');
  if (button) {
    fetch(`/demo/${button.dataset.demo}`, { method: 'POST' });
    return;
  }
  // A tap shows the details of a card; it stays open across live updates.
  const el = e.target.closest('.card');
  if (!el) return;
  const id = Number(el.dataset.id);
  if (opened.has(id)) opened.delete(id);
  else opened.add(id);
  el.classList.toggle('open');
});

function tick() {
  const ring = document.getElementById('ring');
  if (!ring) return;
  const label = ring.querySelector('span');
  const arc = ring.querySelector('.left');
  if (deadline == null) {
    label.textContent = '';
    arc.style.strokeDashoffset = '157.1';
    return;
  }
  const left = Math.max(0, deadline - Date.now());
  label.textContent = Math.ceil(left / 1000);
  ring.classList.toggle('low', left < 8000);
  arc.style.strokeDashoffset = String(157.1 * (1 - (phaseTotal ? Math.min(1, left / phaseTotal) : 0)));
}
setInterval(tick, 250);

function onState(next) {
  state = next;
  const d = state.draft;
  if (d?.timeLeftMs != null) {
    deadline = Date.now() + d.timeLeftMs;
    phaseTotal = d.phaseTotalMs || Math.max(phaseTotal ?? 0, d.timeLeftMs);
  } else {
    deadline = null;
  }
  if (!d) opened.clear();
  const key = JSON.stringify([state.status, state.gameflow, state.summoner, state.queue, state.demo, d && { ...d, timeLeftMs: 0 }, state.advice, phone?.url]);
  if (key !== lastKey) {
    lastKey = key;
    render();
  }
}

function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => (linkLost.hidden = true);
  ws.onmessage = (e) => onState(JSON.parse(e.data));
  ws.onclose = () => {
    linkLost.hidden = false;
    setTimeout(connect, 1500);
  };
}

if (onPc) {
  fetch('/phone')
    .then((r) => r.json())
    .then((p) => {
      phone = p;
      if (state) onState(state);
    })
    .catch(() => {});
}
render();
connect();
