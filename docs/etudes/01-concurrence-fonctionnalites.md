# Concurrence et fonctionnalités : outil de draft LoL pour Thomas et ses potes

État au 30/10/2026, patch 16.21 (26.21 côté marketing), EUW.
Légende : **[V]** = vérifié, j'ai lu la source (URL en fin de document). **[H]** = hypothèse ou info non confirmée pour fin 2026.

---

## En bref

- Oui, une dizaine d'outils suggèrent déjà des picks en direct pendant la sélection des champions. Ceux qui vont le plus loin sont iTero, LoLDraftAI, DraftGap, Baron Buff et DraftForge, devant Porofessor, Blitz, U.GG et OP.GG.
- Le téléphone comme second écran existe déjà. Blitz le fait avec une appli mobile mal notée, et Baron Buff via un QR code qui ouvre la draft dans le navigateur du téléphone, sans appli à installer.
- Aucun outil trouvé ne fait de **coordination entre amis d'un même groupe** : vue partagée des 5, choix conjoint de qui prend quoi, échanges de picks.
- La personnalisation existe partout sur le papier, mais elle reste opaque. Aucun outil ne montre la taille d'échantillon de tes propres stats ni ne signale le bruit.
- Le draft pèse peu dans la victoire. Les prédictions sur le seul draft plafonnent vers 54 à 57 % de réussite. Le confort sur le champion pèse plus lourd : moins de 10 000 points de maîtrise, c'est environ 44 % de victoires.
- Faire mieux, c'est donc pondérer correctement le confort et éviter les pièges, plus que chercher le meilleur contre-pick théorique.

---

# PARTIE A : benchmark

## A1. Ce que fait chaque outil pendant la sélection

