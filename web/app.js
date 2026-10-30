// Live page: renders one screen per moment of champ select. On the PC it follows the local
// companion over a websocket; opened from the group link (#g=…&k=…) it follows the group
// through the encrypted relay, and each friend picks whose draft to show.

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

function renderPeople() {
  if (!remote || people.length < 2) return '';
  return `<nav class="people">${people.map((p) => `<button data-me="${esc(p.name)}" class="${p.name === state?.summoner?.gameName ? 'on' : ''}">${esc(p.name)}</button>`).join('')}</nav>`;
}

function renderGroupWaiting() {
  if (!people.length) {
    return `<section class="wait"><div class="pulse"></div><h1>En attente du groupe</h1>
      <p>Dès qu'un membre lance le compagnon sur son PC, sa draft apparaît ici toute seule.</p></section><p class="legal">${LEGAL}</p>`;
  }
  const status = (m) => (m.status === 'no-client' ? 'client LoL fermé' : ({ Lobby: 'dans le salon', Matchmaking: 'en recherche de partie', ReadyCheck: 'partie trouvée', InProgress: 'en partie', ChampSelect: 'en sélection' }[m.gameflow] ?? 'connecté'));
  const hosts = [...new Map(people.map((p) => [p.msg.name, p.msg])).values()];
  return `${renderPeople()}<section class="wait"><div class="pulse ok"></div><h1>Groupe connecté</h1>
    <p>${hosts.map((m) => `${esc(m.name)} : ${status(m)}`).join('<br>')}</p>
    <p>Les conseils apparaissent dès la sélection des champions.</p></section><p class="legal">${LEGAL}</p>`;
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
      <div class="buttons"><button data-demo="ranked">Ranked solo</button><button data-demo="aram">ARAM du Chaos</button></div>
    </section>`;
  const qr = onPc && phone?.groupQr
    ? `<section class="tile phone"><div class="qr">${phone.groupQr}</div><div>
        <div class="tile-title">Le lien du groupe</div>
        <p>Scanne-le avec ton téléphone, et envoie-le à tes potes : quand vous jouez ensemble, chacun voit sa propre draft. Rien à installer.</p>
        <div class="buttons"><button data-copy="${esc(phone.group)}">Copier le lien</button></div>
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
  return `<section class="wait">${body}</section>${who}${demo}${learn}${qr}<p class="legal">${LEGAL}</p>`;
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
function renderAnalysis(an) {
  if (!an) return '';
  const row = (label, body) => `<div class="arow"><span class="alabel">${label}</span><div class="abody">${body}</div></div>`;
  const rows = [];
  if (an.lane) {
    rows.push(row('Ta lane', an.lane.opponentId
      ? `${mini(an.lane.opponentId)}<span class="aname">${esc(champName(an.lane.opponentId))}</span>${verdict(an.lane.delta)}<span class="muted small">${an.lane.games.toLocaleString('fr-FR')} parties</span>`
      : `<span class="muted">Ton vis-à-vis n'a pas encore choisi${an.lane.worst ? ` · pire cas ${esc(an.lane.worst.name)} ${pts(an.lane.worst.delta)}` : ''}</span>`));
  }
  if (an.others?.length) {
    rows.push(row('Les autres', an.others.map((o) => `<span class="duo">${mini(o.championId)}<b class="${trend(o.delta, 0.5)}">${pts(o.delta)}</b></span>`).join('')));
  }
  if (an.duos?.length) {
    rows.push(row('Tes duos', an.duos.map((o) => `<span class="duo">${mini(o.championId)}<b class="${trend(o.delta, 0.5)}">${pts(o.delta)}</b></span>`).join('')));
  }
  const { us, them } = an.teams ?? {};
  if (us) {
    rows.push(row('Dégâts', `<div class="teams"><div><span class="tname">Nous</span>${damageBar(us)}</div>${them ? `<div><span class="tname">Eux</span>${damageBar(them)}</div>` : ''}</div>`));
    rows.push(row('Tanks', `<span>Nous <b>${us.tanks}</b></span>${them ? `<span class="sep">·</span><span>Eux <b>${them.tanks}</b></span>` : ''}`));
  }
  if (an.timing) {
    rows.push(row('Durée', `<div class="timing">${an.timing.map((t) => `<span class="tcell"><small>${t.label}</small>${verdict(t.delta, ['Nous', '=', 'Eux']).replace('Nous ', '').replace('Eux ', '')}</span>`).join('')}</div><div class="muted small">${timingVerdict(an.timing)}</div>`));
  }
  if (an.overall) {
    rows.push(row('La partie', `<span class="overall">${pct(an.overall.p)}</span><span class="muted small">chance de gagner · entre ${pct(an.overall.low)} et ${pct(an.overall.high)}</span>`));
  }
  const warnings = [us?.warning, them?.warning ? `Eux : ${them.warning.toLowerCase()}` : '', us && us.size >= 4 && !us.tanks ? 'Aucun tank chez nous' : '']
    .filter(Boolean)
    .map((w) => `<div class="warn">${esc(w)}</div>`)
    .join('');
  return `<div class="label"><span>Analyse de la draft</span><b>avec ${esc(champName(an.championId))}</b></div>
    <section class="analysis">${rows.join('')}${warnings}</section>`;
}

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
  // Your hover is shown apart only when it is not already one of the cards.
  const hoverShown = a.hover && a.options.some((o) => o.championId === a.hover.championId);
  const refCard = a.hover && !hoverShown
    ? `<div class="label"><span>Ton survol dans le client</span>${a.hover.trap ? '<b class="danger">mauvais choix ici</b>' : ''}</div>${card(a.hover, { ref: true })}`
    : a.current
      ? `<div class="label"><span>Ton champion</span></div>${card(a.current, { ref: true, flat })}`
      : '';
  return `<div class="label"><span>${title}</span><b>${esc(right)}</b></div>${cards}${legend}${refCard}${renderAvoid(a)}${renderLearn(a)}${renderAnalysis(a.analysis)}${a.note ? `<p class="note">${esc(a.note)}</p>` : ''}`;
}

function render() {
  if (remote && !state) {
    app.innerHTML = renderGroupWaiting();
    return;
  }
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
    : remote
      ? `<div class="demo-bar${state.demo.caption ? ' step' : ''}"><span>${esc(state.demo.caption ?? 'Démo lancée depuis le PC de l’hôte')}</span></div>`
      : state.demo.caption
        ? `<div class="demo-bar step"><span>${esc(state.demo.caption)}</span><button data-demo="next">Continuer</button></div>`
        : `<div class="demo-bar"><span>Démo d’une de tes vraies sélections, avec ${who}</span><button data-demo="stop">Arrêter</button></div>`;
  app.innerHTML = `${renderPeople()}${demo}
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

app.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-learn-form]');
  if (!form) return;
  e.preventDefault();
  const name = form.champ.value.trim().toLowerCase();
  const id = Object.entries(state?.champions ?? {}).find(([, c]) => c.name.toLowerCase() === name)?.[0];
  if (id) saveLearning([...(state.settings?.learning ?? []), Number(id)]);
  form.reset();
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
  const key = JSON.stringify([state.status, state.gameflow, state.summoner, state.queue, state.demo, d && { ...d, timeLeftMs: 0 }, state.advice, phone?.url, people.map((p) => p.name), state.settings]);
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
    status: view.draft ? 'champ-select' : msg.status,
    gameflow: msg.gameflow,
    summoner: { gameName: pick.name },
    queue: msg.queue,
    draft: view.draft,
    advice: view.advice,
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
else connect();
