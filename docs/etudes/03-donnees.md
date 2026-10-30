# 03 · Données : sources, fraîcheur, pipeline

Recherche du 30/10/2026. Patch live 16.21 (affiché « 26.21 » en jeu, sorti le 21/10). Prochains patchs selon Riot : 26.22 le 04/11, 26.23 le 18/11, 26.24 le 09/12.

Légende : **[V]** = vérifié (source lue ou donnée récupérée, URL en fin de document). **[H]** = hypothèse, ou info que je n'ai pas pu confirmer pour fin 2026.

## L'essentiel

1. **Pas besoin de crawler Riot nous-mêmes pour la méta.** Les sites agrégés analysent 3 à 10 fois plus de parties qu'une clé personnelle ne le permet, et leurs fichiers sont refaits chaque nuit.
2. **u.gg est la meilleure source qu'on peut lire sans accord préalable.** Ce sont des fichiers JSON publics sur CDN, découpés par patch, région, rang et rôle. Ils couvrent les matchups de lane, les duos et l'ARAM, et sont refaits vers 05:00 UTC. Limite : rien n'est documenté et u.gg n'a pas donné d'autorisation explicite.
3. **Lolalytics est la source la plus riche** : matchups contre les 5 rôles adverses, synergies avec les 4 alliés. Mais son API est privée, donc on ne l'utilise qu'avec son accord. DraftGap (outil open source, licence MIT) l'interroge chaque jour et republie un dataset public.
4. **Matchups et synergies sont de petits effets.** L'écart réel typique est de ±1,7 point en lane, ±1,2 pour un duo bot+support et ±0,8 pour jungle+mid. Pour que le signal égale le bruit, il faut environ 900, 1 700 et 3 500 parties. Un winrate perso calculé sur 20 à 100 parties est du bruit s'il est lu brut.
5. **Pour les stats perso, le LCU suffit sans clé API.** Il donne le rang, les maîtrises, les champions jouables, l'historique détaillé et le bilan de saison par champion. Une clé personnelle Riot (gratuite, prévue pour « une petite communauté privée ») complète pour l'historique long et pour les potes dont le PC est éteint.
6. **Pipeline proposé.** Un job GitHub Actions quotidien produit un fichier compact par tranche d'elo, d'environ 2,4 Mo compressé, publié en statique. Le compagnon le télécharge une fois par jour et calcule en local. Coût : 0 €.

## 1. Besoins et fraîcheur utile

| Donnée | Fraîcheur utile | Meilleure source | Remarque |
|---|---|---|---|
| Winrate, pickrate, banrate par rôle, elo, patch | J-1 | u.gg `rankings` | 16 tranches de rang, 18 régions |
| Matchups de lane | J-1 | u.gg `matchups`, lolalytics | u.gg : même lane uniquement |
| Matchups hors lane (ton mid contre leur jungle) | J-1 | lolalytics (avec accord) ou DraftGap | absents chez u.gg |
| Synergies duo (jg-mid, adc-sup, top-jg, jg-sup) | J-1 | u.gg `champion_duos` | un seul rôle partenaire par rôle |
| Synergies toutes paires alliées | J-1 | lolalytics, DraftGap | |
| Stats de compo à 5 | — | aucune | trop de combinaisons : à modéliser avec les attributs des champions |
| ARAM | J-1 | u.gg `normal_aram`, OP.GG MCP | tous rangs confondus uniquement |
| Données statiques | à chaque patch | client local, CommunityDragon, Data Dragon | |
| Perso | après chaque partie | LCU, Riot match-v5 | |

« Temps réel » ne concerne que la draft, déjà réglée par le LCU. Pour les stats, J-1 suffit : un jour représente environ 7 % des parties d'un patch de 14 jours.

## 2. Ce que les sites publics exposent vraiment

### u.gg [V]

- **Manifestes.**
  - `static.bigbrain.gg/.../ugg/patches.json` liste les patchs, « 16_21 » en tête.
  - `ugg-api-versions.json` donne, pour chaque patch, la version de chaque fichier (matchups 1.5.0, etc.).
- **Fichiers par champion :** `stats2.u.gg/lol/1.5/{fichier}/{patch}/{file}/{championId}/1.5.0.json`.
  - Fichiers testés : `rankings`, `matchups`, `champion_duos`, `overview`, `counters`. `duos` répond 403.
  - Files testées : `ranked_solo_5x5`, `normal_aram`.
