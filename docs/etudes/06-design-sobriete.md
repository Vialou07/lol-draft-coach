# 06 · Design et sobriété : l'écran de draft

30/10/2026, patch 16.21. Lu avant d'écrire : rapports 01 (concurrence), 04 (modèle), 05 (installation), et les jetons CSS de worlds.html v14.9 (design B).
Légende : **[V]** = source lue (URL en fin de document). **[H]** = hypothèse ou info non reconfirmée pour fin 2026.

Maquette : `C:/Users/vialo/AppData/Local/Temp/claude/c--Users-vialo-Desktop-Code-Worlds-2026/cca1783e-dd4b-465d-8074-0ce9111653e9/scratchpad/lol-draft-research/06-maquette-draft.html`

---

## 0. En bref

- **Règle n°1 : ne pas recopier le client.** Pendant la draft, chacun est devant son PC et le client affiche déjà les picks, les bans, le chrono et le chat. Notre écran montre seulement ce que le client n'a pas : la reco, son pourquoi et sa marge d'erreur.
- **Une question par état.** Selon la phase, l'écran pose une seule question : « que déclarer ? », « que bannir ? », « où on en est ? », « que prendre ? ». Il change tout seul avec la phase, sans onglet ni geste.
- **Rien à toucher.** Ton survol dans le client sert de saisie : l'app le note en direct, en bas de l'écran.
- **Le MVP tient en un seul écran vivant et trois feuilles à un tap**, sans barre d'onglets.
- **Niveau 1 de « Ton tour » :**
  - le chrono ;
  - une grille 2 × 5 de la draft ;
  - 3 cartes : portrait, chiffre entier, 2 pastilles au plus, barre de marge ;
  - ton survol.
- **Incertitude :**
  - chiffre entier ;
  - barre de marge sur la même échelle pour toutes les cartes ;
  - « ≈ égalité » entre deux chiffres trop proches ;
  - nombre de tes parties sur le champion toujours visible ;
  - « bruit » signalé dans le détail.
- **Surfaces.** La fenêtre PC est la surface principale. Le téléphone est un miroir optionnel. **Thème sombre uniquement en V1.**

---

## 1. Le tri : KEEP / LATER / CUT

Les identifiants renvoient au rapport 01. Critère : un élément entre au MVP seulement s'il aide à gagner **et** s'il ne crée ni écran, ni onglet, ni geste en plus.

### KEEP (MVP)

| Fonction | Forme retenue | Pourquoi |
|---|---|---|
| A1 Pont Windows | Invisible hors draft, aucun réglage | Sans lui, rien ne marche. |
| A2 + A3 | **Un seul** écran au premier lancement : compte détecté, QR du téléphone, interrupteur « Partager avec le groupe » | Trois fonctions, un écran, une seule fois. |
| C1, réduit | Grille 2 × 5 (postes en colonnes, nous en haut, eux en bas), ta colonne en or | Prouve que l'app voit la même draft que toi et situe ta lane. Bans et ordre des picks : au tap. |
| C2 | 3 picks classés, le pourquoi au tap | C'est le cœur du produit. Proposer 3 choix est aussi une règle Riot. |
| C5 | 3 bans, avec **la même carte** que les picks | Aucun composant nouveau à apprendre. Ne propose jamais un champion déclaré par un allié. |
| C3, fusionné | Pastille « Contrable : Malphite −4 » dans la carte, seulement si l'effet est significatif | Pas de jauge de risque à part. |
| C4, fusionné | Étiquette « Autofill » dans l'en-tête, effet dans le calcul | Rien d'autre à afficher. |
| C6 + ton survol | Survols alliés dans le calcul. Ton propre survol noté en bas de l'écran | Le client devient la saisie, l'app n'en demande aucune. |
| C9, déplacé | « Notre draft 55 % » **après ton lock seulement** | Pendant ton tour, ce chiffre ferait doublon avec ceux des cartes. |
| P1 | Journal silencieux | Aucune interface. Sans lui, impossible de savoir si l'app aide. |
| E | Bandeau d'état, et recos grisées dès que les données ont plus de 5 s | Une reco périmée affichée comme fraîche est pire que rien. |
| Pool, sur l'écran d'attente | Tes champions tels que l'app les voit, avec le nombre de parties | Remplit l'écran d'attente sans vide, et chacun vérifie ses propres données. |

