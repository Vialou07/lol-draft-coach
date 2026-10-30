# LoL Draft Coach (nom provisoire)

Conseiller de sélection de champions en direct, pour Thomas et ses potes.

**[Télécharger pour Windows](https://github.com/Vialou07/lol-draft-coach/releases/latest/download/LolDraftCoach.exe)**
· page : [vialou07.github.io/lol-draft-coach](https://vialou07.github.io/lol-draft-coach/)

Un petit programme (le compagnon) tourne sur le PC pendant que LoL est ouvert. Il lit la sélection
des champions dans le client, en lecture seule, et affiche une page qui se met à jour toute seule,
sur le PC ou sur le téléphone posé à côté (même Wi-Fi).

## Pour les potes : rien à installer d'autre que ce fichier

1. Télécharger `LolDraftCoach.exe` depuis la page **Releases** du dépôt.
2. Double-clic. Windows affiche « Windows a protégé votre ordinateur » (le fichier n'est pas signé) :
   « Informations complémentaires », puis « Exécuter quand même ». Une fenêtre noire s'ouvre, la page aussi.
3. Une seule fois : coller le lien du groupe (envoyé par Thomas) dans « Ou colle le lien du groupe d'un pote »,
   puis « Rejoindre ». C'est mémorisé.
4. Ensuite : lancer le fichier avant de jouer. Le téléphone suit la même draft via le lien du groupe.

Mises à jour : le programme regarde au démarrage (puis toutes les 6 heures) s'il existe une nouvelle version
sur GitHub. Si oui, il la télécharge et redémarre tout seul, jamais pendant une sélection ou une partie.

Les données (stats, cache, groupe) sont rangées dans `%LOCALAPPDATA%\LolDraftCoach`.

## Lancer depuis le code

1. Double-clic sur `lancer.cmd` (la première fois, il installe ce qu'il faut). Ou `npm install` puis `npm start`.
2. La page s'ouvre dans le navigateur. L'adresse pour le téléphone s'affiche dans la fenêtre noire.
   La première fois, Windows demande d'autoriser Node.js dans le pare-feu : « Autoriser » pour le téléphone.
3. Lance LoL, entre en sélection des champions : les conseils apparaissent.

Si quelque chose coince, le journal est dans `data/local/companion.log` (ou `%LOCALAPPDATA%\LolDraftCoach` avec le .exe).

## Ce que montre la page

- **Draft (ranked, normale)** : à ton ban, trois bans avec leur gain estimé ; avant et pendant ton pick,
  tes trois meilleurs choix avec leur chance de gagner, deux raisons au plus (Méta, Lane, Duo, Confort),
  « Contrable » si un counter courant fait mal, les pièges de la draft, tes champions à apprendre, et
  l'analyse complète (lane, autres matchups, duos, dégâts, tanks, engage, protection, durée de partie).
  Un tap sur une carte montre le détail et l'écart face à ton champion habituel.
- **ARAM du Chaos** : « Prends X » ou « Garde X », d'après le winrate du mode tel que la source le publie ; un
  changement seulement pour au moins un point. Le banc est partagé entre toi et tes amis de la partie.
- **Arena** : reconnue, pas encore de conseils.
- **En partie** : quoi acheter avec tes golds, ton build habituel à ton rang (u.gg), les items que leur compo demande
  (soins, très AD ou AP, tanks), l'ordre des sorts. Le combat en nombre (« 5 contre 3, encore 9 s »), l'écart d'or
  en items au fil de la partie avec les kills, les moments clés (gros items, multikills, inhibiteurs, dragons et
  Baron sur la Faille avec leur repop). Via l'API officielle de Riot (Live Client Data).
- **Après la partie** : dégâts aux champions, dégâts encaissés, soins et or des dix joueurs, et tes augments, lus
  dans le détail de partie du client. Riot ne publie pas les dégâts ni les soins pendant la partie.
- **Ton profil** : tes dernières parties, tes champions, tes bons et mauvais matchups de lane. Le client ne garde
  que tes 20 dernières parties : l'appli garde chaque partie vue (sur ton PC), les remakes ne comptent pas.
- **Mode groupe** : la page publique suit la draft de chacun par un relais chiffré ; la clé n'est que dans le lien.

## Règles du projet

- Vanguard d'abord : lecture seule (aucun pick, ban, verrouillage, échange ou import automatique, un test le vérifie),
  aucune lecture de la mémoire du jeu, aucune injection, rien d'affiché par-dessus le jeu.
- Seulement ce que le client montre au joueur : un champion adverse compte une fois verrouillé (les
  données du client contiennent parfois le survol adverse, il est ignoré exprès), les joueurs masqués en
  ranked ne sont jamais identifiés.
- Le titre dit quoi faire (« Prends X », « Bannis X », « Achète X ») et les autres choix restent affichés à côté.
- En partie, seulement ce que le tableau des scores et les événements officiels montrent, sans alerte sonore.
- Chaque chiffre indique sa source ; ce qui n'est que du bruit n'est pas affiché.

## Données et limites

| Mode | Source | Limite |
|---|---|---|
| Draft | Jeux de données publics de DraftGap (Lolalytics, Emerald+, toutes régions, 30 jours + patch) | Lolalytics n'a pas publié de conditions : accord écrit à demander avant d'ouvrir aux potes |
| ARAM du Chaos | arammayhem.com (serveurs chinois) | Pas de nombre de parties publié ; Riot ne sert pas ces parties dans son API |
| Perso | Client local (historique, maîtrise, rang) | Le client sert 20 parties ; l'appli garde les suivantes |
| En partie | Live Client Data (API officielle, 127.0.0.1:2999) | Pas de dégâts, soins, or des autres ni recharges |
| Après la partie | Détail de partie du client | Disponible quelques secondes après la fin |

Le modèle (détails dans `docs/etudes/04` et `07`) additionne en log-odds : force du champion sur le patch,
matchup de lane, duo bot + support, malus d'expérience (environ −6 points jamais joué, −3 points sous
10 parties). Ses poids ne sont **pas encore calés sur de vrais matchs** : c'est écrit sur la page.

LoL Draft Coach isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or
anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
properties are trademarks or registered trademarks of Riot Games, Inc.

## Développement

```
npm test                                       # 60 tests, sans réseau ni client LoL
npm run build:exe                              # dist/LolDraftCoach.exe (Node SEA, environ 90 Mo)
npm run demo -- q2400-2026-10-24-40.json       # rejoue une vraie partie dans la page
node tools/extract-log-sessions.mjs            # transforme les logs du client en cas de test anonymisés
```

Les tests rejouent de vraies sélections extraites des logs du client, anonymisées, contre un faux client
LoL (`test/fake-client.mjs`). Les études de l'équipe d'agents (concurrence, règles Riot, données, modèle,
parcours, design, cohérence, conformité, ARAM du Chaos et Arena) sont dans `docs/etudes/`.