- **Structure :** `{région: {rang: {rôle: [données, horodatage]}}}`.
  - Régions : 2 = EUW, 12 = monde.
  - Rôles : 1 jungle, 2 support, 3 adc, 4 top, 5 mid.
  - Rangs : 1 challenger, 2 master, 3 diamant, 4 platine, 5 or, 6 argent, 7 bronze, 8 tous, 10 platine+, 11 diamant+, 12 fer, 13 GM, 14 master+, 15 diamant 2+, 16 émeraude, 17 émeraude+. J'ai vérifié ce code par addition : pour Ahri mid EUW, platine+ (84 832) = platine 38 519 + émeraude 26 700 + diamant 12 174 + master+ 7 439.
- **`matchups` :** une ligne `[champion, victoires, parties, écarts d'or et d'xp…]` par adversaire de la même lane.
  - Ahri mid, monde, émeraude+, 16.21 : 162 953 parties.
  - Contre Syndra : 8 555 parties, 4 253 victoires.
- **`champion_duos` :** un seul rôle partenaire par rôle. Mid et top sont associés à la jungle, jungle au support, adc au support, support à l'adc. Exemple : Lee Sin jungle avec Thresh, 16 155 parties.
- **`rankings` :** `[victoires, parties, place, nb de champions, …]`. Ahri mid monde émeraude+ : 84 169 victoires sur 163 652 parties (51,4 %), 8e sur 58.
- **L'elo change les chiffres.** Ahri mid EUW passe de 49,1 % en fer à 50,2 % en argent, 51,3 % en or et 52,0 % en platine. Il faut donc la tranche du joueur, pas une moyenne tous rangs.
- **ARAM :** uniquement la tranche « tous rangs » et le rôle « aucun ». Ahri : 24 751 parties monde, 7 674 EUW sur 16.21.
- **Fraîcheur.** Les horodatages internes du 30/10 vont de 05:02 à 07:21 UTC. En-têtes : `Last-Modified: 30 Oct 2026 05:00 GMT`, `Cache-Control: max-age=14400`. La mise à jour est au moins quotidienne.
- **Poids.**
  - Par champion : `matchups` 2,76 Mo brut (0,93 Mo compressé), `champion_duos` 2,0 Mo (0,85 Mo compressé), `rankings` 0,36 Mo.
  - Pour ~172 champions : environ 200 à 300 Mo compressés par collecte.
- **Limites.**
  - Pas de matchups hors lane, pas de synergies sur toutes les paires.
  - Pas de documentation. La page des CGU renvoie 403 à mes outils, je n'ai donc pas pu la lire.
  - Des projets open source s'en servent depuis des années (uggo, manaflux, Legendary Rune Maker).

### Lolalytics [V partiel]

- **Volume.** Le tier list 16.21 affiche « Emerald+ Champions Analysed: 18,087,041 ». Avec 10 champions par partie, cela fait environ 1,8 M parties Émeraude+ en 9 jours, soit à peu près 200 000 par jour, toutes régions.
- **Méthode.** Le site décrit sa méthode ainsi : « based upon individual player tiers which includes all games by all players of a given bracket ».
- **API interne `a1.lolalytics.com/mega/?ep=…`.**
  - `ep=list` renvoie bien du JSON.
  - D'après le code de DraftGap, les données de synergie viennent de `ep=build-team` (synergies avec les 4 rôles alliés). Les données de matchup viennent du JSON intégré aux pages champion : matchups contre les 5 rôles adverses, winrate par durée de partie, profil de dégâts.
  - Je n'ai pas interrogé ces endpoints : mes garde-fous l'ont refusé, et le site ne publie aucune condition d'utilisation.
- **Conclusion :** c'est la source la plus adaptée au besoin, à utiliser seulement avec un accord écrit.

### DraftGap [V]

- **Projet.** Outil de draft open source (MIT), dernier commit le 10/10/2026.
- **Collecte.** Le workflow `dataset.yml` (`cron: "0 12 * * *"`) interroge lolalytics : Émeraude+, toutes régions, ranked.
- **Fichiers publiés** dans `bucket.draftgap.com/datasets/v5/` :
  - `30-days.json` : 54,3 Mo, 9,9 Mo compressé, `Last-Modified` le 29/10/2026 à 18:00 UTC.
  - `current-patch.json` : sans matchups ni synergies.
