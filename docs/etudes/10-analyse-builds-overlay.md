# 10 · Attributs de compo, stats par elo, builds, données en partie et overlay

Recherche du 30/10/2026, patch 16.21 (Data Dragon 16.21.1), serveur EUW.
Légende : **[V]** vérifié (donnée récupérée ou page lue, URL en fin de document). **[P]** source secondaire ou partielle. **[H]** hypothèse ou proposition.

## L'essentiel

1. **Le client fournit déjà des attributs de compo, sans réseau** : `playstyleInfo` (notes de 1 à 3), `tacticalInfo` et `championTagInfo` (« Initiator », « Ally Protection »…). Meraki est figé depuis le 01/08/2025. [V]
2. **Scores engage, peel, frontline, poke, anti-dive** : un a priori statique, plus le comportement mesuré dans Match-V5, puis une validation par régression. Les « triangles » de compo de la communauté se contredisent : il faut mesurer. [H]
3. **Stats par elo** : u.gg propose 16 tranches et 18 régions en JSON public ; Lolalytics accepte `tier` et `region` (vérifié avec `gold` et `euw`). Dans u.gg `matchups`, les victoires sont celles de **l'adversaire** (revérifié). Chez Lolalytics, `wr` est celui du champion. [V]
4. **Builds** : u.gg `overview` (483 Ko par champion) donne runes, sorts, départ, build cœur, compétences et options d'objets, avec victoires et parties. Lolalytics publie aussi des builds **par matchup**. Aucune source ne publie de winrate d'objet selon la compo adverse. [V]
5. **La Live Client Data API (port 2999) est officielle** et documentée en 2026. Elle donne objets, niveaux et KDA des 10 joueurs, mais l'or seulement pour soi. [V]
6. **Overlay** : une fenêtre séparée, transparente, clics traversants, au premier plan, jeu en mode sans bordure, sans injection ni lecture mémoire. Elle ne touche pas au jeu. **Le risque technique est très faible. Le vrai risque est le contenu** (timers, alertes, info cachée). [V pour les textes, H pour l'évaluation]

---

## 1. Attributs de champions

### 1.1 Client et CommunityDragon [V]

- **Chemins.** LCU : `/lol-game-data/assets/v1/champions/{id}.json`. Miroir : `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/{id}.json`. Leona pèse 55 Ko, `Last-Modified` du 29/09/2026.
- **Clés :** id, name, alias, tacticalInfo, playstyleInfo, championTagInfo, roles, recommendedItemDefaults (vide), passive, spells, skins.
- **Champs de chaque sort :** spellKey, range, cooldownCoefficients, costCoefficients, effectAmounts, ammo, description.

Extrait pour Leona (89) :

```json
"roles": ["tank", "support"],
"tacticalInfo": {"style": 9, "difficulty": 1, "damageType": "kMagic", "attackType": "melee"},
"playstyleInfo": {"damage": 1, "durability": 3, "crowdControl": 3, "mobility": 1, "utility": 1},
"championTagInfo": {"championTagPrimary": "Initiator", "championTagSecondary": "Crowd Control"},
"spells": [{"spellKey": "e", "range": [875, ...], "cooldownCoefficients": [12, 10.5, 9, 7.5, 6]},
           {"spellKey": "r", "range": [1200, ...], "cooldownCoefficients": [90, 75, 60, ...]}]
```

| Champion | durab. | CC | mobil. | utility | dégâts | championTagInfo | style |
|---|---|---|---|---|---|---|---|
| Leona | 3 | 3 | 1 | 1 | 1 | Initiator / Crowd Control | 9 |
| Malphite | 3 | 3 | 1 | 1 | 1 | Initiator / Crowd Control | 8 |
| Janna | 1 | 3 | 1 | 3 | 1 | Crowd Control / Ally Protection | 10 |
| Lulu | 1 | 2 | 1 | 3 | 2 | Ally Protection / Crowd Control | 8 |
| Xerath | 1 | 2 | 1 | 1 | 3 | Long Range / AoE | 9 |
| Zed | 1 | 1 | 3 | 1 | 3 | Burst / Mobile | 6 |
| Jinx | 1 | 2 | 1 | 1 | 3 | Auto-attack / Hypercarry | 2 |
| Zaahen | 2 | 2 | 2 | 1 | 2 | (vide) | 4 |

**Lecture.**
- Les notes sont grossières : Leona et Malphite sont identiques.
- `championTagInfo` est le seul label explicite d'engage ou de peel, mais il est vide pour les champions récents.
- `style` semble aller des attaques de base (Jinx, 2) aux compétences (Janna, 10). [H]
- Le compagnon peut lire les 173 fichiers via le LCU, une fois par patch.

**Data Dragon** `champion.json` : 173 champions, avec `tags`, `info` (attack, defense, magic, difficulty, de 0 à 10) et `stats.attackrange`. [V]

### 1.2 Meraki Analytics [V]

- **Contenu** de `cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/{Nom}.json` :
  - `attributeRatings` (damage, toughness, control, mobility, utility, abilityReliance) ;
  - `roles` avec les **sous-classes Riot** (Leona : SUPPORT, TANK, VANGUARD) ;
  - par compétence : `targeting`, `affects`, `targetRange`, `effectRadius`.
- **Fraîcheur.**
  - `champions.json` : 01/08/2025.
  - `items.json` : 11/02/2026.
  - Dernier commit de `lolstaticdata` : 12/11/2025.
- **Verdict.** Utile pour importer une fois les sous-classes, qui bougent peu. Le wiki reprend leurs définitions : « Vanguards are offensive tanks », « Wardens are defensive tanks », Catcher, Enchanter, Diver, Artillery. Les champions sortis après août 2025 sont à saisir à la main.

### 1.3 Match-V5 : le comportement réel [V pour les champs]

Le schéma Riot contient :
- dans `ParticipantDto` : `timeCCingOthers`, `damageSelfMitigated`, `totalDamageTaken`, `totalHealsOnTeammates`, `totalDamageShieldedOnTeammates`, `physical/magic/trueDamageDealtToChampions` ;
- dans `ChallengesDto` (147 champs) : `damageTakenOnTeamPercentage`, `effectiveHealAndShielding`, `saveAllyFromDeath`, `enemyChampionImmobilizations`, `immobilizeAndKillWithAlly`, `knockEnemyIntoTeamAndKill`, `skillshotsHit`.

### 1.4 Proposition de scores [H]

1. **A priori S (0 à 1)**, tiré du client et de la sous-classe.
2. **Comportement B.** Médiane par 10 minutes de chaque indicateur, pour chaque couple champion × rôle. On la convertit en **percentile dans le rôle**, calculé sur 20 000 à 50 000 parties de la tranche.
3. **Score = (1 − w)·S + w·B**, avec w = N/(N+500). Un champion peu joué reste proche de son étiquette.

| Score | A priori | Comportement (Match-V5) |
|---|---|---|
| Frontline | durability, Tank, Juggernaut, Vanguard, Warden | `damageTakenOnTeamPercentage`, dégâts subis et atténués par minute |
| Engage | Initiator, Vanguard, Diver, Catcher, CC + mobilité | `knockEnemyIntoTeamAndKill`, `immobilizeAndKillWithAlly`, `enemyChampionImmobilizations` |
| Peel | Ally Protection, Enchanter, Warden, utility | `effectiveHealAndShielding`, `saveAllyFromDeath`, `timeCCingOthers` |
| Poke | Long Range, Artillery, sort de dégâts à 1 000 de portée ou plus | `skillshotsHit` (proxy faible) |
| Dégâts | profil réel physique/magique/brut (Lolalytics, DraftGap) | `physical/magic/trueDamageDealtToChampions` |

**Agrégation par équipe.**
- Engage = max + 0,3 × le deuxième.
- Frontline, peel et poke = somme plafonnée.
- **Anti-dive** = peel + 0,5 × CC de l'équipe + mobilité des carrys.

**Ce qui contre quoi.**

| Situation adverse | Draft | Build | Source |
|---|---|---|---|
| ≥ 65 % de dégâts physiques | frontline à armure | Plated Steelcaps (« Reduces incoming damage from Attacks by 10% »), Thornmail, Frozen Heart | Wiki : « Effective health = (1 + R/100) × health » ; Data Dragon |
| ≥ 65 % de dégâts magiques | tanks à RM | Mercury's Treads, Hexdrinker et Maw (« Lifeline »), Force of Nature | Riot (2020) : « Their Akali is a bursty threat, so Crimson Shieldbow is a strong pick » |
| Gros soins | — | Executioner's Calling et Mortal Reminder (AD), Oblivion Orb et Morellonomicon (AP), Bramble Vest et Thornmail, Chempunk Chainsword | Data Dragon ; bin `GrievousAmount` = 0,4 |
| Boucliers | — | Serpent's Fang (« Shield Reaver ») | Data Dragon |
| Beaucoup de CC | Cleanse, champions mobiles | Mercury's (30 % de ténacité), Sterak's Gage, Silvermere Dawn, Quicksilver Sash | tags `Tenacity` |
| Dive ou assassins | peel, désengagement | Zhonya's, Immortal Shieldbow, Exhaust | classes Riot ; communauté [P] |
| Tank qui empile l'armure | % des PV | Lord Dominik's, Black Cleaver ; Void Staff contre la RM | Riot (2020) : « against a Malphite building Armor, Behemoth Slayer » |
| Poke | engage **ou** sustain ? | — | loltheory (2026) : « Poke beats engage ». NERFPLZ : Poke < Sustain < All-In < Disengage < Poke [P] |

**Lecture.**
- Riot ne documente que des formules et des exemples, et les deux triangles de la communauté se contredisent.
- Proposition : une régression logistique `victoire ~ log-odds actuel + scores d'équipe + interactions`, sur 50 000 à 100 000 parties Match-V5 de la tranche. Interactions testées : notre engage × leur poke, notre peel × leur dive, part AD adverse × notre armure.
- On ne garde que les interactions dont l'intervalle à 95 % exclut 0. Elles s'ajoutent au modèle log-odds comme termes additifs.

---

## 2. Statistiques par elo

### 2.1 u.gg [V]

- **Manifeste** : `https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/ugg-api-versions.json`. Pour 16_21, tout est en version 1.5.0 : overview, builds, matchups, rankings, champion_duos, counters, champion_ranking…
- **URL** : `https://stats2.u.gg/lol/1.5/{fichier}/{patch}/{file}/{championId}/1.5.0.json`.
  - `overview`, `builds` et `matchups` répondent 200. `items` et `runes` répondent 403.
  - La tier list est dans `champion_ranking/{région}/{patch}/{file}/{rang}` (rapport 07).
- **Structure** : `{région: {rang: {rôle: [données, horodatage]}}}`.
- **Codes.**
  - Régions : 2 = EUW, 12 = monde.
  - Rangs : 12 fer, 7 bronze, 6 argent, 5 or, 4 platine, 16 émeraude, 3 diamant, 2 master, 13 GM, 1 challenger. Agrégats : 8 tous, 10 platine+, 11 diamant+, 14 master+, 15 diamant 2+, 17 émeraude+.
  - Rôles : 1 jungle, 2 support, 3 adc, 4 top, 5 mid.
- **`matchups`** : `[id adverse, victoires DE L'ADVERSAIRE, parties, sommes d'écarts…]`. Preuve sur Ahri mid, monde, Émeraude+ :
  - Σ victoires / Σ parties = 79 120 / 162 953 = **48,55 % = 1 − 51,45 %**, et le winrate global d'Ahri est de 51,4 %.
  - Ligne Syndra chez Ahri : 4 253 sur 8 555. Ligne Ahri chez Syndra : 4 302. Les deux font 8 555.
  - Les colonnes suivantes sont antisymétriques (+821 877 d'un côté, −821 877 de l'autre) : ce sont probablement des écarts d'or et d'xp. [H]
  - Ce résultat corrige le rapport 03 et confirme le rapport 07.
- **Poids** (Ahri, brut puis gzip) : overview 483 Ko et 98 Ko, builds 3,6 Mo et 594 Ko, matchups 2,76 Mo et 0,95 Mo.
- **Rafraîchissement** : `Last-Modified` à 07:21 GMT, horodatages internes de 05:02 à 07:21 UTC, `max-age=14400`. Donc quotidien, tôt le matin.
- **Effet de l'elo** (Ahri mid EUW) : fer 49,1 % (10 502 parties), or 51,3 % (41 083), émeraude 51,6 % (26 700), master+ 51,2 % (7 439).

### 2.2 Lolalytics [V]

- **JSON de synergies** :
  - requête : `https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=16.21&c=ahri&lane=middle&tier=emerald_plus&queue=ranked&region=all` ;
  - réponse : 19,7 Ko, `{"team_h":["id","wr","d1","d2","pr","n"], "team":{top, jungle, bottom, support}}` ;
  - avec `tier=gold&region=euw`, les chiffres changent (Ahri avec Xin Zhao : 53,08 % sur 2 304 parties) ;
  - `cf-cache-status: DYNAMIC`.
- **Pages avec JSON intégré** (`qwik/json`) : `lolalytics.com/lol/{champion}/build/?lane=&tier=&patch=` et `.../vs/{adversaire}/build/?vslane=` (394 Ko). Champs relevés dans le code de DraftGap :
  - `header` : wr, n, pr, br, `damage{physical, magic, true}` ;
  - `enemy` par rôle : [id, wr, …, n] ;
  - `graph.wr` par elo ;
  - builds : `runes`, `startSet`, `skillOrder`, `boots`, `item1` à `item5`, `winningItem`.
- **Sens** : `wr` est celui **du champion**. La page affiche « Ahri wins against Syndra 51.61% of the time » (9 251 parties).
- **Paramètres** : `lane` (top, jungle, middle, bottom, support), `queue` (`ranked` ou `420`). Pour `tier`, seuls `emerald_plus` et `gold` sont vérifiés ; les autres valeurs sont des hypothèses [H].
- **Fraîcheur** : le compteur « Emerald+ Champions Analysed » est passé de 18 087 041 ce matin (rapport 03) à 18 320 323 cet après-midi. La mise à jour est donc probablement infra-quotidienne. [H]

### 2.3 Estimer l'elo d'une partie [H, sauf mention]

- **En champ select classé**, seules deux sources sont légitimes :
  - ton rang, via le LCU `/lol-ranked/v1/current-ranked-stats` (tier, division, leaguePoints) ;
  - celui des membres de ton groupe, via `/lol-ranked/v1/ranked-stats/{puuid}` [P, schéma LCU communautaire].
  - Les autres alliés sont anonymes : « Products cannot identify or analyze players who are deliberately hidden by the game » [V].
- **Règle.**
  - On prend ta tranche.
  - À une division ou moins d'une frontière, on mélange les deux tranches 50/50.
  - En duo, on fait la moyenne des deux joueurs.
  - Si l'échantillon est trop maigre, on passe à un agrégat plus large.
- **Après le chargement**, les noms sont visibles.
  - Chemin 1 : `riotId` (port 2999), puis `account-v1 /accounts/by-riot-id`, puis `league-v4 /entries/by-puuid`.
  - Chemin 2 : `spectator-v5 /active-games/by-summoner/{puuid}`, qui respecte le mode streamer. [V : endpoints du schéma]
  - On affiche au maximum un rang moyen public, jamais un MMR estimé : « Prohibited alternatives include MMR or ELO calculators » [V].

---

## 3. Builds et itémisation

### 3.1 u.gg `overview` [V]

Exemple : Ahri mid, monde, Émeraude+.

| i | Contenu | Format | Exemple |
|---|---|---|---|
| 0 | runes | [parties, victoires, arbre 1, arbre 2, [6 runes]] | 14 178 parties, 51,9 % |
| 1 | sorts | [parties, victoires, [ids]] | Flash + Ignite |
| 2 | départ | idem | Doran's Ring + 2 potions |
| 3 | build cœur | idem | 3118, 3020, 3100 : 55,3 % sur 12 256 |
| 4 | compétences | [parties, victoires, [18 niveaux], "QWE"] | Q > W > E |
| 5 | options des objets 4 à 6 | [[id, victoires, parties]…] par slot | Rabadon : 13 363 sur 23 665 |
| 6 | total | [victoires, parties] | 84 169 sur 163 652 |
| 8 | fragments | [parties, victoires, [ids]] | 5005, 5008, 5011 |

- **Piège** : l'ordre victoires/parties s'inverse d'un index à l'autre. Je l'ai vérifié avec victoires ≤ parties et par l'égalité avec `rankings`.
- **La page recommandée n'est pas la plus jouée** : en Émeraude EUW, elle ne compte que 521 parties.
- **`builds`** est la version détaillée, au format `[x, victoires, parties]`. On y trouve les pages par keystone, les sorts, les départs, 26 triplets cœur, les ordres de compétences et les bottes (0 = sans bottes).

### 3.2 Lolalytics, par slot et par matchup [V]

- **Ce que donne la page `vs`** : pour chaque slot (objets 1 à 5, bottes, objets à 10 min), « Win Rate, Pick Rate, Games, Time ». C'est le seul winrate d'objet conditionné à l'adversaire que j'ai trouvé.
- **Biais de survie** : le build cœur d'Ahri gagne 55,3 % alors qu'Ahri gagne 51,4 %, et, sur la page `vs`, les objets 4 à 6 affichent de 59 à 65 %. On ne compare donc que des alternatives au même slot.

### 3.3 Données statiques des objets [V]

- **Data Dragon `item.json`** (683 Ko, 863 entrées).
  - 254 objets sont achetables sur la Faille (`maps["11"]`), dont 36 variantes de mode à 6 chiffres (par exemple 323075, Thornmail à 2 650 po) qu'il faut filtrer.
  - Champs : `gold{base, total, sell, purchasable}`, `from`, `into`, `tags` (32 valeurs : Armor, SpellBlock, Health, LifeSteal, Tenacity, MagicPenetration…), `stats`.
  - `stats` n'a que 12 clés anciennes (FlatArmorMod, FlatSpellBlockMod, FlatHPPoolMod…). La hâte, la létalité et la ténacité ne sont que dans le bloc `<stats>` de `description` : il faut le parser.
- **CommunityDragon `items.json`** (identique au fichier du client) : `categories`, `priceTotal`, `inStore`, `requiredChampion`.
- **CommunityDragon `game/items.cdtb.bin.json`** (16 Mo, à récupérer une fois par patch).
  - `mDataValues` nomme les effets. `GrievousAmount` (0,4) est présent sur les 7 objets d'anti-soin achetables, plus Chemtech Putrifier (3011, non achetable en 16.21). On trouve aussi `TenacityAmount`. Cela permet de détecter l'anti-soin sans parser de texte.
  - `mItemAdviceAttributes` (22 hachages) correspond probablement aux catégories de conseil de la boutique. [H]
- **Valeurs en or** (wiki, contrôlées sur les objets de base 16.21.1) : PV 2,67 po, armure 20, RM 20, AD 35, AP 20, hâte 50.

### 3.4 Adapter le build

- **Chiffrage.** Un point d'armure ajoute 1 % de PV effectifs contre les dégâts physiques, la RM fait de même contre les magiques. Avec p la part de dégâts physiques et m la part magique, l'armure vaut p/m fois la RM à prix égal. Exemple : 75/25 → l'armure est 3 fois plus rentable. [H, déduit de la formule V]
- **Précédent Riot** : la boutique le fait déjà. « The engine looks at the enemy team's stats during the game like damage done, CC, healing, resistances » et « It displays this info to you but you decide » (2020). C'est le modèle : plusieurs options, et le joueur décide. [V]

### 3.5 Winrate d'objet selon la compo : à calculer [H]

- **Aucune source ne le publie.**
- **Méthode.**
  1. Récupérer les timelines Match-V5 (événements `ITEM_PURCHASED`).
  2. Comparer les alternatives au même slot, achetées dans la même fenêtre de minutes.
  3. Faire une régression qui contrôle la base du champion, la durée de partie, l'écart d'or à l'achat et le profil adverse.
- **Échantillon.** Il faut environ 2 000 parties par case pour ±2 points. C'est réaliste pour 3 ou 4 dilemmes fréquents par champion (anti-soin oui ou non, armure ou RM).

---

## 4. Live Client Data API [V]

- **Base** : `https://127.0.0.1:2999`, en local uniquement. Swagger : `/swagger/v3/openapi.json`. Certificat auto-signé, racine `riotgames.pem`.
- **Endpoints (GET)** sous `/liveclientdata/` :
  - `allgamedata` (« great for testing », Riot conseille de lui préférer les autres) ;
  - joueur actif : `activeplayer`, `activeplayername`, `activeplayerabilities`, `activeplayerrunes` ;
  - tous les joueurs : `playerlist`, plus `playerscores`, `playersummonerspells`, `playermainrunes` et `playeritems` avec `?riotId=` ;
  - partie : `eventdata`, `gamestats`.
- **Champs utiles.**
  - `activePlayer` : `currentGold`, `level`, `championStats` (armor, magicResist, maxHealth, tenacity, pénétrations…), `fullRunes`.
  - `allPlayers[]` : `championName`, `team`, `position`, `level`, `isDead`, `respawnTimer`, `scores` {kills, deaths, assists, creepScore}, `items[]` {itemID, slot, count, price}, `riotId` [P pour riotId].
  - `gameData.gameTime`.
  - Événements : TurretKilled, InhibKilled, DragonKill, HeraldKill, BaronKill, ChampionKill, Multikill, Ace…
- **Rafraîchissement.** Polling uniquement, sans limite documentée. Proposition [H] : `activeplayer` toutes les 1 à 2 s, `playerlist` toutes les 5 s, et dans `eventdata` on ne lit que les `EventID` nouveaux.
- **Limites voulues par Riot.**
  - CS arrondi à la dizaine : « done out of an abundance of caution […] knowing a jungler's cs count can lead to estimations of their jungle path ».
  - Or des autres : « purposefully excluded ».
  - Objets ennemis : le tableau des scores ne se met à jour que lorsqu'on voit l'ennemi (wiki). L'API suit sans doute la même règle. [H]
- **Pièges.**
  - En mode streamer, `eventdata` donne le nom du champion au lieu du Riot ID (ticket #1045), et il n'y a pas d'identifiant stable (#1161).
  - Le certificat a expiré début janvier 2026 (ticket #1124, ouvert le 06/01, fermé le 22/01). Il faut accepter l'auto-signé **seulement** pour 127.0.0.1:2999.
- **Statut 2026.**
  - Documentée sur le portail.
  - FAQ Vanguard : « Apps developed using the LCU and in-game APIs are still expected to work ».
  - Blocage mémoire (06/10/2026) : « the official API as the only allowed mechanism for retrieving game data ».
  - Réserve : ces API ne relèvent pas de Developer Relations, donc aucune garantie de stabilité.

**Affichage.**
- **Oui** : objets, niveaux et KDA, déjà visibles dans le tableau des scores. Des suggestions d'objets à la demande, avec plusieurs choix.
- **Non** : les timers ; les alertes (« Notifications that dictate player action based on the current game state », Overwolf) ; l'or ennemi ; toute information « previously unknown to the player ».
- **Conséquence** : le verdict G2 du rapport 08 passe à **OK sous conditions** (à la demande, sans notification, plusieurs options).

---

## 5. Affichage en jeu et Vanguard

### Les faits [V]

- **FAQ Vanguard (01/04/2024)** : « Overlays and internal tools using the API, game client, and in-game APIs should continue to function ». Elle ajoute « External tools reading memory will no longer work » et « There is absolutely no allow list for Vanguard ».
- **Blocage mémoire (06/10/2026)** : il vise « game memory access by default for all unknown third-party applications » et précise « This change does not result in bans by itself ». Le texte ne parle pas de fenêtres.
- **Support Riot (10/02/2025)** : sont sanctionnés le fait d'exposer une info masquée, l'automatisation, « Drawing conclusions for you during gameplay » et « global ult alerts ». La sanction peut aller jusqu'à la suspension permanente.
- **Politique LoL** : elle autorise les « Game overlays that provide static data that is available prior to the game ». Elle interdit de suivre les cooldowns d'ultimes ennemis, même à la main, depuis mars 2025 [P pour la date].
- **Concurrents.**
  - Porofessor existe en version autonome, basée sur Electron, depuis le 05/12/2025.
  - Je n'ai trouvé aucun ban confirmé lié à Blitz, Porofessor, U.GG, Mobalytics ou OP.GG [P, Hexgate].
  - Blitz cite RivaTuner et MSI Afterburner comme logiciels en conflit, ce qui suggère un rendu dans le jeu. [H]

### Évaluation [H]

| Technique | Touche au jeu ? | Risque Vanguard |
|---|---|---|
| Fenêtre séparée transparente, clics traversants | Non (composition par Windows) | Très faible |
| Overlay injecté (hook DirectX, DLL) | Oui | Élevé hors plateforme reconnue |
| Lecture mémoire, OCR de l'écran du jeu, SendInput, hook clavier bas niveau | Oui ou ambigu | Élevé |
| Téléphone | Non | Nul |

**Verdict.** Les tricheurs utilisent aussi des fenêtres transparentes, mais c'est la lecture mémoire qui les alimente qui les fait sanctionner. Une sanction viendrait de ce qu'on affiche, pas de la fenêtre. Personne ne garantit rien : il n'existe pas de liste blanche.

### Conception la plus sûre [H]

- **Fenêtre.** Electron ou Tauri : `transparent`, sans cadre, `setAlwaysOnTop(true, 'screen-saver')`, `setIgnoreMouseEvents(true, {forward: true})`, non focusable, absente de la barre des tâches.
- **Mode d'affichage.** Jeu en **sans bordure** : en plein écran exclusif, la fenêtre n'apparaît pas.
- **Sources.** Uniquement 127.0.0.1:2999, le LCU en lecture seule et les fichiers statiques. Ni pilote, ni DLL, ni capture d'écran.
- **Raccourci.** Un raccourci `globalShortcut` (RegisterHotKey) pour afficher ou masquer, fenêtre masquée par défaut.
- **Contenu.** Plan d'avant-partie et suggestions à la demande (2 ou 3 choix). Ni timer, ni alerte, ni son, et rien qui imite le HUD de Riot.

---

## Ce qu'on peut construire

| Rang | Fonction | Valeur | Effort | Risque |
|---|---|---|---|---|
| 1 | Bilan de compo en draft (frontline, engage, peel, poke, AD/AP) : a priori du client et profil de dégâts DraftGap | Forte | Faible (1 à 2 j) | Nul |
| 2 | Tranche d'elo automatique (ton rang et ton groupe) pour les stats u.gg | Moyenne | Faible | Nul |
| 3 | Build d'avant-partie par elo (u.gg `overview`) et « plan à branches » selon la compo adverse | Forte | Moyenne (3 à 4 j) | Nul |
| 4 | Conseil de build en partie, à la demande, sur le téléphone (port 2999) | Forte | Moyenne | Faible |
| 5 | Le même conseil dans une fenêtre transparente au-dessus du jeu | Moyenne | Moyenne | Faible |
| 6 | Scores Match-V5 et régression des interactions de compo | Forte à terme | Élevée | Nul |
| 7 | Winrate d'objet selon la compo, calculé nous-mêmes | Moyenne | Élevée | Nul |

Ordre conseillé : 1, 2, 3, 4, puis 6.

---

## Sources

- CommunityDragon : https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/89.json (et 54, 40, 101, 238, 222, 117, 904), `items.json`, https://raw.communitydragon.org/latest/game/items.cdtb.bin.json
- Data Dragon : https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/champion.json, https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/item.json
- Meraki : https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/Leona.json, https://github.com/meraki-analytics/lolstaticdata
- Schémas : https://www.mingweisamuel.com/riotapi-schema/openapi-3.0.0.json, https://www.mingweisamuel.com/lcu-schema/lcu/openapi.json
- u.gg : https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/ugg-api-versions.json, https://stats2.u.gg/lol/1.5/overview/16_21/ranked_solo_5x5/103/1.5.0.json (et builds/103, matchups/103 et 134)
- Lolalytics : https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=16.21&c=ahri&lane=middle&tier=emerald_plus&queue=ranked&region=all, https://lolalytics.com/lol/ahri/vs/syndra/build/?lane=middle&vslane=middle&tier=emerald_plus&patch=16.21
- DraftGap : https://github.com/vigovlugt/draftgap/tree/main/apps/dataset/src/lolalytics
- Riot : https://developer.riotgames.com/docs/lol, https://static.developer.riotgames.com/docs/lol/liveclientdata_sample.json, https://www.riotgames.com/en/DevRel/vanguard-faq, https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps, https://support.riotgames.com/en-us/riot/events/third-party-applications, https://www.leagueoflegends.com/en-us/news/dev/preseason-item-shop-update/
- Tickets : https://github.com/RiotGames/developer-relations/issues/416, /387, /1045, /1124, /1161
- Wiki : https://wiki.leagueoflegends.com/en-us/Armor, /Gold_efficiency, /Sight, /Champion_classes
- Overwolf : https://dev.overwolf.com/ow-electron/guides/game-compliance/league-of-legends/ ; Electron : https://www.electronjs.org/docs/latest/api/browser-window
- [P] https://blog.loltheory.gg/engage-disengage-lol/, https://www.inderes.fi/en/releases/moba-network-launches-standalone-version-of-the-porofessor-app, https://hexgate.app/blog/can-you-get-banned-for-lol-apps/, https://support.blitz.gg/hc/en-us/articles/900001178283-General-Overlay-Troubleshooting, https://do-something.jp/lol-liveclienapi/, https://mein-mmo.de/lol-riot-verbietet-ultimate-time-tracker/