### LATER

| Fonction | Pourquoi plus tard |
|---|---|
| C10 + C7 Premade (qui prend quoi, échanges) | C'est le vrai différenciant, mais il suppose que C2 soit fiable. À intégrer comme variante de la même carte (« Pour Max : … »), pas comme deuxième écran. |
| C11 ARAM / Mayhem | Écran différent (banc, reroll). Dépend de ce que vous jouez (question). |
| C13 Notification « draft trouvée » | La fenêtre PC s'ouvre seule. Sur iPhone, une notif web exige d'ajouter la page à l'écran d'accueil (iOS 16.4+) **[V]**, sinon il faut l'appli ntfy, soit une installation de plus. À proposer en option. |
| P2 Calibrage affiché | Seulement après environ 200 parties suivies. D'ici là, une ligne dans le détail : « vérifié sur 0 partie sur 200 ». |
| L3 Une ou deux lignes sur la lane après le lock | Il faut un contenu vérifié, par exemple le win rate selon la durée de partie. |
| O1 + O2 Conseiller de pool, effet du patch | Gain sur le long terme. Futur onglet « Pool ». |
| C12, O5 Swiftplay, Clash | Ce sont d'autres écrans. |
| M Mode manuel sans pont | Assurance si Riot casse la LCU : poste et adversaire en 2 à 4 taps. À construire le jour où on en a besoin. |
| F Résumé d'après-partie, « utile / pas utile » | Au MVP : une ligne « Victoire · Ekko (choix n°1) » sur l'écran d'attente. |
| A4 Smurfs | Détection automatique dès le MVP, écran dédié plus tard. |
| Barre d'onglets (Direct · Pool · Groupe) | Seulement quand il y aura trois destinations. |
| Thème clair | Seulement si quelqu'un le demande. |

### CUT

| Fonction | Pourquoi |
|---|---|
| L1 Fiche runes, sorts et build | Le client a un « Rune Recommender » par champion et par rôle depuis la V12.23 **[V]**. Recopier des runes depuis un téléphone en 30 s, c'est pire. |
| L2 Import des runes | Écrit dans le client, ce qui est contraire à la lecture seule. |
| L4 Pics de puissance | Beaucoup de texte pour peu de gain. |
| G1 Scouting au chargement | Il faut une clé API, c'est en zone grise, et ça nourrit le tilt. |
| G2, G3 Build et timers en partie | Le téléphone distrait en pleine partie. Zone grise. |
| G4, G5 Timers ennemis, alertes | Interdits par Riot. |
| P4 « Draft perdue d'avance » | Démoralise sans action possible, et pousse au dodge. |
| O3, O6 « Qui joue ce soir », classement entre potes | Discord le fait déjà, et ça ne fait pas gagner. |
| O4 « Faut-il relancer ? » | Paternaliste, signal faible. |
| A6 Connexion Riot (RSO) | Lourd, et inutile pour nous. |
| Miroir complet du client (bans en grand, sorts, chat) | Déjà sous tes yeux sur le PC. |
| Recos pour les alliés anonymes | Impossible de les leur transmettre. |
| Probabilité d'équipe pendant ton tour | Doublon des cartes. |
| Sons, vibrations | Le vocal Discord est déjà ouvert, et Safari iOS ignore la vibration web **[V]**. |
| Une 3e pastille par carte au niveau 1 | Voir §3 : 9 à 12 pastilles à l'écran, plus rien ne se lit en 2 s. |

---

## 2. Surfaces et navigation