- **Contenu du 30 jours.** 5,66 M parties. Pour chaque champion et rôle : parties, victoires, matchups contre les 5 rôles, synergies avec les 4 rôles, profil de dégâts, winrate par durée de partie. Le winrate moyen est ramené à 50,0 % (fonction `removeRankBias`, qui corrige le biais des données filtrées par rang).
- **Positionnement.** La FAQ indique une mise à jour toutes les 12 heures. DraftGap se limite à Émeraude+ pour ne pas « imposer plus de coût » à Lolalytics.
- **Intérêt et limites.**
  - Intérêt : démarrage immédiat et bons priors.
  - Limites : la fenêtre de 30 jours chevauche deux patchs, il n'y a qu'une tranche d'elo, et on dépend d'un tiers. Il faut demander à l'auteur avant de s'y brancher.

### OP.GG MCP [V]

- **Accès.** Serveur officiel d'OP.GG pour agents IA : `https://mcp-api.op.gg/mcp`. Il fonctionne sans authentification : j'ai testé `tools/list` et un appel. Dépôt MIT, mis à jour le 29/10/2026.
- **`lol_get_champion_analysis`.** Paramètres : `game_mode` (ranked, flex, urf, aram, nexus_blitz), `position`, `tier`. La réponse contient les stats du champion, ses 3 meilleurs et 3 pires matchups et 3 synergies par rôle, avec parties et victoires. Exemple : Ahri mid, 169 531 parties, 51 %.
- **Autres outils :** profil et historique d'un Riot ID, synergies par rôle allié.
- **Limites.** Les listes sont coupées à 3 entrées, il n'y a pas de filtre de région, et c'est conçu pour un LLM. Utile pour une vérification croisée ou en plan C, pas pour une matrice complète.

### Autres [H]

- **Mobalytics :** API GraphQL interne, non documentée, je ne l'ai pas vérifiée.
- **League of Graphs, METAsrc :** pages HTML seulement, je n'ai pas trouvé d'endpoint JSON. Les scraper serait fragile. Je n'ai pas creusé plus loin.

### Comparatif

| Source | Accès | Lane | Hors lane | Synergies | Elo | Région | ARAM | Rafraîchissement | Statut |
|---|---|---|---|---|---|---|---|---|---|
| u.gg | JSON sur CDN | oui | non | 1 partenaire | 16 tranches | 18 | tous rangs | quotidien | non documenté |
| Lolalytics | API privée | oui | oui | 4 rôles | oui | oui | oui | ? | accord requis |
| DraftGap | JSON public | oui | oui | 4 rôles | Émeraude+ seul | monde | non | quotidien (30 j) | dépend d'un tiers |
| OP.GG MCP | officiel | top 3 | non | top 3 | oui | non | oui | ? | officiel, tronqué |

## 3. Construire notre propre dataset avec Riot Match-V5

### Limites de débit [V, portail Riot]

- **Clé personnelle :** 20 requêtes/s et 100 requêtes/2 min. Elle est prévue pour « just the developer or a small private community », pas pour un produit public.
- **Clé de production :** 500 requêtes/10 s et 30 000 requêtes/10 min.
- Les limites s'appliquent par région.
- La clé de développement expire toutes les 24 h, donc elle est inutilisable pour un job automatique.

### Calcul

- **Clé perso, crawler 24 h/24 :**
  - 100 / 120 s = 0,83 requête/s, soit 72 000 requêtes par jour sur la route `europe`.
  - Une partie coûte une requête (`matches/{id}`).
  - Pour trouver les parties : `league-v4 entries/{file}/{tier}/{division}` (qui inclut le puuid), puis `matches/by-puuid/{puuid}/ids` (100 ids maximum par appel). Ce surcoût est d'environ 10 %.
  - Résultat : à peu près 65 000 parties/jour, soit environ 900 000 par patch de 14 jours.
