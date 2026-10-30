# 10 · Attributs de compo, stats par elo, builds, données en partie et overlay

Recherche du 30/10/2026, patch 16.21 (Data Dragon 16.21.1), serveur EUW.
Légende : **[V]** vérifié (j'ai récupéré la donnée ou lu la page, URL en fin de document). **[P]** source secondaire ou partielle. **[H]** hypothèse ou proposition de ma part.

## L'essentiel

1. **Le client fournit déjà des attributs de compo, sans réseau.** Ce sont `playstyleInfo` (damage, durability, crowdControl, mobility, utility, notés de 1 à 3), `tacticalInfo` (damageType, attackType, style, difficulty) et un champ plus récent, `championTagInfo` (« Initiator », « Ally Protection », « Long Range »…). Meraki est figé : son fichier de champions date du 01/08/2025. [V]
2. **Pour les scores engage, peel, frontline, poke et anti-dive, la méthode défendable a trois étages** : un a priori statique (client et classes Riot), le comportement mesuré dans Match-V5 (`damageTakenOnTeamPercentage`, `effectiveHealAndShielding`, `enemyChampionImmobilizations`…), puis une validation par régression sur de vraies parties. Les « triangles » de compo publiés par la communauté se contredisent, il faut donc mesurer. [H]
3. **Stats par elo.** u.gg couvre 16 tranches d'elo et 18 régions en JSON public. Lolalytics accepte `tier`, `region`, `lane` et `patch` (vérifié avec `gold` et `euw`). Attention au sens des victoires : dans u.gg `matchups`, ce sont celles de l'**adversaire** (revérifié ici) ; chez Lolalytics, `wr` est celui du champion. [V]
4. **Builds.** Le fichier `overview` de u.gg (483 Ko par champion, toutes régions et tous rangs) donne runes, sorts, objets de départ, build cœur, ordre des compétences et options pour les objets 4 à 6, avec victoires et parties. Lolalytics publie aussi des builds **par matchup**. Aucune source ne publie de winrate d'objet selon la compo ennemie : il faut le calculer nous-mêmes. [V]
5. **La Live Client Data API (port 2999) est officielle** et toujours documentée en 2026. Elle donne les objets, niveaux et KDA des 10 joueurs, mais l'or uniquement pour soi. Riot arrondit le CS à la dizaine « par prudence ». [V]
6. **Overlay.** Une fenêtre séparée, transparente, qui laisse passer les clics, toujours au premier plan, avec le jeu en mode sans bordure, sans injection ni lecture mémoire, ne touche pas au processus du jeu. Aucun texte de Riot ne l'interdit, et la FAQ Vanguard dit que les overlays qui passent par les API « should continue to function ». **Le risque technique est très faible. Le vrai risque vient du contenu affiché** (timers, alertes, info cachée). [V pour les textes, H pour l'évaluation]

---

## 1. Attributs de champions pour l'analyse de compo

### 1.1 Client et CommunityDragon [V]

- **Chemins.**
  - Dans le client (LCU) : `/lol-game-data/assets/v1/champions/{id}.json`.
  - Miroir CommunityDragon : `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/{id}.json`. Pour Leona : 55 Ko, `Last-Modified` du 29/09/2026.
- **Clés de premier niveau :** id, name, alias, title, tacticalInfo, playstyleInfo, championTagInfo, roles, recommendedItemDefaults (vide), passive, spells, skins.
- **Champs de chaque sort :** spellKey, range, cooldownCoefficients, costCoefficients, coefficients, effectAmounts, ammo, maxLevel, description.

Exemple, Leona (89), extrait :

```json
"roles": ["tank", "support"],
"tacticalInfo": {"style": 9, "difficulty": 1, "damageType": "kMagic", "attackType": "melee"},
"playstyleInfo": {"damage": 1, "durability": 3, "crowdControl": 3, "mobility": 1, "utility": 1},
"championTagInfo": {"championTagPrimary": "Initiator", "championTagSecondary": "Crowd Control"},
"spells": [ {"spellKey": "e", "name": "Zenith Blade", "range": [875, ...], "cooldownCoefficients": [12, 10.5, 9, 7.5, 6]},
            {"spellKey": "r", "name": "Solar Flare", "range": [1200, ...], "cooldownCoefficients": [90, 75, 60, ...]} ]
```

Huit champions comparés (8 requêtes, une par champion) :

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
- Les notes de 1 à 3 sont grossières : Leona et Malphite sont identiques.
- `championTagInfo` est le seul label explicite d'engage ou de peel, mais il est vide pour les champions récents (Zaahen).
- `style` semble aller de « attaques de base » (Jinx, 2) à « compétences » (Janna, 10). [H]
- Le compagnon peut lire les 172 fichiers depuis le LCU, en local, une fois par patch.