**Fenêtre PC (principale).**
- Elle apparaît à l'entrée en draft, se cache au lancement de la partie et se souvient de sa place.
- Elle ne vole jamais le focus : un clic perdu pendant que tu tapes dans le chat ou que tu vas locker serait grave. Tauri a une option `focus: false`, à vérifier dans la version utilisée (la valeur par défaut a changé selon les commits). Selon les notes de version de tao 0.37.1, une fenêtre créée sans focus reprend le focus au premier `set_visible(true)` **[V]**. Il faut donc la créer visible dès le départ, ou tester ce cas.
- « Toujours devant » est désactivé par défaut et s'active par l'icône près de l'horloge.

**Téléphone (miroir optionnel).**
- La même page, ouverte une fois par QR code. Baron Buff valide ce geste : QR code, puis navigateur, « no app install needed » **[V]**.
- Pendant la draft, la page garde l'écran allumé (Screen Wake Lock) et le relâche à la fin. C'est supporté dans Safari iOS depuis 16.4, et dans une web app de l'écran d'accueil seulement depuis 18.4, d'après les données de compatibilité **[V, source secondaire : à tester sur un iPhone]**.

**Navigation du MVP : aucun onglet.**
```
Écran Direct : change seul selon la phase
 ├─ tap sur une carte  → feuille « pourquoi » (sur une fenêtre large : panneau à droite)
 ├─ tap sur la grille  → feuille « la draft » (ordre des picks, bans, « ta lane »)
 └─ « ? »              → feuille « lire l'écran » (6 définitions)
Écran d'attente → roue dentée → feuille Réglages (comptes, partage, téléphone)
```

On reprend l'esprit d'Apple Sports. Eddy Cue revendique une simplicité « intentional », et Gruber décrit des onglets « utterly self-explanatory » où il n'y a pas à creuser **[V]**. La critique de Josh Renaud est aussi une leçon : l'appli « does not degrade gracefully on smaller screens » comme l'iPhone SE **[V]**. On testera donc à 360 px.

---

## 3. L'écran « Ton tour » (celui de la maquette)

Dans l'ordre, de haut en bas :

1. **En-tête.**
   - « À toi » en or et en gros, avec une seule pulsation à l'entrée.
   - Ton poste et la file, avec un point vert « en direct ».
   - Le bouton « ? ».
   - Le chrono en anneau, qui passe au rouge sous 8 s.
2. **Grille 2 × 5.**
   - Colonnes : TOP JGL MID ADC SUP. Nous en haut, eux en bas.
   - Ennemis placés selon l'affectation de rôles la plus probable.
   - Ta colonne sur fond or. Survols en transparence, picks à venir en pointillés.
   - Pas de pseudo : seulement des postes, donc aucun risque de désanonymisation.
3. **« Tes meilleurs choix · Chance de gagner » : 3 cartes.** Chaque carte contient :
   - le portrait (54 px) ;
   - le nom ;
   - **tes parties sur ce champion** (« 23 parties ») ;
   - au plus **2 pastilles** ;
   - le **grand chiffre entier** ;
   - la **barre de marge juste sous le chiffre**.
4. **En bas : « Ton survol dans le client ».**
   - Si tu survoles un champion hors du top 3, sa carte apparaît ici avec un bord pointillé, sur la même échelle que les autres.
   - S'il fait partie du top 3, cette ligne disparaît et la carte prend un liseré or et l'étiquette « Survolé ».
   - Le bouton « Dans le client, tu survoles » de la maquette montre les deux cas.

**Absent du niveau 1 :**
- les bans (dans le client, et au tap sur la grille) ;
- la probabilité d'équipe ;
- le win rate brut perso ;
- le nombre de parties globales ;
- la source, le patch et l'elo des données ;
- les runes.

**Deux pastilles, pas trois.** Le rapport 04 proposait 3 raisons. À 390 px, la troisième passe à la ligne (constaté sur la maquette) : la carte grandit et la ligne du survol sort de l'écran sur une fenêtre PC de 720 px. Surtout, on arrive à 9 à 12 pastilles à l'écran. Les deux premières raisons portent l'essentiel de l'écart. La troisième est à un tap.