- **Clé perso dans GitHub Actions** (un job dure au maximum 6 h) : 6 × 3 000 = 18 000 requêtes, soit à peu près 16 000 parties/jour et 225 000 par patch.
- **Clé de production :** 50 requêtes/s, soit 4,3 M par jour. Elle est réservée aux produits publics, donc hors sujet ici.

### Combien de parties faut-il ?

J'ai mesuré la taille réelle des effets sur le dataset 30 jours (5,66 M parties Émeraude+). Méthode : pour chaque matchup, je compare le winrate observé au winrate attendu à partir des winrates de base des deux champions (modèle logit additif), puis je retire la variance due au hasard.

| Type de cellule | Écart réel typique (σ) | Parties pour signal = bruit (0,25/σ²) |
|---|---|---|
| Lane contre lane | 1,6 à 1,8 pt | ~900 |
| Bot + support | 1,2 pt | ~1 700 |
| Jungle + mid | 0,8 à 0,9 pt | ~3 000 à 4 000 |

Repère : sur n parties, l'erreur type d'un winrate vaut 50/√n points. Elle est de ±2,5 pt à 400 parties, ±1,6 pt à 1 000 et ±1,0 pt à 2 400.

### Couverture selon la taille de l'échantillon

Le tableau donne la part des cellules réellement rencontrées en partie (pondérées par leur fréquence) qui atteignent le seuil, pour une tranche d'elo. Ce sont des extrapolations linéaires à partir du dataset 30 jours.

| Parties dans la tranche | Lane ≥400 | Lane ≥1000 | Bot+sup ≥1000 | Jg+mid ≥2400 |
|---|---|---|---|---|
| 100 k (début de patch, crawl perso) | 14 % | 4 % | 13 % | 0 % |
| 300 k (patch entier en GitHub Actions) | 46 % | 18 % | 42 % | 0 % |
| 700 k (crawl perso 24/7) | 70 % | 44 % | 64 % | 7 % |
| 1,8 M (lolalytics Émeraude+ sur 16.21) | 85 % | 71 % | 81 % | 40 % |
| 5,65 M (lolalytics sur 30 jours) | 93 % | 87 % | 91 % | 73 % |

**Conclusion.**

- Un crawl perso dans GitHub Actions donne des matchups exploitables dans moins d'un cas sur cinq.
- Même en 24/7 sur un serveur, on reste en dessous de u.gg et de lolalytics.
- Le crawl perso ne vaut le coup que pour trois choses : les données perso, un contrôle de cohérence, et un plan B si les sites ferment.
- La synergie jungle+mid restera presque toujours du bruit, quelle que soit la source. Il faut lui donner peu de poids.

### Où faire tourner un crawler 24/7

- **GitHub Actions.** Les CGU (version du 27/08/2026) interdisent de l'utiliser « as part of a serverless application ». Sur les machines de GitHub, elles excluent aussi toute activité « unrelated to the production, testing, deployment, or publication of the software project ».
  - Un build quotidien de données publiées avec l'appli reste un usage normal [H, c'est mon interprétation].
  - Un crawler permanent est en zone grise.
- **Cloudflare Workers gratuit :** 10 ms de CPU et 50 sous-requêtes par exécution, 5 crons par compte. Trop juste pour analyser des parties.
- **Oracle Always Free :** VM gratuite, mais il faut une carte bancaire. Selon la presse, les quotas ont été réduits en 2026, et les instances inactives sont récupérées par Oracle [H].
- **Le PC de Thomas :** possible, avec la clé stockée chez lui. Elle ne doit jamais être dans le binaire du compagnon (règle Riot).

## 4. Jeux de données ouverts [V : rien d'utilisable]

- Kaggle et Hugging Face : par exemple `hca97/LeaugeofLegendRankedMatches`, environ 494 k lignes, sans indication de patch.
- Datasets pro : IEEE, de 2019 à 2024.
- Riot ne publie aucun dump.

Rien de tout cela ne permet une méta par patch. Le seul dataset ouvert à jour est celui de DraftGap.

## 5. Données perso sans clé : le LCU

J'ai vérifié ces endpoints dans le schéma swagger généré automatiquement depuis le client 16.21.829.8620 (dépôt `dysolix/hasagi-types`, mis à jour le 27/10/2026). Tous sont en GET, sauf `scouting`.

