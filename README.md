# LoL Draft Coach

Conseiller de sélection de champions en direct, pour Thomas et ses potes.

Un petit programme (le compagnon) tourne sur le PC pendant que LoL est ouvert. Il lit la sélection
des champions dans le client, en lecture seule, et affiche les meilleurs choix sur une page web locale,
sur le PC ou sur le téléphone posé à côté (même Wi-Fi).

## Lancer

```
npm install
npm start
```

La page s'ouvre toute seule. L'adresse pour le téléphone s'affiche dans la console.

## Règles du projet

- Lecture seule : aucun pick, ban ou verrouillage automatique.
- Seulement ce que le client montre au joueur : un champion adverse compte une fois verrouillé,
  les joueurs masqués en ranked ne sont jamais identifiés.
- Chaque chiffre affiché a sa taille d'échantillon ; ce qui n'est que du bruit est dit comme tel.

## Tests

```
npm test
```

Les tests rejouent de vraies sélections extraites des logs du client (`tools/extract-log-sessions.mjs`),
anonymisées, contre un faux client LoL (`test/fake-client.mjs`).
