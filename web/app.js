// Live page: renders one screen per moment of champ select. On the PC it follows the local
// companion over a websocket; opened from the group link (#g=…&k=…) it follows the group
// through the encrypted relay, and each friend picks whose draft to show.

import { Idiomorph } from './vendor/idiomorph.esm.js';

const app = document.getElementById('app');
const linkLost = document.getElementById('link');

const QUEUES = {
  400: 'Normale draft', 420: 'Classée solo/duo', 430: 'Normale aveugle', 440: 'Classée flexible', 450: 'ARAM',
  480: 'Swiftplay', 490: 'Partie rapide', 700: 'Clash', 1700: 'Arena', 1710: 'Arena', 1750: 'Arena', 2400: 'ARAM du Chaos',
};
const COLS = ['top', 'jungle', 'mid', 'bot', 'support'];
const COL_LABELS = { top: 'TOP', jungle: 'JGL', mid: 'MID', bot: 'ADC', support: 'SUP' };
const ROLE_NAMES = { top: 'Top', jungle: 'Jungle', mid: 'Mid', bot: 'ADC', support: 'Support' };
const RANKS = { IRON: 'Fer', BRONZE: 'Bronze', SILVER: 'Argent', GOLD: 'Or', PLATINUM: 'Platine', EMERALD: 'Émeraude', DIAMOND: 'Diamant', MASTER: 'Maître', GRANDMASTER: 'Grand maître', CHALLENGER: 'Challenger' };
const DDRAGON = '16.21.1';
const SCALE = [0.42, 0.62]; // every gauge shares one scale, so gaps between cards are visible
const LEGAL = 'LoL Draft Coach isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.';
const onPc = ['localhost', '127.0.0.1'].includes(location.hostname);
const DOWNLOAD = 'https://github.com/Vialou07/lol-draft-coach/releases/latest/download/LolDraftCoach.exe';
const REPO = 'https://github.com/Vialou07/lol-draft-coach';
const onWindows = /Windows NT/.test(navigator.userAgent) && !/Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
// The public copy on GitHub Pages; anything else is served by a companion (PC or Wi-Fi address).
const hosted = location.hostname.endsWith('github.io');
const hash = new URLSearchParams(location.hash.slice(1));
const remote = hash.get('g') && hash.get('k') ? { group: hash.get('g'), key: hash.get('k') } : null;
const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
const MQTT_LIB = 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js';
const STALE_MS = 45000;
const storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

let state = null;
let lastKey = '';
let lastHeadline = '';
let deadline = null;
let phaseTotal = null;
let phone = null;
const opened = new Set();

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const champ = (id) => state?.champions?.[id];
const champName = (id) => champ(id)?.name ?? `#${id}`;
const ddragonIcon = (alias) => `https://ddragon.leagueoflegends.com/cdn/${state?.assets?.ddragon ?? DDRAGON}/img/champion/${alias}.png`;
const img = (id, cls = '') => {
  if (!(id > 0)) return '';
  const alias = champ(id)?.alias ?? '';
  const src = remote && alias ? ddragonIcon(alias) : `/icon/${id}`;
  return `<img class="${cls}" src="${src}" alt="${esc(champName(id))}" data-alias="${esc(alias)}">`;
};

// The companion proxies icons from the client; outside a game, fall back to Data Dragon.
document.addEventListener('error', (e) => {
  const el = e.target;
  if (el.tagName !== 'IMG' || !el.dataset.alias || el.dataset.fallback) return;
  el.dataset.fallback = '1';
  el.src = ddragonIcon(el.dataset.alias);
}, true);

const pts = (x, digits = 1) => {
  const v = Math.abs(x * 100).toFixed(digits).replace('.', ',');
  return x * 100 >= 0.05 ? `+${v}` : x * 100 <= -0.05 ? `−${v}` : (0).toFixed(digits).replace('.', ',');
};
const trend = (x, min = 0.05) => (x * 100 >= min ? 'up' : x * 100 <= -min ? 'down' : 'flat');
const pct = (x) => `${Math.round(x * 100)} %`;

// The headline is the answer: what to do now, and with which champion.
function headline(d, a, me) {
  const top = a?.options?.[0];
  const name = top ? champName(top.championId) : '';
  if (d.kind === 'aram') {
    if (!a?.focus) return { text: a?.verb ?? 'ARAM', mine: false };
    return a.flat ? { text: champName(a.focus), mine: false } : { text: `${a.verb} ${champName(a.focus)}`, mine: a.verb === 'Prends' };
  }
  if (d.kind === 'arena') return { text: 'Arena', mine: false };
  if (d.myTurn === 'pick') return { text: top ? `Prends ${name}` : 'À toi', mine: true };
  if (d.myTurn === 'ban') return { text: top ? `Bannis ${name}` : 'Ton ban', mine: true };
  if (me?.championId) {
    const mine = a?.options?.find((o) => o.championId === me.championId);
    return { text: mine?.p != null ? `${champName(me.championId)} · ${pct(mine.p)}` : champName(me.championId), mine: false };
  }
  if (d.phase === 'PLANNING') return { text: top ? `Déclare ${name}` : 'Déclare ton pick', mine: false };
  return { text: d.acting === 'enemy' ? 'Les adversaires choisissent' : 'Prépare ton pick', mine: false };
}

// The line under the headline: whose turn it is, then the role and the queue.
function turnNote(d, a) {
  if (d.kind === 'aram') return aramWhy(a);
  if (d.myTurn === 'pick') return 'à toi de choisir';
  if (d.myTurn === 'ban') return Math.max(...(a?.options ?? []).map((o) => o.gain ?? 0)) < 0.01 ? 'à toi de bannir · effet faible, moins d’un point' : 'à toi de bannir';
  return '';
}

// 'fresh' once when the headline changes (a new advice), so the eye goes back to it.
function fresh(text) {
  if (text === lastHeadline) return '';
  const first = !lastHeadline;
  lastHeadline = text;
  return first ? '' : 'fresh';
}

function renderPeople() {
  if (remote && state?.following && people.length < 2) {
    return `<div class="demo-bar"><span>Tu suis ${esc(state.following)}. Pour tes propres conseils, lance l’appli sur ton PC.</span></div>`;
  }
  if (!remote || people.length < 2) return '';
  return `<nav class="people">${people.map((p) => `<button data-me="${esc(p.name)}" class="${p.name === state?.summoner?.gameName ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</nav>`;
}