| Outil | Pendant la sélection | Méthode et transparence | Perso (pool, perf) | Plateforme, poids | Pubs, prix | Mobile, groupe |
|---|---|---|---|---|---|---|
| **Porofessor** | Suggestions de bans, conseils de contre-pick, import runes, sorts et build. Scouting des joueurs (rang, win rate sur le champion, KDA, historique 30 j) **[V]** | Opaque. Un test (biaisé, auteur lié à iTero, 03/2026) parle de 5 choix « sans contexte » qui ressemblent au pick méta **[V]** | Non visible | Overwolf 3,0 Mo ou Electron 99,8 Mo, v2.16.41 du 28/10/2026, 17,7 M téléchargements **[V]**. Version autonome sortie le 05/12/2025 **[V]** | Pubs, premium | Pas de mobile, pas de groupe |
| **Blitz** | Recos pick et ban selon « tes perfs passées, ta compo, les adversaires, la méta », import auto des runes, sorts et objets **[V]** (App Store) | Opaque. Le même test juge les recos proches des win rates moyens, sans explication **[V]** | Annoncée, non détaillée | Appli native Windows et Mac **[V]**. Poids non publié | Pubs lourdes en gratuit. Premium 4,99 $/mois **[H]** (prix de tiers) | **Appli mobile pour drafter depuis le téléphone**, PC allumé et compte connecté. Note 2,7/5 sur 6 avis datés de 2022-2023 : on ne sait pas si elle est maintenue **[V]** |
| **U.GG** | « Champion Select Scouting » (meilleurs picks, contres, synergies), import auto des loadouts selon elo, rôle et matchup **[V]** (extrait de u.gg/app, page bloquée en lecture directe) | Opaque | « Personal counters » réservé au payant U.GG Plus, 3,99 $/mois **[H]** | Appli Electron LoL, Valorant et Deadlock | Pubs, Plus sans pub | Non |
| **Mobalytics** | Recos pick et ban dès que tu survoles un champion, contre-picks proposés à toi et aux alliés qui n'ont pas pické **[V]** (extraits de leurs guides) | Le test de 03/2026 parle d'une « tier list déguisée » **[V]** | Le score GPI existe, son lien avec les picks est flou | Overwolf et version autonome. La plus gourmande en RAM selon buildzcrank (concurrent) | Pubs, premium | Non |
| **OP.GG Desktop** | Recos pick et ban, builds perso, import, overlays (jungle, inhibs, anti-soin), un « AI Agent » vocal **[V]** | Opaque | Non visible | Windows et Mac. v2.5.2 du 30/07/2026 ajoute League Classic **[V]**. A retiré son overlay de suivi des sorts en 08/2025 **[H]** (source concurrente) | Pubs | Non |
| **DraftGap** | Picks selon la méta, **les 25 matchups croisés** et **les 10 duos alliés**. Analyse de draft complète, synchro auto avec le client **[V]** | **Transparent et open source (MIT)**. Modèle additif sur échelle Elo, lissage bayésien de 250 à 3 000 parties fictives selon le « risk level », prior sur 30 jours. Données Lolalytics **[V]** (code lu) | Favoris uniquement | Web et appli de bureau. Release 3.2.2 du 10/10/2026 **[V]** | Gratuit, sans pub | Non |
| **LoLDraftAI** | Réseau de neurones qui lit les 10 picks d'un coup. Mode « counterpick adjusted » pour les blind picks. Runes et build **[V]** | Boîte noire. 56,7 % de précision sur le seul draft, chiffre annoncé par l'éditeur. Modèle 16.21 du 24/10, ré-entraîné chaque semaine **[V]** | Favoris par lane | Web et appli Windows qui lit le client **[V]** | Gratuit limité. 3,99 $/mois, ou 29,99 $/mois avec le pro play **[V]** | Non |
| **iTero** | « AI Drafting Coach » qui analyse les 2 équipes, **ton historique et ton pool**. Plan de match après le lock **[V]** | Explique « pourquoi », d'après un article d'iTero **[V]** | Oui, annoncée, méthode non publiée | Overwolf v3.11.7 du 13/10/2026, Electron 152 Mo, 1,13 M téléchargements **[V]** | Gratuit avec pubs. Payant sans pub, prix non affiché | « 2nd monitor support », pas de mobile **[V]** |
| **Lolalytics** | Pas d'outil de draft. C'est **la source de données** : matchups avec Delta 1 et Delta 2, synergies, nombre de parties, filtres elo et période **[V]** | Nombre de parties affiché partout | n/a | Site web | Pubs | n/a |
| **League of Graphs** | Pas d'outil de draft. Site de stats du même groupe que Porofessor (Wargraphs, racheté par M.O.B.A. Network en 2023) **[V]** | | | Web | Pubs | n/a |

**Nouveaux venus 2025-2026 (vérifiés sur leurs propres pages)** :

- **Baron Buff** : le concurrent le plus proche de notre idée. Connecteur Windows distribué sur le Microsoft Store, sans Overwolf ni Electron, environ 70 Mo de RAM. Les recos utilisent les contres, la synergie, la compo et « les champions que tu joues vraiment ». Une icône pendant la sélection affiche un QR code : on le scanne et la draft s'ouvre en direct **dans le navigateur du téléphone, sans appli**. Sans pub, gratuit, payant pour plusieurs pools par rôle et l'import auto. Rien sur les premades.
- **DraftForge** (alpha v1.6.1) : lit la draft via le client. Pools perso par rôle, badge « RISK » quand un pick peut se faire contrer, plan de jeu après le lock. Un « Tournament Hub » scoute 5 adversaires pour Clash. Gratuit pendant la bêta.
- **Mejais** (Overwolf) : 3 scores visibles, force (OP), synergie (SY) et contre (CO). Le poids des contres et de la synergie augmente au fil de la draft. Bonus pour les favoris, calcul local, sans compte.
- **LoLTheory** (Overwolf, 184 k téléchargements, MAJ 07/06/2026) : au choix, recos « perso selon ton historique » ou « standard », plus suggestions de bans. Avec pubs.
- **Hexgate** (Tauri, moins de 100 Mo) : cibles de ban, contres, import des runes et du build en un clic, fenêtre dédiée Swiftplay.
- **LoL Brain** : calculateur web et appli. Propose « Should I Queue » et une détection du tilt. Données mises à jour le 28/10/2026.
- **Smartpick** : draft en direct, moteur opaque.
- **Lexu.gg** : accepter la partie, bannir et picker **depuis le téléphone**. C'est de la télécommande, contraire à notre règle de lecture seule.

## A2. Statut après le blocage mémoire du 06/10/2026

- **[V]** Riot ne publie aucune liste d'applis touchées et ne garantit le fonctionnement d'aucune. Le blocage ne vise que la lecture de la mémoire du jeu. Les outils connus ont jusqu'en avril 2027 pour passer aux API officielles.
- **[V]** Au 07/10 puis au 21/10/2026, deux articles n'ont trouvé **aucune déclaration** de Porofessor, Blitz, Mobalytics, U.GG ni OP.GG.
- **[V]** Porofessor a sorti une mise à jour le 28/10/2026 et iTero le 13/10/2026 : les deux sont toujours actifs.
- **[H]** Toutes les fonctions de sélection reposent sur l'API locale du client (LCU), qui n'est pas de la mémoire de jeu : elles devraient continuer à marcher. Les overlays en jeu passent en général par Overwolf ou par l'API de partie en cours du port 2999. Aucun cas de casse confirmé trouvé.
- Pour nous, ce blocage ne change rien : on ne lit jamais la mémoire du jeu. Le vrai risque reste que Riot modifie la LCU sans prévenir.

## A3. Ce que pèse vraiment le draft (pour calibrer les promesses)

- **[V]** Sur plus d'un million de parties solo (iTero, 09/2022), la grande majorité des champions sont entre 46 et 54 % de victoires. Le matchup mid contre mid est le plus important. Les contres hors lane, comme le mid contre le jungler ennemi, comptent aussi.
- **[V]** Sur plus d'un million de parties en patch 13.7, niveau Gold (iTero, 04/2023) : moins de 10 000 points de maîtrise donnent environ 44 % de victoires, au-delà c'est 50 % et plus, puis ça plafonne. L'auteur estime le seuil à une vingtaine de parties sur le champion. Le confort compte bien plus en jungle qu'en ADC.
- **[V]** Prédire le résultat à partir du seul draft donne environ 54 % de réussite dans une thèse (CTU) et 56,7 % chez LoLDraftAI (chiffre de l'éditeur).
- **Conséquence [H]** : un bon draft rapporte quelques points de win rate. Proposer un contre que le joueur n'a jamais joué peut lui en coûter 6. Le facteur confort doit donc pouvoir l'emporter sur le contre. Ces études datent de 2022-2023 : à re-mesurer sur nos propres données.

## A4. Où ils sont imbattables, où sont les trous

**Imbattables (inutile de lutter)** :

1. **Volume de données.** Lolalytics compte 18 055 567 champions joués en Emerald+ sur 16.21 en une dizaine de jours. LoLDraftAI ré-entraîne son modèle chaque semaine sur des millions de parties. On ne collectera jamais ça : il faudra réutiliser leurs agrégats publics.
2. **Builds et runes**, avec l'import automatique en un clic.
3. **Overlays en jeu** (Overwolf, période de grâce), support Mac, équipes de dev à plein temps.
4. **Notoriété et statut « outil connu »** auprès de Riot.

**Trous réels qu'on peut exploiter** :

1. **Le groupe.** Aucun outil ne sait que les 4 alliés de ta flex sont tes potes, avec leurs pools réels. Personne ne propose la répartition conjointe de qui prend quoi, les échanges de pick ou l'ordre de pick, ni une vue partagée sur les 5 téléphones.
2. **Une personnalisation honnête.** Les autres disent « personnalisé » sans montrer sur combien de parties. Nous pouvons afficher « Ahri : 23 parties, 57 % ±10, encore du bruit ». C'est exactement l'exigence de Thomas, et personne ne le fait.
3. **Un téléphone d'abord pensé pour être lisible en 2 secondes.** Blitz mobile semble à l'abandon. Baron Buff fait le miroir dans le navigateur, mais pour un joueur isolé. Les autres n'ont rien sur mobile.
4. **Zéro pub, zéro Overwolf, un compagnon léger.** Les concurrents pèsent de 99 à 152 Mo en Electron. Seuls Baron Buff, Hexgate et Mejais sont dans le même esprit.
5. **Des explications sur demande, chiffrées.** Sauf DraftGap, Mejais et iTero, ce sont des boîtes noires.
6. **Des bans pensés pour notre camp.** Bannir ce qui menace les intentions de pick de mes alliés, visibles pendant la phase de ban, plutôt que la tier list. Aucun concurrent ne le décrit explicitement.
7. **Base réutilisable.** Le cœur de DraftGap est sous licence MIT : on peut s'en servir comme base de calcul, puis y ajouter le confort perso et le groupe. Conditions d'utilisation des données Lolalytics : à vérifier par l'agent données.

**Peut-on faire mieux qu'eux ?** Pas en général. Mais pour 5 à 10 potes qui se connaissent, oui sur quatre points :
- le confort réel de chacun, pondéré et affiché avec sa marge d'erreur ;
- la coordination du premade ;
- le téléphone sans installation ;
- l'absence de pub.

Le gain à espérer sur le win rate reste modeste. Il faut le mesurer sur nos parties, pas le promettre.

---

# PARTIE B : fonctionnalités

## B1. Règles Riot qui façonnent la liste

Sources : doc Riot et page de conformité Overwolf, lues.

- **Autorisé** : les produits « peuvent mettre en avant les décisions importantes et donner **plusieurs choix** » ; les overlays de données statiques connues avant la partie ; ses propres stats ; les outils pour trouver des partenaires de jeu (LFG) ; les stats agrégées.
- **Interdit** :
  - les applis qui **dictent** les décisions ou les retirent au joueur ;
  - les infos absentes du client qui donnent un avantage ;
  - la dé-anonymisation : en ranked solo/duo, les noms hors party doivent s'afficher « Ally # ». Les membres d'une même party se voient entre eux ;
  - les calculateurs de MMR ou d'elo ;
  - les win rates d'augments et d'objets d'Arena ;
  - le suivi des cooldowns d'ultimes et de sorts ennemis, interdit depuis le 13/03/2025, même saisi à la main ;
  - les alertes de pic de puissance ;
  - les notifications qui dictent une action selon l'état de la partie ;
  - les données Brawl et League Classic.
- **Impact sur le design** : toujours **3 options classées**, jamais un « PICK X » unique. Le joueur décide, l'app ne clique jamais.

Échelle utilisée dans les tableaux :
- **Gain** : effet sur la victoire.
- **Effort** : S = moins de 2 jours, M = 1 à 2 semaines, L = plus de 2 semaines.
- **Riot ?** : mon premier avis, à vérifier par l'agent dédié. OK = probablement autorisé, Gris = à vérifier, Non = interdit d'après une source.

## B2. Inventaire par moment

### Pendant la sélection

| # | Fonction | Gain | Effort | Données | Riot ? |
|---|---|---|---|---|---|
| C1 | Draft en direct sur le téléphone : bans, picks, rôles, « à toi », timer | Socle | M | Session LCU | OK |
| C2 | **Top 3 picks pour ton rôle**, parmi tes champions possédés. Score décomposé sur demande : méta du patch à ton elo, matchups contre les ennemis lockés (lane d'abord, autres rôles ensuite), synergie avec les picks et survols alliés, confort perso. Nombre de parties affiché, bruit signalé | Fort | L | LCU (session, champions possédés, maîtrise, historique), stats agrégées par patch et elo (matchups, duos) | OK si plusieurs choix |
| C3 | **Sécurité blind / contre** : risque de te faire contrer selon le nombre d'ennemis qui pickent après toi | Fort | M | Ordre des actions, matchups | OK |
| C4 | **Mode autofill** : si le rôle assigné n'est pas ton rôle préféré du lobby, on privilégie le confort et les champions simples | Fort | S | Lobby, session, maîtrise | OK |
| C5 | **Bans pour notre camp** : ce qui menace ton pool et les intentions de pick alliées | Moyen+ | M | Matchups, survols alliés | OK |
| C6 | Survols alliés pris en compte avec un poids réduit, puisqu'ils peuvent changer | Moyen | S (dans C2) | `championPickIntent` | OK |
| C7 | Suggestions d'échange : ordre de pick, champion, rôle (« laisse le mid au pick 5 pour contrer ») | Moyen | M | `pickOrderSwaps`, `trades` (champs présents dans le payload, doc Overwolf **[V]**) | OK (affichage seul) |
| C8 | Signaler les flex picks quand on pick tôt | Faible+ | S | Stats par rôle | OK |
| C9 | Proba de victoire du draft **avec intervalle** | Moyen | S (après C2) | Modèle | OK (DraftGap et LoLDraftAI le font) |
| C10 | **Premade** (flex, normale, Clash) : vue commune et optimisation de qui prend quoi parmi les pools des amis présents | Fort, et unique | L | Pools des amis, session | OK (party visible entre membres) |
| C11 | **ARAM et ARAM Mayhem** : quel champion du banc prendre, faut-il reroll, répartition entre amis | Moyen+ | M | `benchChampions`, `rerollsRemaining`, stats ARAM | OK. Pas de win rate d'augments en Mayhem **[H]** |
| C12 | **Swiftplay** : le choix se fait dans le lobby avant la file (2 rôles, un champion par rôle) | Moyen | M | Endpoints lobby **[H]** | OK |
| C13 | Push ntfy « draft commencée » et « à toi dans 1 tour » | Fort (UX) | S | Phase de jeu, session | OK |

### Juste après le lock

| # | Fonction | Gain | Effort | Données | Riot ? |
|---|---|---|---|---|---|
| L1 | Fiche : keystone et runes, sorts, objets de départ, ordre des compétences, selon le matchup et l'elo | Moyen | M | Source de builds par matchup | OK |
| L2 | Import des runes en 1 clic | Moyen (temps) | S-M | **Écriture** dans la LCU (`lol-perks`) | Toléré (tous les gros le font), mais **contraire à la règle de lecture seule** : décision de Thomas |
| L3 | 3 lignes chiffrées sur le matchup (« lane à 47 %, 12 k parties, ton champion monte en puissance plus tard ») | Moyen | M | Matchups, éventuellement l'or à 15 min | OK |
| L4 | Pics de puissance statiques de ton champion (niveaux, objets clés) | Faible+ | M | Données statiques | OK hors partie. Pas d'alerte en jeu |

### Écran de chargement et en jeu

| # | Fonction | Gain | Effort | Données | Riot ? |
|---|---|---|---|---|---|
| G1 | Rang et pool des adversaires au chargement, quand les noms deviennent visibles | Faible+ | M | API de partie en cours ou API Riot (clé). Respecter l'option de masquage du nom (patch 25.20) | Gris (Porofessor le fait) |
| G2 | Build qui s'adapte aux objets ennemis, à consulter sur demande quand tu es mort | Moyen | L | API de partie en cours (`/liveclientdata`) | Gris : uniquement à la demande, jamais en notification |
| G3 | Timers jungle et objectifs | Faible (pas sur téléphone) | M | | Gris |
| G4 | Timers d'ultimes et de sorts ennemis | | | | **Non** (interdit depuis le 13/03/2025) |
| G5 | Alertes de pic de puissance, ou « va au dragon » | | | | **Non** (conformité Overwolf) |

### Après la partie

| # | Fonction | Gain | Effort | Données | Riot ? |
|---|---|---|---|---|---|
| P1 | **Journal automatique** : recos affichées, pick choisi, résultat, stats de fin de partie | Fort (base de tout) | S | Fin de partie LCU, historique local | OK |
| P2 | « Le conseil a-t-il marché ? » : calibration affichée seulement au-delà de N parties, sinon « pas assez de données » | Moyen | M | P1 | OK |
| P3 | Recalage du confort perso : tes stats tirées vers la moyenne tant que l'échantillon est petit | Fort | M | P1, maîtrise | OK |
| P4 | « Ce draft était-il perdu d'avance ? » | Faible+ | S | Modèle | OK |

### En dehors des parties

| # | Fonction | Gain | Effort | Données | Riot ? |
|---|---|---|---|---|---|
| O1 | **Conseiller de pool** : 2 ou 3 champions par rôle qui se complètent (un blind sûr, un contre, un flex) | Fort (long terme) | M | Méta, confort | OK |
| O2 | **Impact du patch** sur ton pool : notif le jour du patch avec les chiffres avant/après et le nombre de parties | Moyen | S-M | Stats par patch | OK |
| O3 | Groupe : qui joue quel rôle, compo type pour la flex, « qui joue ce soir » | Moyen | M | Profils | OK (outil LFG) |
| O4 | « Faut-il relancer ? » après une série de défaites | Moyen | S | Historique perso | OK (stats perso) |
| O5 | Scouting Clash : les adversaires sont nommés | Moyen (Clash seulement) | M | API Riot (clé) | OK **[H]** |
| O6 | Classement entre amis | Faible | S | LP du client | Gris : jamais de MMR estimé |

### Comptes et installation

| # | Fonction | Gain | Effort | Riot ? |
|---|---|---|---|---|
| A1 | Compagnon Windows en un seul fichier : lancement au démarrage, icône discrète, mise à jour auto, aucun réglage | Fort (sans ça, personne ne l'utilise) | M | OK |
| A2 | Appairage du téléphone par QR code une seule fois. Identité = PUUID lu dans le client : ni mot de passe ni clé API | Fort | S-M | OK |
| A3 | Consentement explicite au partage entre amis, données supprimables | Nécessaire | S | OK |
| A4 | Plusieurs comptes par joueur (smurfs) | Moyen | S | OK |
| A5 | Exécutable signé pour éviter les alertes SmartScreen et antivirus (LoLDraftAI en a) | Moyen | Coût en € | n/a |
| A6 | Connexion Riot officielle (RSO) | Faible | L | Demande l'approbation de Riot. Probablement inutile **[H]** |

## B3. Classement

### MVP : prouver que ça aide, sur le téléphone, sans rien installer côté téléphone

1. **A1 + A2 + A3**, compagnon léger, appairage QR et consentement : sans installation facile, rien d'autre ne sert.
2. **C13**, push ntfy : le téléphone se réveille au bon moment, avec un outil que Thomas a déjà.
3. **C1**, draft en direct : le socle de lecture de tout le reste.
4. **C2 avec C6**, top 3 décomposé avec nombre de parties : le cœur du produit, et le format à plusieurs choix exigé par Riot.
5. **C4**, mode autofill : gros gain pour peu de travail, appuyé sur les données de maîtrise.
6. **C3**, sécurité blind / contre : l'ordre de pick est connu, autant l'exploiter.
7. **C5**, bans pour notre camp : la phase de ban est le premier moment où l'on peut aider.
8. **P1**, journal silencieux dès le premier jour : sans lui, impossible de savoir si l'app aide.
9. Modes couverts : ranked solo/duo, flex et normale draft. ARAM et Swiftplay viennent après.

### V2 : la différence avec les concurrents

1. **C10**, optimisation du premade : c'est le trou du marché, mais il faut d'abord que C2 soit fiable.
2. **C11**, ARAM et Mayhem (banc, rerolls) : très joué entre amis **[H]**, à confirmer avec Thomas.
3. **C7**, suggestions d'échanges : se branche naturellement sur C10.
4. **P2 + P3**, boucle d'apprentissage : possible une fois quelques centaines de parties collectées.
5. **L1 + L3**, fiche après le lock : utile, mais les concurrents la font déjà bien.
6. **O1 + O2**, conseiller de pool et notifs de patch : là où se fait le gain à long terme.
7. **C12**, Swiftplay : la sélection a lieu avant la file, donc un autre écran.
8. **C9**, proba de draft avec intervalle : seulement quand le modèle sera calibré.
9. **O4**, « Faut-il relancer ? » : peu de travail, utile contre le tilt.

### Plus tard

1. **O5**, Clash : nécessite une clé API Riot.
2. **G1**, scouting au chargement : peu de gain, demande une clé.
3. **G2**, build adaptatif en jeu : le téléphone en pleine partie distrait. À la demande uniquement.
4. **O3 + O6**, côté social : agréable, mais ne fait pas gagner.
5. **L2**, import des runes : seulement si Thomas assouplit la règle de lecture seule.
6. **C8, P4** : bonus.

### Rejeté

- **Accepter la partie, picker, bannir ou locker à distance** : règle de Thomas, et Riot interdit de retirer une décision au joueur.
- **Timers d'ultimes et de sorts ennemis** : interdits depuis le 13/03/2025.
- **Alertes en jeu** (pics de puissance, « va au dragon ») : interdites.
- **Lever l'anonymat en ranked**, ou chercher le profil des alliés et ennemis pendant la sélection : interdit, et c'est justement ce que Riot cherche à empêcher pour limiter les dodges.
- **Conseil de dodge fondé sur l'identité d'un joueur** : interdit. Un conseil fondé sur le seul draft reste en zone grise, et coûte des LP : non.
- **Estimation du MMR** : interdite.
- **Win rates d'augments** (Arena, probablement Mayhem) : interdits.
- **Données Brawl et League Classic** : non approuvées par Riot.
- **Toute lecture de la mémoire du jeu** : bloquée depuis le 06/10/2026.
- **Overwolf** : alourdit, ajoute des pubs, et n'apporte rien pour la sélection.

## B4. Ce qu'on risque d'oublier

- **Champions possédés** : ne recommander que les champions disponibles, y compris la rotation gratuite (endpoints pickable / owned).
- **Ennemis** : leurs survols sont invisibles, on ne connaît que leurs picks lockés. Il faut donc anticiper les contres possibles, d'où C3.
- **Début de patch** : les données sont maigres les premiers jours. On tire vers le patch précédent, comme DraftGap avec son prior sur 30 jours. On affiche « patch récent, données minces ».
- **Hotfixes** en cours de patch.
- **Vitesse** : les calculs doivent tenir en moins d'une seconde. On précalcule pendant le tour des autres.
- **Écart d'elo entre amis** : en flex, il y a un elo par joueur. Quelle tranche de stats utiliser ?
- **Masquage du nom** (option du patch 25.20) : un ami peut l'activer. L'identité passe donc par le PUUID, jamais par le nom.
- **Panne de la LCU** après un patch client : afficher clairement « connexion perdue » plutôt que des recos fausses.
- **Sécurité** : le jeton LCU ne quitte jamais le PC, et le compagnon n'écoute que la machine locale.
- **Déclaration à Riot** : la doc demande de déclarer les endpoints LCU utilisés sur le Developer Portal. À faire par Thomas s'il le souhaite.
- **Modes tournants** (URF et autres) : désactiver proprement les recos quand on n'a pas de données.

---

## Sources

Concurrents et données :
- Porofessor : https://porofessor.gg/ , https://porofessor.gg/download , https://www.overwolf.com/app/trebonius-porofessor.gg
- Porofessor, version autonome (05/12/2025) : https://www.mfn.se/a/m-o-b-a-network/m-o-b-a-network-launches-standalone-version-of-the-porofessor-app
- Porofessor, installs et premium (30/06/2025) : https://www.inderes.fi/en/releases/porofessor-reaches-155-million-installs-as-premium-strategy-and-monetization-framework-deepen
- Wargraphs et League of Graphs : https://tech.eu/2023/06/15/game-on-for-solopreneurs-as-wargraphs-sells-to-m-o-b-a-network-for-50-million/
- Blitz mobile : https://apps.apple.com/ca/app/blitz/id1591484739
- U.GG (extraits de recherche, page en 403) : https://u.gg/app
- OP.GG Desktop : https://op.gg/desktop/en , https://op.gg/desktop/en/games/lol
- DraftGap : https://github.com/vigovlugt/draftgap ; code lu : https://raw.githubusercontent.com/vigovlugt/draftgap/main/packages/core/src/draft/analysis.ts , https://raw.githubusercontent.com/vigovlugt/draftgap/main/packages/core/src/risk/risk-level.ts ; commits : https://api.github.com/repos/vigovlugt/draftgap/commits
- LoLDraftAI : https://loldraftai.com/ , https://loldraftai.com/pricing , https://loldraftai.com/download
- iTero : https://www.itero.gg/ , https://www.overwolf.com/app/iTero_Gaming-iTero_Drafting_Coach
- Comparatif iTero (03/2026, auteur lié à iTero) : https://www.itero.gg/articles/what-is-the-best-league-of-legends-companion-app-in-2025
- Études iTero : https://www.itero.gg/articles/draft-sq (09/2022), https://www.itero.gg/articles/mastery-a-statistical-summary (04/2023)
- Lolalytics : https://lolalytics.com/ , https://lolalytics.com/lol/ahri/build/
- Baron Buff : https://baronbuff.com/
- DraftForge : https://draftforge.gg/
- Mejais : https://mejais.com/about.html
- Smartpick : https://www.smartpick.gg/
- LoL Brain : https://www.lol-brain.com/draft
- LoLTheory : https://www.overwolf.com/app/LoLTheory.gg-LoLTheory
- Comparatifs buildzcrank et Hexgate (éditeurs concurrents, à lire avec prudence) : https://buildzcrank.com/en/blog/best-league-of-legends-app-2026/ (23/10/2026), https://hexgate.app/blog/lol-overlay-without-overwolf/ (21/10/2026), https://hexgate.app/blog/riot-third-party-apps/
- Thèse CTU sur la prédiction par le draft (environ 54 %) : https://dspace.cvut.cz/entities/publication/4d02f46b-ec5c-4aa2-af19-ba1d510670e0 (extrait de recherche)
- DraftRec, recommandation de draft personnalisée (WWW 2022) : https://arxiv.org/abs/2204.12750

Règles Riot et conformité :
- https://developer.riotgames.com/docs/lol
- https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps (29/09/2026)
- https://dev.overwolf.com/ow-native/guides/game-compliance/riot-games
- Payload de sélection (`benchChampions`, `trades`, `pickOrderSwaps`) : https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/league-of-legends-launcher
- Après le blocage mémoire (07/10, MAJ 21/10/2026) : https://senseos.gg/guides/league-of-legends/third-party-apps-after-memory-block/
- Ce qui est autorisé en 2026 (secondaire) : https://buildzcrank.com/en/blog/riot-api-and-third-party-apps-what-is-allowed/
- Interdiction des timers d'ultimes (03/2025) : https://mein-mmo.de/lol-riot-verbietet-ultimate-time-tracker/
