// Live page: receives the companion's state over a websocket and renders it.

const app = document.getElementById('app');
const linkLost = document.getElementById('link');

const QUEUES = {
  400: 'Normale draft', 420: 'Classée Solo/Duo', 430: 'Normale aveugle', 440: 'Classée Flexible',
  450: 'ARAM', 480: 'Swiftplay', 490: 'Partie rapide', 700: 'Clash', 1700: 'Arena', 1710: 'Arena', 2400: 'ARAM du Chaos',
};
const ROLES = { top: 'TOP', jungle: 'JGL', mid: 'MID', bot: 'BOT', support: 'SUP' };
const DDRAGON = '16.21.1';

let state = null;
let lastKey = '';
let deadline = null;
let phaseTotal = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const champ = (id) => state?.champions?.[id];
const champName = (id) => champ(id)?.name ?? `#${id}`;
const icon = (id, cls = '') =>
  id > 0
    ? `<img class="${cls}" src="/icon/${id}" alt="${esc(champName(id))}" loading="lazy" data-alias="${esc(champ(id)?.alias ?? '')}">`
    : '';

// Companion proxies icons from the client; outside a game, fall back to Data Dragon.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.dataset.alias || img.dataset.fallback) return;
  img.dataset.fallback = '1';
  img.src = `https://ddragon.leagueoflegends.com/cdn/${state?.assets?.ddragon ?? DDRAGON}/img/champion/${img.dataset.alias}.png`;
}, true);

const pct = (x, digits = 1) => `${(x * 100).toFixed(digits).replace('.', ',')} %`;
const signed = (x, digits = 1) => {
  const v = (x * 100).toFixed(digits).replace('.', ',');
  return x > 0.0005 ? `+${v}` : x < -0.0005 ? `−${v.replace('-', '')}` : `${(0).toFixed(digits).replace('.', ',')}`;
};
const trend = (x) => (x > 0.0005 ? 'up' : x < -0.0005 ? 'down' : 'flat');
const games = (n) => `${Math.round(n).toLocaleString('fr-FR')} parties`;

function phaseLabel(d) {
  if (d.phase === 'PLANNING') return { text: 'Préparation', mine: false };
  if (d.phase === 'FINALIZATION') return { text: 'Finalisation', mine: false };
  if (d.phase === 'GAME_STARTING') return { text: 'Lancement', mine: false };
  if (d.kind === 'aram') return { text: 'Choix des champions', mine: false };
  if (d.myTurn === 'ban') return { text: 'Ton ban', mine: true };
  if (d.myTurn === 'pick') return { text: 'Ton pick', mine: true };
  if (d.acting === 'enemy') return { text: 'Les adversaires choisissent', mine: false };
  if (d.acting) return { text: 'Tes alliés choisissent', mine: false };
  return { text: 'Bans et picks', mine: false };
}

function renderWaiting() {
  const who = state?.summoner ? `<div class="who">Compte <b>${esc(state.summoner.gameName)}</b></div>` : '';
  if (!state || state.status === 'no-client') {
    return `<section class="wait"><div class="pulse"></div><div class="big">Lance League of Legends</div>
      <p>La page se met à jour toute seule dès que le client est ouvert.</p></section>`;
  }
  if (state.gameflow === 'InProgress' || state.gameflow === 'GameStart') {
    return `<section class="wait"><div class="pulse ok"></div><div class="big">Partie en cours</div><p>Bonne game.</p></section>${who}`;
  }
  const text = { Matchmaking: 'Recherche de partie...', ReadyCheck: 'Partie trouvée', Lobby: 'Dans le salon' }[state.gameflow];
  return `<section class="wait"><div class="pulse ok"></div><div class="big">${text ?? 'Connecté'}</div>
    <p>Les conseils apparaissent dès la sélection des champions.</p></section>${who}`;
}

// Win chance for picks, expected gain in points for bans.
let flat = false;
const value = (o) => (flat ? '' : o.p != null ? `${Math.round(o.p * 100)}<small>%</small>` : `${signed(o.gain)}<small> pt</small>`);
const valueClass = (o) => (o.p != null ? (o.p >= 0.505 ? 'up' : o.p <= 0.495 ? 'down' : 'flat') : trend(o.gain));