function renderGroupWaiting() {
  if (!people.length) {
    return `${pcBanner()}<section class="wait"><div class="pulse"></div><h1>En attente du groupe</h1>
      <p>Dès qu'un membre lance le compagnon sur son PC, sa draft apparaît ici toute seule.</p></section><p class="legal">${LEGAL}</p>`;
  }
  const status = (m) => (m.status === 'no-client' ? 'client LoL fermé' : ({ Lobby: 'dans le salon', Matchmaking: 'en recherche de partie', ReadyCheck: 'partie trouvée', InProgress: 'en partie', ChampSelect: 'en sélection' }[m.gameflow] ?? 'connecté'));
  const hosts = [...new Map(people.map((p) => [p.msg.name, p.msg])).values()];
  return `${pcBanner()}${renderPeople()}<section class="wait"><div class="pulse ok"></div><h1>Groupe connecté</h1>
    <p>${hosts.map((m) => `${esc(m.name)} : ${status(m)}`).join('<br>')}</p>
    <p>Les conseils apparaissent dès la sélection des champions, puis le build pendant la partie.</p></section>${renderRecap(state?.recap)}<p class="legal">${LEGAL}</p>`;
}

function renderWaiting() {
  if (remote) return renderGroupWaiting();
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
      <div class="buttons"><button data-demo="ranked">Ranked solo</button><button data-demo="aram">ARAM du Chaos</button><button data-demo="game">En partie</button><button data-demo="recap">Après la partie</button></div>
    </section>`;
  const qr = onPc && phone?.groupQr
    ? `<section class="tile phone"><div class="qr">${phone.groupQr}</div><div>
        <div class="tile-title">Le lien du groupe</div>
        <p>Scanne-le avec ton téléphone, et envoie-le à tes potes : quand vous jouez ensemble, chacun voit sa propre draft. Rien à installer.</p>
        <div class="buttons"><button data-copy="${esc(phone.group)}">Copier le lien</button></div>
        <form class="add" data-join-form><input name="link" placeholder="Ou colle le lien du groupe d'un pote" autocomplete="off"><button>Rejoindre</button></form>
        ${phone.url ? `<p class="url">Même Wi-Fi, sans internet : ${esc(phone.url)}</p>` : ''}</div></section>`
    : onPc && phone?.qr
      ? `<section class="tile phone"><div class="qr">${phone.qr}</div><div>
          <div class="tile-title">Sur ton téléphone</div>
          <p>Scanne ce code avec l'appareil photo, sur le même Wi-Fi.</p>
          <p class="url">${esc(phone.url)}</p></div></section>`
      : '';
  const learning = state?.settings?.learning ?? [];
  const names = Object.values(state?.champions ?? {}).map((c) => c.name).sort((a, b) => a.localeCompare(b, 'fr'));
  const learn = `<section class="tile">
      <div class="tile-title">Champions à apprendre</div>
      <p>À chaque draft, l'appli te dira si c'est le bon moment pour en tester un, ou si ce serait du troll.</p>
      <div class="chips wrap">${learning.map((id) => `<button class="chip-btn" data-unlearn="${id}">${mini(id)}${esc(champName(id))}<b>×</b></button>`).join('') || '<span class="muted small">Aucun pour l’instant</span>'}</div>
      <form class="add" data-learn-form><input list="champ-names" name="champ" placeholder="Ajouter un champion" autocomplete="off"><button>Ajouter</button></form>
      <datalist id="champ-names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    </section>`;
  const version = state?.version ? `<p class="note">Version ${esc(state.version)}${state.update?.status === 'ready' ? ` · la ${esc(state.update.version)} s'installera après ta partie` : ''}</p>` : '';
  return `${updateBanner()}<section class="wait">${body}</section>${who}${renderRecap(state?.recap)}<div class="tiles">${renderProfile()}${demo}${learn}${qr}</div>${version}<p class="legal">${LEGAL}</p>`;
}

// Your last games as a row of portraits, green for a win, red for a loss; today's count first.
function renderRecent(recent) {
  if (!recent?.length) return '';
  const today = new Date().toDateString();
  const games = recent.filter((r) => new Date(r.at).toDateString() === today);
  const wins = games.filter((r) => r.win).length;
  const count = games.length ? `<div class="small">Aujourd’hui : <b class="up">${wins} V</b> · <b class="down">${games.length - wins} D</b></div>` : '';
  return `${count}<div class="recent">${recent.map((r) => `<span class="rgame ${r.win ? 'win' : 'loss'}" title="${esc(champName(r.championId))} · ${r.win ? 'victoire' : 'défaite'}">${img(r.championId)}</span>`).join('')}</div>`;
}