**Data Dragon** `champion.json` 16.21.1 : 173 champions. On y trouve `tags` (Tank, Support…), `info` (attack, defense, magic, difficulty, de 0 à 10) et `stats.attackrange` (Leona : 125). [V]

### 1.2 Meraki Analytics [V]

- **Contenu.** `cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/{Nom}.json` donne :
  - `attributeRatings` (damage, toughness, control, mobility, utility, abilityReliance, difficulty) ;
  - `roles` avec les **sous-classes Riot** (Leona : SUPPORT, TANK, VANGUARD) ;
  - `positions`, `adaptiveType` ;
  - et, par compétence : `targeting`, `affects`, `damageType`, `spellEffects`, `targetRange`, `effectRadius`.
- **Fraîcheur.**
  - `champions.json` (13 Mo) : `Last-Modified` du 01/08/2025.
  - `items.json` : 11/02/2026.
  - Leona : `patchLastChanged` = 14.24.
  - Dernier commit du dépôt `lolstaticdata` : 12/11/2025.
- **Verdict.** Bon pour importer une fois les sous-classes, qui changent rarement. Les définitions Riot sont reprises par le wiki : « Vanguards are offensive tanks », « Wardens are defensive tanks », Catcher, Enchanter, Diver, Artillery… Il faut compléter à la main les champions sortis après août 2025. Ne pas s'en servir pour les chiffres.

### 1.3 Match-V5 : le comportement réel [V pour les champs, H pour l'usage]

Le schéma de l'API Riot contient ces champs.
- Dans `ParticipantDto` : `timeCCingOthers`, `totalTimeCCDealt`, `damageSelfMitigated`, `totalDamageTaken`, `totalHealsOnTeammates`, `totalDamageShieldedOnTeammates`, et `physical/magic/trueDamageDealtToChampions`.
- Dans `ChallengesDto` (147 champs) : `damageTakenOnTeamPercentage`, `effectiveHealAndShielding`, `saveAllyFromDeath`, `enemyChampionImmobilizations`, `immobilizeAndKillWithAlly`, `knockEnemyIntoTeamAndKill`, `pickKillWithAlly`, `skillshotsHit`, `landSkillShotsEarlyGame`, `teamDamagePercentage`.

C'est la seule source qui mesure le rôle réellement tenu en partie, et non l'étiquette.

### 1.4 Proposition de scores [H]

1. **A priori statique S (0 à 1)**, tiré du client et de la sous-classe (tableau ci-dessous).
2. **Comportement B.** Pour chaque couple champion × rôle, on prend la médiane par 10 minutes de chaque indicateur. On la convertit en **percentile dans le rôle**, pour comparer un support à des supports. Calcul sur 20 000 à 50 000 parties de la tranche d'elo.
3. **Score = (1 − w)·S + w·B**, avec w = N/(N+500), où N est le nombre de parties du champion dans le rôle. Un champion rare reste proche de son étiquette.

| Score | A priori | Comportement (Match-V5) |
|---|---|---|
| Frontline | durability, Tank, Juggernaut, Vanguard, Warden, mêlée | `damageTakenOnTeamPercentage`, (`totalDamageTaken` + `damageSelfMitigated`)/min |
| Engage | tag Initiator, Vanguard, Diver, Catcher, CC + mobilité, portée de R ≥ 600 | `knockEnemyIntoTeamAndKill`, `immobilizeAndKillWithAlly`, `enemyChampionImmobilizations`/min |
| Peel | tag Ally Protection, Enchanter, Warden, utility | `effectiveHealAndShielding`, `saveAllyFromDeath`, `timeCCingOthers` |
| Poke | tag Long Range, Artillery, sort de dégâts à ≥ 1 000 de portée, distance | `skillshotsHit`, `landSkillShotsEarlyGame` (proxy faible) |
| Dégâts | profil réel physique/magique/brut (`damage` de Lolalytics ou DraftGap) plutôt que `damageType` | `physical/magic/trueDamageDealtToChampions` |

**Agrégation par équipe.**
- Engage = max + 0,3 × le deuxième : un bon engageur suffit, un second aide.
- Frontline, peel et poke = somme plafonnée.
- **Anti-dive** = peel de l'équipe + 0,5 × CC de l'équipe + mobilité des carrys.

**Ce qui contre quoi : règles documentées et origine.**