| Endpoint | Ce qu'on obtient |
|---|---|
| `/lol-summoner/v1/current-summoner` | puuid, Riot ID |
| `/lol-ranked/v1/current-ranked-stats` | par file : tier, division, LP, victoires, défaites, plus haut rang, rang de fin de saison précédente |
| `/lol-champion-mastery/v1/local-player/champion-mastery` | par champion : niveau, points, `lastPlayTime`, jalons de saison, meilleure note |
| `/lol-champions/v1/owned-champions-minimal`, `/lol-champ-select/v1/pickable-champion-ids` | champions possédés et jouables : on ne recommande jamais un champion injouable |
| `/lol-match-history/v1/products/lol/current-summoner/matches?begIndex&endIndex` | liste des parties : file, durée, version, champion, KDA |
| `/lol-match-history/v1/games/{gameId}` | partie complète : les 10 participants, leurs stats, lane et rôle, écarts de cs, d'xp et d'or par minute. Permet de retrouver les matchups qu'on a subis |
| `/lol-match-history/v1/game-timelines/{gameId}` | timeline de la partie |
| `POST /lol-champion-mastery/v1/scouting` (corps : liste de puuid) | `topSeasonChampions` : championId, victoires, parties et KDA de la saison (la fonction « scouting » du client) |
| `/lol-patch/v1/game-version` | version exacte du client, pour charger les données du bon patch |
| `/lol-gameflow/v1/gameflow-phase` | détecte la fin de partie, pour mettre à jour les stats perso |

**À tester sur le vrai client [H].**

- La profondeur réelle de l'historique : jusqu'où on peut remonter avec `begIndex`/`endIndex`. Les outils communautaires se limitent à 20 parties par appel.
- Le contenu exact de `scouting` : ranked seulement ? combien de champions ?

Un script d'une vingtaine de lignes dans `lcu-poc` suffit.

**Riot API en complément** (clé perso, utilisée côté serveur) [V, miroir de la doc de novembre 2025].

- Endpoints : `match-v5 by-puuid/ids` (count de 0 à 100, horodatage disponible depuis le 16/06/2021), `matches/{id}`, `league-v4 entries/by-puuid`, `champion-mastery-v4`.
- Coût : environ 300 requêtes par pote pour récupérer l'historique au départ (à peu près 6 minutes chacun), puis 5 à 10 par pote et par jour.
- Avantage : les potes n'ont rien à faire à part donner leur Riot ID, et ça marche même PC éteint.
- Il existe aussi `lol-rso-match-v1` (passe par la connexion Riot du joueur et inclut les parties personnalisées). Je suppose qu'il est réservé aux produits validés [H].

**Bruit perso.** Sur 20 parties avec un champion, l'erreur type vaut ±11 points. Sur 100 parties, ±5 points.

- On n'affiche jamais un winrate perso brut comme un fait.
- On s'en sert comme indice de confort (nombre de parties, maîtrise, récence), en le ramenant vers la moyenne du champion.

**Règles Riot qui touchent ces données [V].**

- « Products cannot identify or analyze players who are deliberately hidden by the game ».
  - En ranked solo/duo, on ne traite que le joueur local et les membres de son groupe.
  - Un pote inscrit qui se retrouve dans ta partie sans être dans ton groupe ne doit pas être reconnu.
- « Prohibited alternatives include MMR or ELO calculators » : on choisit la tranche de stats d'après le rang affiché, jamais d'après une estimation du MMR.
- « Apps that dictate player decisions » sont listées comme non approuvées, et « Products should increase, and not decrease the diversity of game decisions ». Il faut donc toujours proposer plusieurs options.
- « Products cannot display win rates for Augments » : en ARAM Mayhem, aucun winrate d'augment.
- « Do not include your API key in your code, especially if you plan on distributing a binary » : la clé reste côté serveur.
- Confidentialité : l'historique des potes ne va jamais dans un dépôt public.

## 6. Données statiques [V]

- **Data Dragon.**
  - `versions.json` : 16.21.1 en tête.
  - `champion.json` fr_FR : 172 champions, 160 Ko, avec tags (Fighter, Mage…), `partype` et `info` (attack, defense, magic, difficulty).
  - Riot le met à jour à la main après chaque patch, donc parfois avec du retard.
