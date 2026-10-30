# 05 · Parcours d'installation et d'usage

Recherche du 30/10/2026 (patch 16.21). Légende : **[V]** = vérifié, source lue (URL en fin de section). **[H]** = hypothèse ou chiffre non confirmé pour fin 2026. **[M]** = mesuré sur ton PC aujourd'hui.

---

## 0. Verdict en 6 lignes

1. **Un petit programme « pont » sur le PC est obligatoire.** Aucune page web ni extension de navigateur ne peut lire le client LoL (port et mot de passe tirés au hasard à chaque lancement, certificat Riot auto-signé).
2. **Le pont reste bête.** Il lit le client en lecture seule et transmet l'état de la draft. L'interface et les calculs vivent sur GitHub Pages : tu les mets à jour comme worlds.html, sans faire réinstaller personne.
3. **Techno du pont : Tauri v2.** Un installeur de quelques Mo, sans droits admin, avec icône près de l'horloge, démarrage avec Windows et mise à jour depuis GitHub Releases.
4. **Distribution en deux temps.** D'abord toi seul avec un .exe non signé. Ensuite tes potes via le **Microsoft Store en audience privée**. C'est gratuit, Microsoft signe le paquet, il n'y a aucun avertissement SmartScreen ni Smart App Control, et le Store fait les mises à jour.
5. **Affichage.** Une fenêtre qui s'ouvre toute seule à côté du client pendant la draft, plus la même vue sur le téléphone via un relais cloud gratuit (Cloudflare Worker et Durable Object). Pas de mode réseau local.
6. **Côté actions.** Environ 5 actions la première fois, 0 au quotidien. En premade, **un seul pont par équipe suffit** : les potes sans programme suivent leur reco sur leur téléphone.

---

## 1. Blitz, Porofessor et U.GG le font déjà ?

En partie, oui. Voici ce qu'ils proposent pour l'installation et la draft :

| App | Distribution | Draft | Téléphone |
|---|---|---|---|
| Porofessor | Overwolf, plus une version autonome Electron depuis décembre 2025 **[V]** | Suggestions de bans, conseils de contre-pick, import des runes **[V]** | Non mentionné |
| Blitz | Appli PC/Mac autonome **[V]** (Electron **[H]**) | Suggestions de picks et de bans, import de builds **[V]** | Oui : « Paired with the Blitz PC or Mac app, our mobile app lets you draft entirely on your smartphone » **[V]**. Page App Store avec des avis de 2022-2023, état actuel non confirmé |
| U.GG | Appli autonome (LoL, Valorant, Deadlock) **[V, via extrait de recherche, page u.gg/app refusée en 403]** | « Champion Select Scouting » : picks, counters et synergies, import automatique **[V, extrait]** | Non trouvé |

Ce qu'on peut faire mieux, côté parcours :
- **pas de pub ni de compte à créer** ;
- **pas de client lourd** comme Overwolf ;
- **un vrai mode groupe** : les pools et l'historique de tes potes servent à la reco commune, ce qu'aucun ne fait pour un groupe privé **[H]** ;
- **le téléphone comme écran d'appoint dès la première version** ;
- **la taille d'échantillon affichée partout.**

La qualité de la reco elle-même relève de l'agent « analyse ».