**Pourquoi la barre sous le chiffre.** Même échelle (40 à 60 %) et même colonne sur toutes les cartes : c'est un mini graphique où le chevauchement se voit d'un coup d'œil (Ekko et Ahri se recouvrent, Sylas est nettement à gauche), sans une ligne de texte.

---

## 4. Les états

Durées d'une draft classée **[V, wiki officiel, page éditée le 14/09/2025, non reconfirmé pour fin 2026]** :
- déclaration 15 s ;
- bans simultanés 30 s ;
- révélation 5 s ;
- 6 tours de pick de 30 s (1-2-2-2-2-1) ;
- finalisation 30 s, soit environ 4 min 20 au total.

Le même wiki précise que les intentions de ban alliées sont visibles tout de suite **[V]**. Les noms exacts des phases (`gameflow`, `timer.phase`) sont à lire dans `draft-log.jsonl` **[H]**.

| État | Déclencheur | Question | Niveau 1 | À un tap |
|---|---|---|---|---|
| Hors ligne | Pont absent ou PC éteint | « Ça marche ? » | « Lance LoL sur ton PC » ou, en premade, « Suivi via le PC de Thomas » | Aide en 3 lignes |
| Prêt (lobby, file, partie trouvée) | Phase lobby, file ou ready check | « Je suis prêt ? » | Statut, tes postes du lobby, ton pool (champions et nombre de parties par poste), dernière partie | Réglages. Jamais d'acceptation automatique |
| Déclaration (15 s) | Planification | « Que déclarer ? » | Poste et rang de pick (« 4e : ton vis-à-vis choisit avant toi », ou « avant lui : prends un pick sûr »), 3 picks avec « Contrable » si besoin, ton survol noté | Pourquoi |
| Bans (30 s) | Ton action de ban en cours | « Que bannir ? » | 3 bans avec le gain en points et une raison courte (« menace ton Ekko », « menace la Jinx déclarée »). Alerte si ton survol de ban est un champion déclaré par un allié | Pourquoi |
| Les autres pickent | Action d'un allié ou d'un ennemi en cours | « Où on en est ? » | « À toi dans 2 picks », grille, aperçu des 3 picks qui se recalcule (cartes atténuées, sans chrono or) | Draft complète |
| **Ton tour (30 s)** | Ton action de pick en cours | « Que prendre ? » | Voir §3 et la maquette | Pourquoi, draft, légende |
| Après ton lock | Ton pick terminé | « Et maintenant ? » | Ton champion, « Notre draft 55 % » avec sa marge, une ligne sur la suite (« Leur top choisit encore ») | Détail du draft |
| Finalisation (30 s) | Finalisation | idem | idem, avec le chrono. Échanges en premade : plus tard | idem |
| Draft annulée | Retour au lobby sans partie | | « Draft annulée (dodge) », puis Prêt | |
| Chargement, en partie | Lancement de la partie | | Fenêtre PC cachée. Sur le téléphone, une carte figée « Ekko contre Syndra · Notre draft 55 % ». Rien de dynamique (règles Riot) | |
| Après la partie | Fin de partie | | Retour à Prêt, avec la ligne « Victoire · Ekko (choix n°1) » | |
| Dégradé | Plus de 5 s sans données, ou client inconnu | | Un seul bandeau. Les chiffres deviennent « — » et les cartes passent en gris | |

**Mouvement.**
- Fondu de 200 ms entre deux états.
- Les cartes glissent à leur nouvelle place (250 ms) quand un pick ennemi change le classement, et les chiffres défilent.
- Seul le chrono tourne en continu. Pas de rebond ni de lueur en boucle.
- `prefers-reduced-motion` coupe tout.

---

## 5. Le pourquoi, sans mur de texte

**Niveau 1.** Pastilles d'un seul mot plus une valeur signée en points de chance de gagner. Une pastille n'apparaît que si |valeur| ≥ 0,5 point **et** que les données pèsent au moins 30 % (règle du rapport 04).