| Situation adverse | Réponse en draft | Réponse en build | Source |
|---|---|---|---|
| ≥ 65 % de dégâts physiques | frontline à armure | armure, Plated Steelcaps (« Reduces incoming damage from Attacks by 10% »), Thornmail, Frozen Heart | Wiki : « Effective health = (1 + R/100) × health », pas de rendements décroissants ; descriptions Data Dragon |
| ≥ 65 % de dégâts magiques | tanks à RM | Mercury's Treads, Hexdrinker et Maw (bouclier magique « Lifeline »), Force of Nature | Idem ; Riot (2020) : « Their Akali is a bursty threat, so Crimson Shieldbow is a strong pick » |
| Gros soins | — | Wounds : Executioner's Calling et Mortal Reminder (AD), Oblivion Orb et Morellonomicon (AP), Bramble Vest et Thornmail (tank), Chempunk Chainsword | Data Dragon 16.21.1 ; fichier bin `GrievousAmount` = 0,4 |
| Boucliers | — | Serpent's Fang (« Shield Reaver ») | Data Dragon |
| Beaucoup de CC | Cleanse, champions mobiles | Mercury's (30 % de ténacité), Sterak's Gage, Silvermere Dawn, Quicksilver Sash | Tags `Tenacity` de Data Dragon |
| Dive ou assassins (Burst + Mobile, Diver, Assassin) | peel (Warden, Enchanter), désengagement | Zhonya's, Immortal Shieldbow, Maw, Exhaust | Classes Riot ; communauté [P] |
| Tank qui empile l'armure | dégâts en % des PV | Lord Dominik's, Black Cleaver, Void Staff (contre la RM) | Riot (2020) : « against a Malphite building Armor, Behemoth Slayer » |
| Poke | engage **ou** sustain ? | — | loltheory (2026) : « Poke beats engage », « Sustain beats poke ». NERFPLZ : Poke < Sustain < All-In < Disengage < Poke [P] |

**Lecture.**
- Riot ne documente que des formules et des exemples, et les deux triangles de la communauté se contredisent sur poke contre engage.
- Proposition : une régression logistique `victoire ~ log-odds actuel + scores d'équipe + interactions` (notre engage × leur poke, notre peel × leur dive, part AD adverse × notre frontline à armure), sur 50 000 à 100 000 parties Match-V5 de la tranche.
- On ne garde que les interactions dont l'intervalle à 95 % exclut 0. Elles s'ajoutent comme termes additifs au modèle log-odds existant.

---

## 2. Statistiques par elo

### 2.1 u.gg [V]

- **Manifeste :** `https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/ugg-api-versions.json`. Pour 16_21, toutes les versions sont en 1.5.0 : overview, builds, matchups, rankings, champion_duos, counters, champion_ranking, items, runes, combat, objectives, primary_roles.
- **Patron d'URL :** `https://stats2.u.gg/lol/1.5/{fichier}/{patch}/{file}/{championId}/1.5.0.json`.
  - `overview`, `builds` et `matchups` répondent 200. `items` et `runes` répondent 403.
  - Tier list : `.../champion_ranking/{région}/{patch}/{file}/{rang}/1.5.0.json` (voir rapport 07).
- **Structure :** `{région: {rang: {rôle: [données, horodatage]}}}`. Le fichier `builds` n'a pas d'horodatage.
- **Codes.**
  - Régions : 1 à 18 ; 2 = EUW, 12 = monde.
  - Rangs : 12 fer, 7 bronze, 6 argent, 5 or, 4 platine, 16 émeraude, 3 diamant, 2 master, 13 GM, 1 challenger. Agrégats : 8 tous, 10 platine+, 11 diamant+, 14 master+, 15 diamant 2+, 17 émeraude+.
  - Rôles : 1 jungle, 2 support, 3 adc, 4 top, 5 mid.
