# LoL Draft Coach (nom provisoire)

Conseiller de sélection de champions en direct, pour Thomas et ses potes.

Un petit programme (le compagnon) tourne sur le PC pendant que LoL est ouvert. Il lit la sélection
des champions dans le client, en lecture seule, et affiche une page qui se met à jour toute seule,
sur le PC ou sur le téléphone posé à côté (même Wi-Fi).

## Lancer

1. Double-clic sur `lancer.cmd` (la première fois, il installe ce qu'il faut). Ou `npm install` puis `npm start`.
2. La page s'ouvre dans le navigateur. L'adresse pour le téléphone s'affiche dans la fenêtre noire.
   La première fois, Windows demande d'autoriser Node.js dans le pare-feu : « Autoriser » pour le téléphone.
3. Lance LoL, entre en sélection des champions : les conseils apparaissent.

Si quelque chose coince, le journal est dans `data/local/companion.log`.

## Ce que montre la page

- **Draft (ranked, normale)** : à ton ban, trois bans avec leur gain estimé ; avant et pendant ton pick,
  tes trois meilleurs choix, avec l'écart en points face à ton champion habituel dans ce rôle, deux raisons
  au plus (Méta, Lane, Duo, Confort) et « Contrable » si un counter courant fait mal. Ton survol dans le
  client est noté en bas. Un tap sur une carte montre la chance de victoire estimée.
- **ARAM du Chaos** : les meilleurs champions du banc que tu possèdes, comparés à ton champion actuel.
- **Arena** : reconnue, pas encore de conseils.

## Règles du projet

- Lecture seule : aucun pick, ban, verrouillage, échange ou import automatique. Un test le vérifie.
- Seulement ce que le client montre au joueur : un champion adverse compte une fois verrouillé (les
  données du client contiennent parfois le survol adverse, il est ignoré exprès), les joueurs masqués en
  ranked ne sont jamais identifiés.
- Toujours plusieurs choix, jamais un seul « prends X » (règle Riot contre les applis qui dictent).
- Pas de winrates d'augments, rien pendant la partie.
- Chaque chiffre indique sa source ; ce qui n'est que du bruit n'est pas affiché.

## Données et limites

| Mode | Source | Limite |
|---|---|---|
| Draft | Jeux de données publics de DraftGap (Lolalytics, Emerald+, toutes régions, 30 jours + patch) | Lolalytics n'a pas publié de conditions : accord écrit à demander avant d'ouvrir aux potes |
| ARAM du Chaos | arammayhem.com (serveurs chinois) | Pas de nombre de parties publié ; Riot ne sert pas ces parties dans son API |
| Perso | Client local (historique, maîtrise, rang) | Quelques dizaines à 200 parties seulement |

Le modèle (détails dans `docs/etudes/04` et `07`) additionne en log-odds : force du champion sur le patch,
matchup de lane, duo bot + support, malus d'expérience (environ −6 points jamais joué, −3 points sous
10 parties). Ses poids ne sont **pas encore calés sur de vrais matchs** : c'est écrit sur la page.

LoL Draft Coach isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or
anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
properties are trademarks or registered trademarks of Riot Games, Inc.

## Développement

```
npm test                                       # 22 tests, sans réseau ni client LoL
npm run demo -- q2400-2026-10-24-40.json       # rejoue une vraie partie dans la page
node tools/extract-log-sessions.mjs            # transforme les logs du client en cas de test anonymisés
```

Les tests rejouent de vraies sélections extraites des logs du client, anonymisées, contre un faux client
LoL (`test/fake-client.mjs`). Les études de l'équipe d'agents (concurrence, règles Riot, données, modèle,
parcours, design, cohérence, conformité, ARAM du Chaos et Arena) sont dans `docs/etudes/`.