Sources : [porofessor.gg/download](https://porofessor.gg/download), [communiqué Porofessor autonome](https://www.inderes.fi/en/releases/moba-network-launches-standalone-version-of-the-porofessor-app), [Blitz sur l'App Store](https://apps.apple.com/ca/app/blitz/id1591484739), [u.gg/app](https://u.gg/app).

---

## 2. Le programme pont : comparatif des options

### 2.1 Tableau

| Option | Taille | Fenêtre et icône | Démarrage auto | Mise à jour | Admin | Verdict |
|---|---|---|---|---|---|---|
| **Node SEA** | ~91 Mo (node.exe 24.14 fait 91,4 Mo **[M]**) | Console seulement. Une icône près de l'horloge demande un module natif, et ces modules ne se chargent pas depuis le système de fichiers virtuel du SEA **[V]** | À coder (clé Run) | À coder | Non | Pour tes prototypes uniquement. Statut « 1.1 Active development », `--build-sea` intégré depuis Node 25.5 **[V]** |
| **Bun compile** | Plusieurs dizaines de Mo (doc donnée pour Linux et macOS seulement) **[V/H]** | Option `hideConsole` et icône **[V]**, pas d'icône près de l'horloge en natif | À coder | À coder | Non | Non : même poids, même absence d'interface |
| **Go** (+ systray, WebView2 via Wails) | ~8-15 Mo **[H]** | Oui, via bibliothèques | Clé Run HKCU | Bibliothèques de mise à jour depuis GitHub | Non | Plan B correct. Les binaires Go non signés sont souvent pris pour des virus par l'analyse automatique de Defender (rapport anecdotique de 2022) **[V faible]** |
| **Rust seul** | ~3-8 Mo **[H]** | Crate `tray-icon` | Clé Run | À coder | Non | Bien, mais revient à refaire Tauri à la main |
| **Tauri v2** | Installeur de quelques Mo : 3,2 Mo pour un hello world dans un test de juillet 2026, méthode contestée **[V/H]**. WebView2 est déjà sur Windows 11, l'amorce par défaut ajoute 0 Mo **[V]** | Icône près de l'horloge et fenêtre natives | Plugin autostart, avec arguments (`--minimized`) **[V]** | Plugin updater + `latest.json` sur GitHub Releases, signature obligatoire, mode « passive » **[V]** | **Non** : l'installeur NSIS installe pour l'utilisateur courant par défaut, dans `%LOCALAPPDATA%` **[V]** | **Recommandé** |
| **Electron** | ~85 Mo en hello world **[V/H]**, 150-300 Mo de RAM **[H]** | Oui | Oui | electron-updater, mûr | Non | Ça marche (c'est le choix de Porofessor autonome), mais c'est 25 fois plus lourd sans rien apporter de plus |
| **Overwolf** | Client Overwolf + l'appli | Overlay | Oui | Overwolf | Non | **Exclu.** L'appli doit être validée par Overwolf sur dossier **[V]**. Clause d'exclusivité **[V]**. Et surtout : « From November 1, 2026, Overwolf only approves apps with Overwolf monetization » **[V]**, donc pub imposée |
| **Extension navigateur** | - | - | - | - | - | **Impossible seule.** Elle ne peut lire ni le lockfile ni la liste des processus, alors que le port et le mot de passe changent à chaque lancement **[V]**. Le certificat est auto-signé **[V]**. La seule passerelle, le « native messaging », impose d'installer un exécutable à part et une clé de registre **[V]**. Autant faire le pont directement |
| **Sans rien installer** | 0 | Téléphone | - | - | - | Mode manuel en secours (voir §7, écran M) |

### 2.2 SmartScreen, Smart App Control et antivirus

- **.exe non signé** : Windows affiche « Windows a protégé votre ordinateur ». Il faut cliquer « Informations complémentaires » puis « Exécuter quand même » **[V]**. La réputation se gagne fichier par fichier et demande « several weeks and hundreds of clean installs from a wide audience » **[V]**, donc jamais avec 10 potes. Chaque nouvelle version non signée repart de zéro **[V]**.
- **Smart App Control (Windows 11)** : c'est le vrai piège. Quand il est activé, il « will block execution of unsigned files unless the file has a positive reputation », et ce contrôle s'applique à tous les exécutables, pas seulement aux téléchargements **[V]**. Il n'existe aucune exception par appli **[V]**. Depuis la mise à jour d'avril 2026, on peut le désactiver sans réinstaller Windows **[V, presse et FAQ Microsoft]**, mais une mise à jour d'octobre 2026 grise l'option sur certains PC **[V, PCWorld 19/10/2026]**. Demander à un pote de couper une protection Windows, c'est non.
- **Signature EV** : elle ne contourne plus SmartScreen depuis 2024 **[V]**.
- **Antivirus** : quelques réflexes pour éviter les faux positifs :
  - ne pas lancer PowerShell ou WMI depuis le pont. Le POC le fait en secours (`Get-CimInstance`) ; en version finale, passer par les API Win32 **[H, bonne pratique]** ;
  - ne pas compresser l'exécutable (UPX) ;
  - signer ;
  - en cas de faux positif, soumettre le fichier au [portail WDSI](https://www.microsoft.com/en-us/wdsi/filesubmission) **[V]**.

### 2.3 Options de signature pour toi (particulier en France)

| Option | Coût | Accès pour toi | Effet |
|---|---|---|---|
| **Microsoft Store (paquet MSIX)** | **0 €**. Inscription des développeurs particuliers gratuite depuis 2025 (pièce d'identité + selfie) **[V]** | Oui | Microsoft signe le paquet. « Users will never see a SmartScreen warning for a Store-installed app » **[V]** |
| Azure Artifact Signing | 9,99 $/mois | **Non** : les particuliers doivent être aux États-Unis ou au Canada **[V, page du 29/08/2026]** | - |
| Certificat OV classique | 150-300 $/an, clé sur matériel dédié obligatoire depuis 06/2023 **[V]** | Oui | Avertissement au début, puis réputation qui s'accumule version après version |
| Certum « Open Source Code Signing » | dès 69 € TTC, carte et lecteur fournis **[V]**, durée non indiquée | Oui. Le certificat porte « Open Source Developer » suivi de ton nom **[V]** | Comme un OV. Passe probablement Smart App Control **[H]** |
| SignPath Foundation | 0 € | Projet sous licence libre (OSI), sans composant propriétaire, avec une « verifiable reputation » pour un exécutable, et une validation manuelle à chaque version **[V]**. Certificat au nom de SignPath Foundation **[V]** | Peu réaliste pour un projet privé tout neuf |

**Le Store, concrètement** :
- Tauri ne produit pas de MSIX tout seul **[V]**, mais Microsoft documente l'empaquetage d'une appli Tauri en MSIX avec `winapp` (page du 07/10/2026). Le Store signe ensuite le MSIX **[V]**.
- **Audience privée** : seuls les comptes Microsoft personnels que tu listes voient la fiche et peuvent installer, même en connaissant l'URL **[V]**. Il faut donc récupérer l'e-mail du compte Microsoft de chaque pote.
- Variante sans e-mails : « disponible mais non découvrable », installation par lien direct uniquement **[V]**.
- **Certification** : jusqu'à 3 jours ouvrés, y compris pour chaque nouvelle version du paquet **[V]**. C'est pour ça que le pont doit rester bête et rarement mis à jour.
- **Démarrage auto** : extension `StartupTask`. Elle ne s'active qu'après un premier lancement manuel, et l'utilisateur peut la couper dans le Gestionnaire des tâches **[V]**.
- **Risque** : refus en certification (appli qui dépend d'un jeu tiers, API non officielle) **[H, non vérifié]**. Repli : signer avec Certum et diffuser l'installeur NSIS.

Sources : [options de signature (MS Learn, 29/08/2026)](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), [réputation SmartScreen (MS Learn, 2026)](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation), [Smart App Control (textslashplain, 28/04/2026)](https://textslashplain.com/2026/04/28/smart-app-control/), [PCWorld, octobre 2026](https://www.pcworld.com/article/3263770/windows-11s-october-update-blocks-smart-app-control-heres-the-fix.html), [inscription gratuite au Store (10/09/2025)](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/), [visibilité MSIX](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/visibility-options), [certification](https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/msix/app-certification-process), [Tauri et le Store](https://v2.tauri.app/distribute/microsoft-store/), [winapp et Tauri](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/guides/tauri), [StartupTask](https://blogs.windows.com/windowsdeveloper/2017/08/01/configure-app-start-log/), [Certum Open Source](https://shop.certum.eu/open-source-code-signing.html), [conditions SignPath](https://signpath.org/terms), [installeur Windows Tauri](https://v2.tauri.app/distribute/windows-installer/), [updater Tauri](https://v2.tauri.app/plugin/updater/), [autostart Tauri](https://v2.tauri.app/plugin/autostart/), [Node SEA (doc v26.13)](https://nodejs.org/api/single-executable-applications.html), [Bun, taille des exécutables](https://bun.com/docs/compiler/size), [comparatif Tauri/Electron 2026](https://tech-insider.org/tauri-vs-electron-2026/), [proposition d'appli Overwolf](https://dev.overwolf.com/ow-native/getting-started/submitting-an-app-proposal), [conditions de monétisation Overwolf](https://legal.overwolf.com/docs/overwolf/monetization-terms), [Overwolf, LoL launcher (bandeau du 1/11/2026)](https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/league-of-legends-launcher/), [native messaging Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging), [Hextech docs, LCU](https://hextechdocs.dev/getting-started-with-the-lcu-api/).

### 2.4 Démarrage et détection de LoL

- **Recommandé** : le pont démarre avec la session Windows (clé Run HKCU, sans admin **[H, standard Windows]**, ou `StartupTask` avec le Store). Il reste en veille dans l'icône près de l'horloge. Toutes les 3 secondes, il regarde si `LeagueClientUx.exe` tourne via les API Win32, ce qui coûte environ 0 % de CPU **[H]**. Il lit ensuite le lockfile dans le dossier du processus, ce qui gère les installations hors `C:\Riot Games` **[H]**.
- **À écarter** :
  - un raccourci « LoL + Draft » : il oblige à changer d'habitude ;
  - un déclenchement sur événement de démarrage de processus (WMI `Win32_ProcessStartTrace`) : il demande l'admin **[H]**.
- **Mises à jour du pont** : uniquement quand l'état du client est « aucun » ou « lobby », jamais en draft ni en partie. Sur Windows, l'updater Tauri ferme l'appli pendant l'installation **[V]**.

---

## 3. Où afficher : comparatif des surfaces

| Surface | Latence | Fiabilité | Actions pour l'ami | Verdict |
|---|---|---|---|---|
| **Fenêtre du pont à côté du client** | < 10 ms après l'événement du client **[H]** | Locale, sans réseau | 0 : elle s'ouvre seule en draft et se cache au lancement de la partie | **Surface principale en draft.** Le client fait 1280×720 par défaut **[H]**, ce qui laisse environ 640 px libres sur un écran 1080p pour une colonne de 360-420 px. « Toujours au premier plan » désactivé par défaut, avec un interrupteur dans le menu de l'icône |
| Onglet navigateur sur `http://127.0.0.1` servi par le pont | < 10 ms | Bonne | +1 à chaque draft (ouvrir ou retrouver l'onglet) | Inutile si la fenêtre existe |
| Téléphone en réseau local (QR vers `http://192.168.x.x`) | 5-30 ms **[H]** | Médiocre : pare-feu Windows à valider en admin à la première écoute réseau **[V faible]**, réseau en profil « Public » bloqué par défaut **[H]**, isolation Wi-Fi sur certaines box **[H]**, adresse IP qui change, rien en 4G | +2 à 4 la première fois, puis ça casse en silence | **Non.** De plus, une page https (GitHub Pages) qui appelle `http://` en local doit déclarer `targetAddressSpace` et obtenir une permission ; c'est documenté pour Chrome seulement, pas pour Safari iOS **[V]** |
| **Téléphone via relais cloud** | Connexion TCP mesurée à 14-35 ms vers Cloudflare Marseille **[M]**, donc environ 50-150 ms de bout en bout **[H, à mesurer]** | Bonne : connexions sortantes seulement, marche en 4G, même page https que le reste | 0 au quotidien | **Recommandé en second écran** |
| WebRTC (pair à pair) | ~ relais | Il faut de toute façon un serveur de mise en relation et un relais en cas de NAT | 0 | Complexité pour rien |
| ntfy comme relais d'état | ~100 ms de connexion vers ntfy.sh **[M]** | Limites de ntfy.sh : 4 096 octets par message, rafale de 60 requêtes puis 1 toutes les 5 s, **250 messages par jour** par visiteur **[V]** | 0 | Trop juste : environ 30 à 40 messages par draft, 10 parties par soir. À garder pour **une seule notification** « ta draft commence » |

Le relais retenu : un **Cloudflare Worker et un Durable Object par groupe**. Le plan gratuit offre 100 000 requêtes par jour ; les messages WebSocket entrants comptent pour 1/20 de requête ; stockage SQLite **[V]**. Le Durable Object garde le dernier état, donc un téléphone qui se connecte en pleine draft voit tout de suite la situation. Indication de lieu `weur` (Europe de l'Ouest, indicative seulement) **[V]**.
Alternative : Firebase Realtime Database, limitée à 100 connexions simultanées en gratuit **[V]**.

Le partage d'écran PC : la fenêtre du pont charge la page GitHub Pages, la même que sur le téléphone. Tauri v2 permet de donner à une origine distante l'accès à des commandes précises (`remote.urls`), avec mise en garde de sécurité **[V]**. On n'y expose qu'**un seul flux d'événements en lecture**, aucune commande.
Variante plus simple : la fenêtre s'abonne au relais comme le téléphone (+100 ms).
Dans les deux cas, garder une copie embarquée de l'interface en secours hors ligne.

Sources : [Chrome, accès au réseau local (07/10/2026)](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access), [limites ntfy](https://docs.ntfy.sh/publish/), [tarifs des Durable Objects](https://developers.cloudflare.com/durable-objects/platform/pricing/), [lieu des Durable Objects](https://developers.cloudflare.com/durable-objects/platform/data-location), [limites Firebase](https://firebase.google.com/docs/database/usage/limits), [capacités Tauri](https://v2.tauri.app/security/capabilities/), [alerte pare-feu (doc universitaire)](https://stolafcarleton.teamdynamix.com/TDClient/2092/Carleton/KB/Article/142988/Troubleshooting-Windows-Defender-Firewall-blocking-certain-features-of-Zoom).

---

## 4. Lier le compte : zéro saisie

- **Côté PC, entièrement automatique.** `/lol-summoner/v1/current-summoner` renvoie `gameName`, `tagLine` et `puuid`. Le POC l'utilise déjà pour afficher « Connecté : Pseudo#Tag ». Au premier contact, le pont enregistre ce PUUID dans la liste du groupe sur le relais. Avec un smurf, le compte est détecté de la même façon et rattaché à la même installation, avec une confirmation d'un tap « C'est aussi toi ? » **[H, conception]**.
- **Stats perso sans clé Riot.** Le pont lit en local la maîtrise, le classement et l'historique (endpoints LCU de maîtrise, de ranked et d'historique **[H, à confirmer dans le log réel]**) et les envoie au groupe. Pas besoin de clé d'API Riot pour les potes qui ont le pont.
- **Potes sans pont.** Il faut l'API Riot (match-v5) appelée par ton backend avec une **clé personnelle** : prévue « for just the developer or a small private community », 20 requêtes par seconde et 100 par 2 minutes, usage public interdit, produit à enregistrer **[V]**. La clé reste côté serveur (Worker ou GitHub Action), jamais dans la page.
- **Téléphone.** Le pont affiche un QR code au premier lancement. Le pote le scanne avec l'appareil photo (1 action), puis touche le lien (1 action). La page s'ouvre déjà liée : clé de groupe et PUUID dans le fragment d'URL, puis stockés en local.
  Piège iOS : une web app ajoutée à l'écran d'accueil ne partage pas son stockage avec Safari, c'est voulu par Apple **[V]**. Le lien peut donc se perdre à l'ajout. Secours : un écran « Qui es-tu ? » qui liste les membres du groupe, 1 tap.

Sources : [portail développeurs Riot (types de clés)](https://developer.riotgames.com/docs/portal), [bug WebKit 181849](https://bugs.webkit.org/show_bug.cgi?id=181849).

---

## 5. Le groupe : partager l'état entre potes

- **Regroupement automatique.** Chaque pont publie son état dans le Durable Object du groupe, avec une **clé de lobby** : identifiant de groupe pris dans le lobby, ou `gameId` / salon de chat de la session de draft **[H : le champ exact est à repérer dans `draft-log.jsonl` sur une vraie partie]**. Les potes du même premade se retrouvent ensemble sans rien faire.
- **Un seul pont par premade suffit pour la draft.** Chaque client voit déjà les picks, les hovers et les postes des 5 alliés, et le `puuid` des membres du groupe ; les noms des joueurs hors groupe sont masqués (`nameVisibilityType: HIDDEN`) **[V, exemple de données Overwolf]**. Si tu as le pont, ton pote sans programme ouvre la page sur son téléphone et voit la reco pour **son** poste.
- **Ce que les ponts multiples ajoutent** : les pools et la maîtrise de chacun, plus une reco commune (synergie de duo bot, qui prend quoi selon l'ordre de pick, échanges de champions pendant la finalisation).
- **Vie privée** :
  - on ne publie que les membres du groupe qui ont accepté ;
  - aucune donnée sur les joueurs masqués : Riot interdit de les désanonymiser **[V]**, et le client ne les donne pas ;
  - le relais garde le dernier état, avec une durée de vie courte (par exemple 6 h) **[H, conception]** ;
  - accès protégé par une clé de groupe intégrée au pont et au lien. Elle est récupérable par quelqu'un de motivé, mais l'enjeu est faible.

Sources : [exemple de draft Overwolf](https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/league-of-legends-launcher/), [règles générales Riot (29/05/2025)](https://developer.riotgames.com/policies/general).

---

## 6. Architecture recommandée

```
[Client LoL] --LCU (WAMP, lecture seule)--> [Pont Tauri, icône près de l'horloge]
                                                 |  événement local --> fenêtre à côté du client (page GitHub Pages)
                                                 |  WebSocket sortant
                                                 v
                                [Cloudflare Worker + Durable Object "groupe"]
                                  dernier état, liste du groupe, présence, salons de lobby
                                                 |  WebSocket
                                                 v
                          [Téléphones : page GitHub Pages "draft"]  <-- stats.json (GitHub Actions)
                                                 ^
                                    ntfy : 1 notification « draft commencée » (optionnel)
```

Principes :
1. **Le pont ne décide rien.** Il fait 4 choses : détecter LoL, lire une **liste blanche de GET** plus l'abonnement à la session de draft, publier des différences (sans les tics du chrono, qui restent en local), afficher la fenêtre. Aucun POST, PUT, PATCH ou DELETE dans le code : c'est une garantie vérifiable et affichée.
2. **Les calculs tournent dans la page**, à partir de l'état en direct, des stats statiques par patch et par niveau générées par GitHub Actions, et des données perso du groupe. Même code sur PC et sur téléphone, déployé en préprod puis en prod comme worlds.html.
3. **Si le relais tombe, le PC fonctionne encore** : la fenêtre calcule à partir du flux local.
4. **Si Riot change le client**, le pont l'indique (« client non reconnu ») et la page bascule en mode manuel.

Plan de déploiement :
- **Phase A (toi, 1 à 2 semaines)** : NSIS non signé sur GitHub Releases, updater Tauri, test sur de vraies drafts.
- **Phase B (les potes)** : MSIX sur le Store en audience privée, mis à jour par le Store, `StartupTask`.
- **Repli si le Store refuse** : Certum Open Source (~69 €) et NSIS signé.

---

## 7. Parcours écran par écran (contenu attendu, sans design)

Les actions se comptent en clics ou en taps. « 0 » veut dire que tout se passe tout seul.

| # | Moment | Écran | Doit contenir | Actions |
|---|---|---|---|---|
| D | Découverte | Message de toi sur Discord ou WhatsApp, avec un lien unique | Lien vers la fiche Store privée (sur PC) ; sur téléphone, page « Ouvre ce lien sur ton PC » avec bouton Partager et « Sans installer : mode manuel » | 1 |
| I1 | Installation (Store) | Fiche Store | Nom, une phrase sur ce que ça fait, « lecture seule » | 1 (Obtenir) |
| I2 | | Fin d'installation | Bouton Ouvrir. Ce premier lancement est indispensable pour activer le démarrage automatique **[V]** | 1 |
| I-bis | *Variante non signée (phase A)* | Navigateur, SmartScreen, installeur | Edge peut demander de « Conserver » un fichier peu téléchargé **[H]** ; « Informations complémentaires » ; « Exécuter quand même » ; 1 à 2 écrans d'installeur. **Bloqué net si Smart App Control est activé** | 6-9 |
| B | 1er lancement | Fenêtre « Bienvenue » | Pastille d'état du client (détecté / « Lance LoL, je m'occupe du reste ») ; compte détecté « Pseudo#EUW » ; QR code pour le téléphone ; interrupteur « Démarrer avec Windows » (activé) ; phrase « Ne clique jamais à ta place » | 0 (+1 si « C'est bien toi ? ») |
| T | Lier le téléphone | Appareil photo, puis page liée | « Lié à Pseudo#EUW » ; propositions optionnelles : écran d'accueil, notifications | 2 |
| Q | Chaque jour : démarrage du PC | Rien (icône près de l'horloge) | Menu de l'icône : état, ouvrir la fenêtre, toujours au premier plan, pause, version, quitter | 0 |
| L | Lancement de LoL, lobby | Téléphone ou fenêtre : « Prêt » | Potes en ligne ou dans ton lobby, dernière partie | 0 |
| S1 | Draft : phase d'intention et bans | Fenêtre qui s'ouvre seule à côté du client ; notification optionnelle sur le téléphone | Ton poste et ta position dans l'ordre de pick ; **3 bans proposés** ; **3 picks proposés** (icône, un gros chiffre, un libellé court, badge `n=`) ; **note de ton hover actuel**. Ton hover dans le client sert de saisie : rien à toucher chez nous | 0 (1 tap sur la notification) |
| S2 | Draft : ton tour | Même écran, mis à jour à chaque pick | Chrono en gros ; 3 picks recalculés avec les picks ennemis ; « pourquoi » au tap (matchup, synergie, tes stats, taille d'échantillon, « bruit » si n est faible) ; alerte si ton adversaire direct est encore inconnu | 0 (tap facultatif) |
| S3 | Après verrouillage (finalisation) | Même écran, onglet « Plan » | Runes, sorts, départ et build conseillés pour CE matchup, plan de lane, échanges utiles en premade. Tout est à recopier soi-même : lecture seule | 0 |
| G | En partie | Fenêtre cachée ; le téléphone garde le plan | **Plan statique** décidé avant la partie (build, pics de puissance de TON champion, objectifs). Aucune alerte en direct (voir §8) | 0 |
| F | Après la partie | Téléphone ou fenêtre « Résumé » | Victoire ou défaite, LP gagnés ou perdus, la reco proposée face à ton choix ; 1 tap facultatif « utile / pas utile » ; partie ajoutée au log de calibrage (avec ton accord) | 0-1 |
| M | Secours sans pont | Téléphone, mode manuel | Ton poste (1 tap), ton adversaire direct (grille ou 2-3 lettres), et en option les autres picks ennemis et alliés. Mode express « poste + adversaire » en 2-4 taps, réaliste dans un tour de 30 s | 2-4 par draft |
| E | Mode dégradé | Bandeau | « Client non reconnu (mise à jour Riot ?) : mode manuel » ; « Relais indisponible : la fenêtre PC marche toujours » ; « Nouvelle version installée après la partie » | 0 |

**Total première fois (Store)** : environ 5 actions (lien, Obtenir, Ouvrir, scan, tap), en à peu près une minute **[H]**. **Au quotidien** : 0 sur le PC, 0 ou 1 sur le téléphone. Les potes en premade avec toi sans pont : 1 tap (le lien) puis « Qui es-tu ? » (1 tap) une seule fois.

---

## 8. Règles Riot qui encadrent le parcours

- **Toujours plusieurs choix.** « Products should not remove game decisions » ; il faut « give multiple choices », et « increase, and not decrease the diversity » **[V, règles générales du 29/05/2025]**. D'où le top 3, jamais « verrouille X ».
- **Pas de désanonymisation** **[V]**. En ranked Solo/Duo, les noms des joueurs hors groupe sont remplacés par « Ally # » ; les membres du groupe se voient entre eux **[V, page de conformité Overwolf]**.
- **En partie, interdit** : les alertes de pics de puissance (« X champion has hit level 6 »), les notifications qui dictent une action selon l'état de la partie, et le suivi des temps de recharge ennemis **[V, page de conformité Overwolf]**. L'overlay de données statiques connues avant la partie est autorisé **[V, doc Riot LoL]**. Donc en partie : plan statique uniquement, même si l'API Live Client Data (port 2999, officielle) est disponible **[V]**.
- **Enregistrement.** « All products must be registered » **[V]**, et Riot demande d'indiquer quels endpoints LCU on utilise **[V]**. À faire au moment de la demande de clé personnelle.
- **Le LCU n'est « not officially supported »** **[V]**. Le Vanguard FAQ dit que les applis LCU « are still expected to work » **[V, extrait de recherche, page non datée]**. Pas de garantie pour fin 2026 : le mode manuel est l'assurance.

Sources : [doc Riot LoL](https://developer.riotgames.com/docs/lol), [règles générales Riot](https://developer.riotgames.com/policies/general), [conformité LoL (Overwolf)](https://dev.overwolf.com/ow-electron/guides/game-compliance/league-of-legends/), [Vanguard FAQ (DevRel)](https://www.riotgames.com/en/DevRel/vanguard-faq).

---

## 9. À tester sur le vrai client (prochaines étapes)

1. Lancer `watch-draft.mjs` sur une normale draft en premade, puis lire `draft-log.jsonl` pour : la clé de lobby, la présence du `puuid` des membres du groupe, le nombre de messages par draft hors chrono, la phase d'intention.
2. Mesurer la latence de bout en bout PC, relais puis téléphone en 4G et en Wi-Fi (objectif : moins de 300 ms).
3. Vérifier chez chaque pote : Smart App Control activé ou non (Sécurité Windows, Contrôle des applications et du navigateur), la définition d'écran, s'ils ont un compte Microsoft.
4. Prototype Tauri : taille réelle de l'installeur, RAM au repos, détection de `LeagueClientUx.exe` sans PowerShell, position de la fenêtre à côté du client (classe de fenêtre du client **[H]**).
5. Soumettre un MSIX minimal au Store en audience privée, pour savoir tôt s'il passe la certification.
