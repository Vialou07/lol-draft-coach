# 08 · Conformité : chaque fonction, chaque source, chaque choix d'architecture

État au 30/10/2026, patch 16.21. J'ai relu à la source toutes les règles citées ci-dessous.
Verdicts : **OK** = autorisé. **RISQUE** = aucune règle claire, ou toléré mais exposé. **INTERDIT** = une règle l'exclut.
Notation : **[V]** = j'ai lu la source aujourd'hui (URL donnée). **[P]** = lu en partie, ou seulement via un extrait ou un relais. **[H]** = mon interprétation.

## En bref

1. Le cœur du produit est **OK** : lire la draft en local et en lecture seule, puis proposer plusieurs picks et bans. Une condition : il ne doit jamais sortir de l'écran d'un joueur une information que son propre client ne lui montre pas.
2. Le vrai danger vient de **notre propre architecture**, pas de Riot. Le relais partagé entre potes peut fuiter dans trois cas : un pote dans l'équipe adverse, un pote dans la même partie mais pas groupé, ou un lien de groupe qui circule. Dans ces trois cas, ce serait de la triche. La parade : on cloisonne par lobby et par équipe, avec un jeton par personne.
3. **Données de stats : je rétrograde la source principale du rapport 03.** Les JSON du CDN de u.gg passent en RISQUE : pas de licence, réserve de droits explicite dans le robots.txt, droit des bases de données. Le dataset de DraftGap (issu de Lolalytics) et le MCP d'OP.GG sont aussi en RISQUE, et INTERDITS dans un pipeline automatique. La seule base propre, c'est l'API Riot, Data Dragon et le client local. Pour un tiers, il faut un accord écrit.
4. **Interdits nets** : l'automatisation (pick, ban, lock, accept, chat, rerolls, échanges), les timers et alertes en jeu, les winrates d'augments, les données Brawl et League Classic, un MMR affiché, la clé API côté client et l'aspiration des sites de stats.
5. **Zones grises à trancher par Thomas** : l'import de runes (écriture), la chance de victoire absolue de la draft, le build adaptatif en jeu.
6. **Deux obligations administratives oubliées ailleurs** :
   - **enregistrer le produit chez Riot avant d'installer chez les potes**, puis déclarer chaque nouvelle fonction ;
   - **publier une politique de confidentialité**, exigée par le Microsoft Store pour toute appli Win32.

---

## 1. Textes relus aujourd'hui