| Mot | Sens | Couleur |
|---|---|---|
| Lane | ton vis-à-vis direct | + vert d'eau, − rose |
| Méta | force du champion à ce poste, ce patch, cet elo | idem |
| Compo | ce que ton pick apporte à l'équipe (mix de dégâts, frontline) | idem |
| Confort | ton expérience et tes résultats sur ce champion | idem |
| Synergie | avec tes alliés, surtout le duo bot et la jungle | idem |
| Contrable | ce que te coûterait la réponse adverse si ton vis-à-vis n'a pas encore pické | toujours rose |

**Niveau 2 (tap sur la carte).** C'est une feuille. Sur une fenêtre de 560 px ou plus, c'est un panneau permanent à droite. Elle contient :
- l'en-tête : portrait, nom, grand chiffre, et la marge en clair (« Marge : entre 51 et 58 %, 8 fois sur 10 ») ;
- une note « ≈ » si le choix est à égalité avec un autre (« 0,9 point d'écart, c'est moins que la marge. Prends celui que tu préfères. ») ;
- une ligne par terme : le mot, un détail court avec le nombre de parties, une **barre divergente** sur la même échelle (±4 points) et la valeur ;
- le total : « 50 % au départ, +4,7 points » ;
- en pied, en petit : source, elo, patch, date des données, et l'état du calibrage (« pas encore vérifié sur vos parties : 0 sur 200 »).

**Écriture.**
- Virgule décimale et vrai signe moins (−).
- Une décimale pour les points, aucune sur le grand chiffre.
- Pas de phrase là où un mot suffit. Le seul texte suivi est la note « ≈ ».

---

## 6. Incertitude et échantillons, en simple

1. **Le grand chiffre est entier** : 54,7 s'affiche 55. Une décimale ferait croire à une précision qui n'existe pas.
2. **La barre de marge** montre l'intervalle à 80 %, au même endroit sur chaque carte et à la même échelle.
3. **« ≈ égalité »** apparaît quand la probabilité que le premier choix soit vraiment devant est inférieure à 0,75 (rapport 04). Le badge se place entre les deux chiffres.
4. **Si les trois choix sont à égalité**, une seule ligne : « Les 3 se valent, prends ton préféré ». C'est honnête, et c'est fréquent : entre deux champions de la méta, l'écart vrai n'est que de 1,1 à 1,5 point (rapport 04).
5. **Tes parties sur le champion restent toujours visibles** à côté du nom : « 23 parties », ou « jamais joué ». Tous les concurrents oublient de l'afficher (rapport 01).
6. **« bruit »** n'apparaît qu'au niveau 2, sur la ligne concernée. Exemple : « Tes 5 victoires sur 6 ne prouvent rien ».
7. **« Patch récent »** : une pastille dans l'en-tête les premiers jours du patch, quand le prior pèse plus que les données.
8. **À ne jamais faire :**
   - des décimales sur le grand chiffre ;
   - un « indice de confiance » en % ;
   - des étoiles ou des notes sur 10 ;
   - une couleur seule pour dire bon ou mauvais : toujours le signe plus la position sur la barre, pour les daltoniens.

---

## 7. S'adapter à la taille

La mise en page réagit à **la taille du cadre** (container queries), pas à celle de l'appareil. La même page tient dans le téléphone, dans la fenêtre PC redimensionnable et dans un onglet.

| Largeur du cadre | Mise en page |
|---|---|
| < 360 px | Compact : 1 pastille, portraits de 44 px, chiffres plus petits, sans les libellés Nous / Eux |
| 360 à 559 px | Standard : téléphones et fenêtre PC de 400 px |
| ≥ 560 px | Le pourquoi s'affiche en panneau permanent à droite, sans feuille |
| **Hauteur** < 700 / < 600 px | Grille resserrée, puis sans libellés de postes et chrono plus petit |

**Téléphones.**
- Largeurs courantes en 2026 : 390 px (iPhone 17e), 402 px (17 et 17 Pro), 440 px (17 Pro Max) **[V, site tiers]**.
- Environ 360 px sur les petits Android **[H]**.
- Zones tactiles d'au moins 44 px (WCAG 2.5.5) **[V]**.
- En production, tailles de texte en `rem` pour suivre le zoom du navigateur.