// Your own record, as it is: counts, not percentages, so small samples look small.
function renderProfile() {
  const p = state?.profileSummary;
  if (!p || (!p.comfort.length && !p.aram.length)) return '';
  const record = (r) => `<span class="small">${r.wins} V · ${r.games - r.wins} D</span>`;
  const champs = (list) => list.map((c) => `<span class="duo">${mini(c.championId)}<span class="small">${esc(champName(c.championId))}</span>${record(c)}</span>`).join('');
  const pairs = (list) => list.map((m) => `<div class="pair">${mini(m.championId)}<span class="small muted">vs</span>${mini(m.vs)}${record(m)}</div>`).join('');
  const rows = [
    p.comfort.length ? `<div class="arow"><span class="alabel">Tes champions</span><div class="abody list">${champs(p.comfort)}</div></div>` : '',
    p.favorable.length ? `<div class="arow"><span class="alabel">Bons matchups</span><div class="abody">${pairs(p.favorable)}</div></div>` : '',
    p.hard.length ? `<div class="arow"><span class="alabel">Matchups durs</span><div class="abody">${pairs(p.hard)}</div></div>` : '',
    p.aram.length ? `<div class="arow"><span class="alabel">ARAM du Chaos</span><div class="abody list">${champs(p.aram)}</div></div>` : '',
  ].join('');
  return `<div class="col"><section class="tile"><div class="tile-title">Ton profil</div><p>Sur tes ${p.gamesRead} parties gardées${p.rank ? ` · ${esc(RANKS[p.rank.tier] ?? p.rank.tier)} ${esc(p.rank.division)}` : ''}. Peu de parties = simple tendance.</p>${renderRecent(p.recent)}</section>
    <section class="analysis">${rows}</section></div>`;
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

function card(o, { flat = false, ref = false, best = false, precise = false } = {}) {
  const isBan = o.gain != null;
  const showNumber = !flat && (isBan || o.p != null);
  const pos = (x) => Math.max(0, Math.min(100, ((x - SCALE[0]) / (SCALE[1] - SCALE[0])) * 100));
  const number = isBan
    ? `<span class="big ${trend(o.gain, 0.05)}">${num(o.gain, 'pts', 0)}<small>pt</small></span>`
    : `<span class="big">${num(o.p, precise ? 'pct1' : 'pct', 0.5)}<small>%</small></span>`;
  const gauge = showNumber && !isBan
    ? `<div class="gauge ${best ? 'best' : ''}"><i class="range" style="left:${pos(o.low ?? o.p)}%;right:${100 - pos(o.high ?? o.p)}%"></i><i class="fill" style="width:${pos(o.p)}%"></i><i class="mid" style="left:${pos(0.5)}%"></i></div>`
    : '';
  const chips = (o.reasons ?? []).map((r) => `<span class="chip ${trend(r.delta)}">${esc(r.label)}<b>${pts(r.delta)}</b></span>`).join('');
  // A long tag (bans) moves to the second line so the name never gets cut.
  const tagInTitle = champName(o.championId).length + (o.tag ?? '').length <= 18;
  const detail = !isBan && o.p != null
    ? `<div class="abs">
        ${o.vsId && o.delta != null ? `<div><b>${pts(o.delta)} pt</b> face à ${esc(champName(o.vsId))}</div>` : ''}
        ${(o.detail ?? []).length ? `<div>${o.detail.map((r) => `${esc(r.label)} ${pts(r.delta)}`).join(' · ')}</div>` : ''}
        ${o.high - o.low > 0.001 ? `<div>Entre ${pct(o.low)} et ${pct(o.high)}${o.n ? ` · ${o.n.toLocaleString('fr-FR')} parties analysées` : ''}</div>` : ''}
      </div>`
    : '';
  return `<article id="card-${o.championId}${ref ? '-ref' : ''}" class="card ${ref ? 'ref' : ''} ${o.mine ? 'mine' : ''} ${opened.has(o.championId) ? 'open' : ''}" data-id="${o.championId}">
    ${o.close ? '<span class="eq">≈ égalité</span>' : ''}
    ${img(o.championId, 'portrait')}
    <div class="title"><span class="name">${esc(champName(o.championId))}</span>${tagInTitle ? `<span class="tag">${esc(o.tag ?? '')}</span>` : ''}</div>
    <div class="num">${showNumber ? number : ''}</div>
    <div class="chips">${tagInTitle ? chips : `<span class="tag">${esc(o.tag ?? '')}</span>${chips}`}</div>
    ${gauge}
    ${o.warn ? `<div class="warn">${esc(o.warn)}</div>` : ''}
    ${o.brings?.length ? `<div class="brings">${o.brings.map((b) => `<span>${esc(b)}</span>`).join('')}</div>` : ''}
    ${detail}
  </article>`;
}

function mini(id) {
  return `<span class="mini">${img(id)}</span>`;
}

function verdict(delta, words = ['Favorable', 'Équilibrée', 'Difficile']) {
  const cls = trend(delta, 1);
  const word = cls === 'up' ? words[0] : cls === 'down' ? words[2] : words[1];
  return `<span class="pill ${cls}">${word}${cls === 'flat' ? '' : ` ${pts(delta)}`}</span>`;
}

function damageBar(team) {
  if (team?.physical == null) return '<span class="muted">-</span>';
  const ad = Math.round(team.physical * 100);
  return `<div class="dmg"><i class="ad" style="width:${ad}%"></i><i class="ap" style="width:${100 - ad}%"></i></div><span class="dmg-label">AD ${ad} % · AP ${100 - ad} %</span>`;
}

function timingVerdict(timing) {
  const [short, , long] = timing.map((t) => t.delta * 100);
  if (Math.max(...timing.map((t) => Math.abs(t.delta * 100))) < 1) return 'Pas de différence nette selon la durée.';
  if (long - short >= 2) return 'Ton équipe gagne en durée : joue safe et laisse scaler.';
  if (short - long >= 2) return 'Ton équipe est forte tôt : joue agressif avant 25 minutes.';
  return long > 0 ? 'Léger avantage si la partie dure.' : 'Léger avantage si la partie est courte.';
}

// The full read of the draft around the champion in focus: lane, other matchups, duos,
// then both teams (damage, tanks, game length) and the overall win chance.
function renderAnalysis(an, { hideOverall = false, hover = false } = {}) {
  if (!an) return '';
  const row = (label, body) => `<div class="arow"><span class="alabel">${label}</span><div class="abody">${body}</div></div>`;
  const rows = [];
  if (an.lane) {
    rows.push(row('Ta lane', an.lane.opponentId
      ? `${mini(an.lane.opponentId)}<span class="aname">${esc(champName(an.lane.opponentId))}</span>${verdict(an.lane.delta)}<span class="muted small">${an.lane.games.toLocaleString('fr-FR')} parties</span>${an.lane.personal ? `<span class="small">toi : ${an.lane.personal.wins} V · ${an.lane.personal.games - an.lane.personal.wins} D</span>` : ''}`
      : `<span class="muted">Ton vis-à-vis n'a pas encore choisi${an.lane.worst ? ` · pire cas ${esc(an.lane.worst.name)} ${pts(an.lane.worst.delta)}` : ''}</span>`));
  }
  const named = (o) => `<span class="duo">${mini(o.championId)}<span class="small">${esc(champName(o.championId))}</span><b class="${trend(o.delta, 0.5)}">${pts(o.delta)}</b></span>`;
  if (an.others?.length) rows.push(row('Autres matchups', an.others.map(named).join('')));
  if (an.duos?.length) rows.push(row('Tes duos', an.duos.map(named).join('')));
  const { us, them } = an.teams ?? {};
  if (us) {
    rows.push(row('Dégâts', `<div class="teams"><div><span class="tname">Nous</span>${damageBar(us)}</div>${them ? `<div><span class="tname">Eux</span>${damageBar(them)}</div>` : ''}</div>`));
    rows.push(row('Tanks', `<span>Nous <b>${us.tanks}</b></span>${them ? `<span class="sep">·</span><span>Eux <b>${them.tanks}</b></span>` : ''}`));
    if (us.engage != null) {
      rows.push(row('Engage', `<span>Nous <b>${us.engage}</b></span>${them ? `<span class="sep">·</span><span>Eux <b>${them.engage}</b></span>` : ''}<span class="muted small">qui lance les fights</span>`));
      rows.push(row('Protection', `<span>Nous <b>${us.peel}</b></span>${them ? `<span class="sep">·</span><span>Eux <b>${them.peel}</b></span>` : ''}<span class="muted small">qui protège ses carrys</span>`));
    }
  }
  if (an.timing) {
    rows.push(row('Durée', `<div class="timing">${an.timing.map((t) => `<span class="tcell"><small>${t.label}</small>${verdict(t.delta, ['Nous', '≈ 0', 'Eux']).replace('Nous ', '').replace('Eux ', '')}</span>`).join('')}</div><div class="muted small">${timingVerdict(an.timing)}</div>`));
  }
  if (an.overall && !hideOverall) {
    rows.push(row('La partie', `<span class="overall">${num(an.overall.p, 'pct', 0.5)} %</span><span class="muted small">chance de gagner · entre ${pct(an.overall.low)} et ${pct(an.overall.high)}</span>`));
  }
  const warnings = [us?.warning, them?.warning ? `Eux : ${them.warning.toLowerCase()}` : '', ...(an.needs ?? [])]
    .filter(Boolean)
    .map((w) => `<div class="warn">${esc(w)}</div>`)
    .join('');
  const fixes = (an.fixes ?? [])
    .map((f) => `<div class="fix">${mini(f.championId)}<span><b>${esc(champName(f.championId))}</b> ${esc(f.label.toLowerCase())} · ${pct(f.p)}</span></div>`)
    .join('');
  return `<div class="label"><span>Analyse de la draft</span><b>avec ${esc(champName(an.championId))}${hover ? ' (ton survol)' : ''}</b></div>
    <section class="analysis">${rows.join('')}${warnings}${fixes ? `<div class="fixes"><span class="muted small">Pour combler :</span>${fixes}</div>` : ''}</section>`;
}

// --- In game: what to buy, the usual build, what their team calls for ---

const itemIcon = (id, cls = '') => `<img class="${cls}" src="https://ddragon.leagueoflegends.com/cdn/${state?.assets?.ddragon ?? DDRAGON}/img/item/${id}.png" alt="${esc(state?.game?.itemNames?.[id] ?? id)}" title="${esc(state?.game?.itemNames?.[id] ?? '')}">`;
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const golds = (n) => `${Math.round(n).toLocaleString('fr-FR')} po`;

// The game plan from the draft: your lane, when your team is strong, what it lacks.
function renderPlan() {
  const plan = state.plan;
  if (!plan) return '';
  const rows = [];
  if (plan.lane?.opponentId) {
    const personal = plan.lane.personal ? `<span class="small">toi : ${plan.lane.personal.wins} V · ${plan.lane.personal.games - plan.lane.personal.wins} D</span>` : '';
    rows.push(`<div class="arow"><span class="alabel">Ta lane</span><div class="abody">${mini(plan.lane.opponentId)}<span class="aname">${esc(champName(plan.lane.opponentId))}</span>${verdict(plan.lane.delta)}${personal}</div></div>`);
  }
  if (plan.timing) rows.push(`<div class="arow"><span class="alabel">Timing</span><div class="abody"><span>${esc(timingVerdict(plan.timing))}</span></div></div>`);
  const needs = (plan.needs ?? []).map((n) => `<div class="warn">${esc(n)}</div>`).join('');
  if (!rows.length && !needs) return '';
  return `<div class="label"><span>Plan de jeu</span><b>d'après la draft</b></div><section class="analysis">${rows.join('')}${needs}</section>`;
}

function renderLoading() {
  return `${renderPeople()}<header class="head"><div><h1>Chargement</h1><div class="sub"><i class="dot"></i>${esc(champName(state.plan.championId))}</div></div></header>
    ${renderPlan()}
    <p class="note">Les conseils de build arrivent dès que la partie démarre.</p>
    <p class="legal">${LEGAL}</p>`;
}

function renderGame() {
  const g = state.game;
  const name = (id) => g.itemNames?.[id] ?? `#${id}`;
  const demo = state.demo?.name === 'game'
    ? `<div class="demo-bar step"><span>${esc(state.demo.caption)}</span>${remote ? '' : '<button data-demo="stop">Arrêter</button>'}</div>`
    : '';
  const buy = g.buy
    ? `<section class="card buy">${itemIcon(g.buy.item, 'portrait')}
        <div class="title"><span class="name">${esc(name(g.buy.item))}</span></div>
        <div class="num"><span class="big ${g.buy.short ? '' : 'up'}">${num(g.buy.cost, 'int')}<small> po</small></span></div>
        <div class="chips"><span class="tag">${esc(g.buy.short ? `il te manque ${g.buy.short.toLocaleString('fr-FR')} po` : g.buy.item !== g.buy.for ? `vers ${name(g.buy.for)}` : 'item complet')}${g.nextStats ? ` · ${pct(g.nextStats.winrate)} sur ${g.nextStats.games.toLocaleString('fr-FR')} parties` : ''}</span></div>
      </section>`
    : g.noBuild ? '<p class="note">Pas de build disponible pour ce champion pour l’instant, nouvel essai dans 30 s.</p>' : '<p class="note">Ton build est complet.</p>';
  const st = g.style;
  const styleNote = st?.followed
    ? `<p class="note good">Tu es parti ${esc(st.name)} : le build suit, d'après ${g.source.games.toLocaleString('fr-FR')} parties ${esc(st.name)} sur u.gg.</p>`
    : st?.missing
      ? `<p class="note">Tu es parti ${esc(st.name)} : pas assez de parties ${esc(st.name)} sur u.gg pour ce champion, build le plus joué affiché.</p>`
      : '';
  const alternatives = (g.alternatives ?? []).length
    ? `<section class="analysis">${g.alternatives.map((a) => `<div class="arow"><span class="trap">${itemIcon(a.item, 'mini-item')}<span class="aname">${esc(name(a.item))}</span></span><div class="abody"><span class="muted small">${esc(a.reason ?? `${pct(a.winrate)} sur ${a.games.toLocaleString('fr-FR')} parties`)}</span></div></div>`).join('')}</section>`
    : '';
  const path = g.path.length
    ? `<section class="path">${g.path.map((p) => `<div class="slot-item ${p.owned ? 'owned' : ''} ${p.item === g.buy?.for ? 'next' : ''}">${itemIcon(p.item)}${p.owned ? '<b>✓</b>' : ''}</div>`).join('<i class="arrow">›</i>')}</section>`
    : '';
  const shownAbove = new Set((g.alternatives ?? []).map((a) => a.item));
  const adaptList = g.adapt.filter((a) => !shownAbove.has(a.item));
  const adapt = adaptList.length
    ? `<div class="label"><span>Adapté à leur compo</span><b>à toi de voir</b></div>
      <section class="analysis">${adaptList.map((a) => `<div class="arow"><span class="trap">${itemIcon(a.item, 'mini-item')}<span class="aname">${esc(name(a.item))}</span></span><div class="abody"><span class="muted small">${esc(a.reason)}</span></div></div>`).join('')}</section>`
    : '';
  const e = g.enemy ?? {};
  const sig = e.signals ?? {};
  const bought = [[sig.crit, 'critiques'], [sig.attackSpeed, 'vitesse d’attaque'], [sig.lifesteal, 'vol de vie'], [sig.armor, 'armure'], [sig.magicResist, 'résistance magique']]
    .filter(([n]) => n >= 2)
    .map(([n, label]) => `<span class="chip">${n} ${label}</span>`)
    .join('');
  const enemyRows = [
    e.threat ? `<div class="arow"><span class="alabel">S'envole</span><div class="abody">${mini(e.threat.championId)}<span class="aname">${esc(champName(e.threat.championId))}</span><span class="muted small">${golds(e.threat.value)} d'items${e.threat.kda ? ` · ${esc(e.threat.kda)}` : ''}</span></div></div>` : '',
    bought ? `<div class="arow"><span class="alabel">Leurs items</span><div class="abody">${bought}</div></div>` : '',
    e.physical != null ? `<div class="arow"><span class="alabel">Leurs dégâts</span><div class="abody">${damageBar({ physical: e.physical })}</div></div>` : '',
    e.healers?.length ? `<div class="arow"><span class="alabel">Soins</span><div class="abody">${e.healers.map((id) => `<span class="duo">${mini(id)}<span class="small">${esc(champName(id))}</span></span>`).join('')}</div></div>` : '',
    `<div class="arow"><span class="alabel">Tanks</span><div class="abody"><b>${e.tanks ?? 0}</b></div></div>`,
  ].join('');
  const skills = g.skills?.priority
    ? `<p class="skillrow">Sorts à monter <b class="skills">${esc(g.skills.priority.split('').join(' › '))}</b><span class="muted small">départ ${esc(g.skills.start.join(' '))}</span></p>`
    : '';
  const source = g.source
    ? `${g.source.queue === 'normal_aram' ? 'Build ARAM' : 'Build des joueurs de ton rang'} sur ${g.source.games.toLocaleString('fr-FR')} parties (u.gg, patch ${g.source.patch.replace('_', '.')})${g.source.games < 200 ? ' : petit échantillon, à prendre comme une piste' : ''}.`
    : 'Pas de build disponible pour ce champion.';
  const winrate = !g.source
    ? ''
    : `${st?.followed ? `build ${esc(st.name)} · ` : ''}${g.source.games < 200 ? `${g.source.games.toLocaleString('fr-FR')} parties` : `${Math.round((g.source.wins / Math.max(1, g.source.games)) * 100)} % de victoires`}`;
  const title = !g.buy ? (g.noBuild ? 'En partie' : 'Build complet') : g.buy.short ? `Prochain : ${name(g.buy.item)}` : `Achète ${name(g.buy.item)}`;
  return `${demo}${renderPeople()}
    <header class="head">
      <div><h1 class="${g.buy && !g.buy.short ? 'mine' : ''} ${title.length > 14 ? 'long' : ''} ${fresh(title)}">${esc(title)}</h1><div class="sub"><i class="dot"></i>${esc(champName(g.championId))} · ${clock(g.gameTime)}</div></div>
      <div class="gold">${num(g.gold, 'int')} po</div>
    </header>
    ${renderAlive(g)}
    <div class="cols">
      <div class="col">
        ${buy}
        ${alternatives ? `<div class="label"><span>Ou bien</span></div>${alternatives}` : ''}
        <div class="label"><span>Ton build</span><b>${winrate}</b></div>
        ${path}
        ${skills}
        ${styleNote}
      </div>
      <div class="col">
        ${renderGoldChart(g)}
        ${renderFeed(g)}
        ${renderPlan()}
        ${adapt}
        <div class="label"><span>Eux</span></div>
        <section class="analysis">${enemyRows}</section>
        <p class="note">${esc(source)}</p>
      </div>
    </div>
    <p class="legal">${LEGAL}</p>`;
}

// The fight right now: how many are alive on each side, and until when (the scoreboard
// shows the respawn timers one by one; here they are counted for you).
function renderAlive(g) {
  const lv = g.live;
  if (!lv || lv.alive.us === lv.alive.them) return '';
  const ahead = lv.alive.us > lv.alive.them;
  // The advantage lasts until the first of the outnumbered side comes back.
  const back = lv.dead.filter((d) => d.ally !== ahead).sort((a, b) => a.left - b.left)[0];
  const until = back ? g.at + back.left * 1000 : null;
  return `<section class="alive ${ahead ? 'up' : 'down'}">
      <div class="alive-n"><b>${lv.alive.us}</b><span>contre</span><b>${lv.alive.them}</b></div>
      <div class="alive-t">${ahead ? 'À vous de jouer' : 'Recule'}${until ? ` · encore <b data-until="${until}">${back.left} s</b>` : ''}</div>
      <div class="alive-dead">${lv.dead.filter((d) => d.ally !== ahead).map((d) => `<span class="mini dead">${img(d.championId)}<i data-until="${g.at + d.left * 1000}">${d.left} s</i></span>`).join('')}</div>
    </section>`;
}

// Gold held in items, team against team, over the game; kills as dots on the edges.
function renderGoldChart(g) {
  const lv = g.live;
  if (!lv?.points?.length) return '';
  const W = 320;
  const H = 120;
  const mid = H / 2;
  const tMax = Math.max(lv.t, 240);
  const span = Math.max(1500, ...lv.points.map((p) => Math.abs(p[1]))) * 1.15;
  const x = (t) => (t / tMax) * W;
  const y = (v) => mid - (v / span) * (mid - 10);
  // Before the first read (the app started mid-game) the curve is unknown: a dashed line from 0.
  const known = lv.t - lv.points[0][0] < 10 ? [[0, 0], lv.points.at(-1)] : lv.points;
  const pts = known.map(([t, v]) => [x(t), y(v)]);
  const data = JSON.stringify(pts.map(([a, b]) => [+a.toFixed(1), +b.toFixed(1)]));
  const before = known[0][0] > 30 ? `<line class="before" x1="0" y1="${mid}" x2="${pts[0][0].toFixed(1)}" y2="${pts[0][1].toFixed(1)}"/>` : '';
  const diff = lv.gold.us - lv.gold.them;
  const kills = lv.kills.map(([t, ours]) => `<circle class="kill ${ours ? 'us' : 'them'}" cx="${x(t).toFixed(1)}" cy="${ours ? 4 : H - 4}" r="2.6"/>`).join('');
  const minutes = Array.from({ length: Math.floor(tMax / 300) }, (_, i) => (i + 1) * 300).map((t) => `<line class="tick" x1="${x(t)}" x2="${x(t)}" y1="${mid - 3}" y2="${mid + 3}"/>`).join('');
  return `<div class="label"><span>La partie</span><b>or en items · kills</b></div>
    <section class="chart">
      <div class="chart-head">
        <span class="score"><b class="up">${lv.score.us}</b> – <b class="down">${lv.score.them}</b></span>
        <span class="gnow ${diff >= 0 ? 'up' : 'down'}">${num(diff, 'k')}</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="gold">
        <defs>
          <clipPath id="gc-up"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath>
          <clipPath id="gc-down"><rect x="0" y="${mid}" width="${W}" height="${mid}"/></clipPath>
        </defs>
        <line class="axis" x1="0" x2="${W}" y1="${mid}" y2="${mid}"/>${minutes}
        <path class="tw area up" clip-path="url(#gc-up)" data-base="${mid}" data-pts="${esc(data)}" d=""/>
        <path class="tw area down" clip-path="url(#gc-down)" data-base="${mid}" data-pts="${esc(data)}" d=""/>
        <path class="tw line" data-pts="${esc(data)}" d=""/>${before}
        ${kills}
      </svg>
      <div class="chart-foot"><span>Vous ${num(lv.gold.us, 'int')} po</span><span>${clock(lv.t)}</span><span>Eux ${num(lv.gold.them, 'int')} po</span></div>
    </section>`;
}

// What just happened, newest first: an enemy's big item, a multikill, an inhibitor down.
function renderFeed(g) {
  const lv = g.live;
  const timers = (lv?.timers ?? []).map((t) => `<span class="chip ${t.ally ? 'up' : 'down'}">${{ inhib: t.ally ? 'Leur inhib' : 'Votre inhib', dragon: 'Dragon', baron: 'Baron' }[t.kind]} <b data-until="${g.at + (t.back - lv.t) * 1000}" data-clock="1">${clock(t.back - lv.t)}</b></span>`).join('');
  if (!lv?.feed?.length && !timers) return '';
  const rows = (lv.feed ?? []).map((f) => `<div class="feed-row ${f.ally ? 'up' : f.ally === false ? 'down' : ''}" id="feed-${f.t}-${esc(f.kind)}-${f.championId ?? 0}">
      <span class="feed-t">${clock(f.t)}</span>${f.item ? itemIcon(f.item, 'mini-item') : f.championId ? mini(f.championId) : ''}<span>${esc(f.text)}</span></div>`).join('');
  return `<div class="label"><span>Moments clés</span>${timers ? '<b>repop</b>' : ''}</div>
    <section class="analysis feed">${timers ? `<div class="timers">${timers}</div>` : ''}${rows}</section>`;
}

// After the game: the ten players side by side, the bars grow and slide when you switch.
const METRICS = { damage: 'Dégâts', taken: 'Encaissés', heal: 'Soins', gold: 'Or' };
const ROW = 40;
let metric = 'damage';
function renderRecap(r) {
  if (!r?.players?.length) return '';
  const value = (p) => p[metric] ?? 0;
  const max = Math.max(1, ...r.players.map(value));
  const order = [...r.players].sort((a, b) => value(b) - value(a));
  const rank = new Map(order.map((p, i) => [p.id, i]));
  const me = r.players.find((p) => p.me);
  const myRank = rank.get(me.id) + 1;
  const rows = r.players.map((p) => `<div class="bar-row ${p.ally ? 'ally' : 'enemy'} ${p.me ? 'me' : ''}" id="bar-${p.id}" style="transform:translateY(${rank.get(p.id) * ROW}px);--d:${rank.get(p.id) * 60}ms">
      ${img(p.championId)}
      <div class="bar"><i style="width:${((value(p) / max) * 100).toFixed(1)}%"></i><span class="bname">${esc(p.name || champName(p.championId))}<small>${p.kills}/${p.deaths}/${p.assists}</small></span></div>
      <b class="bval">${num(value(p), 'int', 0)}</b>
    </div>`).join('');
  const augs = me.augments.map((id) => r.augments?.[id]).filter(Boolean);
  const augRow = augs.length
    ? `<div class="augs">${augs.map((a) => `<span class="aug ${esc(a.rarity)}">${a.icon ? `<img src="${esc(a.icon)}" alt="">` : ''}${esc(a.name)}</span>`).join('')}</div>`
    : '';
  return `<div class="label"><span>${r.demo ? 'Récap d’exemple' : 'Ta dernière partie'}</span><b>${clock(r.duration)}</b></div>
    <section class="recap ${r.win ? 'win' : 'loss'}">
      <div class="recap-head">${img(me.championId, 'portrait')}<div>
        <div class="recap-title">${r.win ? 'Victoire' : 'Défaite'} · ${esc(champName(me.championId))}</div>
        <div class="small muted">${me.kills}/${me.deaths}/${me.assists} · ${myRank === 1 ? 'n°1' : `${myRank}e`} en ${METRICS[metric].toLowerCase()} sur 10</div>
      </div></div>
      ${augRow}
      <div class="metrics">${Object.entries(METRICS).map(([k, label]) => `<button data-metric="${k}" class="${k === metric ? 'on' : ''}">${label}</button>`).join('')}</div>
      <div class="bars" style="height:${r.players.length * ROW}px">${rows}</div>
      <p class="note">Dégâts aux champions, dégâts encaissés (atténués compris), soins et or, tels que le client les enregistre en fin de partie.</p>
    </section>`;
}

// The public page without a group link: what it is, and the download for Windows.
function renderLanding() {
  const pc = `<section class="tile"><div class="tile-title">Sur ton PC Windows</div>
      <p>Un seul fichier à lancer avant de jouer. Il lit ta sélection dans le client LoL (lecture seule) et se met à jour tout seul.</p>
      <div class="buttons"><a class="button primary" href="${DOWNLOAD}">Télécharger LoL Draft Coach</a></div>
      <p class="small muted">Windows va prévenir (fichier non signé) : « Informations complémentaires », puis « Exécuter quand même ». Colle ensuite le lien du groupe dans la page qui s'ouvre.</p>
    </section>`;
  const phone = `<section class="tile"><div class="tile-title">Sur ton téléphone</div>
      <p>Ouvre le lien du groupe envoyé par Thomas : tu y verras ta draft en direct, quand ton PC ou celui d'un pote de ta partie a le programme lancé.</p>
    </section>`;
  return `<section class="wait"><h1>LoL Draft Coach</h1><p>Les meilleurs choix pendant ta sélection des champions et ton build en partie, pour toi et tes potes.</p></section>
    ${onWindows ? pc + phone : phone + pc}
    <p class="note"><a href="${REPO}">Le projet sur GitHub</a></p>
    <p class="legal">${LEGAL}</p>`;
}

const pcBanner = () => (remote && onWindows
  ? `<div class="demo-bar"><span>Sur ce PC ? Lance le programme pour avoir tes propres conseils.</span><a class="button" href="${DOWNLOAD}">Télécharger</a></div>`
  : '');

const updateBanner = () => {
  const u = state?.update;
  if (!u || u.status === 'ready' || u.status === 'failed') return '';
  return `<div class="demo-bar step"><span>Mise à jour vers la version ${esc(u.version)}… la page revient toute seule.</span></div>`;
};

function renderAvoid(a) {
  if (!a.avoid?.length) return '';
  const rows = a.avoid.map((t) => `<div class="arow"><span class="trap">${mini(t.championId)}<span class="aname">${esc(champName(t.championId))}</span></span>
      <div class="abody"><span class="pill down">${esc(t.reason)} ${pts(t.delta)}</span>${t.warn ? `<span class="muted small">${esc(t.warn)}</span>` : ''}</div></div>`).join('');
  return `<div class="label"><span>À éviter ici</span><b>pièges de cette draft</b></div><section class="analysis">${rows}</section>`;
}

const LEARN = { go: ['up', 'Bon moment'], maybe: ['amber', 'Jouable'], no: ['down', 'Pas ce soir'], offrole: ['flat', 'Autre poste'] };
function renderLearn(a) {
  if (!a.learn?.length) return '';
  const rows = a.learn.map((l) => {
    const [cls, word] = LEARN[l.verdict] ?? LEARN.offrole;
    return `<div class="arow"><span class="trap">${mini(l.championId)}<span class="aname">${esc(champName(l.championId))}</span></span>
      <div class="abody"><span class="pill ${cls}">${word}</span><span class="muted small">${esc(l.text)}</span></div></div>`;
  }).join('');
  return `<div class="label"><span>Tes champions à apprendre</span></div><section class="analysis">${rows}</section>`;
}

// Two parts: the choice itself, and the reading of the draft (side by side on a PC).
function renderAdvice(d, a) {
  if (!a) return { main: '', side: '' };
  const note = a.note ? `<p class="note">${esc(a.note)}</p>` : '';
  if (!a.options?.length) return { main: note, side: '' };
  const flat = Boolean(a.flat);
  const aram = d.kind === 'aram';
  let title = 'Tes meilleurs choix';
  let right = 'chance de gagner';
  if (d.myTurn === 'ban') [title, right] = ['Bans conseillés', 'gain estimé'];
  if (aram) [title, right] = ['Ton champion et le banc', 'winrate du mode'];
  if (a.verb === 'Verrouillé') title = 'Ton champion';
  if (a.allClose) right = '≈ les 3 se valent';
  if (flat) right = '';
  const topP = Math.max(...a.options.map((o) => o.p ?? -1));
  const best = (o) => (aram ? o.championId === a.focus : o.p != null && o.p === topP) && a.options.length > 1;
  const cards = a.options.map((o) => card(o, { flat, best: best(o), precise: aram })).join('');
  const legend = aram && flat
    ? ''
    : aram
    ? '<p class="legend">Winrate de chaque champion dans le mode, tel que la source le publie. On ne te conseille de changer que pour au moins un point de plus.</p>'
    : !flat && d.myTurn !== 'ban' && a.options.some((o) => o.p != null)
      ? '<p class="legend">Ligne blanche = 50 %. Un point de plus = une victoire de plus sur 100 parties. Entre deux bons choix, l’écart est souvent de 1 à 4 points.</p>'
      : '';
  // Your hover is shown apart only when it is not already one of the cards.
  const hoverShown = a.hover && a.options.some((o) => o.championId === a.hover.championId);
  const refCard = a.hover && !hoverShown
    ? `<div class="label"><span>Ton survol dans le client</span>${a.hover.trap ? '<b class="danger">mauvais choix ici</b>' : ''}</div>${card(a.hover, { ref: true })}`
    : a.current && !a.options.some((o) => o.championId === a.current.championId)
      ? `<div class="label"><span>Ton champion</span></div>${card(a.current, { ref: true, flat })}`
      : '';
  return {
    main: `<div class="label"><span>${title}</span><b>${esc(right)}</b></div>${cards}${legend}${refCard}`,
    side: `${renderAvoid(a)}${renderLearn(a)}${renderAnalysis(a.analysis, {
      // The locked champion's card already shows the same win chance.
      hideOverall: a.options.length === 1 && a.options[0].championId === a.analysis?.championId,
      hover: Boolean(a.hover) && a.hover.championId === a.analysis?.championId && a.options[0]?.championId !== a.hover.championId,
    })}${note}`,
  };
}

// ARAM: why keep or take, in one line, from the numbers on the cards.
function aramWhy(a) {
  const focus = a?.options?.find((o) => o.championId === a.focus);
  const mine = a?.options?.find((o) => o.mine);
  if (!focus || !mine || a.flat) return '';
  const gap = (x) => `${pts(x)} pt${x >= 0.0195 ? 's' : ''}`;
  if (a.verb === 'Prends') return `${gap(focus.p - mine.p)} par rapport à ${champName(mine.championId)} · prends-le avant les autres`;
  const next = a.options.filter((o) => !o.mine && !o.takenBy).sort((x, y) => y.p - x.p)[0];
  if (next && next.p > mine.p) return `${champName(next.championId)} à peine mieux (${gap(next.p - mine.p)}) : comme tu préfères`;
  return 'rien de mieux sur le banc';
}

// The page is patched in place, not rebuilt: images stay loaded, the field being typed in
// keeps its text, bars slide to their new width and numbers count to their new value.
function paint(html) {
  Idiomorph.morph(app, html, { morphStyle: 'innerHTML', ignoreActiveValue: true });
  countUp();
  glide();
}

// Charts: <path class="tw" data-pts="[[x,y],…]" data-base="60">. A new point slides in from
// the last one and the whole curve eases to its new scale, instead of jumping.
function pathOf(points, base) {
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  return base == null || !points.length ? line : `${line}L${points.at(-1)[0].toFixed(1)},${base}L${points[0][0].toFixed(1)},${base}Z`;
}
function glide() {
  for (const el of app.querySelectorAll('path.tw[data-pts]')) {
    const to = JSON.parse(el.dataset.pts);
    const base = el.dataset.base != null ? Number(el.dataset.base) : null;
    const from = el.pts;
    el.pts = to;
    if (!motion || !from?.length) {
      el.setAttribute('d', pathOf(to, base));
      continue;
    }
    const start = performance.now();
    const run = (now) => {
      if (el.pts !== to) return;
      const k = Math.min(1, (now - start) / 700);
      const e = 1 - (1 - k) ** 3;
      const mid = to.map(([x, y], i) => {
        const [fx, fy] = from[Math.min(i, from.length - 1)];
        return [fx + (x - fx) * e, fy + (y - fy) * e];
      });
      el.setAttribute('d', pathOf(mid, base));
      if (k < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }
}

// <b class="n" data-n="0.573" data-f="pct">57</b>: shown values glide to the new one.
const FORMATS = {
  pct: (v) => String(Math.round(v * 100)),
  pct1: (v) => (v * 100).toFixed(1).replace('.', ','),
  pts: (v) => pts(v),
  int: (v) => Math.round(v).toLocaleString('fr-FR'),
  k: (v) => `${v >= 0.05 ? '+' : v <= -0.05 ? '−' : ''}${Math.abs(v / 1000).toFixed(1).replace('.', ',')} k`,
};
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp() {
  for (const el of app.querySelectorAll('.n[data-n]')) {
    const to = Number(el.dataset.n);
    const from = el.shown ?? (el.dataset.from != null ? Number(el.dataset.from) : to);
    const format = FORMATS[el.dataset.f] ?? FORMATS.int;
    el.shown = to;
    if (!motion || from === to || !Number.isFinite(from)) {
      el.textContent = format(to);
      continue;
    }
    const start = performance.now();
    const run = (now) => {
      if (el.shown !== to) return; // a newer value took over
      const k = Math.min(1, (now - start) / 650);
      el.textContent = format(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }
}
const num = (v, f, from) => `<b class="n" data-n="${v}" data-f="${f}"${from != null ? ` data-from="${from}"` : ''}>${FORMATS[f](v)}</b>`;

function render() {
  if (hosted && !remote) {
    paint(renderLanding());
    return;
  }
  if (state?.game) {
    paint(renderGame());
    return;
  }
  if (state?.plan && ['GameStart', 'InProgress'].includes(state.gameflow)) {
    paint(renderLoading());
    return;
  }
  if (remote && !state) {
    paint(renderGroupWaiting());
    return;
  }
  if (state?.status !== 'champ-select' || !state.draft) {
    paint(renderWaiting());
    return;
  }
  const d = state.draft;
  const a = state.advice;
  const me = d.allies.find((p) => p.me);
  const h = headline(d, a, me);
  const mode = state.queue?.name || QUEUES[d.queueId] || 'Partie';
  const sub = [turnNote(d, a), ROLE_NAMES[me?.role], mode].filter(Boolean).join(' · ');
  const who = state.demo?.profile === 'real' ? 'ton profil' : 'un profil d’exemple (ouvre le client LoL pour le tien)';
  const demo = !state.demo
    ? ''
    : remote
      ? `<div class="demo-bar${state.demo.caption ? ' step' : ''}"><span>${esc(state.demo.caption ?? 'Démo lancée depuis le PC de l’hôte')}</span></div>`
      : state.demo.caption
        ? `<div class="demo-bar step"><span>${esc(state.demo.caption)}</span><button data-demo="next">Continuer</button></div>`
        : `<div class="demo-bar"><span>Démo d’une de tes vraies sélections, avec ${who}</span><button data-demo="stop">Arrêter</button></div>`;
  const { main, side } = renderAdvice(d, a);
  paint(`${renderPeople()}${demo}
    <header class="head">
      <div><h1 class="${h.mine ? 'mine' : ''} ${h.text.length > 14 ? 'long' : ''} ${fresh(h.text)}">${esc(h.text)}</h1><div class="sub"><i class="dot"></i>${esc(sub)}</div></div>
      <div class="ring" id="ring"><svg viewBox="0 0 58 58"><circle class="track" cx="29" cy="29" r="25"/><circle class="left" cx="29" cy="29" r="25" stroke-dasharray="157.1" stroke-dashoffset="0"/></svg><span></span></div>
    </header>
    <div class="cols"><div class="col">${renderGrid(d, a)}${main}</div><div class="col">${side}</div></div>
    <p class="legal">${LEGAL}</p>`);
  tick();
}

app.addEventListener('click', (e) => {
  const pickMetric = e.target.closest('[data-metric]');
  if (pickMetric) {
    metric = pickMetric.dataset.metric;
    render();
    return;
  }
  const button = e.target.closest('[data-demo]');
  if (button) {
    fetch(`/demo/${button.dataset.demo}`, { method: 'POST' });
    return;
  }
  const person = e.target.closest('[data-me]');
  if (person) {
    storage.set('ldc-me', person.dataset.me);
    showRemote();
    return;
  }
  const unlearn = e.target.closest('[data-unlearn]');
  if (unlearn) {
    saveLearning((state.settings?.learning ?? []).filter((id) => id !== Number(unlearn.dataset.unlearn)));
    return;
  }
  const copy = e.target.closest('[data-copy]');
  if (copy) {
    navigator.clipboard?.writeText(copy.dataset.copy).then(() => (copy.textContent = 'Lien copié'));
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

function saveLearning(learning) {
  fetch('/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ learning }) });
}

app.addEventListener('submit', async (e) => {
  const join = e.target.closest('[data-join-form]');
  if (join) {
    e.preventDefault();
    const res = await fetch('/group/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link: join.link.value.trim() }) }).then((r) => r.json());
    join.link.value = res.ok ? '' : res.error;
    if (res.ok) phone = await fetch('/phone').then((r) => r.json());
    if (state) onState({ ...state });
    return;
  }
  const form = e.target.closest('[data-learn-form]');
  if (!form) return;
  e.preventDefault();
  const name = form.champ.value.trim().toLowerCase();
  const id = Object.entries(state?.champions ?? {}).find(([, c]) => c.name.toLowerCase() === name)?.[0];
  if (id) saveLearning([...(state.settings?.learning ?? []), Number(id)]);
  form.reset();
});

function tick() {
  for (const el of app.querySelectorAll('[data-until]')) {
    const left = Math.max(0, Math.ceil((Number(el.dataset.until) - Date.now()) / 1000));
    const text = el.dataset.clock ? clock(left) : `${left} s`;
    if (el.textContent !== text) el.textContent = text;
  }
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
  const key = JSON.stringify([state.following, state.status, state.gameflow, state.summoner, state.queue, state.demo, d && { ...d, timeLeftMs: 0 }, state.advice, phone?.url, people.map((p) => p.name), state.settings, state.game, state.recap, state.profileSummary, phone?.group, state.group, state.plan, state.update]);
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

// --- Group mode: every companion of the group publishes its drafts to the relay ---

let people = [];
const players = new Map();

// Who can be followed: each companion's own player, plus the allies it computes advice for
// (a friend running their own companion is preferred over a view computed by someone else).
function showRemote() {
  const now = Date.now();
  const entries = new Map();
  for (const msg of players.values()) {
    if (now - (msg.sentAt ?? 0) > STALE_MS) continue;
    const views = msg.views?.length ? msg.views : [{ name: msg.name, self: true, draft: null, advice: null }];
    for (const view of views) {
      const name = view.self ? msg.name : view.name;
      const current = entries.get(name);
      if (!current || (view.self && !current.view.self)) entries.set(name, { name, msg, view });
    }
  }
  people = [...entries.values()].sort((a, b) => Number(b.view.self) - Number(a.view.self));
  if (!people.length) return onState({ status: 'group-empty', remote: true });
  const wanted = storage.get('ldc-me');
  const pick = people.find((p) => p.name === wanted) ?? people[0];
  const { msg, view } = pick;
  onState({
    following: wanted && pick.name !== wanted ? pick.name : null,
    status: view.draft ? 'champ-select' : msg.status,
    gameflow: msg.gameflow,
    summoner: { gameName: pick.name },
    queue: msg.queue,
    draft: view.draft,
    advice: view.advice,
    game: view.self ? msg.game ?? null : null,
    plan: view.self ? msg.plan ?? null : null,
    recap: msg.recap ?? null,
    champions: msg.champions,
    assets: msg.assets,
    demo: msg.demo,
    remote: true,
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
}

async function connectRemote() {
  const { importKey, decode } = await import('./codec.js');
  const key = await importKey(remote.key);
  await loadScript(MQTT_LIB);
  let attempt = 0;
  const start = () => {
    const client = window.mqtt.connect(BROKERS[attempt % BROKERS.length], { reconnectPeriod: 0, connectTimeout: 8000 });
    client.on('connect', () => {
      linkLost.hidden = true;
      client.subscribe(`ldc1/${remote.group}/p/+`);
    });
    client.on('message', async (topic, payload) => {
      const id = topic.split('/').pop();
      if (!payload.length) players.delete(id);
      else {
        try {
          players.set(id, await decode(new Uint8Array(payload), key));
        } catch {
          return; // not for this group key
        }
      }
      showRemote();
    });
    const retry = () => {
      linkLost.hidden = false;
      client.end(true);
      attempt++;
      setTimeout(start, 2000);
    };
    client.on('close', retry);
    client.on('error', () => {});
  };
  start();
  setInterval(showRemote, 5000); // drop companions that went quiet
}

if (onPc && !remote) {
  fetch('/phone')
    .then((r) => r.json())
    .then((p) => {
      phone = p;
      if (state) onState(state);
    })
    .catch(() => {});
}
render();
if (remote) connectRemote().catch(() => (linkLost.hidden = false));
else if (!hosted) connect();