| Texte | Date | URL |
|---|---|---|
| Politique LoL du portail (intégrité, cas d'usage) | sans date (© 2021) | https://developer.riotgames.com/docs/lol |
| General Policies | 29/05/2025 | https://developer.riotgames.com/policies/general |
| Types de clés, limites, 429 | sans date | https://developer.riotgames.com/docs/portal |
| Page League Client APIs | sans date | https://developer.riotgames.com/league-client-apis.html |
| Conditions de l'API Riot | 09/12/2013 | https://developer.riotgames.com/terms |
| CGU joueurs, §7.1 | 01/12/2024 | https://www.riotgames.com/en/terms-of-service |
| Support, applis tierces | 10/02/2025 | https://support.riotgames.com/en-us/riot/events/third-party-applications |
| Support, blocage mémoire | 29/09/2026 | https://support.riotgames.com/en-us/riot/performance/game-memory-access-removed-for-third-party-apps |
| FAQ Vanguard DevRel | 01/04/2024 | https://www.riotgames.com/en/DevRel/vanguard-faq |
| Mode streamer (25.20) | 06/10/2025 | https://www.leagueoflegends.com/en-us/news/dev/dev-account-linking-and-streamer-mode/ |
| « Legal Jibber Jabber » (usage de la PI Riot) | 08/2018 | https://www.riotgames.com/en/legal |
| Conformité Riot chez Overwolf (LoL) | © 2026 | https://dev.overwolf.com/ow-electron/guides/game-compliance/league-of-legends/ et https://dev.overwolf.com/ow-native/guides/game-compliance/riot-games |
| Message Riot sur l'anonymat (12.22) | 2022 | https://devtrackers.gg/leagueoflegends/p/749a443a-apps-that-reveal-player-names-or-stats-in-champ-select-need-to-remove-these-informations-starting-patch-12-22 |
| Microsoft Store Policies v7.20 | 14/09/2026 | https://learn.microsoft.com/en-us/windows/apps/publish/store-policies |
| GitHub, conditions Actions et Pages | 27/08/2026 | https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features |
| CGU OP.GG | 14/09/2026 | https://www.op.gg/lol/policies/agreement |
| robots.txt de u.gg et stats2.u.gg | lus le 30/10/2026 | https://u.gg/robots.txt , https://stats2.u.gg/robots.txt |

**Ce que la relecture ajoute au rapport 02 :**

- **La page support Riot couvre aussi le champ select [V].** Elle dit : « No software should compromise game integrity [...] from the moment you press "Play" until you log off ». Le champ select est donc bien dans le périmètre de l'intégrité.
- **Les conditions de l'API prévoient le RGPD [V].** Riot transmet aux développeurs les demandes de suppression sous forme de « a list of identifiers » (accountId, etc.). À la fin de l'accès, il faut « delete all of the Game Information in Your possession ».
- **Riot audite chaque évolution [V]** : « Any new features or changes to a product must be audited through the product's page in the Developer Portal ».
- **Le robots.txt de u.gg réserve ses droits [V].** Il présente ses « Content-Signal » (`search=yes, ai-train=no, use=reference`) comme une réserve de droits au sens de l'article 4 de la directive UE 2019/790 (fouille de textes et de données). Il interdit aussi toutes les URL avec paramètres.
- **Une règle communautaire ancienne [P, 2021, non reprise par Riot aujourd'hui]** : « If an API exists both in the Riot API and the LCU API, you must use the Riot API ». La même page ajoute : « You're not allowed to use the LCU APIs to bypass the rate limiting ». Source : https://hextechdocs.dev/getting-started-with-the-lcu-api/. Je la traite comme une règle de prudence.
- **Aucune déclaration de Riot sur le LCU depuis le 06/10/2026** (recherche du 30/10). Le guide SenseOS, mis à jour le 21/10, fait le même constat [V].

---

## 2. Pendant la draft : ce qu'on affiche

Règle mère [V, docs/lol] :
- « Products must not use or incorporate information not present in the game client that would give players a competitive edge » ;
- « Products may not provide any game-session-specific information that would be previously unknown to the player » ;
- « Products should not remove game decisions, but may highlight decisions that are important [...] give multiple choices ».

| # | Fonction (rapports 01, 04, 05) | Verdict | Règle précise | Condition ou alternative |
|---|---|---|---|---|
| C1 | Draft en direct : bans, picks, postes, ordre, chrono | OK | Le client montre tout cela au joueur | Uniquement le point de vue de **son** équipe |
| C2 | Top 3 des picks, score décomposé, n affiché | OK | « give multiple choices » ; « increase [...] the diversity » [V, docs/lol] | Au moins 3 options **de poids visuel comparable**. Pas de gros bouton « PICK X ». Le badge « ≈ » du rapport 04 va dans le bon sens |
| C3 | Sécurité blind, risque de contre | OK | Calculé depuis l'ordre des picks et des stats agrégées, pas depuis une info cachée | La simulation des picks ennemis ne doit utiliser que des taux agrégés |
| C4 | Mode autofill | OK | Postes et préférences visibles par le joueur | — |
| C5, C6 | Bans « pour notre camp » d'après les hovers alliés | OK | Les intentions de pick et de ban alliées sont affichées à toute l'équipe | — |
| C7 | Suggestions d'échange (ordre, champion, rôle) | OK si affichées seulement | Affichage = « highlight decisions » | **INTERDIT** d'envoyer ou d'accepter un échange via le LCU (voir §6) |
| C8 | Flex picks | OK | — | — |
| C9 | Chance de victoire de la draft | RISQUE faible | Aucune règle explicite. L'anonymat de 2022 vise le dodge [V, devtrackers]. La page support vise « Drawing conclusions for you during gameplay » [V] | Voir §4 |
| C10 | Optimisation du premade | OK, entre membres de la party seulement | « Players who queued in the same party are de-anonymized to each other » [V, Overwolf] | Suggestions multiples par personne. Chacun picke lui-même |
| C11 | ARAM : banc, reroll, répartition | OK | Le banc est visible par l'équipe | Winrate des **augments** en Mayhem : **INTERDIT** (« Products cannot display win rates for Augments or Arena Mode items. This applies to all websites, applications and overlays » [V]). L'équipe ennemie n'est pas visible en ARAM pendant la sélection : rien à montrer sur elle |
| C12 | Swiftplay, conseil avant la file | OK | Hors draft | — |
| C13 | Push « draft commencée », « à toi dans 1 tour » | OK | Information d'état déjà montrée par le client | Le push ne contient **aucune recommandation** (« prends X ») : rien qui « dictate player action » (règle Overwolf pour le jeu, appliquée ici par prudence [H]) |
| — | Hover ennemi, sorts ennemis avant le chargement | INTERDIT | Absents du client. « Exposing information that's intentionally obfuscated » [V, support] | Le client ne les envoie pas : ne jamais chercher à les obtenir autrement |
| — | Nom, rang, historique ou maîtrise d'un allié anonyme | INTERDIT | « Products cannot identify or analyze players who are deliberately hidden by the game » [V, docs/lol] ; « cannot de-anonymize players who cannot reasonably be identified » [V, General Policies] | « Allié 2 » + poste + champion + hover. π = 0 dans le modèle (rapport 04, déjà conforme) |
| — | Scouting des alliés hors party en normale ou en flex quand les noms sont visibles | RISQUE | Overwolf limite l'anonymat au Solo/Duo [V]. Le message Riot de 2022 se contredit sur la flex [V] | Traiter **tout joueur hors party comme anonyme**, dans toutes les files. Plus simple et sans risque |

---

## 3. Ennemis, alliés masqués et partage entre potes

C'est le point le plus sensible, et il vient de **notre** relais. Le client de chaque pote est conforme. C'est la mise en commun qui peut créer de l'information « previously unknown to the player ».

| Scénario | Ce qui fuiterait | Verdict | Parade obligatoire |
|---|---|---|---|
| A. Deux inscrits dans la **même** ranked Solo/Duo, même équipe, **sans** être groupés | L'identité de « Allié 3 » (c'est Karim) | INTERDIT | Ne fusionner deux compagnons que s'ils déclarent le même **identifiant de party du lobby** (`lol-lobby`) **avant** la file. Jamais sur le `gameId` ni sur la salle de chat de la draft |
| B. Deux inscrits dans des **équipes opposées** (hasard du matchmaking à elo proche, customs, Clash) | Les hovers, les bans prévus et le pool de l'adversaire | INTERDIT | Cloisonner par party **et** par équipe. Une partie personnalisée entre potes compte comme deux équipes |
| C. « Regarder la draft d'un pote » depuis la liste du groupe, alors qu'on est soi-même dans la partie adverse | Toute la draft adverse en direct | INTERDIT | **Aucune vue « draft d'un autre »** pendant le champ select pour quelqu'un hors de la party. La présence (« en draft ») est OK, le contenu non. Après la partie, OK |
| D. Le lien ou la clé de groupe circule (le rapport 05 dit qu'elle est « récupérable par quelqu'un de motivé ») | Un inconnu, ou un adversaire, suit nos drafts | RISQUE fort | **Jeton par personne**, révocable. Le Durable Object n'envoie un état de draft qu'aux jetons des membres de cette party. TTL court. Aucune liste publique de salons |
| E. Le log `draft-log.jsonl` garde les champs masqués (`obfuscatedPuuid`, ids de salon, `nameVisibilityType`) | Traçage d'un joueur anonyme d'une partie à l'autre | INTERDIT si on recoupe, RISQUE si on stocke | Retirer ces champs **avant** tout envoi au relais ou au serveur. En local, on peut les garder pour le débogage, avec une rotation courte. Ne **jamais** relier deux parties par un identifiant masqué |
| F. Un pote active « Hide My Name » ou « Hide My Everything » | Son Riot ID devant des inconnus | Respect obligatoire | L'option masque l'identité « in champ select, in game, and in third party apps » [V, Riot 06/10/2025]. Elle ne change rien au sein de la party, mais : aucun affichage public, et identité interne par PUUID |

Clash, scouting des adversaires (O5, rapport 04 §5) : **OK [H]**. Les noms des adversaires de Clash sont montrés par le client avant le match. Ils ne sont donc pas « deliberately hidden ». À vérifier sur un vrai Clash : ne scouter que ce que le client affiche déjà. Le calendrier 2026 n'est pas confirmé par Riot (sources tierces contradictoires).

Écran de chargement (G1) : **OK sous conditions**. Riot, en 2022, autorise l'affichage « once you hit the loading screen » [V, devtrackers]. Overwolf dit la même chose [V]. Conditions : passer par l'API Riot (spectator-v5 + league-v4, clé côté serveur) et respecter le mode streamer. Gain faible : à garder pour plus tard.

---

## 4. Dodge et chance de victoire

- Aucun texte de Riot n'interdit d'afficher une probabilité. DraftGap et LoLDraftAI le font. Mais :
  - l'anonymat du Solo/Duo a été créé pour réduire le dodge [V, devtrackers 2022] ;
  - la page support vise « Drawing conclusions for you » [V].
- **Verdict : RISQUE faible**, à encadrer :
  1. Jamais le mot « dodge », ni « draft perdue », ni de seuil coloré du genre « < 45 % = rouge ».
  2. Par candidat, le gros chiffre est **l'écart en points** (+2,1). Le pourcentage absolu s'affiche au tap. Cela rejoint le rapport 02, et nuance le rapport 04 (qui met « 54 » en gros).
  3. « Notre draft : 51 % » est masqué par défaut pendant la sélection. On le montre après la partie (P4 : « analyze and reflect later » [V, support]).
  4. Aucune recommandation fondée sur l'identité d'un joueur. C'est impossible de toute façon, puisque π = 0 hors party.

---

## 5. En partie : overlays et notifications

| # | Fonction | Verdict | Règle | Alternative |
|---|---|---|---|---|
| G (rapport 05) | Plan statique décidé avant la partie, consulté sur le téléphone | OK | « Game overlays that provide static data that is available prior to the game » [V, docs/lol] | — |
| G2 | Build qui s'adapte aux objets ennemis via la Live Client Data API (port 2999) | RISQUE | « Drawing conclusions for you during gameplay » [V, support]. Overwolf interdit les « Notifications that dictate player action based on the current game state » [V]. L'API est officielle, son usage pour conseiller reste gris | Un **plan à branches** préparé avant la partie (« si 3 AP ou plus en face : objet X ») : c'est une donnée statique. Pas d'appel au port 2999 en v1 |
| G3 | Timers de jungle et d'objectifs | RISQUE ou INTERDIT | Les timers de camps **ennemis** sont une info absente du client | Rejeter |
| G4 | Timers d'ultimes et de sorts ennemis | INTERDIT | « automatically or manually allowing tracking enemy ultimate cooldowns » [V, docs/lol] ; « Ultimate timers is strictly forbidden » [V, Overwolf] | — |
| G5 | Alertes de power spike, « va au dragon » | INTERDIT | « Notifications that alert players when a power spike hits » [V, Overwolf] | Power spikes de **ton** champion dans le plan statique |
| — | Push pendant la partie | INTERDIT par prudence | Même règle Overwolf | Aucun push entre le chargement et la fin de partie |
| — | Fenêtre du pont au premier plan pendant la partie | OK si elle ne montre que le plan statique | Ce n'est pas une injection, et c'est de la donnée statique | Masquée par défaut au lancement de la partie (déjà prévu au rapport 05) |

---

## 6. Automatisation et écriture dans le client

Règles :
- [V, CGU §7.1 item 11] : « Using any unauthorized third party programs, including mods, hacks, cheats, scripts, bots, trainers and automation programs » ;
- [V, support] : « Taking actions on your behalf (botting or scripting) » ;
- [V, docs/lol] : « Apps that dictate player decisions ».

| Action | Verdict | Remarque |
|---|---|---|
| Auto-accept, auto-pick, auto-ban, auto-lock, auto-reroll ARAM, échange automatique | INTERDIT | Y compris « depuis le téléphone » façon Lexu.gg : c'est de la télécommande |
| Message dans le chat de la draft | INTERDIT | Les conditions de l'API interdisent aussi de « messaging other players using Game Information » [V, résumé des restrictions] |
| Import de runes ou d'objets en un clic (L2, `lol-perks`) | RISQUE | Les gros le font. U.GG affiche « Auto-Import Loadouts » et « Riot Games Compliant » [V selon le rapport 02, page en 403 chez moi]. Aucun texte de Riot ne l'autorise explicitement. Cela casse aussi la garantie vérifiable « zéro POST » du pont. **Alternative v1** : page de runes affichée en grand, recopiée à la main. Si Thomas l'autorise un jour : uniquement sur un clic explicite, hors chrono, et déclaré sur le portail Riot |
| `POST /lol-champion-mastery/v1/scouting` (rapport 03) | RISQUE | Lecture déguisée en POST. Si on l'utilise, ce sera **seulement** avec les PUUID des membres de la party visibles dans `lol-lobby`, jamais avec ceux d'une session de draft. Pas en v1 |
| Lire l'historique d'**autres** PUUID via le LCU pour économiser des appels à l'API Riot | RISQUE | Règle communautaire de 2021 sur le contournement des limites [P]. Les données des potes passent par match-v5 côté serveur |

---

## 7. Sources de données

| Source (rapport 03) | Verdict | Règle | Alternative |
|---|---|---|---|
| API Riot (match-v5, league-v4, mastery-v4), clé personnelle côté serveur | OK | « Aggregate player stats (no specific players) » et « Showing (self) player stats » [V, docs/lol]. Clé personnelle « for just the developer or a small private community » [V, docs/portal]. Respecter `Retry-After`, sinon « access disabled » [V] | Source de référence |
| Data Dragon | OK | Listé dans « Use the following assets » [V, General Policies] | — |
| Données du client local (`/lol-game-data`) | OK | Lecture locale en lecture seule | Source principale du compagnon |
| CommunityDragon | RISQUE faible | Miroir communautaire des fichiers du client, sans statut officiel [H] | En secours seulement |
| **JSON du CDN de u.gg** (`stats2.u.gg`) | **RISQUE** (rétrogradé) | Aucune licence. CGU illisibles chez moi (403). Le rapport 02 n'y voit pas de clause anti-aspiration, mais une clause de non-divulgation. Le robots.txt réserve les droits (directive 2019/790, art. 4) [V]. Droit *sui generis* des bases : l'exception d'extraction « à des fins privées » ne vaut que pour les bases **non électroniques** (CPI L342-3) [P]. Télécharger chaque jour les fichiers de tous les champions = extraction d'une partie substantielle [H]. Riot : « Products should use supported services from Riot Games for data ingestion » [V] | **Demander par écrit à U.GG.** En attendant : notre propre agrégation match-v5, plus petite mais propre. Si jamais un accord est obtenu, ne **jamais republier** ces données en public (GitHub Pages est public) |
| API interne de Lolalytics (`a1.lolalytics.com/mega`) | INTERDIT sans accord écrit | API privée, aucune condition publiée, robots d'IA bloqués [V selon le rapport 02] | Écrire à Lolalytics |
| Dataset public de DraftGap (`bucket.draftgap.com`) | RISQUE | La licence MIT couvre le **code**, pas les données. La FAQ dit que les données viennent de Lolalytics, sans mentionner d'autorisation [V, FAQDialog.tsx] | Le code de DraftGap : OK (MIT, garder la notice). Les données : accord de **l'auteur et de Lolalytics** |
| MCP d'OP.GG | RISQUE en usage manuel, INTERDIT en pipeline | Le service est officiel, conçu pour des agents IA [V, repo]. Mais les CGU d'OP.GG interdisent « automated scripts to collect information » et « reproduce, distribute, create derivative works [...] without our express written consent », et limitent l'usage au « personal, non-commercial use only » [V, 14/09/2026] | Vérification ponctuelle à la main, par une personne. Rien dans le pipeline |
| Aspiration d'OP.GG, Mobalytics, League of Graphs | INTERDIT | Citations exactes au rapport 02 §6. OP.GG revérifié aujourd'hui [V] | — |
| Consultation manuelle de ces sites pour contrôler nos chiffres | OK | Usage normal d'un navigateur | — |

**Conséquence pour le pipeline du rapport 03.** Le job quotidien qui collecte u.gg n'est pas conforme en l'état. La v1 doit partir de match-v5 et accepter des échantillons plus petits, en affichant n et en signalant le bruit, comme Thomas le veut. Le rapport 04 a mesuré ses τ sur le dataset DraftGap : pour une étude ponctuelle et privée, c'est un RISQUE faible. Il ne faut pas en faire une dépendance de production.

---

## 8. Architecture

| Choix (rapport 05) | Verdict | Règle | Condition |
|---|---|---|---|
| Pont Tauri qui lit le LCU (GET + abonnement WAMP) | OK, avec RISQUE structurel | « not officially supported [...] no guarantees of [...] change communication » [V]. « Apps developed using the LCU [...] are still expected to work » [V, FAQ Vanguard 01/04/2024]. Le blocage mémoire ne cite pas le LCU [V] | Liste blanche d'endpoints dans le code ; aucun verbe d'écriture ; plan B manuel |
| Trouver le port et le jeton via le **lockfile** | OK | Méthode documentée par la communauté | Trouver le dossier via le chemin de l'exécutable (`QueryFullProcessImageName`) ou `RiotClientInstalls.json` |
| Lire la **ligne de commande** de `LeagueClientUx.exe` (repli `Get-CimInstance` du POC) | RISQUE | Sous Windows, cela revient à lire la mémoire d'un processus Riot (PEB). La CGU §7.1 vise les programmes « reading areas of memory used by the Riot Services » [V, interprétation H] | **Supprimer ce repli**, ne garder que le lockfile. Ne jamais ouvrir un handle sur `League of Legends.exe` |
| Fenêtre à côté du client pendant la draft | OK | Le client n'est pas le jeu, rien n'est injecté | Ne pas imiter l'écran de Riot : « cannot closely resemble Riot's games or products » [V] |
| Relais Cloudflare (Worker + Durable Object) | OK sous conditions | — | Cloisonnement du §3, jetons par personne, TTL, aucun champ masqué |
| Page sur GitHub Pages | OK sous conditions | « You may not run your application for public consumption using a personal key » [V, docs/portal]. Pages est public, même depuis un dépôt privé [H, sauf Enterprise] | La page sans jeton ne montre rien. `noindex`. Données de stats et perso servies par le Worker, sur jeton |
| GitHub Actions pour la collecte | RISQUE pour un crawler, OK pour un build léger | « You may only access and use GitHub Actions to develop and test your application(s) » ; interdit « as part of a serverless application » [V, 27/08/2026] | Le crawler match-v5 tourne sur le PC de Thomas ou un petit serveur. Actions se limite à construire et publier |
| ntfy.sh | OK | — | Les sujets ntfy.sh sont publics pour qui devine le nom : nom imprévisible, aucun Riot ID ni contenu de draft dans le message |
| Microsoft Store en audience privée | OK sous conditions | 10.5.1 : un produit Win32 « must always have privacy policies » [V]. 10.5.2 et 10.5.3 : consentement opt-in, et consentement **écrit** pour publier les données d'une personne qui n'est pas utilisatrice [V]. 11.2 : contenus de tiers sous licence [V] | Politique de confidentialité, écran de consentement, nom **sans** « LoL », « League » ni « Riot » (Legal Jibber Jabber : pas de marques Riot dans les noms de domaine ou de comptes [V]) |
| Icônes et images des champions | OK | Data Dragon est autorisé pour un produit enregistré [V]. La PI Riot dans une appli suppose une clé valide et le respect des conditions de l'API [V, Legal Jibber Jabber] | Mention Riot visible (§9) |

---

## 9. Clé API et enregistrement

| Point | Verdict | Règle |
|---|---|---|
| Enregistrer le produit, même s'il n'utilise que le LCU | **Obligatoire** | « you must register it with us regardless of whether or not your product uses official documented APIs » [V, page LCU]. Indiquer « which endpoints you're using and how » [V] |
| Déclarer chaque nouvelle fonction | **Obligatoire** | « Any new features or changes to a product must be audited » [V] |
| Clé personnelle pour 5 à 10 potes | OK | « small private community » [V] |
| Clé dans le compagnon, la page, le dépôt ou un `.env` commité | INTERDIT | « Do not include your API key in your code, especially if you plan on distributing a binary » [V] ; « You may not [...] disclose Your API Key(s) to any other party » [V, conditions API] |
| Une clé par pote, ou plusieurs produits pour additionner les limites | INTERDIT | « may NOT have multiple applications to bypass rate limits » [V selon le rapport 02, FAQ] ; « one product per key » [V] |
| Clé compromise | Signaler | « notify Riot immediately » [V] |
| Mention obligatoire | **Obligatoire** | « [Nom] isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games [...] » [V, General Policies] |
| RSO | Impossible et inutile | « only available to developers with Production Level API Keys » [V] |

Côté joueur, l'enregistrement compte aussi [H] : la CGU vise les programmes « unauthorized ». Un produit déclaré et audité sur le portail est la meilleure défense pour les comptes des potes.

---

## 10. Données des autres joueurs

| Donnée | Verdict | Règle | Règle pour nous |
|---|---|---|---|
| Stats, pool et maîtrise des potes inscrits | OK avec consentement | Store 10.5.2 [V]. RGPD : un usage privé entre amis relève probablement de l'exemption « purely personal or household activity » (RGPD, art. 2.2.c) [H] | Consentement explicite au premier lancement, liste de ce qui est stocké, bouton « supprimer mes données » |
| Les 9 autres joueurs d'une partie de l'historique (Riot ID, PUUID) | RISQUE si on les envoie au serveur | Store 10.5.3 [V]. Données personnelles au sens du RGPD | Ne remonter que les champions, les rôles, le résultat et les stats **sans identité**. Les identités restent dans le client |
| PUUID collectés par le crawler match-v5 (inconnus) | RISQUE | Hors de l'exemption domestique [H]. Demandes de suppression relayées par Riot [V] | Garder les PUUID seulement le temps de la collecte. Ne stocker que des agrégats |
| Parties personnalisées entre potes | OK en privé, avec accord | « may not publicly display [...] custom match queue unless the player opts in » [V] | Jamais affichées publiquement |
| Données Brawl et League Classic | INTERDIT | « does NOT approve any Brawl related data being aggregated or visible » ; League Classic « in any form » [V, Overwolf] | Filtrer ces files dans les historiques et les stats |
| Classement entre potes (O6) | OK avec les LP officiels | « Official Ladder Leaderboards » est approuvé [V] | **INTERDIT** : un MMR ou un « niveau » estimé et affiché (« Prohibited alternatives include MMR or ELO calculators » [V]). Le terme interne u_ic du rapport 04 ne s'affiche jamais comme une note du joueur |
| Fin de l'accès à l'API | Obligatoire | « delete all of the Game Information » [V] | Script de purge prêt |

---

## 11. Ce que je corrige dans les autres rapports

1. **Rapport 03.** u.gg ne peut pas être la « meilleure source qu'on peut lire sans accord préalable » : il faut un accord. Le MCP d'OP.GG n'est pas un plan C de pipeline. Pour DraftGap, l'accord de l'auteur ne suffit pas : il faut aussi celui de Lolalytics. Le crawler 24/7 ne tourne pas sur Actions.
2. **Rapport 05.**
   - La « clé de groupe récupérable » est insuffisante : il faut un jeton par personne et le cloisonnement du §3.
   - L'écran L (« potes en ligne ») ne doit jamais devenir une vue de la draft d'un autre.
   - Le repli par ligne de commande du POC est à supprimer.
   - Il manque une politique de confidentialité pour le Store.
3. **Rapport 04.** Le gros chiffre par candidat devient l'écart en points. « Notre draft : X % » est masqué pendant la sélection. Le modèle est déjà conforme sur π = 0 hors party et sur l'absence de MMR affiché.
4. **Rapport 01.**
   - C9 passe de OK à RISQUE faible.
   - G1 passe de Gris à OK sous conditions.
   - G2 passe à RISQUE, avec l'alternative du plan à branches.
   - G3 passe à RISQUE ou INTERDIT.
   - C13 est OK sans recommandation dans le push.
   - O5 est OK [H].

---

## 12. Règles dures pour les développeurs

1. **Lecture seule vérifiable.** Le pont n'appelle que des GET listés en dur, plus l'abonnement WAMP. Aucun POST, PUT, PATCH ou DELETE. Un test automatique échoue si un autre verbe apparaît.
2. **Rien qui ne soit pas déjà sur l'écran du joueur.** Pas de hover ni de sort ennemi. Une draft n'est visible que par le joueur et les membres de **sa party, dans sa party et son équipe**. On fusionne sur l'identifiant de party du lobby, jamais sur le `gameId`.
3. **Un joueur hors party est « Allié N », dans toutes les files.** Pas de nom, de PUUID, de rang ni d'historique. Les champs masqués sont retirés avant tout envoi. On ne relie jamais deux parties par un identifiant masqué.
4. **Au moins 3 options de poids visuel comparable**, jamais un ordre. Jamais « dodge » ni « draft perdue ». L'écart en points est mis en avant, l'absolu s'affiche au tap.
5. **Aucune action à la place du joueur** : pick, ban, lock, accept, reroll, échange, chat, runes (tant que Thomas n'a pas tranché L2).
6. **En partie, uniquement le plan statique décidé avant.** Pas de push, pas de timer, pas d'alerte, pas d'appel au port 2999 en v1.
7. **Ne jamais toucher aux processus Riot.** On détecte par le nom du processus et on lit le lockfile. Pas de lecture de mémoire ni de ligne de commande, pas d'injection, pas de capture d'écran du jeu.
8. **La clé API n'existe que dans un secret serveur.** Une seule clé, `Retry-After` respecté, aucun accès public sans jeton personnel.
9. **Stats issues uniquement de l'API Riot, de Data Dragon et du client local.** Un site tiers ne sert qu'avec un accord écrit, et ses données ne sont jamais republiées en public.
10. **Minimiser les données des autres.** Pas d'identité des 9 autres joueurs côté serveur. PUUID du crawler jetés après agrégation. Purge possible à la demande.
11. **Pas d'augments, d'Arena, de Brawl, de League Classic. Pas de MMR ni d'elo de joueur affiché.**
12. **Enregistrer le produit avant le premier pote**, avec la liste des endpoints LCU, et mettre la fiche à jour à chaque nouvelle fonction. Mention Riot dans l'appli, nom sans marque Riot, politique de confidentialité et consentement.
13. **Surveillance à chaque patch** : page LCU, page support sur les applis tierces, article sur le blocage mémoire. Le mode manuel doit rester fonctionnel.

---

## 13. Non confirmé

- Les CGU actuelles de U.GG : 403 avec mes outils. Je m'appuie sur la lecture du rapport 02, qui cite une version du 25/05/2018.
- La FAQ qui cite « data broker » et « multiple applications to bypass rate limits » : vue dans docs/lol pour la première, et seulement via le rapport 02 pour la seconde.
- Les noms des adversaires de Clash sont-ils visibles avant le match en 2026 ? Le Clash de novembre 2026 aura-t-il lieu ? Sources tierces seulement.
- L'exemption domestique du RGPD pour un groupe privé de 5 à 10 personnes : c'est mon interprétation, pas un avis juridique.
- Le texte exact en vigueur de l'article L342-3 du CPI : lu via un extrait universitaire, pas sur Légifrance (404).
- Aucune déclaration de Riot sur le LCU après le 06/10/2026 : le statut « toléré » repose sur la FAQ de 2024 et l'absence de démenti.