**Fenêtre PC.**
- 400 × 720 par défaut, la hauteur d'un client en 1280 × 720 **[H : liste des tailles du client non confirmée]**. Minimum 300 × 440.
- Placée du côté libre du client.
- Sur un écran 1080p avec le client en 1600 × 900, il ne reste que 320 px : mode compact, ou bien le téléphone **[H]**.

**Thème : sombre uniquement en V1.**
- La fenêtre est collée à un client sombre, et une fenêtre claire à côté éblouit.
- On joue le soir, et l'appli Worlds est déjà sombre.
- Un seul thème, c'est deux fois moins de vérifications.
- La maquette a un bouton « Clair » seulement pour que tu compares.

**Identité.**
- Cousine de l'appli Worlds : bleu nuit, or, polices Barlow et Barlow Condensed.
- **Sans** le motif hexagonal ni les halos de couleur : ici, l'écran doit être le plus calme possible.
- L'or est réservé à « c'est à toi » : ta colonne, le chrono, ton survol.
- Le vert d'eau et le rose ne servent qu'aux valeurs + et −.

---

## 8. Oublis de design à ne pas rater

- **Données périmées.** Au-delà de 5 s sans nouvelle donnée, les chiffres sont grisés : aucune reco figée ne doit avoir l'air vivante.
- **Bans alliés.** Ne jamais proposer de bannir un champion déclaré par un allié, et prévenir si ton survol de ban en est un (cas classique de solo queue).
- **Rôles ennemis devinés.** La ligne Eux de la grille montre l'hypothèse la plus probable. Un flex pick (par exemple un champion top ou mid) peut finir ailleurs : le calcul en tient compte, mais l'affichage ne doit pas le présenter comme sûr. Un « ? » discret si la probabilité est sous 60 % **[H, seuil à régler]**.
- **Ordre de pick.** « Ton vis-à-vis choisit avant ou après toi » change tout pour le contre. C'est la première ligne de l'état Déclaration.
- **Noms français des champions** : prendre ceux de Data Dragon fr_FR (« Maître Yi », « Nunu et Willump »), jamais l'identifiant technique.
- **iPhone.** Une web app ajoutée à l'écran d'accueil ne partage pas son stockage avec Safari (rapport 05). L'écran « Qui es-tu ? » (1 tap) doit exister dès le MVP.
- **Mode autofill.** L'étiquette s'affiche, et les champions faciles remontent. Pas d'écran à part.
- **Draft annulée** par un dodge : retour propre à l'écran Prêt, sans recos fantômes.

---

## 9. La maquette

Fichier : `06-maquette-draft.html`, dans le même dossier. Il est autonome : polices Google Fonts, portraits Data Dragon 16.21.1 (les 22 URL répondent en 200). Si une image ne charge pas, la case affiche les initiales du champion. C'est utile si la page est publiée en Artifact, où les images externes sont bloquées.

- **Scénario.** Ranked solo/duo, côté bleu. Tu es mid, 4e pick, en même temps que ton support qui survole Nautilus. En face : Lee Sin, Kai'Sa, Syndra et Rell sont lockés, leur top est le dernier pick. Bans : Yone, Zed, Malphite, Draven, Blitzcrank / Vex, Fizz, Kassadin, Ambessa, Mel.
- **Recos.**
  - Ekko 55 (Lane +2,1, Méta +1,5) ≈ Ahri 54 (Confort +3,1, Lane −1,4), puis Twisted Fate 52.
  - En bas, ton survol Sylas à 47 (Confort −3,1, 6 parties).
  - Le scénario montre le vrai arbitrage du rapport 04 : le contre contre le confort, avec une égalité honnête.
- **Données.**
  - Les volumes affichés sont réels : nombre de parties Emerald+ du fichier DraftGap du 29/10, par exemple Ekko contre Syndra, 53,78 % sur 11 964 parties en 30 jours **[V, calcul sur le fichier local]**.
  - Les points et les pourcentages sont inventés, dans les ordres de grandeur du rapport 04.
