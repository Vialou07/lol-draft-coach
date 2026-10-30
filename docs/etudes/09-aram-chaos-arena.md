# 09 — ARAM du Chaos (KIWI / 2400) et Arena (CHERRY) : mécaniques, données, scoring

Recherche du 2026-10-30, patch 16.21 (Riot et les sites l'appellent « 26.21 », Data Dragon/LCU « 16.21 » : c'est le même patch, notes publiées le 2026-10-20).
Légende : **[VÉRIFIÉ]** = source primaire ou donnée récupérée moi-même ; **[INFÉRENCE]** = déduit de données vérifiées ; **[HYPOTHÈSE]** = non confirmé, à tester sur un vrai log client.

## 0. Ce qu'il faut retenir

- **Match-V5 ne sert PAS les parties ARAM du Chaos.** Elles renvoient 403 et n'apparaissent pas dans `/matches/by-puuid/{puuid}/ids`. Le ticket Riot a été fermé « is working » : « Mayhem matches are private ». On ne pourra pas calculer de winrates via l'API officielle. [VÉRIFIÉ]
- Les données Mayhem accessibles par programme ne sont pas européennes. arammayhem.com publie des winrates Tencent/Chine (MCP public) et des pickrates sous CC BY. Les sites qui ont des données EUW (u.gg, metasrc, blitz, mobalytics) bloquent les accès automatiques (403 Cloudflare).
- **L'Arena du patch 16.21 se joue en 3x6** (6 équipes de 3, file 1750 « Arena 3x6 »). En 3x6, une « victoire » veut dire finir dans le top 3. [INFÉRENCE forte]
- Pour l'Arena, Match-V5 fonctionne, avec les champs `playerAugment1..6`, `playerSubteamId`, `subteamPlacement` et `placement`. Lolalytics publie aussi l'Arena au patch 16.21 (Emerald+, environ 78 000 parties).
- **Le plus gros levier mesurable, c'est le champion lui-même** : environ ±7 points de winrate en Mayhem, environ ±6 en Arena. Les effets de composition sont faibles et mal documentés.

## 1. ARAM : Mayhem (ARAM du Chaos, gameMode KIWI)

### 1.1 Statut
- Sorti le 2025-10-22 (V25.21) comme mode temporaire, puis prolongé. [VÉRIFIÉ, wiki]
- Riot Support (maj 2026-10-21) : « ARAM: Mayhem will stick around until further notice. » Pas de date de fin, mais pas de « permanent » non plus. [VÉRIFIÉ]
- Release en cours : « Journey to Stardom » (26.21), qui introduit les **Headliners**. [VÉRIFIÉ]

### 1.2 Identifiants côté client
D'après `queues.json` de CommunityDragon (version 16.21.8298620) [VÉRIFIÉ] :