- **CommunityDragon.**
  - `champion-summary.json` : rôles.
  - `champions/{id}.json` : `tacticalInfo.damageType` (kMagic, kPhysical, kMixed), `attackType`, `playstyleInfo` (damage, durability, crowdControl, mobility, utility).
  - `content-metadata.json` : version (16.21.8298620).
- **Le client local** sert ces mêmes données : le chemin `/lol-game-data/assets/v1/champion-summary.json` est déjà utilisé par le PoC. Elles sont toujours synchronisées avec le patch installé, sans réseau. C'est la source principale pour le compagnon, avec CommunityDragon et Data Dragon en secours.
- **Profil de dégâts réel** (part physique, magique, vraie) : présent dans les données lolalytics et DraftGap. C'est plus fiable que l'étiquette de CommunityDragon pour juger l'équilibre AD/AP d'une compo.

## 7. ARAM

- **Files.** Les files 450 (ARAM) et 2400 (ARAM: Mayhem) figurent dans `queues.json` de Riot [V].
- **Pas de draft.** Le LCU expose `benchEnabled`, `benchChampions`, `allowRerolling` et `rerollsRemaining` [V, schéma]. La recommandation devient : quel champion garder ou prendre sur le banc.
- **Stats.**
  - u.gg `normal_aram` : tous rangs, environ 25 k parties par patch pour un champion populaire.
  - OP.GG MCP avec `game_mode: aram`.
- **Matchups et synergies ARAM :** aucune source fiable, et trop peu de parties. On modélise la compo (dégâts, tank, contrôle, poke) à partir des attributs statiques.
- **ARAM Mayhem chez u.gg :** pas vérifié [H].

## 8. Pipeline recommandé

```
GitHub Actions — cron quotidien 06:17 UTC, et toutes les heures le mercredi de patch
 1. Versions : DDragon versions.json, u.gg patches.json + ugg-api-versions.json
 2. Collecte : u.gg rankings + matchups + champion_duos (ranked) et rankings (ARAM),
    ~172 champions, ~700 requêtes en série, User-Agent honnête avec contact
    [+ lolalytics ou DraftGap uniquement après accord]
 3. Normalisation dans un schéma maison, indépendant de la source :
    {patch, file, tranche, type, rôleA, champA, rôleB, champB, parties, victoires}
 4. Contrôles : schéma, totaux comparés à la veille (±50 %), champions manquants
    → si échec : on garde le fichier précédent + alerte ntfy
 5. Publication : stats/{patch}/{tranche}.json.gz + manifest.json
    (patch, date, sources, totaux, sha256) sur GitHub Pages ou dans une Release
 6. Optionnel, clé perso en secret : rattrapage match-v5 des Riot ID inscrits
    → dépôt privé
Compagnon (sur le PC de chaque pote)
 - Au démarrage puis toutes les 6 h : GET manifest.json (ETag),
   puis le fichier de sa tranche s'il a changé
 - Lit le LCU : rang, maîtrises, champions jouables, historique, scouting, draft en direct
 - Calcule en local et n'envoie au téléphone que le résultat (quelques Ko)
```

- **Où.** GitHub Actions.
  - Dépôt public : gratuit et illimité.
  - Dépôt privé : 12 $ de calcul inclus par mois (environ 2 000 minutes Linux). Un job de 15 minutes par jour en consomme environ 450.
  - Les crons peuvent être retardés aux heures de pointe : c'est pour ça que le job démarre à 06:17 et pas à l'heure pile.
  - Sur un dépôt public, les crons sont désactivés après 60 jours sans activité. Le commit quotidien du job devrait compter comme activité [H].
- **Stockage.**
  - GitHub Pages ou les fichiers d'une Release [H sur les limites exactes de Pages].
  - On garde les 3 derniers patchs pour servir de priors.
  - Cloudflare R2 gratuit (10 Go) en option.
- **Tranches.**
  - Celles des potes (par exemple or, platine, émeraude+) sur la région monde, plus EUW si l'échantillon suffit.
  - Les matchups se calculent sur le monde. Chez u.gg, l'EUW pèse environ 28 % du volume mondial, et l'écart entre régions est probablement plus petit que le bruit [H].