- **Interactions.**
  - Tap sur une carte : le pourquoi.
  - Tap sur la grille : la draft complète.
  - « ? » : la légende.
  - Bouton « survol Sylas / Ekko » : montre les deux comportements de la ligne du bas.
  - Bouton Sombre / Clair.
  - Fenêtre PC redimensionnable par son coin : sous 360 px, mode compact ; au-delà de 560 px, panneau à droite.
  - Ouverte sur un vrai téléphone, la maquette s'affiche sans cadre, comme l'écran réel.
- **Correction déjà faite après rendu.** La 3e pastille passait à la ligne et la ligne du survol sortait de la fenêtre PC. D'où les 2 pastilles et la barre de marge sous le chiffre.

---

## 10. Questions pour toi

1. Pendant la draft, tes potes regarderont-ils la fenêtre PC, le téléphone, ou les deux ? Si c'est le PC, le miroir téléphone peut attendre la V2.
2. Quelle part d'ARAM / Mayhem dans vos soirées ? Cette réponse décide si C11 passe juste après le MVP.
3. Sombre uniquement en V1, ça te va ?
4. On supprime les runes et builds, parce que le client les recommande déjà. Tes potes utilisent-ils U.GG ou Blitz surtout pour ça ?
5. Grand chiffre en « chance de gagner » (55 %) ou en « gain par rapport à ton pick habituel » (+3) ? Je recommande le premier.
6. Proportion de soirées en premade de 3 ou plus, face à la solo queue ? Elle fixe l'urgence de C10.
7. Qui joue sur un seul écran 1080p avec le client en 1600 × 900 ? Ces potes-là auront la fenêtre en compact, ou le téléphone.
8. Un nom pour l'appli ? Il faut un titre pour la fenêtre et la fiche Store.

---

## Sources

- Draft classée : déroulé, durées, intentions de ban alliées visibles (page éditée le 14/09/2025) : https://wiki.leagueoflegends.com/en-us/Draft
- Rune Recommender depuis la V12.23, par champion et par rôle : https://wiki.leagueoflegends.com/en-us/Rune
- Web Push sur iOS, uniquement pour une web app de l'écran d'accueil (iOS 16.4, WebKit, 16/02/2023) : https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Screen Wake Lock (MDN, Baseline 2025) : https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API · bug des web apps de l'écran d'accueil, corrigé en iOS 18.4 selon les données de compatibilité : https://bugs.webkit.org/show_bug.cgi?id=254545 , https://progressier.com/pwa-capabilities/screen-wake-lock
- Vibration non supportée dans Safari iOS : https://caniuse.com/vibration
- Taille des cibles, 44 × 44 px (WCAG 2.2, 2.5.5, niveau AAA) : https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- Largeurs d'écran des iPhone 17 (site tiers) : https://yesviz.com/iphones.php , https://yesviz.com/devices/iphone-17/
- Tauri, option `focus` de la fenêtre : https://jetbrains.github.io/kotlin-wrappers/kotlin-tauri-apps-api/tauri.apps.api/-window-options/focus.html , https://github.com/tauri-apps/tauri/commit/ff5d76ca214b94a7b6e88aa4f0f797bbf747824d · tao 0.37.1 (focus au `set_visible`) : https://v2.tauri.app/release/tao/v0.37.1/
- Baron Buff, miroir de la draft par QR dans le navigateur : https://baronbuff.com/
- Apple Sports : simplicité voulue (MacRumors) https://macrumors.com/2024/02/21/apple-sports-app-simplicity · Gruber https://daringfireball.net/2024/02/apple_sports · critique sur les petits écrans https://leancrew.com/all-this/2024/04/a-tardy-assessment-of-the-apple-sports-app/
- Données de la maquette : jeu de données DraftGap (Lolalytics Emerald+), 29/10/2026, fichiers locaux `dl-dataset/30-days.json` et `current-patch.json`, issus de https://bucket.draftgap.com/datasets/v5/
- Data Dragon 16.21.1, portraits : https://ddragon.leagueoflegends.com/cdn/16.21.1/img/champion/