| queueId | Nom | Remarque |
|---|---|---|
| 2400, 2401, 2403, 2405 | ARAM: Mayhem | pickMode `AllRandomPickStrategy` (comme l'ARAM 450) |
| 2410 | ARAM: Mayhem Tournament | |
| 2450 | ARAM: Mayhem Classic-ish | file limitée, 60 champions, 29/07 → 24/08/2026 |
| 3240, 3270, 3280 | Mayhem en partie personnalisée | |

- Le `queues.json` officiel de Riot liste aussi 2400 « ARAM: Mayhem ». [VÉRIFIÉ]
- Le mapId 12 s'appelle désormais « Random Map » (rotation des cartes ARAM). Au 26.21, Butcher's Bridge et Koeshin's Crossing sont désactivées en Mayhem, retour prévu au 26.22. [VÉRIFIÉ]
- Le companion doit identifier le mode par `queueId ∈ {2400, 2401, 2403, 2405}` ou `gameMode == "KIWI"`, pas par le mapId.

### 1.3 Champ select
Règles ARAM depuis le patch 25.13 (Riot Support ARAM, page du 2026-03-24 ; notes 25.13 ; wiki) [VÉRIFIÉ] :
- **Il n'y a plus de rerolls.** Chaque joueur reçoit 2 « cartes champion » et a 12 s pour en choisir une. La carte non choisie part sur le **banc** de l'équipe.
- Une 3e carte (« Blessing », icône bleue) apparaît avec une probabilité de 5 % + 0,15 % par champion possédé (environ 30 % pour un compte complet).
- Pendant la révélation, on peut reprendre une de ses propres cartes. Les cartes des alliés restent verrouillées jusqu'à la phase de finalisation (45 s), pendant laquelle tout le banc s'ouvre. Il y a un cooldown de 3 s entre deux swaps.
- On ne peut prendre sur le banc qu'un champion de **son propre pool** : ses champions possédés plus ceux des 5 dernières rotations gratuites.
- Les alliés peuvent s'échanger des champions (trades), avec l'accord des deux.
- Les équipes ne voient ni les picks ni le banc adverses. Un champion ne peut pas apparaître dans les deux équipes. Pas de bans.

Ces règles collent à ce que montrent tes logs : `rerollsRemaining=0` et un banc de 5 à 8 champions. Le banc contient 5 cartes non choisies, plus une par joueur « béni » (donc 5 à 10). [INFÉRENCE]

Mayhem utilise très probablement ce système : même pickMode que l'ARAM, récompense de progression « Blessed Card+ » (extrait de recherche Riot Support, absente de la version actuelle de la page), et LoL Theory (2026-08-25) dit « same as standard ARAM ». [INFÉRENCE]

**Correspondance LCU** (swagger hasagi-types, client 16.21.829.8620) [VÉRIFIÉ pour les schémas] :
- `GET /lol-champ-select/v1/session` : `queueId`, `benchEnabled`, `benchChampions[{championId,isPriority}]`, `allowRerolling`, `rerollsRemaining`, `allowSubsetChampionPicks`, `myTeam[{cellId,championId,puuid,team,…}]`, `theirTeam`, `trades[]`, `timer{phase,adjustedTimeLeftInPhase}`, `localPlayerCellId`, `hasSimultaneousPicks`, `hasSimultaneousBans`.
- `POST /lol-champ-select/v1/session/bench/swap/{championId}` ; `/session/champion-swaps/{id}/request|accept|decline`.
- `GET /lol-champ-select/v1/pickable-champion-ids` sert à filtrer le banc par le pool du joueur.
- `GET /lol-lobby-team-builder/champ-select/v1/subset-champion-list` renvoie un `int[]`. **[HYPOTHÈSE]** Ce pourrait être les 2 ou 3 cartes offertes. De même, `isPriority` pourrait marquer ses propres cartes pendant la révélation. À loguer pendant les 12 premières secondes.

### 1.4 Ce qui change la force des champions en jeu [VÉRIFIÉ, wiki + Riot Support + notes de patch]
- **Augments** : 4 sélections, au départ (niveau 3) puis aux niveaux 7, 11 et 15. On choisit parmi 3 offres, chacune rerollable une fois. Le rang (Argent, Or, Prismatique) est tiré au hasard mais **commun à tous les joueurs**, et on ne peut choisir que dans la fontaine ou mort.
- Depuis le patch 26.12, il y a des Ability Augments (qui améliorent un sort précis) et des Quest Augments. Les Traits ont été supprimés.
- **Runes désactivées**, Exhaust interdit, Presence of Mind pour tout le monde, Nexus à 3000 PV : les parties sont plus courtes.
- Il existe des **modificateurs par champion** propres au mode.
- **Headliners** (26.21) : un par partie, inconnu pendant le champ select (ex. or au centre, enclumes sur les éliminations, augment bonus).
- Conséquence : la force d'un champion dépend de ses augments, pas seulement de son kit ARAM. Il faut des stats **propres au mode et au patch** (26.21 : 35 augments ajoutés, 13 retirés).

## 2. Arena (CHERRY, mapId 30)

### 2.1 Statut et format
- L'Arena est revenue au patch 25.13 « pour au moins 12 mois ». Elle reçoit toujours des équilibrages au patch 26.21. [VÉRIFIÉ]
- La Saison 2 2026 a introduit des événements : 3x6, Bravery, Swift Arena (2 équipes de 4) et « No Event ». Les notes 26.9 présentent le 3x6 au patch 26.10 : « three players on each team with a total of six teams ». Les notes 26.12 disent « Arena 3x6 has been going strong ». [VÉRIFIÉ]
- Files (CDragon 16.21) : 1700 et 1710 « Arena », 1740 « Bravery Arena », 1750 « Arena 3x6 ». Toutes en pickMode `SimulPickStrategy`. [VÉRIFIÉ]
- Format en direct au 16.21 : lolalytics affiche 6 places pour Ahri (21,6 / 19,6 / 17,3 / 15,6 / 13,7 / 12,1 %), et le top 3 (58,5 %) correspond à son « Win » (58,56 %). op.gg Arena 16.21 n'affiche que des **trios**. Donc 3x6, victoire = top 3, place moyenne 3,5. [INFÉRENCE forte] Le wiki (« Current event V26.09: 8×2 ») est périmé. Lire la taille d'équipe dans la session, ne pas la coder en dur.

### 2.2 Champ select
- Wiki (époque 8×2) : « 16-blind-ban blind pick ». 10 s d'intention de pick visible par les coéquipiers, **25 s de bans simultanés (1 par joueur)**, **40 s de picks simultanés**, 10 s de finalisation ; sélections révélées à la fin de chaque phase. [VÉRIFIÉ pour le wiki ; transposition au 3x6 = INFÉRENCE]
- On voit les intentions de ses coéquipiers, mais **rien des adversaires** avant la fin de la phase. Les bans adverses, révélés avant les picks, servent seulement à exclure des champions.
- Le duo ou trio prémade est connu dès le lobby : `LolLobbyLobbyParticipantDto.subteamIndex` et `intraSubteamPosition`. [VÉRIFIÉ, schéma]
- Bonus : « Crowd Favorites » (enclume de stats et Fame ; `GET /lol-lobby-team-builder/champ-select/v1/crowd-favorte-champion-list` → `int[]`, faute d'orthographe d'origine Riot) et option Bravery (champion aléatoire, enclume, 2 rerolls, or). [VÉRIFIÉ pour le schéma ; bonus d'après dodge.gg, 2026-03-23]
- Unicité des champions dans tout le lobby : non confirmée. En 2023, les doublons entre équipes étaient permis. [HYPOTHÈSE]
- **Je n'ai trouvé aucun log de session Arena publié.** Il faut capturer `session` (myTeam, theirTeam, actions, bans, hasSimultaneous*) sur une vraie partie.

### 2.3 Mécaniques en jeu [VÉRIFIÉ, wiki/dodge.gg]
- Augments aux manches 1, 5, 8 et 11 (jusqu'à 6), 4 rerolls, enclume prismatique à la manche 3, votes « Guest of Honor » aux manches 2 et 8.
- Profils qui marchent : sustain, accès aux cibles, contrôle de zone (tank + carry, enchanteur + hypercarry).

## 3. Sources de statistiques

| Source | Mode | Accès programmatique | Contenu confirmé |
|---|---|---|---|
| **arammayhem.com MCP** `POST https://arammayhem.com/mcp` (JSON-RPC, outil `get_tier_list`, args `limit≤30, offset, role, locale`) | Mayhem | Oui, sans clé, 60 req/min/IP | Champs `dataDate`, `patch`, `total`, `entries[{championId, name, tier, winRate:"54.49%", pickRate, url}]`. Patch 26.21, données du 2026-10-29, 173 champions. **Source : « Tencent China public statistics » (même chiffres qu'aramgg.com), pas EUW, pas de nombre de parties.** |
| arammayhem.com dataset `https://arammayhem.com/data/v1/{latest\|26-21}/champions.json` (+ `augments`, `combos`, `items`, CSV ; index `/data/v1/index.json`) | Mayhem | Oui, **CC BY 4.0**, attribution « Data: arammayhem.com » | `rows[{championId, pickRate, pickRateRank, previousPickRate, pickRateChange…}]`. **Pickrates seulement, licence explicitement sans winrates.** |
| op.gg | Mayhem, Arena (duo + trio) | Les pages SSR ne contiennent que tier et rang ; le MCP officiel `https://mcp-api.op.gg/mcp` ne propose que `game_mode ∈ {ranked, flex, urf, aram, nexus_blitz}` (pas Mayhem ni Arena), plus `lol_list_aram_augments{champion_id}` → `augments[{id,name,tier,performance,popular}]` | Arena 16.21 : trios avec place moyenne, % de 1re place, WR et parties (40 à 188 parties pour les meilleurs trios). Mayhem : filtres serveur EUW et rang ; les données viennent de leur appli. |
| lolalytics `https://lolalytics.com/lol/tierlist/arena/`, `/lol/{champ}/arena/build/` | **Arena seulement** (`/tierlist/mayhem/` → 404) | HTML SSR (Qwik), aucune API documentée, robots `Allow`, content-signal `use=reference, ai-train=no` | Arena 16.21 Emerald+ : WR (= top 3), pick, ban, parties (Ahri 10 093) ; 1 409 136 entrées-champion. Synergies de coéquipiers chargées côté client. Définition : *Synergy Delta = WR ensemble − (WR A + WR B)/2*. |
| metasrc | Mayhem (par région, ex. 29 132 parties), Arena (synergies) | **Non** : robots `Disallow: /api/`, 403 | — |
| u.gg, blitz.gg, mobalytics | Mayhem, Arena, arena-duo | **Non** : 403 Cloudflare | Mobalytics indique ne pas avoir de vraies données Mayhem (ARAM + notes d'augments). |
| metabot.gg | Arena (duos/trios) | Non testé | Échantillons minuscules (14 à 34 parties par duo). |

Conclusion : pour Mayhem, aucune source EUW avec effectifs n'est exploitable légitimement par un script. Pour l'Arena, lolalytics ou un calcul maison via Match-V5 suffisent.

## 4. Match-V5 et volume

- **Mayhem** :
  - Ticket #1109 (ouvert par metasrc le 2025-10-22, fermé le 2025-12-18 avec le label « closed: is working ») : « Expected behavior. Mayhem matches are private. »
  - Ticket #1204 (2026-10-28, toujours ouvert) : `by-puuid/ids` omet les parties Mayhem, et `matches/{id}` renvoie 403.
  - Un commentateur, sans badge Riot : « they don't want people generating win rates ».
  - Il existe des accès autorisés au cas par cas pour certains sites (#1154).
  - **Seule voie technique restante : l'historique local LCU.** `GET /lol-match-history/v1/products/lol/{puuid}/matches?begIndex&endIndex` et `/lol-match-history/v1/games/{gameId}`. Les participants y ont `playerAugment1..6`, `playerSubteamId`, `subteamPlacement`, et la partie a `gameModeMutators`. [VÉRIFIÉ, schéma]
  - Un projet (Lanternko/ARAM-Mayhem-Database, MIT) dit avoir collecté plus de 30 000 parties 2400 en élargissant à partir de « seed players ». **Attention** : explorer massivement l'historique d'autres joueurs contourne le choix explicite de Riot. Je recommande de se limiter aux parties du groupe.
- **Arena** : les champs de ParticipantDto (`placement`, `playerSubteamId`, `subteamPlacement`, `playerAugment1..6`) et le filtre `queue` existent [VÉRIFIÉ, schéma riotapi-schema]. Lolalytics, qui n'a pas d'appli de bureau, publie l'Arena 16.21 : Match-V5 sert donc l'Arena. [INFÉRENCE]
- **Clé personnelle** : 20 req/s et 100 req/2 min, autorisée pour une « small private community » [VÉRIFIÉ, portail Riot]. Ça fait au plus environ 70 000 requêtes par jour, donc environ 30 000 parties par jour en comptant les listes d'ID.
- **Effectifs nécessaires** : erreur type = √(p(1−p)/n), soit ±5 points à n = 100, ±2,5 à n = 400, ±1 à n = 2 500.
  - Mayhem : 10 champions par partie, pickrate de 1 à 14 %. Un champion à 2 % demande environ 20 000 parties pour 400 apparitions, et plus de 100 000 pour ±1 point.
  - Arena 3x6 : 18 champions par partie (un champion moyen apparaît dans environ N/9,6 parties). Environ 20 000 parties pour des tiers grossiers ; 10 à 50 fois plus pour les paires.
  - Les quelques centaines de parties du groupe **ne suffiront jamais pour des winrates de champions**, seulement pour la maîtrise personnelle et le calibrage.

## 5. Ce que le recommandeur doit pondérer

### 5.1 ARAM du Chaos
Choix possibles : garder son champion, prendre sur le banc (dans son pool) ou échanger avec un allié. Pas d'ennemis visibles, pas de bans. On peut donc **optimiser l'affectation sur toute l'équipe** (quelques centaines de combinaisons au plus) et suggérer des trades entre amis.

Score pour un joueur p et un champion c, en log-odds :
1. **Force du champion dans le mode** (poids principal). Écart mesuré : 44,3 % (K'Sante) à 58,1 % (Yasuo), soit **±7 points** (Tencent, 26.21).
   - À rétrécir vers 50 % (bêta-binomial, k ≈ 300 à 500 parties équivalentes) car il n'y a ni effectifs ni données EUW.
   - Le pickrate y est très corrélé au winrate : les champions forts sont pris sur le banc par des joueurs qui les ont choisis. Biais de sélection à atténuer. [HYPOTHÈSE]
   - Utiliser le winrate, pas le tier « S+ » (Teemo 54,5 % classé devant Yasuo 58,1 %).
2. **Maîtrise du joueur** : parties et winrate sur le champion en ARAM/Mayhem (historique LCU), maîtrise.
   - Rétrécir fortement (k ≈ 20 à 30) vers la force globale.
   - En ranked, l'expérience joueur-champion permet de prédire 75,1 % des issues (Do et al. 2021). En ARAM aléatoire, l'effet est sans doute plus faible. [HYPOTHÈSE]
3. **Composition d'équipe** : au moins un frontliner avec du contrôle, pas plus d'environ 80 % de dégâts d'un seul type, de l'engage ou du désengage, du nettoyage de vagues ou du poke.
   - **Aucun effet de taille publié et fiable.** Seule donnée : un témoignage Reddit dit qu'un modèle basé uniquement sur le draft prédit 55 à 57 % des parties en ARAM.
   - Poids initiaux faibles (1 à 3 points par critère), à apprendre par régression logistique régularisée quand le groupe aura environ 500 parties.
4. **Ignorés en champ select** : Headliner et augments, qui sont aléatoires et inconnus. Le patch compte, car les stats se périment vite.

Affichage : un delta en points de WR par rapport au champion actuel, avec un indicateur de confiance. Ne jamais présenter un écart de moins de 2 points comme décisif.

### 5.2 Arena
Les décisions : 1 ban par joueur, puis un pick à l'aveugle coordonné avec son duo ou trio.
1. **Force du champion** : prendre la place moyenne ou le taux de top 3 par patch. La place moyenne donne plus d'information par partie qu'un résultat binaire. Écart : environ 58 à 60 % pour les meilleurs contre 53 % en moyenne Emerald+ (lolalytics 16.21), soit environ 6 points.
2. **Synergie par paire** : Synergy Delta façon lolalytics, sommée sur les paires du trio, très rétrécie. Les trios op.gg à 64-70 % reposent sur 40 à 188 parties, donc surtout du bruit, sauf quelques archétypes connus (Yi + Yuumi).
3. **Complémentarité des rôles** : tank ou engage avec carry, enchanteur avec hypercarry. Pénaliser les trios sans frontline.
4. **Maîtrise** du joueur, comme pour Mayhem.
5. **Valeur d'un ban** ≈ P(un adversaire le prend s'il n'est pas banni) × gain de place moyenne de ce champion. P ≈ 1 − (1 − pickrate par joueur)^(nombre d'adversaires). Ne jamais bannir un champion que veut un coéquipier. Les bans étant révélés à la fin de leur phase, recalculer les picks juste après.
6. **Bonus Crowd Favorite** (enclume) : léger plus, à estimer.

## 6. À vérifier sur un vrai client (priorité)
1. Mayhem : logger `session`, `subset-champion-list` et `pickable-champion-ids` toutes les 250 ms pendant les 12 premières secondes (où sont les cartes ? que veut dire `isPriority` ?).
2. Arena 1750 : capturer une session complète (`myTeam`, `theirTeam`, `actions`, `bans`, `hasSimultaneousPicks`).
3. Vérifier que l'historique LCU renvoie bien les augments des parties KIWI.

## Sources
- Riot Support, ARAM: Mayhem (maj 2026-10-21) : https://support.riotgames.com/en-us/league-of-legends/events/league-of-legends-aram-mayhem-game-mode
- Riot Support, ARAM (2026-03-24) : https://support.riotgames.com/league-of-legends/gameplay/aram-game-mode
- Notes 25.13 : https://www.leagueoflegends.com/en-au/news/game-updates/patch-25-13-notes/ ; blog dev : https://leagueoflegends.com/en-us/news/dev/dev-all-random-all-mid-blind-bridge
- Notes 26.9 (2026-04-28), 26.12 (2026-06-09), 26.15 (2026-07-28), 26.21 (2026-10-20) : https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-26-21-notes/ (même schéma d'URL)
- Blog dev Mayhem, Traits retirés (2026-05-27) : https://www.leagueoflegends.com/en-us/news/dev/dev-augmentmaxxing-aram-mayhem
- Wiki : https://wiki.leagueoflegends.com/en-us/ARAM:_Mayhem ; https://wiki.leagueoflegends.com/en-us/ARAM ; https://wiki.leagueoflegends.com/en-us/Arena_(League_of_Legends)
- Riot queues/maps : https://static.developer.riotgames.com/docs/lol/queues.json ; CDragon 16.21 : https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/queues.json
- Swagger LCU 16.21 : https://github.com/dysolix/hasagi-types (swagger.json)
- Schéma Riot API : https://www.mingweisamuel.com/riotapi-schema/openapi-3.0.0.json ; limites des clés : https://developer.riotgames.com/docs/portal
- Mayhem privé : https://github.com/RiotGames/developer-relations/issues/1109 , /1154 , /1204 ; https://github.com/Lanternko/ARAM-Mayhem-Database
- arammayhem : https://arammayhem.com/data/ , https://arammayhem.com/use-with-ai/ , https://github.com/arammayhem/arammayhem-mcp ; aramgg : https://aramgg.com/en
- op.gg : https://op.gg/lol/modes/arena , https://op.gg/lol/modes/aram-mayhem , MCP https://github.com/opgginc/opgg-mcp
- lolalytics : https://lolalytics.com/lol/tierlist/arena/ , https://lolalytics.com/lol/ahri/arena/build/
- PCGamesN, événements Arena S2 (2026-04-14) : https://www.pcgamesn.com/league-of-legends/season-2-2026 ; dodge.gg Arena (2026-03-23) : https://www.dodge.gg/en-US/lol/news/arena-guide-2026 ; LoL Theory (2026-08-25) : https://blog.loltheory.gg/aram-mayhem/
- Do et al. 2021 : https://arxiv.org/abs/2108.02799 ; metabot : https://metabot.gg/en/league/arena/duos