function renderAdvice(advice) {
  if (!advice?.options?.length) {
    return advice?.note ? `<p class="note">${esc(advice.note)}</p>` : '';
  }
  const [best, ...rest] = advice.options;
  flat = Boolean(advice.flat);
  const reasons = (best.reasons ?? [])
    .map((r) => `<span class="chip ${trend(r.delta)}">${esc(r.label)}<b>${signed(r.delta)}</b></span>`)
    .join('');
  const range = !flat && best.p != null && best.low != null ? `${Math.round(best.low * 100)}–${Math.round(best.high * 100)} %` : '';
  const sample = [range, best.n ? games(best.n) : '', best.p == null ? best.tag : ''].filter(Boolean).join(' · ');
  const hero = `<section class="card hero" data-key="${best.championId}">
    ${icon(best.championId, 'portrait')}
    <div>
      <div class="verb">${esc(advice.verb ?? 'Conseil')}</div>
      <div class="name">${esc(champName(best.championId))}</div>
      <div class="score"><span class="delta ${valueClass(best)}">${value(best)}</span></div>
      ${sample ? `<div class="sample">${esc(sample)}</div>` : ''}
    </div>
    ${reasons ? `<div class="reasons">${reasons}</div>` : ''}
    ${best.warn ? `<div class="warn">${esc(best.warn)}</div>` : ''}
  </section>`;
  const alts = rest.slice(0, 3).map((o) => `<div class="alt">
      ${icon(o.championId)}
      <div><div class="n">${esc(champName(o.championId))}</div><div class="t">${esc([o.tag, o.warn].filter(Boolean).join(' · '))}</div></div>
      <span class="delta ${valueClass(o)}">${o.close ? '<i class="eq">≈</i>' : ''}${value(o)}</span>
    </div>`).join('');
  const note = advice.note ? `<p class="note">${esc(advice.note)}</p>` : '';
  return hero + (alts ? `<section class="card alts">${alts}</section>` : '') + note;
}

function renderBoard(d) {
  const slot = (p, ally) => {
    const id = p.championId || (ally ? p.hoverId : 0);
    const cls = ['slot', ally && p.me ? 'me' : '', !p.championId && id ? 'hover' : ''].join(' ');
    const label = ally ? (p.me ? 'TOI' : ROLES[p.role] ?? '') : '';
    return `<div class="${cls}"><div class="pic">${icon(id)}</div><span class="role">${label}&nbsp;</span></div>`;
  };
  const enemies = d.enemies.length && d.kind !== 'aram'
    ? `<div><div class="row-label">Adversaires</div><div class="team">${d.enemies.map((p) => slot(p, false)).join('')}</div></div>`
    : '';
  const bench = d.kind === 'aram'
    ? `<div><div class="row-label">Banc</div><div class="icons bench">${d.bench.map((id) => icon(id)).join('') || '<span class="muted">Vide</span>'}</div></div>`
    : '';
  const banList = (ids) => ids.map((id) => icon(id)).join('') || '<span class="muted">-</span>';
  const bans = d.bans.ally.length || d.bans.enemy.length
    ? `<div class="bans-wrap"><div><div class="row-label">Nos bans</div><div class="icons bans">${banList(d.bans.ally)}</div></div>
       <div><div class="row-label">Leurs bans</div><div class="icons bans">${banList(d.bans.enemy)}</div></div></div>`
    : '';
  return `<section class="card board">
    <div><div class="row-label">Ton équipe</div><div class="team">${d.allies.map((p) => slot(p, true)).join('')}</div></div>
    ${bench}${enemies}${bans}
  </section>`;
}

function render() {
  if (state?.status !== 'champ-select' || !state.draft) {
    app.innerHTML = renderWaiting();
    return;
  }
  const d = state.draft;
  const phase = phaseLabel(d);
  const mode = state.queue?.name || QUEUES[d.queueId] || 'Partie';
  app.innerHTML = `
    <header class="top">
      <div><div class="mode">${esc(mode)}</div><div class="phase ${phase.mine ? 'mine' : ''}">${phase.text}</div></div>
      <div class="timer" id="timer"></div>
    </header>
    <div class="bar"><i id="bar"></i></div>
    ${renderAdvice(state.advice)}
    ${renderBoard(d)}`;
  tick();
}

function tick() {
  const t = document.getElementById('timer');
  const bar = document.getElementById('bar');
  if (!t) return;
  if (deadline == null) {
    t.textContent = '';
    bar.style.transform = 'scaleX(0)';
    return;
  }
  const left = Math.max(0, deadline - Date.now());
  t.textContent = Math.ceil(left / 1000);
  t.classList.toggle('low', left < 8000);
  bar.style.transform = `scaleX(${phaseTotal ? Math.min(1, left / phaseTotal) : 0})`;
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
  const key = JSON.stringify([state.status, state.gameflow, state.summoner, state.queue, d && { ...d, timeLeftMs: 0 }, state.advice]);
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

render();
connect();