- **Taille côté compagnon.**
  - Une tranche complète (stats de base, matchups toutes positions, synergies, cellules d'au moins 30 parties) pèse 7,8 Mo en JSON et 2,4 Mo compressée (mesuré sur le dataset 30 jours).
  - Avec u.gg seul (lane et duo) : environ 1 Mo.
  - Un téléchargement par jour.
- **Jour de patch** (mercredi).
  - Le job tourne toutes les heures jusqu'à ce que u.gg publie le nouveau patch.
  - Les premiers jours, on mélange nouveau et ancien patch selon le nombre de parties : le nouveau pèse n/(n+k), avec k ≈ 900 pour une lane.
  - Les champions modifiés par le patch sont marqués « incertain ». Un nouveau champion affiche « pas encore de données ».
  - Le compagnon lit la version du client (`lol-patch`) pour ne jamais mélanger deux patchs.
- **Coût :** 0 €.

## 9. Fragilités et plans B

| Risque | Effet | Plan B |
|---|---|---|
| u.gg change de format (1.5 → 1.6) | le build échoue | lire `ugg-api-versions.json`, valider, garder le dernier fichier valide, alerte ntfy |
| u.gg bloque la collecte | plus de mise à jour | rythme bas (1 fois par jour, en série) ; bascule sur lolalytics ou DraftGap (si accord), ou sur OP.GG MCP pour les stats de base |
| Pas d'accord de lolalytics | pas de matchups hors lane | ces effets ont peu de poids de toute façon ; crawl perso plus tard |
| Le LCU change (API non supportée) | la collecte perso casse | suivre le schéma hasagi-types patch par patch ; Riot API en secours |
| Clé perso refusée ou révoquée | pas d'historique côté serveur | LCU seul |
| Cron GitHub en retard ou désactivé | données plus vieilles | le compagnon affiche l'âge des données ; alerte au-delà de 36 h |
| Data Dragon en retard le jour du patch | noms ou icônes manquants | données du client local, puis CommunityDragon `latest` |
| Données perso publiées par erreur | fuite | jamais de données perso dans un dépôt public |

## 10. Reste à vérifier

- **LCU sur le vrai client** : profondeur de l'historique, contenu de `scouting`, présence de `/lol-game-data` (très probable : CommunityDragon en est l'extraction).
- **u.gg** : ce qui sort pour ARAM Mayhem, et l'heure de publication d'un nouveau patch.
- **Lolalytics** : cadence et conditions, à obtenir par écrit.
- **Clé perso Riot** : délai d'approbation. Une seule source anecdotique parle d'une approbation automatique.

## Sources

- Riot, portail développeur (limites, types de clé) : https://developer.riotgames.com/docs/portal
- Riot, docs LoL (LCU non supporté, politique de jeu) : https://developer.riotgames.com/docs/lol
- Riot, politiques générales (mise à jour du 29/05/2025) : https://developer.riotgames.com/policies/general
- Riot, calendrier des patchs 2026 : https://support.riotgames.com/en-us/league-of-legends/gameplay/patch-schedule-league-of-legends
- Riot, files : https://static.developer.riotgames.com/docs/lol/queues.json
- Miroir de la doc match-v5 et league-v4 (novembre 2025) : https://github.com/chirpon9/riot-docs-mcp
- Data Dragon : https://ddragon.leagueoflegends.com/api/versions.json
- CommunityDragon : https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json
- u.gg : https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/ugg/ugg-api-versions.json et https://stats2.u.gg/lol/1.5/matchups/16_21/ranked_solo_5x5/103/1.5.0.json
- Lolalytics : https://lolalytics.com/lol/tierlist/
- DraftGap (code, workflow, FAQ) : https://github.com/vigovlugt/draftgap ; dataset : https://bucket.draftgap.com/datasets/v5/30-days.json
- OP.GG MCP : https://github.com/opgginc/opgg-mcp ; endpoint https://mcp-api.op.gg/mcp
- Schéma LCU : https://github.com/dysolix/hasagi-types
- GitHub Actions (limites, facturation, cron, CGU du 27/08/2026) : https://docs.github.com/en/actions/reference/limits ; https://docs.github.com/en/billing/concepts/product-billing/github-actions ; https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows ; https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features
- Cloudflare Workers (limites) : https://developers.cloudflare.com/workers/platform/limits
- Oracle Always Free : https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm
