# Règles Riot : ce que notre appli de draft a le droit de faire

État au 30/10/2026, patch 26.21 (numérotation Data Dragon 16.21.1, vérifiée sur https://ddragon.leagueoflegends.com/api/versions.json).
Notation : **[V]** = vérifié, j'ai lu la source (URL donnée). **[P]** = partiellement vérifié, vu seulement via un extrait de recherche ou une source secondaire. **[H]** = hypothèse ou interprétation de ma part.

## En bref

1. Recommander des picks et des bans pendant le champ select à partir de ce que le client montre est autorisé. Des applis grand public le font déjà et s'affichent « Riot Games Compliant ». Condition : proposer **plusieurs choix**, jamais un ordre.
2. Le LCU reste toléré, mais Riot ne le « supporte » pas officiellement. Le blocage du 6/10/2026 vise la **mémoire du jeu** et ne cite pas le LCU. Aucun texte de Riot depuis cette date ne l'autorise ni ne l'interdit explicitement.
3. Les trois lignes rouges qui nous concernent : rien d'automatique (ni pick, ni ban, ni lock, ni accept), rien de caché (hovers ennemis, identité des alliés anonymes), aucun timer ennemi.
4. Une **clé API personnelle** convient à un petit groupe privé. Elle ne donne pas accès à RSO, et ce n'est pas un problème pour nous. Il faut quand même **enregistrer le produit** chez Riot, même s'il n'utilise que le LCU.
5. On n'aspire pas automatiquement les données d'OP.GG, de Mobalytics ou de League of Graphs : leurs CGU l'interdisent noir sur blanc. Pour les stats, on passe par l'API Riot et on agrège nous-mêmes.

---

## 1. Les textes qui font foi, du plus fort au plus faible

| Texte | Date | Portée |
|---|---|---|
| CGU joueurs Riot, section 7.1 | modifiées le 01/12/2024 | Risque pour **les comptes** de nos potes |
| Developer Portal, General Policies | mise à jour 29/05/2025 | Tous les produits tiers |
| Developer Portal, politique LoL (docs/lol) | sans date, lue le 30/10/2026 | Spécifique LoL |
| Support Riot, « Third-party applications » | 10/02/2025 | Ce qui vaut un ban côté joueur |
| Support Riot, blocage de la mémoire du jeu | publié 29/09/2026, effectif 06/10/2026 | Applis lisant la mémoire |
| Guide de conformité Riot chez Overwolf | page © 2026 | Règles Riot appliquées par la principale plateforme d'applis |
| Annonces ponctuelles (12.22, timers d'ult, mode streamer, Spectator) | 2022 à 2025 | Précisions et durcissements |

Sources :
- [V] https://www.riotgames.com/en/terms-of-service
- [V] https://developer.riotgames.com/policies/general
- [V] https://developer.riotgames.com/docs/lol
- [V] https://support.riotgames.com/en-us/riot/events/third-party-applications
- [V] https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps
- [V] https://dev.overwolf.com/ow-electron/guides/game-compliance/league-of-legends/
- [V] https://dev.overwolf.com/ow-native/guides/game-compliance/riot-games

---

## 2. Champ select : ce qui est visible, ce qui ne l'est pas, ce qu'on peut en faire

### La règle de fond (intégrité du jeu, politique LoL) [V]
https://developer.riotgames.com/docs/lol
- « Products must not use or incorporate information not present in the game client that would give players a competitive edge », avec cet exemple : « automatically or manually allowing tracking enemy ultimate cooldowns ».
- « Products should not remove game decisions », mais ils « may highlight decisions that are important and give multiple choices to help players make good decisions ».
- « Products should increase, and not decrease the diversity of game decisions (builds, compositions, characters, decks) ».
- Exemples refusés : « Products may not provide any game-session-specific information that would be previously unknown to the player » et « Apps that dictate player decisions ».
- « Products cannot identify or analyze players who are deliberately hidden by the game. »
- « Products cannot create alternatives for official skill ranking systems [...] Prohibited alternatives include MMR or ELO calculators. »

### Côté joueur (support Riot, 10/02/2025) [V]
https://support.riotgames.com/en-us/riot/events/third-party-applications

Riot dit ne s'en prendre qu'aux applications « that impede the competitive nature of our games ». Pratiques visées :
- « Exposing information that's intentionally obfuscated »
- « Taking actions on your behalf (botting or scripting) »
- « Drawing conclusions for you during gameplay (ie we want to see you play the game first, then analyze and reflect later!) »
- « Altering your field of intelligence (zoomhacks or global ult alerts) »

Sanctions possibles : suspension jusqu'à « permanent suspension for consistent, blatant use », retrait des récompenses classées, « takedown of the application ».

### Anonymat en Ranked Solo/Duo
- Annonce de Riot reprise sur devtrackers, patch 12.22, 2022 [P] : « Apps that reveal player names or stats in Champ Select will be asked to remove this feature immediately ». Les noms redeviennent visibles « as soon as you hit the loading screen ». Le message dit d'abord « only to Ranked Solo/Duo », puis une modification ajoute la Flex : il se contredit. https://devtrackers.gg/leagueoflegends/p/749a443a-apps-that-reveal-player-names-or-stats-in-champ-select-need-to-remove-these-informations-starting-patch-12-22
- Overwolf, règles en vigueur en 2026 [V] : « All instances of non-party Summoner Names in Champion Select should be replaced with Ally # ». Aussi : « Your own name is not anonymous to yourself », « Players who queued in the same party are de-anonymized to each other » et « this only applies during Champion Select ».
- Mode streamer, depuis le patch 25.20 (billet du 06/10/2025) [V] : « Hide My Name » et « Hide My Everything » masquent l'identité « in champ select, in game, and in third-party apps ». https://www.leagueoflegends.com/en-us/news/dev/dev-account-linking-and-streamer-mode/
- Spectator-V5, octobre 2025 [P] : Riot annonce d'abord sa désactivation « to prevent third party applications from deanonymizing players », puis la réactive deux jours plus tard. Les recherches de partie en cours « respect players' streamer mode settings ». Je n'ai pas pu ouvrir les posts (X bloque la lecture) : https://x.com/RiotGamesDevRel/status/1979263978787246391 et https://x.com/LeagueOfLegends/status/1980434308268687850

### Conséquences pour notre appli [H, déduites des règles ci-dessus]
- **Utilisable** : picks et hovers alliés (affichés dans le client à toute l'équipe), positions assignées, picks ennemis verrouillés, bans, ordre de pick, timer, son propre compte, et les comptes des amis du **même groupe**.
- **Inutilisable** : hovers ennemis (le client ne les reçoit pas, et on ne doit pas chercher à les obtenir autrement), identité, rang ou historique d'un allié anonyme, toute tentative de recouper un `obfuscatedPuuid` ou un champ masqué.
- **Piège propre à notre architecture** : plusieurs potes font tourner le compagnon. Si deux inscrits se retrouvent par hasard dans la même partie classée sans être groupés, ou dans des équipes opposées (customs entre potes, Clash, hasard du matchmaking), la mise en commun des données révélerait une identité masquée ou les hovers de l'équipe adverse. Ce serait de la triche caractérisée. Règle : on ne partage les données qu'entre membres du **même groupe** (lobby), information que le client montre déjà.
- **Dodge** : aucun texte n'interdit d'afficher une probabilité de victoire de la draft. L'anonymat de 2022 visait toutefois explicitement le dodge et le metagaming. Le billet Riot de l'automne 2022 parle des joueurs qui fouillent les profils de leurs coéquipiers [P] : https://www.leagueoflegends.com/en-us/news/dev/matchmaking-and-champion-select-fall-2022/. On reste donc à l'écart : pas d'incitation à dodger.

### Les concurrents agréés le font déjà [V]
- L'appli U.GG (Outplayed Inc.) affiche « Riot Games Compliant ». Elle propose « Champion Select Scouting : Scout everything, from the best picks & counters to team synergies » et « Auto-Import Loadouts ». https://u.gg/app
- DraftGap, open source sous licence MIT, « integrates with the League client to automatically synchronize with the current draft in champ select ». https://github.com/vigovlugt/draftgap
- Champ Select Coach, sur Overwolf (v9.0.0 du 01/02/2026), estime les chances de victoire d'après la draft. La page ne revendique aucune validation par Riot. https://www.overwolf.com/app/samuel_blad-champ_select_coach

Les recommandations en champ select sont donc admises dans les faits. Ce qui nous distinguera, ce sont la qualité de l'analyse et le respect strict des limites.

---

## 3. Statut du LCU après octobre 2026

- Page LCU du Developer Portal [V] : « This service is not officially supported for use with third party applications » et « We provide no guarantees of full documentation, service uptime, or change communication ». Elle demande aussi : « Either create a new application or leave a note on your existing application in the Developer Portal. We need to know which endpoints you're using and how you're using them ». https://developer.riotgames.com/league-client-apis.html et https://developer.riotgames.com/docs/lol
- General Policies [V] : « If your product utilizes the League Client API », il faut lire la doc et enregistrer le produit. Riot reconnaît donc l'usage du LCU comme un chemin normal pour un produit enregistré.
- FAQ Vanguard du 01/04/2024 [V] : « Apps developed using the LCU and in-game APIs are still expected to work », « Overlays and internal tools using the API, game client, and in-game APIs should continue to function » et « There is absolutely no allow list for Vanguard ». https://www.riotgames.com/en/DevRel/vanguard-faq
- Blocage mémoire du 06/10/2026 [V] : il vise « game memory access by default for all unknown third-party applications ». Les outils déjà approuvés ont un délai de grâce jusqu'en avril 2027. « This change does not result in bans by itself. » La phrase la plus large annonce le passage de toutes les applis tierces à « the official API as the only allowed mechanism » pour récupérer les données du jeu. **Le LCU n'est pas cité.**
- Vanguard On-Demand (24/06/2026) [V] : le pilote ne démarre qu'avec le jeu, si le PC passe le Pre-Check (Windows 11 25H2, Secure Boot, TPM 2.0, VBS/HVCI, IOMMU). La page ne parle pas des applis tierces. Aucun effet attendu sur un compagnon qui ne lit que le LCU [H]. https://www.riotgames.com/en/news/vanguard-on-demand
- Depuis le 06/10/2026 [V] : ni Riot, ni Porofessor, ni Blitz, ni U.GG, ni Mobalytics, ni OP.GG, ni Overwolf n'ont publié de déclaration sur le LCU. C'est ce que constatent deux guides tiers : SenseOS (07/10/2026, mis à jour le 21/10) https://senseos.gg/guides/league-of-legends/third-party-apps-after-memory-block/ et Hexgate https://hexgate.app/blog/riot-third-party-apps/. Le traqueur public de Riot (GitHub RiotGames/developer-relations) contient encore en novembre 2025 des tickets sur des endpoints LCU de champ select, signe que Riot suit cet usage [V] : https://github.com/RiotGames/developer-relations/issues?q=LCU
- Tendance [P] : Riot verrouille progressivement l'accès aux données. Au patch 26.20, les téléchargements de replays ont été restreints puis assouplis. Selon le compte DevRel sur X, l'endpoint des replays exige RSO depuis le 23/10/2026 (non vérifié à la source).

**Lecture [H]** : le LCU est aujourd'hui **toléré pour un produit enregistré, en lecture seule**, sans aucune garantie. Riot peut le restreindre à tout moment, sans préavis. Il nous faut un plan B : la saisie manuelle de la draft sur le téléphone.

---

## 4. Overlays et fenêtres pendant le champ select

- Riot autorise les « Game overlays that provide static data that is available prior to the game » [V, docs/lol]. Elle interdit les winrates d'augments et d'objets d'Arena dans « all websites, applications and overlays ».
- Le champ select se passe dans le **client**, pas dans le jeu. Une fenêtre à côté du client, ou un écran sur le téléphone, n'injecte rien. Aucune règle ne l'interdit et U.GG le fait [H, appuyé par u.gg/app].
- Pub interdite « in Riot properties, which include in-game, loading screens, and the Riot Client » [V, General Policies]. Sans objet pour nous.
- « Products cannot closely resemble Riot's games or products in style or function » [V]. Notre interface ne doit pas copier l'écran de champ select du client.
- En jeu, Overwolf interdit [V] les « Notifications that alert players when a power spike hits », les « Notifications that dictate player action based on the current game state », le suivi des cooldowns de sorts et de sorts d'invocateur ennemis, et rappelle que « The use of Ultimate timers is strictly forbidden ».
- Interdiction des timers d'ult ennemis en mars 2025 [P] : post DevRel https://x.com/RiotGamesDevRel/status/1899532362637250955, relayé le 13/03/2025 par https://mein-mmo.de/lol-riot-verbietet-ultimate-time-tracker/. Elle figure aujourd'hui dans la politique LoL [V].
- Modes : « Riot Games does NOT approve any Brawl related data being aggregated or visible » et pas de données « League Classic » [V, Overwolf].

**Pour nous** : l'écran du téléphone (et éventuellement une fenêtre sur PC) ne pose aucun problème pendant le champ select. Pendant la partie, uniquement de l'info statique d'avant-partie, consultée à la demande, sans notification.

---

## 5. API Riot : clés, limites, enregistrement, RSO

### Types de clés [V] (https://developer.riotgames.com/docs/portal et https://developer.riotgames.com/docs/faqs)

| Clé | Pour qui | Limites | Particularités |
|---|---|---|---|
| Développement | prototypage | 20 req/s et 100 req/2 min (changelog Riot de 2017, https://www.riotgames.com/en/DevRel/riot-games-api-change-log) | « deactivate every 24 hours » |
| Personnelle | « just the developer or a small private community », « products for yourself and a small group » | 20 req/s et 100 req/2 min, par région | « registered without the verification process, but won't be approved for rate limit increases ». Il faut « a detailed description of the product ». API standard, pas l'API Tournaments. Pas d'expiration à 24 h d'après plusieurs sources communautaires [H] |
| Production | « large communities or the Internet as a whole » | 500 req/10 s et 30 000 req/10 min au départ | Exige un prototype fonctionnel, « a verified website », une page de CGU et une politique de confidentialité. Examen « weekly », « up to three weeks » selon la FAQ ; 5 à 8 mois selon des retours de développeurs [P] |

Calcul [H] : avec 100 requêtes par 2 minutes, une clé personnelle plafonne à environ 72 000 requêtes par jour et par région de routage. Cela suffit pour les profils des potes et pour agréger nous-mêmes quelques dizaines de milliers de parties par jour (une requête match-v5 par partie). Il faudra respecter le `Retry-After` en cas de 429 : « Applications that are in violation of this policy may have their access disabled ».

### Obligations [V]
- « All products must be registered in, and audited by Riot Games through the Developer Portal. » Et : « If your product serves players, you must register it with us regardless of whether or not your product uses official documented APIs. » Même une appli privée qui n'utilise que le LCU doit donc être enregistrée.
- « You may not run your application for public consumption using a personal key », y compris en alpha ou en bêta ouverte. Une page GitHub Pages ouverte à tous sur Internet pose donc problème [H] : l'accès doit être réservé aux invités.
- « Do not include your API key in your code, especially if you plan on distributing a binary. » Et dans les conditions de l'API : « You may not sell, transfer, sublicense or otherwise disclose Your API Key(s) to any other party » (https://developer.riotgames.com/terms). La clé ne va **ni dans le compagnon, ni dans la page web**. Elle reste sur un petit serveur, dans un secret.
- « Do not use a Production API key to run multiple projects (one product per key) ». La FAQ ajoute : « may NOT have multiple applications to bypass rate limits ».
- Mention obligatoire, « readily visible to players » : « [Notre produit] isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc. »
- Usages de clé personnelle cités par Riot : « Showing (self) player stats », outils d'entraînement sur son propre historique, « Aggregate player stats (no specific players) », overlays de données statiques.
- « No apps serving as a "data broker" between our API and another third-party company. » Et : « Products should use supported services from Riot Games for data ingestion. »
- Parties personnalisées : un produit « may not publicly display a player's match history from the custom match queue » ; autrement, ces données ne peuvent être montrées au joueur concerné que via RSO. Les customs lus localement par le LCU ne doivent donc pas être affichés aux autres membres [H].

### RSO [V]
« This access is only available to developers with Production Level API Keys » (docs/lol). La FAQ précise : « RSO Clients are only available for applications that have an existing, approved production application ID ». Avec une clé personnelle, RSO est **impossible**. Ce n'est pas un manque pour nous [H] : le compagnon lit le Riot ID du compte connecté via le LCU local (`current-summoner`), ce qui prouve que le pote possède bien ce compte. Le serveur le résout ensuite avec account-v1. RSO ne deviendrait utile que pour un passage en production ou si Riot réserve un jour l'historique de parties à RSO, comme pour les replays [H].

---

## 6. Conditions d'utilisation des sites de stats

| Site | Ce que disent les CGU | robots.txt (lu le 30/10/2026) | Verdict |
|---|---|---|---|
| OP.GG (CGU du 14/09/2026) [V] https://www.op.gg/lol/policies/agreement | Interdit « scraping or data mining while using the Sites or Services » et « use automated scripts to collect information ». « personal, non-commercial use only » | autorise `/` pour `*` | **Interdit** |
| Mobalytics, Gamers Net (CGU du 23/07/2026) [V] https://mobalytics.gg/terms/ | Interdit l'accès « through the use of any engine, software, tool, agent [...] (including spiders, robots, crawlers, data mining tools or the like) » autre qu'un navigateur courant. « personal, non-commercial use » | bloque `/api/tft` et `/api/valorant` | **Interdit** |
| League of Graphs (CGU du 21/01/2016, copie archivée du 02/04/2026) [V] https://www.leagueofgraphs.com/terms-of-use | « Automated queries (including screen and database scraping, spiders, robots, crawlers...) are strictly prohibited [...] unless you have received express written permission » | `Disallow: /api/*`, pages live, matchs et filtres par elo | **Interdit** sans accord écrit |
| MetaSRC (CGU du 22/07/2026) [V] https://www.metasrc.com/terms | Interdit l'extraction automatisée « for commercial, competitive, or abusive purposes ». Propose une « Embed Feature » sous licence | long, sans blocage général | **Zone grise** : usage privé gratuit non visé, mais on ne s'y appuie pas |
| U.GG, Outplayed Inc. (CGU du 25/05/2018) [V] https://u.gg/terms-of-service | Pas de clause anti-scraping. Une clause de « Non-Disclosure » sur ses idées et fonctions | `Disallow: /*?*`, `Content-Signal: ai-train=no` | **Zone grise** : rien n'autorise l'usage de ses API internes |
| Lolalytics, GG Software LP [V] https://lolalytics.com/info/privacy | Aucune page de CGU trouvée. La politique de confidentialité renvoie à des « Terms and Conditions » sans lien | `ai-train=no`, robots d'IA bloqués | **Zone grise** |

Pour tous les sites [H] : en droit européen, une base de données bénéficie du droit *sui generis* (directive 96/9/CE), même quand les chiffres pris un par un ne sont pas protégés. Riot de son côté demande de passer par ses propres services. **Conclusion : on agrège nous-mêmes depuis l'API Riot (match-v5, league-v4) et Data Dragon.** Les sites tiers servent seulement à vérifier nos chiffres à la main, jamais de source automatique. Pour aller plus loin, on demande une autorisation écrite (par exemple à Lolalytics).

---

## 7. Tableau AUTORISÉ / ZONE GRISE / INTERDIT

| Statut | Pratique | Règle exacte | Source |
|---|---|---|---|
| AUTORISÉ | Lire la session de champ select via le LCU, en local et en lecture seule | « If your product utilizes the League Client API » : lire la doc et enregistrer. « Apps developed using the LCU [...] are still expected to work » | https://developer.riotgames.com/policies/general et https://www.riotgames.com/en/DevRel/vanguard-faq |
| AUTORISÉ | Recommander picks et bans avec plusieurs options | « may highlight decisions that are important and give multiple choices to help players make good decisions » | https://developer.riotgames.com/docs/lol |
| AUTORISÉ | Utiliser picks et hovers alliés, picks ennemis verrouillés, bans, positions | Informations « present in the game client », donc hors de l'interdiction | https://developer.riotgames.com/docs/lol |
| AUTORISÉ | Stats agrégées par patch, elo et matchup | « Aggregate player stats (no specific players) » | https://developer.riotgames.com/docs/lol |
| AUTORISÉ | Ses propres stats et son historique | « Showing (self) player stats » | https://developer.riotgames.com/docs/lol |
| AUTORISÉ | Stats des amis groupés ensemble | « Players who queued in the same party are de-anonymized to each other » | https://dev.overwolf.com/ow-electron/guides/game-compliance/league-of-legends/ |
| AUTORISÉ | Données statiques d'avant-partie (build, runes) pendant la partie | « Game overlays that provide static data that is available prior to the game » | https://developer.riotgames.com/docs/lol |
| AUTORISÉ | Clé personnelle pour 5 à 10 amis | « just the developer or a small private community » | https://developer.riotgames.com/docs/portal |
| AUTORISÉ | Regarder les joueurs à partir de l'écran de chargement, en respectant le mode streamer | « Once in the loading screen, players will be able to see summoner names ». Le mode streamer masque l'identité « in third-party apps » | Overwolf et https://www.leagueoflegends.com/en-us/news/dev/dev-account-linking-and-streamer-mode/ |
| ZONE GRISE | Dépendre du LCU | « not officially supported », « no guarantees [...] change communication ». Les applis tierces passent à « the official API as the only allowed mechanism » (LCU non cité) | https://developer.riotgames.com/league-client-apis.html et https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps |
| ZONE GRISE | Afficher un pourcentage de victoire absolu pour la draft | Rien d'explicite. Risque d'incitation au dodge et de « Drawing conclusions for you » | https://support.riotgames.com/en-us/riot/events/third-party-applications |
| ZONE GRISE | Notification push « c'est ton tour » pendant le champ select | Overwolf interdit les « Notifications that dictate player action based on the current game state » (en jeu) | https://dev.overwolf.com/ow-native/guides/game-compliance/riot-games |
| ZONE GRISE | Import automatique de runes et d'objets (écriture via le LCU) | U.GG le fait (« Auto-Import Loadouts »). Riot vise « Taking actions on your behalf » | https://u.gg/app et la page support Riot |
| ZONE GRISE | Stats des coéquipiers en Flex quand les noms sont visibles | Le message 12.22 dit « only to Ranked Solo/Duo », puis ajoute la Flex | lien devtrackers (section 2) |
| ZONE GRISE | Tiers d'augments en ARAM Mayhem | « Products cannot display win rates for Augments or Arena Mode items ». U.GG affiche des « Augment Tiers » | https://developer.riotgames.com/docs/lol |
| ZONE GRISE | Conseils en jeu qui s'adaptent à l'état de la partie | Interdiction des « Notifications that dictate player action based on the current game state ». U.GG propose pourtant des « In-Game Builds » | Overwolf et u.gg/app |
| ZONE GRISE | Utiliser les données de MetaSRC, U.GG ou Lolalytics | Pas de licence. Droit des bases de données. « supported services from Riot » | section 6 |
| ZONE GRISE | Estimer en interne le niveau d'un joueur pour pondérer les calculs | « Prohibited alternatives include MMR or ELO calculators » (interdit si on l'affiche) | https://developer.riotgames.com/policies/general |
| INTERDIT | Auto-pick, auto-ban, auto-lock, auto-accept, toute automatisation | « Using any unauthorized third party programs, including [...] scripts, bots, trainers and automation programs ». « Taking actions on your behalf (botting or scripting) » | https://www.riotgames.com/en/terms-of-service et la page support Riot |
| INTERDIT | Lire la mémoire du jeu, injecter du code, contourner Vanguard | « collect info about the Riot Services by reading areas of memory ». Interdiction de « circumventing ». Blocage depuis le 06/10/2026 | CGU joueurs et article mémoire |
| INTERDIT | Obtenir ou relayer les hovers ennemis, y compris via le compagnon d'un pote dans l'autre équipe | « may not provide any game-session-specific information that would be previously unknown to the player ». « Exposing information that's intentionally obfuscated » | docs/lol et la page support Riot |
| INTERDIT | Dé-anonymiser un allié en Solo/Duo (nom, rang, historique) | « Products cannot de-anonymize players who cannot reasonably be identified from visible information ». « cannot identify or analyze players who are deliberately hidden » | General Policies et docs/lol |
| INTERDIT | Timers d'ult et de sorts d'invocateur ennemis | « allowing tracking enemy ultimate cooldowns ». « Ultimate timers is strictly forbidden » | docs/lol et Overwolf |
| INTERDIT | Alertes de power spike, ordres en jeu | « Notifications that alert players when a power spike hits » | Overwolf |
| INTERDIT | Calculateur de MMR ou d'elo affiché | « Prohibited alternatives include MMR or ELO calculators » | General Policies |
| INTERDIT | Un choix unique imposé | « Apps that dictate player decisions ». « Products should not remove game decisions » | docs/lol |
| INTERDIT | Winrates d'augments et d'objets Arena ; données Brawl et League Classic | « cannot display win rates for Augments or Arena Mode items ». « does NOT approve any Brawl related data » | docs/lol et Overwolf |
| INTERDIT | Clé API dans le compagnon ou la page web | « Do not include your API key in your code, especially if you plan on distributing a binary » | General Policies |
| INTERDIT | Clé personnelle pour un service public, ou plusieurs clés pour contourner les limites | « may not run your application for public consumption using a personal key ». « may NOT have multiple applications to bypass rate limits » | docs/portal et docs/faqs |
| INTERDIT | Aspirer OP.GG, Mobalytics, League of Graphs | Citations exactes en section 6 | section 6 |
| INTERDIT | Montrer à d'autres les parties personnalisées d'un pote | « may not publicly display a player's match history from the custom match queue » | docs/lol |
| INTERDIT | Interface qui imite le client, paris, crypto | « cannot closely resemble Riot's games or products ». « cannot feature betting or gambling ». « No cryptocurrencies » | General Policies |

---

## 8. À faire / À ne pas faire pour notre appli

### À faire
1. **Enregistrer un produit « Personal »** sur le Developer Portal avec le compte de Thomas. Décrire le compagnon en lecture seule et lister les endpoints LCU utilisés : `lol-champ-select/v1/session`, `lol-gameflow`, `lol-summoner/v1/current-summoner`, `lol-lobby`, plus ce qu'on ajoutera.
2. Afficher la mention « isn't endorsed by Riot Games... » dans l'appli, dans l'écran « À propos ».
3. Garder la clé API côté serveur uniquement, dans un secret d'hébergeur gratuit (type Cloudflare Worker). Le compagnon et la page n'appellent que notre serveur.
4. Réserver l'accès aux invités (code ou jeton par personne) et empêcher l'indexation de la page.
5. Ne mettre en commun les données de draft qu'**entre membres du même groupe**. Un allié anonyme s'affiche « Allié 2 », avec seulement son poste, son champion et son hover.
6. Toujours proposer **au moins 3 options** pour un pick ou un ban, avec la raison en un mot et la taille d'échantillon. Le détail s'ouvre à la demande.
7. Exprimer l'avantage en écart relatif (« +2,1 pts ») plutôt qu'en « 38 % de victoire ». Le chiffre absolu reste disponible à la demande.
8. Construire nos stats depuis match-v5 et league-v4, plus Data Dragon et CommunityDragon pour les données statiques. Respecter `Retry-After`.
9. Respecter le mode streamer et les champs masqués du LCU : ce qui est caché reste caché.
10. Surveiller trois sources à chaque patch : la page LCU du portail, la page support des applis tierces et le compte DevRel. Prévoir le plan B (saisie manuelle de la draft sur le téléphone) si le LCU se ferme.
11. Tenir une liste de ce qu'on stocke sur chaque pote, avec un bouton « supprimer mes données » (conditions de l'API Riot et RGPD).

### À ne pas faire
1. Aucune écriture dans le client en v1 : ni pick, ni ban, ni lock, ni accept, ni import de runes, ni message dans le chat.
2. Ne jamais relayer le LCU vers le téléphone ni vers Internet. Le jeton du lockfile ne quitte pas le PC. Seules sortent les données de draft déjà mises en forme.
3. Ne pas toucher au processus du jeu : pas de lecture mémoire, pas d'injection, pas de capture d'écran du jeu.
4. Ne jamais chercher à identifier un allié anonyme, ni recouper deux potes qui ne sont pas dans le même groupe.
5. Pas de timer, pas d'alerte en jeu, pas de push pendant la partie.
6. Rien sur les augments, l'Arena ou Brawl, et pas de MMR affiché.
7. Pas d'aspiration de sites de stats, pas d'appel à leurs API internes.
8. Ne pas copier l'écran de champ select de Riot, pas de logo Riot, pas de pub.
9. Ne pas afficher « dodge » ni « partie perdue ».
10. N'ouvrir l'appli au public qu'après avoir obtenu une clé de production.

---

## 9. Ce que je n'ai pas pu confirmer

- Une déclaration de Riot sur le LCU **après le 06/10/2026**. Je n'en ai trouvé aucune.
- Le texte exact des posts sur X (timers d'ult de 2025, Spectator de 2025, replays et RSO du 23/10/2026) : X bloque la lecture, je n'ai que des extraits et des relais.
- L'absence d'expiration des clés personnelles : la doc officielle n'en dit rien, seules des sources communautaires l'affirment.
- La liste des queues où s'applique l'anonymat : la règle officielle d'Overwolf dit Solo/Duo, le message de 2022 se contredit.
- Les fonctions actuelles de Blitz et Porofessor en champ select : leurs pages ne sont pas lisibles ou n'en disent rien.