- **`matchups`.** Une ligne par adversaire : `[id adverse, victoires DE L'ADVERSAIRE, parties, sommes d'écarts…]`. Preuve sur Ahri mid (monde, Émeraude+) :
  - Σ victoires / Σ parties = 79 120 / 162 953 = **48,55 % = 1 − 51,45 %**, et le winrate global d'Ahri est de 51,4 %.
  - Ligne Syndra dans le fichier d'Ahri : 4 253 sur 8 555. Ligne Ahri dans le fichier de Syndra : 4 302 sur 8 555. Et 4 253 + 4 302 = 8 555.
  - Les colonnes suivantes sont antisymétriques (+821 877 dans un fichier, −821 877 dans l'autre). Ce sont des sommes d'écarts, probablement or et xp. [H]
  - Ce résultat corrige la lecture du rapport 03 et confirme le rapport 07.
- **Poids** (Ahri) : overview 483 Ko (98 Ko en gzip), builds 3,6 Mo (594 Ko en gzip), matchups 2,76 Mo (0,95 Mo en gzip).
- **Rafraîchissement :** `Last-Modified` le 30/10 à 07:21 GMT, horodatages internes de 05:02 à 07:21 UTC, `Cache-Control: max-age=14400`. Les fichiers sont donc refaits chaque jour, tôt le matin UTC.
- **L'elo change les chiffres.** Ahri mid EUW : fer 49,1 % (10 502 parties), or 51,3 % (41 083), émeraude 51,6 % (26 700), master+ 51,2 % (7 439).

### 2.2 Lolalytics [V]

- **JSON de synergies.**
  - Requête testée : `https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=16.21&c=ahri&lane=middle&tier=emerald_plus&queue=ranked&region=all`.
  - Réponse : 19,7 Ko, `{"team_h":["id","wr","d1","d2","pr","n"], "team":{top, jungle, bottom, support}}`.
  - Variante `tier=gold&region=euw` testée : 200, avec des chiffres différents (Ahri avec Xin Zhao jungle : 53,08 % sur 2 304 parties).
  - Pas d'en-tête de cache (`cf-cache-status: DYNAMIC`) ; `Access-Control-Allow-Origin: *`.
- **Pages HTML avec données intégrées** (`qwik/json`) :
  - `https://lolalytics.com/lol/{champion}/build/?lane=&tier=&patch=` ;
  - `.../lol/{champion}/vs/{adversaire}/build/?vslane=` (394 Ko).
  - Champs (types relevés dans le code de DraftGap) : `header` {wr, n, pr, br, damage{physical, magic, true}}, `enemy` {top…support : [id, wr, …, n]}, `graph.wr` par elo (all, diamond_plus, emerald, platinum, gold, silver, bronze, iron), `runes`, `spells`, `startSet`, `skillOrder`, `skill6/10/15`, `boots`, `item1` à `item5`, `popularItem`, `winningItem`.
- **Sens.** `wr` est le winrate **du champion** : la page affiche « Ahri wins against Syndra 51.61% of the time » (9 251 parties, Émeraude+ toutes régions). C'est l'inverse de u.gg.
- **Paramètres.**
  - `lane` : top, jungle, middle, bottom, support.
  - `queue` : `ranked` ou `420`.
  - `tier` : `emerald_plus` et `gold` sont vérifiés. Les autres valeurs (platinum_plus, diamond_plus, master_plus, all…) sont des hypothèses. [H]
- **Méthode et fraîcheur.**
  - Le site déclare classer les parties selon le rang de chaque joueur.
  - Le compteur « Emerald+ Champions Analysed » est passé de 18 087 041 (rapport 03, ce matin) à 18 320 323 cet après-midi. Les données sont donc probablement mises à jour plusieurs fois par jour. [H]

### 2.3 Estimer l'elo d'une partie [H, sauf mention]

- **Pendant le champ select en classé**, seules deux sources sont légitimes :
  - ton propre rang : LCU `/lol-ranked/v1/current-ranked-stats` (tier, division, leaguePoints, wins, losses) ;
  - les rangs des membres de ton groupe : `/lol-ranked/v1/ranked-stats/{puuid}` [P, schéma LCU communautaire].
  - Les alliés hors groupe sont anonymes : « Products cannot identify or analyze players who are deliberately hidden by the game » [V].
- **Règle proposée.**
  - On prend ta tranche.
  - À une division ou moins d'une frontière (Platine 1, Émeraude 4), on mélange les deux tranches 50/50.
  - En duo, on fait la moyenne des deux joueurs.
  - Si l'échantillon est trop petit, on passe à un agrégat plus large : en or, il y a environ 4 fois moins de parties qu'en Émeraude+.
- **Après l'écran de chargement**, les noms sont visibles.
  - Chemin 1 : `riotId` via le port 2999 (sauf mode streamer), puis `account-v1 /accounts/by-riot-id`, puis `league-v4 /entries/by-puuid/{puuid}`.
  - Chemin 2 : `spectator-v5 /active-games/by-summoner/{puuid}`, qui respecte le mode streamer. [V : endpoints présents dans le schéma]
  - Coût : une vingtaine de requêtes par partie.
  - Usage : choisir la tranche du build en partie.
  - On affiche au maximum un **rang moyen public**, jamais un MMR estimé : « Prohibited alternatives include MMR or ELO calculators » [V].

---

## 3. Builds et itémisation

### 3.1 u.gg `overview` : le build recommandé [V]

Le tableau décrit `données[i]`. Exemple : Ahri mid, monde, Émeraude+.

| i | Contenu | Format | Exemple |
|---|---|---|---|
| 0 | page de runes | [parties, victoires, arbre 1, arbre 2, [6 runes]] | 14 178 parties, 51,9 % |
| 1 | sorts d'invocateur | [parties, victoires, [ids]] | Flash + Ignite, 114 581 |
| 2 | départ | idem | Doran's Ring + 2 potions |
| 3 | build cœur (3 objets) | idem | 3118, 3020, 3100 : 55,3 % sur 12 256 |
| 4 | compétences | [parties, victoires, [18 niveaux], "QWE"] | Q > W > E |
| 5 | options pour les objets 4, 5, 6 et consommables | [[id, victoires, parties]…] par slot | Rabadon : 13 363 / 23 665 |
| 6 | total | [victoires, parties] | 84 169 / 163 652 |
| 8 | fragments | [parties, victoires, [ids]] | 5005, 5008, 5011 |

- **Piège.** L'ordre victoires/parties s'inverse d'un index à l'autre. Je l'ai vérifié par la taille des nombres (victoires ≤ parties) et par l'égalité avec `rankings`.
- **La page affichée n'est pas forcément la plus jouée** : en Émeraude EUW, la page recommandée ne compte que 521 parties.
- **`builds` (3,6 Mo)** est la version détaillée. Format `[x, victoires, parties]`. Sections :
  - 0 : par keystone et arbre secondaire, avec les pages complètes ;
  - 1 : sorts ;
  - 2 : départs ;
  - 3 : triplets d'objets cœur (26) ;
  - 4 : ordres de montée des compétences ;
  - 5 : bottes (0 = sans bottes) ;
  - 6 : autres triplets (33). [H : probablement sans les bottes]

### 3.2 Lolalytics : par slot et par matchup [V]

- **Ce que donne la page `vs`.** Pour Ahri contre Syndra, elle donne pour chaque slot (Item 1 à 5, Boots, Early Items à 10 min) : « Win Rate, Pick Rate, Games, Time ». C'est **le seul winrate d'objet conditionné à l'adversaire** que j'ai trouvé.
- **Biais de survie.** Le build cœur d'Ahri gagne 55,3 % alors qu'Ahri gagne 51,4 %. Sur la page `vs`, les objets 4 à 6 affichent 59 à 79 %. Plus le slot est tardif, plus la partie est longue et gagnée. On ne compare donc que des alternatives **au même slot**.

### 3.3 Données statiques des objets [V]

- **Data Dragon `item.json` 16.21.1.**
  - 683 Ko, 863 entrées. 254 sont achetables sur la Faille (`maps["11"]`), dont 36 ont un id à 6 chiffres. Ce sont des variantes de mode : par exemple 323075, une Thornmail à 2 650 po. Il faut les filtrer.
  - Champs : `name`, `from`, `into`, `gold{base, total, sell, purchasable}`, `tags`, `maps`, `stats`.
  - 32 tags, dont Armor, SpellBlock, Health, LifeSteal, SpellVamp, Tenacity, MagicPenetration, ArmorPenetration, AbilityHaste, Boots.
  - `stats` n'a que 12 clés anciennes (FlatArmorMod, FlatSpellBlockMod, FlatHPPoolMod, FlatPhysicalDamageMod, FlatMagicDamageMod, PercentAttackSpeedMod…). La hâte, la létalité et la ténacité ne figurent que dans le bloc `<stats>` de `description` : il faut le parser. Exemple : Maw annonce 15 de hâte dans sa description, mais rien dans `stats`.
- **CommunityDragon `items.json`** (le même fichier que celui du client) : `id`, `categories`, `priceTotal`, `from`, `to`, `inStore`, `requiredAlly`, `requiredChampion`.
- **CommunityDragon `game/items.cdtb.bin.json`** (16 Mo, à récupérer une fois par patch) :
  - `mDataValues` donne les effets en clair. `GrievousAmount` (0,4) est présent sur Bramble Vest, Thornmail, Mortal Reminder, Executioner's Calling, Morellonomicon, Oblivion Orb, Chempunk Chainsword et Chemtech Putrifier. On trouve aussi `TenacityAmount` et `PercentTenacityReduc`. Cela permet de détecter l'anti-soin sans parser de texte.
  - `mItemAdviceAttributes` contient 22 valeurs hachées. Ce sont probablement les catégories de conseil de la boutique. [H]
- **Valeurs en or** (wiki) : PV 2,67 po, armure 20, RM 20, AD 35, AP 20, hâte 50, vitesse d'attaque 25 par %, ténacité environ 10,3 par %. Vérifié en 16.21.1 : Cloth Armor 300 po pour 15 d'armure, Null-Magic Mantle 400 po pour 20 de RM, Ruby Crystal 400 po pour 150 PV.

### 3.4 Adapter le build à la compo adverse

- **Les règles** sont celles du tableau du §1.4.
- **On peut les chiffrer avec la formule d'armure.** Un point d'armure ajoute 1 % de PV effectifs contre les dégâts physiques, et la RM fait de même contre les dégâts magiques. Si p est la part de dégâts physiques adverses et m la part magique, l'armure vaut p/m fois la RM à prix égal (20 po le point dans les deux cas). Exemple : avec 75 % physique et 25 % magique, l'armure est 3 fois plus rentable. [H, déduit de la formule V]
- **Précédent Riot.** La boutique du jeu fait déjà ce travail.
  - Riot (2020) : « The engine looks at the enemy team's stats during the game like damage done, CC, healing, resistances ».
  - Et : « It displays this info to you but you decide the best strategy ».
  - C'est le modèle à copier : plusieurs options, et la décision reste au joueur. [V]

### 3.5 Winrate d'objet selon la compo : à calculer nous-mêmes [H]

- **Aucune source ne publie de winrate d'un objet selon la compo adverse** (contre AP ou contre AD par exemple). Lolalytics s'arrête au matchup de lane.
- **Méthode.**
  1. Récupérer les parties Match-V5 et leur timeline (`/lol/match/v5/matches/{id}/timeline`, événements `ITEM_PURCHASED`).
  2. Pour chaque slot, comparer les objets alternatifs achetés dans la même fenêtre de minutes.
  3. Faire une régression logistique avec ces variables : base du champion, durée, écart d'or au moment de l'achat, profil adverse (part AD, soins, CC).
- **Échantillon.** Il faut environ 2 000 parties par case pour une précision de ±2 points. C'est faisable pour les 3 ou 4 dilemmes fréquents par champion (bottes, anti-soin oui ou non, armure ou RM au 3e objet), pas pour tout.

---

## 4. En partie : Live Client Data API [V]

- **Base.**
  - `https://127.0.0.1:2999`, accessible uniquement en local.
  - Swagger : `/swagger/v2/swagger.json` et `/swagger/v3/openapi.json`.
  - Certificat auto-signé, avec la racine `riotgames.pem`.
- **Endpoints (GET).**
  - `/liveclientdata/allgamedata` : tout d'un bloc ; Riot conseille de ne l'utiliser que pour les tests.
  - Joueur actif : `activeplayer`, `activeplayername`, `activeplayerabilities`, `activeplayerrunes`.
  - Tous les joueurs : `playerlist`, ainsi que `playerscores`, `playersummonerspells`, `playermainrunes` et `playeritems`, chacun avec `?riotId=`.
  - Partie : `eventdata`, `gamestats`.
- **Champs utiles.**
  - `activePlayer` : `currentGold`, `level`, `championStats` (armor, magicResist, abilityPower, attackDamage, maxHealth, tenacity, pénétrations, lethality…), `abilities`, `fullRunes`.
  - `allPlayers[]` : `championName`, `team`, `position`, `level`, `isDead`, `respawnTimer`, `scores` {kills, deaths, assists, creepScore, wardScore}, `summonerSpells`, `runes`, `items[]` {itemID, slot, count, price, canUse, consumable, displayName}, `riotId`, `riotIdGameName`, `riotIdTagLine` [P pour les champs riotId, guide de 2026].
  - `gameData` : `gameTime`, `gameMode`, `mapNumber`.
  - `events` : GameStart, MinionsSpawning, FirstBrick, TurretKilled, InhibKilled, DragonKill (DragonType, Stolen), HeraldKill, BaronKill, ChampionKill (Killer, Victim, Assisters), Multikill, Ace.
  - Le fichier d'exemple de Riot date de 2020 et ne contient pas les champs riotId.
- **Rafraîchissement.**
  - Pas de push : c'est du polling, et aucune limite n'est documentée.
  - Proposition [H] : `activeplayer` toutes les 1 à 2 s, `playerlist` toutes les 5 s, `eventdata` en ne gardant que les `EventID` nouveaux.
- **Ce qui est délibérément limité.**
  - CS arrondi à la dizaine. Riot : « done out of an abundance of caution […] knowing a jungler's cs count can lead to estimations of their jungle path ».
  - Or des autres joueurs : « purposefully excluded ».
  - Objets ennemis : le tableau des scores du jeu ne les met à jour que lorsqu'on voit l'ennemi (wiki : « The scoreboard's views of enemy champions also update for an ally only when they gain sight of the enemy »). L'API suit très probablement la même règle. [H]
- **Pièges.**
  - En mode streamer, `eventdata` renvoie le nom du champion au lieu du Riot ID (ticket #1045), et il n'existe aucun identifiant stable (#1161, juin 2026).
  - Le certificat a expiré le 06/01/2026 et a été corrigé le 22/01 (#1124). Il faut accepter l'auto-signé **uniquement** pour 127.0.0.1:2999.
- **Statut en 2026.**
  - L'API est documentée sur le portail Riot, page lue aujourd'hui.
  - FAQ Vanguard : « Apps developed using the LCU and in-game APIs are still expected to work ».
  - Blocage mémoire du 06/10/2026 : « the official API as the only allowed mechanism for retrieving game data ».
  - Réserve : ces API « are not owned by Developer Relations ». Riot ne garantit donc ni support ni stabilité.

**Ce qu'on peut montrer.**
- **Oui :** objets, niveaux et KDA, puisque le tableau des scores les montre déjà. Des suggestions d'objets à la demande, avec plusieurs choix, comme la boutique.
- **Non :**
  - les timers (ultimes, sorts d'invocateur, camps ennemis) ;
  - les alertes du genre « X est niveau 6 » (Overwolf : « Notifications that dictate player action based on the current game state ») ;
  - l'or ennemi ;
  - toute information « previously unknown to the player ».

Cela affine le verdict G2 du rapport 08 : **OK sous conditions** (à la demande, sans notification, plusieurs options, données du tableau des scores seulement).

---

## 5. Affichage en jeu et Vanguard

### Les faits [V]

- **FAQ Vanguard** (01/04/2024) : « Overlays and internal tools using the API, game client, and in-game APIs should continue to function ». Aussi : « External tools reading memory will no longer work » et « There is absolutely no allow list for Vanguard ».
- **Blocage mémoire** (29/09/2026, effectif au 06/10/2026) : il vise « game memory access by default for all unknown third-party applications ». Et : « This change does not result in bans by itself ». Le texte ne parle ni de fenêtres, ni de la Live Client Data API.
- **Support Riot** (10/02/2025) : sont sanctionnés le fait d'exposer une info masquée, d'agir à la place du joueur, « Drawing conclusions for you during gameplay » et « Altering your field of intelligence (zoomhacks or global ult alerts) ». Les sanctions vont jusqu'à la suspension permanente. Le texte ne parle pas des overlays.
- **Politique LoL.** Elle autorise les « Game overlays that provide static data that is available prior to the game ». Elle interdit le suivi des cooldowns d'ultimes ennemis, « manually » compris. Cette interdiction date de mars 2025 [P, relais presse du post DevRel].
- **Concurrents.**
  - Porofessor existe en version autonome depuis le 05/12/2025 (« electron-based ») ; Overwolf reste son partenaire technique.
  - Je n'ai trouvé aucun ban confirmé lié à Blitz, Porofessor, U.GG, Mobalytics ou OP.GG. C'est aussi ce que conclut Hexgate, un éditeur concurrent [P].
  - La technique exacte de leurs overlays n'est pas publiée. Blitz cite RivaTuner et MSI Afterburner comme logiciels en conflit, ce qui évoque un rendu dans le jeu plutôt qu'une fenêtre séparée. [H]

### Évaluation du risque [H]

| Technique | Touche au jeu ? | Risque Vanguard | Risque règles |
|---|---|---|---|
| Fenêtre séparée transparente, clics traversants, au premier plan | Non (composition Windows) | Très faible | Dépend du contenu |
| Overlay injecté (hook DirectX, DLL) | Oui | Élevé hors plateforme reconnue | — |
| Lecture mémoire, capture d'écran avec OCR du jeu, SendInput, hook clavier bas niveau | Oui ou ambigu | Élevé | Élevé |
| Second écran (téléphone) | Non | Nul | Dépend du contenu |

**Verdict.** La fenêtre séparée est sûre sur le plan technique. Les tricheurs utilisent aussi des fenêtres transparentes, mais ce qui les fait sanctionner, c'est la lecture de la mémoire qui les alimente. Une sanction viendrait de ce qu'on affiche, pas de la fenêtre. Personne ne publie de garantie : il n'existe pas de liste blanche.

### Conception la plus sûre [H]

- **Fenêtre.** Electron ou Tauri : `transparent`, sans cadre, `setAlwaysOnTop(true, 'screen-saver')`, `setIgnoreMouseEvents(true, {forward: true})`, non focusable, absente de la barre des tâches.
- **Mode d'affichage.** Jeu en mode **sans bordure** : en plein écran exclusif, la fenêtre n'apparaît pas.
- **Sources de données.** Uniquement 127.0.0.1:2999, le LCU en lecture seule et les fichiers statiques. Aucun pilote, aucune DLL, aucune lecture de processus, aucune capture d'écran du jeu.
- **Raccourci.** Un seul raccourci global pour afficher ou masquer la fenêtre, via `globalShortcut` (RegisterHotKey), jamais via un hook clavier bas niveau. Masquée par défaut.
- **Contenu.**
  - Le plan statique d'avant-partie.
  - Des suggestions d'objets à la demande, avec 2 ou 3 choix.
  - Ni timer, ni alerte, ni son, ni pop-up.
  - Rien qui ressemble au HUD de Riot.
- **Plan B.** Le même contenu sur le téléphone.

---

## Ce qu'on peut construire

| Rang | Fonction | Valeur | Effort | Risque |
|---|---|---|---|---|
| 1 | Bilan de compo en draft : frontline, engage, peel, poke, part AD/AP, avec les a priori du client et le profil de dégâts de DraftGap | Forte | Faible (1 à 2 j) | Nul |
| 2 | Choix automatique de la tranche d'elo (ton rang et ton groupe) pour les stats u.gg | Moyenne | Faible | Nul |
| 3 | Build d'avant-partie par elo et rôle (u.gg `overview`), plus un « plan à branches » selon la compo adverse (règles du §1.4) | Forte | Moyenne (3 à 4 j) | Nul |
| 4 | Conseil de build en partie à la demande (port 2999 : objets ennemis vus, part AD/AP, soins), sur le téléphone | Forte | Moyenne | Faible si on reste à la demande |
| 5 | Le même conseil dans une fenêtre transparente au-dessus du jeu | Moyenne | Moyenne | Faible |
| 6 | Scores comportementaux Match-V5 et régression des interactions de compo | Forte à terme | Élevée (collecte d'une semaine) | Nul |
| 7 | Winrate d'objet selon la compo, calculé nous-mêmes | Moyenne | Élevée | Nul |

Ordre conseillé : 1 → 2 → 3 → 4, puis 6. La fenêtre au-dessus du jeu (5) passe après le téléphone.

---

## Sources

- CommunityDragon : https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champions/89.json (et 54, 40, 101, 238, 222, 117, 904), `champion-summary.json`, `items.json`, https://raw.communitydragon.org/latest/game/items.cdtb.bin.json
- Data Dragon : https://ddragon.leagueoflegends.com/api/versions.json, https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/champion.json, https://ddragon.leagueoflegends.com/cdn/16.21.1/data/en_US/item.json
- Meraki : https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions/Leona.json, https://api.github.com/repos/meraki-analytics/lolstaticdata/commits
- Schéma de l'API Riot : https://www.mingweisamuel.com/riotapi-schema/openapi-3.0.0.json ; schéma LCU (ancien) : https://www.mingweisamuel.com/lcu-schema/lcu/openapi.json
- u.gg : https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/ugg-api-versions.json, https://stats2.u.gg/lol/1.5/overview/16_21/ranked_solo_5x5/103/1.5.0.json, `builds/…/103`, `matchups/…/103` et `matchups/…/134`
- Lolalytics : https://a1.lolalytics.com/mega/?ep=build-team&v=1&patch=16.21&c=ahri&lane=middle&tier=emerald_plus&queue=ranked&region=all (et la variante gold/euw), https://lolalytics.com/lol/ahri/vs/syndra/build/?lane=middle&vslane=middle&tier=emerald_plus&patch=16.21
- Code de DraftGap : https://github.com/vigovlugt/draftgap/tree/main/apps/dataset/src/lolalytics
- Riot : https://developer.riotgames.com/docs/lol, https://static.developer.riotgames.com/docs/lol/liveclientdata_sample.json, https://static.developer.riotgames.com/docs/lol/liveclientdata_events.json, https://www.riotgames.com/en/DevRel/vanguard-faq, https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps, https://support.riotgames.com/en-us/riot/events/third-party-applications, https://www.leagueoflegends.com/en-us/news/dev/preseason-item-shop-update/
- Tickets Riot DevRel : https://github.com/RiotGames/developer-relations/issues/416, /387, /1045, /1124, /1161
- Wiki : https://wiki.leagueoflegends.com/en-us/Armor, https://wiki.leagueoflegends.com/en-us/Gold_efficiency, https://wiki.leagueoflegends.com/en-us/Sight, https://wiki.leagueoflegends.com/en-us/Champion_classes
- Overwolf (conformité LoL) : https://dev.overwolf.com/ow-electron/guides/game-compliance/league-of-legends/
- Electron : https://www.electronjs.org/docs/latest/api/browser-window
- [P] https://blog.loltheory.gg/engage-disengage-lol/, https://www.inderes.fi/en/releases/moba-network-launches-standalone-version-of-the-porofessor-app, https://hexgate.app/blog/can-you-get-banned-for-lol-apps/, https://support.blitz.gg/hc/en-us/articles/900001178283-General-Overlay-Troubleshooting, https://do-something.jp/lol-liveclienapi/, https://mein-mmo.de/lol-riot-verbietet-ultimate-time-tracker/
