# 07 — Le modèle face aux données : revue contradictoire

Date : 30/10/2026. Patch live 16.21. Ce rapport relit le modèle (04) et le rapport données (03) en se posant une question : chaque terme a-t-il les données qu'il lui faut ? Il faut la bonne granularité, la bonne fraîcheur et assez de parties.

Légende :

- **[V]** : source lue (URL en fin de document).
- **[V calcul]** : calcul fait sur des fichiers publics téléchargés le 30/10/2026 (scripts en fin de document).
- **[H]** : hypothèse.
- **[Corrigé]** : affirmation de 03 ou 04 que les données contredisent.

Unités : 1 point de winrate ≈ 0,04 logit près de 50 %. « n0 » est la taille d'échantillon à partir de laquelle les données pèsent autant que le prior. Le « poids des données » vaut w = N/(N+n0).

---

## 0. Verdict en bref

1. **Le modèle 04 suppose des données que la source retenue par 03 ne fournit pas.** La formule Λ additionne les 25 paires allié-ennemi et les 10 paires alliées par équipe. Ces données n'existent que chez Lolalytics, directement ou via DraftGap, et leur usage demande un accord. u.gg, la source retenue, ne donne que les 5 vis-à-vis de lane et 4 duos (top-jungle, mid-jungle, jungle-support, ADC-support). Il manque aussi l'ADC contre le support adverse, alors que c'est un vrai terme de lane (τ = 0,061, aussi gros que le vis-à-vis bot).
2. **Le piège le plus dangereux est un sens de lecture.** Dans les fichiers `matchups` de u.gg, le champ « victoires » compte les victoires de l'**adversaire** [V calcul]. Lu tel quel, chaque counter devient un bon choix. Dans les fichiers `champion_duos`, ce même champ compte les victoires du champion. Un test automatique est obligatoire (§3.1).
3. **Les matchups de lane sont stables. On peut donc les regrouper.** Entre l'EUW et le reste du monde, entre Master+ et Émeraude-Diamant, et entre les patchs 16.20 et 16.21, la corrélation des effets vrais vaut environ 1,0. Les écarts restent sous le bruit, à moins de 0,7 point au seuil de 90 % [V calcul, 8 champions]. Entre Or et Émeraude+, la corrélation vaut 0,88. Entre Argent et Émeraude+, elle tombe à 0,72.
   - Conséquence : matchups **monde, sur 3 patchs glissants, dans une large bande d'elo**. Il ne faut ni table EUW, ni table par tranche fine, ni remise à zéro au changement de patch.
4. **La force de base, elle, dépend vraiment de l'elo.**
   - L'écart entre Or et Émeraude+ vaut 0,6 à 1,4 point d'écart-type selon le rôle. C'est autant que l'écart entre champions lui-même. Nidalee jungle perd 5,4 points en Or.
   - L'écart EUW contre monde n'est que de 0,2 à 0,7 point, soit à peu près le bruit d'une table EUW.
   - Il faut donc une force par tranche, calculée sur le monde. Un seul fichier u.gg de 60 Ko par tranche et par patch suffit.
5. **Sans regroupement, la moitié du signal disparaît.** On mesure le signal récupérable par l'écart-type du score entre les picks viables, au dernier pick. Il vaut 2,2 à 2,4 points avec u.gg regroupé, 1,6 à 1,7 avec le patch courant en EUW Émeraude+ seul, 1,3 à 1,5 en EUW Master+ seul. La méta seule donne déjà 1,1 à 1,4.
6. **À retirer du MVP :**
   - les 16 croisements hors lane et 8 des 10 synergies (pas de source, et impossibles à valider sous 130 000 parties pour les petites) ;
   - le terme de performance perso u_ic, l'oubli à 90 jours et l'écart hors rôle (σ_u inconnu, aucune donnée pour le caler) ;
   - la simulation du contre-pick λ (aucun log réel) ;
   - le chiffrage de la compo (1,5 % des équipes sont concernées, il faudrait environ 200 000 parties).
7. **Trois erreurs de formule** :
   - le prior de la force de base utilise le mauvais τ (n0 = 1 600 au lieu d'environ 15 000 pour un champion inchangé et 1 300 pour un champion modifié) ;
   - u_ic compte deux fois la courbe d'apprentissage ;
   - la règle d'affichage laisse passer du bruit (§3).
8. **La plupart des chiffres cités sont exacts**, avec trois réserves :
   - l'affirmation d'iTero sur les équipes à moins de 20 % de dégâts physiques n'est accompagnée d'aucun chiffre ;
   - les « 6 à 13 points » mélangent deux comparaisons différentes ;
   - la part EUW est d'environ 23,5 %, pas 28 %.

---

## 1. Combien de parties par case ? (arithmétique)

### 1.1 Volumes de référence [V calcul]

Source : fichier `champion_ranking` de u.gg, 16.21 au 30/10 04:50 UTC, soit environ 9 jours de patch. Le nombre de parties est au champ `d[3]`.

| Tranche | Parties sur 9 jours | Part de « monde Émeraude+ » |
|---|---|---|
| Monde Émeraude+ | 1 657 570 | 1 |
| Monde Or | 1 578 165 | 0,95 |
| Monde Platine | 1 437 300 | 0,87 |
| Monde Argent | 1 265 534 | 0,76 |
| Monde Master+ | 304 865 | 0,18 |
| EUW Émeraude+ | 389 055 | **0,235** (et non 0,28 comme dans 03) |
| EUW Or | 364 986 | 0,22 |
| EUW Master+ | ≈ 58 000 | 0,035 (moyenne sur 5 champions) |

Le patch 16.20 complet, en monde Émeraude+, compte 2 357 516 parties. Le dataset 30 jours de DraftGap (Lolalytics, Émeraude+ monde) en compte 5 663 423. u.gg et Lolalytics ont des volumes très proches : Ahri mid sur le 16.21 fait 163 652 parties chez u.gg contre 165 548 chez Lolalytics.

### 1.2 Un cas concret : Ahri mid contre Syndra, 16.21, 9 jours [V calcul]

Ahri est le 8e mid le plus joué, et Syndra son adversaire le plus fréquent. C'est donc l'une des cases les mieux remplies du jeu.

| Tranche | Parties | Ahri gagne | Erreur type (50/√N) | Poids des données (n0 mid = 600) |
|---|---|---|---|---|
| Monde Émeraude+ | 8 555 | 50,3 % | ±0,5 pt | 0,93 |
| EUW Émeraude+ | 2 883 | 50,9 % | ±0,9 pt | 0,83 |
| Monde Master+ | 1 571 | 48,5 % | ±1,3 pt | 0,72 |
| EUW Or | 1 912 | 51,3 % | ±1,1 pt | 0,76 |
| **EUW Master+** | **489** | 48,3 % | **±2,3 pt** | 0,45 |

Pour une case *typique*, on prend la médiane pondérée par la fréquence de rencontre, sur les adversaires d'Ahri : 4 137 en monde Émeraude+, 1 008 en EUW Émeraude+, 726 en monde Master+, **184 en EUW Master+**.

### 1.3 Toutes les paires, sur un patch complet [V calcul]

Méthode :

- On part du dataset DraftGap 30 jours : N_30j est la médiane des cases pondérée par la rencontre.
- On le met à l'échelle : N_patch = N_30j × 14/30 × part de la tranche. Exemple pour le top en EUW Émeraude+ : 3 945 × 0,467 × 0,234 = **431 parties**.
- Le facteur 14/30 surestime de 12 % le volume réel d'un patch (2,36 M mesurés). Les poids ci-dessous sont donc légèrement optimistes.
- τ est l'écart-type vrai de l'effet (variance observée moins bruit binomial), avec n0 = 4/τ². Mes τ recoupent ceux de 04 à ±0,005 près.
- « w moy. » est le poids moyen des données sur les cases rencontrées.

| Paire | τ (logit) | n0 | N médian, 30 j monde É+ | Patch, monde É+ : N / w moy. | Patch, EUW É+ : N / w | Patch, monde M+ : N / w | Patch, EUW M+ : N / w |
|---|---|---|---|---|---|---|---|
| Top contre top | 0,091 | 480 | 3 945 | 1 841 / 0,69 | **430 / 0,43** | 309 / 0,37 | **64 / 0,13** |
| Mid contre mid | 0,081 | 600 | 5 968 | 2 785 / 0,71 | 651 / 0,47 | 467 / 0,40 | 97 / 0,15 |
| Jungle contre jungle | 0,060 | 1 110 | 5 761 | 2 688 / 0,64 | 629 / 0,36 | 451 / 0,30 | 94 / 0,10 |
| Support contre support | 0,063 | 1 000 | 8 797 | 4 105 / 0,70 | 960 / 0,45 | 689 / 0,39 | 143 / 0,15 |
| Bot contre bot | 0,055 | 1 300 | 20 053 | 9 358 / 0,78 | 2 189 / 0,56 | 1 572 / 0,50 | 327 / 0,23 |
| Bot contre support adverse | 0,061 | 1 070 | 12 617 | 5 887 / 0,75 | 1 377 / 0,51 | 989 / 0,45 | 206 / 0,19 |
| 16 autres croisements | 0,033 à 0,052 | 1 450 à 3 630 | 4 600 à 10 200 | w 0,39 à 0,63 | w 0,16 à 0,35 | w 0,12 à 0,29 | w 0,03 à 0,10 |
| Synergie bot + support | 0,048 | 1 760 | 13 607 | 6 349 / 0,69 | 1 485 / 0,45 | 1 066 / 0,39 | 222 / 0,16 |
| Synergie jungle + mid | 0,033 | 3 740 | 5 686 | 2 653 / 0,40 | 620 / 0,16 | 445 / 0,13 | 92 / 0,03 |
| 8 autres synergies | 0,019 à 0,027 | 5 460 à 11 100 | 4 700 à 10 400 | w 0,20 à 0,44 | w 0,06 à 0,19 | w 0,05 à 0,15 | w 0,01 à 0,04 |

J'ai recoupé avec les duos u.gg (16.21, 9 jours, médiane pondérée) :

- Jinx + support : 7 477 en monde Émeraude+, 1 691 en EUW Émeraude+, 221 en EUW Master+.
- Ahri + jungle : 4 224, 1 189 et 170.

Lecture :

- En **EUW Master+**, sur un seul patch, toutes les cases sont du bruit à plus de 75 %, même les vis-à-vis de lane.
- En **EUW Émeraude+** ou **EUW Or**, la lane est un mélange à parts égales entre signal et bruit. Les synergies hors bot + support sont du bruit pur (w ≤ 0,19).

### 1.4 Ce qu'il reste pour un dernier pick [V calcul]

L'indicateur est l'écart-type du score récupérable entre les picks viables. Il additionne la force de base, plus la somme des τ² × w des termes disponibles pour ce rôle.

| Scénario | Top | Jungle | Mid | Bot | Support |
|---|---|---|---|---|---|
| A. Modèle 04 complet, données Lolalytics 30 jours | 2,9 | 2,9 | 3,0 | 3,0 | 3,0 |
| B. u.gg (lane + 4 duos), regroupé sur 2 tranches et 3 patchs (environ 2,7 fois le volume « 30 jours Émeraude+ ») | 2,4 | 2,2 | 2,4 | 2,2 | 2,3 |
| C. u.gg, patch courant seul, EUW Émeraude+ | 1,7 | 1,6 | 1,7 | 1,7 | 1,7 |
| D. u.gg, patch courant seul, EUW Master+ | 1,3 | 1,5 | 1,4 | 1,4 | 1,4 |
| E. Méta seule (force par tranche) | 1,1 | 1,4 | 1,2 | 1,3 | 1,3 |

Les chiffres de 04 (« ±3,3 points ») sont des effets vrais, non réduits par le shrinkage. Ce sont des plafonds. Le gain réel dépend de deux choses : les données vraiment disponibles, et le pool du joueur.

- Choisir le meilleur parmi 3 à 5 champions du pool rapporte environ 0,85 à 1,16 écart-type de plus qu'un choix au hasard dans ce pool.
- Au dernier pick, en scénario B, cela fait **2 à 2,8 points**.
- Plus tôt dans la draft, le vis-à-vis est inconnu : le gain tombe vers 1 à 1,5 point.
- Ce sont des plafonds, car les joueurs choisissent déjà rarement au hasard [H].

---

## 2. Que peut-on regrouper ? [V calcul]

### 2.1 Matchups de lane

Données : fichiers u.gg `matchups` de 8 champions très joués (Ahri, Sylas, Garen, Darius, Lee Sin, Jinx, Kai'Sa, Thresh), patchs 16.20 et 16.21.

Méthode :

- Pour chaque case : écart = logit(winrate de la case) − logit(winrate du champion) + logit(winrate de l'adversaire dans le rôle, DraftGap).
- On ne garde que les cases d'au moins 100 parties.
- Pondération par rencontre, bootstrap sur 400 tirages.
- L'écart-type vrai de ces écarts vaut 0,052 à 0,063. Cela recoupe DraftGap, qui donne 0,056 pour ces mêmes champions.

| Comparaison (échantillons disjoints) | Cases | Corrélation des effets vrais [IC 90 %] | Écart-type vrai de la différence |
|---|---|---|---|
| EUW contre reste du monde (É+, 16.21) | 393 | 1,0 [0,89 ; 1,16] | ≈ 0 (≤ 0,027 logit, soit ≤ 0,7 pt) |
| Master+ contre Émeraude-Diamant | 362 | 1,0 [0,89 ; 1,14] | ≈ 0 (≤ 0,030) |
| Patch 16.20 contre 16.21 (monde É+) | 620 | 1,00 [0,95 ; 1,05] | 0,008 (≤ 0,018, soit ≤ 0,5 pt) |
| Platine contre Émeraude+ | 574 | 0,91 [0,85 ; 0,98] | 0,024 (0,6 pt) |
| Or contre Émeraude+ | 580 | 0,88 [0,82 ; 0,94] | 0,028 (0,7 pt) |
| Argent contre Émeraude+ | 544 | 0,72 [0,64 ; 0,79] | 0,047 (1,2 pt) |

Les différences entre elos et entre patchs contiennent aussi la variation de force de l'adversaire. Ce sont donc des **bornes hautes**.

Limites :

- L'échantillon se limite à 8 champions populaires et à un seul changement de patch.
- Un champion très modifié (refonte, gros ajustement) peut sortir de cette stabilité [H]. Il faut donc un drapeau « matchups incertains » pour les champions cités dans les notes de patch.

### 2.2 Force de base

Données : fichier u.gg `champion_ranking`, champions représentant au moins 0,5 % de leur rôle.

| Mesure | Résultat |
|---|---|
| Écart-type entre champions, monde Émeraude+ | 0,043 (top) à 0,056 (jungle), soit 1,1 à 1,4 pt. **Confirme 04** |
| Le même en EUW Or | 0,052 à 0,093, soit 1,3 à 2,3 pt : la méta est plus dispersée en Or |
| Dérive du 16.20 au 16.21, champions nerfés | 13 champion-rôles (liste des previews) : moyenne −1,2 pt, écart-type 0,056 (1,4 pt). Exemples : Qiyana jungle −2,9, Viktor mid −2,5 |
| Dérive, autres champions | 187 champion-rôles : écart-type 0,016 (0,4 pt) |
| Or contre Émeraude+ | 0,026 à 0,054 (0,6 à 1,4 pt) ; Nidalee jungle −5,4, Rengar jungle −3,3 |
| Argent contre Émeraude+ | 0,032 à 0,069 (0,8 à 1,7 pt) |
| Master+ contre Émeraude-Diamant | 0,016 à 0,041 |
| EUW contre reste du monde | 0,007 à 0,026 (0,2 à 0,7 pt). Le bruit d'une table EUW Or par champion vaut environ 2/√12 000 = 0,018 : le gain d'une table régionale est à peu près annulé par son bruit |

---

## 3. Erreurs et pièges

### 3.1 Données

1. **Le sens des victoires dans u.gg `matchups`.** Pour Ahri mid (monde Émeraude+, 16.21) :
   - la somme des « victoires » sur ses lignes de matchup donne 79 120 / 162 953 = 48,55 % ;
   - or son winrate réel (`rankings`) est de 84 169 / 163 652 = 51,43 %, et 1 − 0,4855 = 0,5145.
   - Autre exemple, Garen contre Jax : u.gg affiche 2 401 / 5 485 = 43,8 %. DraftGap donne 56,2 % du côté de Garen et 44,1 % du côté de Jax.
   - Donc winrate(c contre e) = 1 − ligne[1] / ligne[2]. Dans `champion_duos`, au contraire, la somme redonne 51,4 % : ce sont bien les victoires du champion.
   - Le rapport 03 écrit « Syndra : 8 555 parties, 4 253 victoires ». Ces 4 253 victoires sont celles de Syndra **[Corrigé]**.
   - **Tests à chaque build :**
     - la somme des victoires de matchup doit redonner le winrate du champion à 0,3 point près ;
     - les deux sens d'une même case doivent être symétriques : |wr(c,e) + wr(e,c) − 1| < 0,02 sur les cases de plus de 2 000 parties ;
     - les codes de rôle doivent concorder entre u.gg (1 jungle, 2 support, 3 ADC, 4 top, 5 mid), `champion_ranking` (« adc », « supp »…), DraftGap (0 à 4 = top, jungle, mid, bot, support) et le LCU (« top », « jungle », « middle », « bottom », « utility »).
2. **Les sources ne couvrent pas le modèle.** u.gg ne publie pas les croisements hors lane, ni l'ADC contre le support adverse (Jinx contre Thresh : 20 parties seulement dans le fichier, donc seuls les ADC adverses y figurent), ni 6 des 10 synergies. Le profil de dégâts réel vient aussi de Lolalytics. Pour une simple alerte de compo, l'étiquette `damageType` de CommunityDragon suffit.
3. **Le mélange de patchs.** 03 propose de pondérer le nouveau patch par n/(n+k) avec k ≈ 900 pour une lane. Mais les matchups ne bougent pas d'un patch à l'autre (§2.1) : il ne faut **pas** les remettre à zéro, on garde une fenêtre glissante de 3 patchs **[Corrigé]**. Pour la force de base, k dépend du fait que le champion a été modifié ou non (point 4 ci-dessous).
4. **La fraîcheur réellement utile.** `champion_ranking` doit être relu chaque jour : c'est un fichier d'environ 60 Ko par tranche, qui contient aussi les bans (`d[1]`, dont la somme vaut 16,49 M, soit environ 10 × 1,66 M parties [V calcul, interprétation]). Les 172 fichiers `matchups` pèsent environ 160 Mo compressés au total. Une relecture par semaine et une en fin de patch suffisent, puisque ces données sont stables.

### 3.2 Formules du modèle 04

1. **§3.2, prior de la force de base.**
   - 04 calcule n0_s = 4/τ_s² avec τ_s = 0,05, l'écart *entre champions*. Mais le prior est *le même champion au patch précédent*. Le bon τ est donc celui de la **dérive** d'un patch à l'autre : 0,016 pour un champion inchangé (n0 ≈ 15 000) et 0,056 pour un champion modifié (n0 ≈ 1 300).
   - 04 avait vu la bonne direction (« ÷ 4 si modifié »), mais avec un facteur 10 d'erreur pour les champions inchangés.
   - Avec les volumes monde par tranche, les données dominent en moins d'une journée. L'erreur ne compte donc que le jour du patch, ou sur une table régionale.
2. **§3.5, double comptage dans u_ic.** Les résidus y − p̂ sont calculés avec p̂ « sans π ». Les défaites des premières parties, celles de l'apprentissage, déjà prises en compte par f_c(k), tirent donc u vers le bas une seconde fois. Il faut calculer le résidu contre σ(logit p̂_g + f_c(k_g) − f̄_c), où k_g est l'expérience *au moment* de la partie g.
3. **§3.5, oubli exponentiel à 90 jours.** Avec cette règle, 300 parties jouées il y a un an donnent k_eff = 300 × e^(−365/90) ≈ 5. Le joueur serait alors traité comme un débutant, avec −3 à −6 points. Aucune source ne mesure un tel oubli. iTero signale seulement la limite d'une photo statique.
   - Correction : expérience cumulée sur toute la carrière, plus un éventuel terme « rouille » plafonné, seulement après calage [H].
4. **§3.5, convertir les points de maîtrise en parties.**
   - Depuis la refonte d'avant le 14.10, les points dépendent de la performance, de la durée et du résultat. L'ARAM et l'Arena en rapportent aussi [V, Riot].
   - Le repère « environ 600 points par partie » date d'iTero 2023 et n'est pas vérifié pour 2026.
   - Il faut donc compter les parties (LCU, match-v5), et ne garder les points que comme borne basse (« a déjà joué »).
5. **§3.7, Monte-Carlo à 300 tirages.**
   - Si chaque candidat a ses propres tirages, le bruit sur la différence entre deux candidats atteint environ 0,2 à 0,3 point. Il faut les mêmes tirages pour tous les candidats.
   - Avec λ = 0 (MVP), le calcul est exact sans simulation : E[m(c ; e)] = Σ_e q(e)·m(c, e).
6. **§6, règle d'affichage.** Une pastille s'affiche dès que |valeur| ≥ 0,5 pt et w ≥ 0,3. Mais à w = 0,3, l'écart-type a posteriori d'un matchup top vaut τ·√(1−w) = 0,091 × 0,84 = 0,076 logit, soit 1,9 pt. Une pastille de 0,5 pt représente donc 0,26 écart-type : c'est du bruit.
   - Règle corrigée : on affiche seulement si |moyenne a posteriori| ≥ 1 pt **et** ≥ 1,28 × son écart-type a posteriori, autrement dit si l'on est sûr du signe à 80 %.
   - Avec des matchups regroupés (w ≈ 0,9), l'écart-type tombe à 0,7 pt, et la plupart des matchups top et mid notables passent le filtre.
7. **§3.6, terme de compo.**
   - Si l'on tire les picks au hasard selon leurs taux de pick, 1,5 % seulement des équipes ont moins de 20 % de dégâts physiques, et 1,6 % plus de 80 % [V calcul].
   - Avec 20 000 parties, cela fait environ 600 équipes concernées. L'erreur type sur leur effet est alors de 2 points, de 0,9 point avec 100 000 parties.
   - On garde une **alerte sans chiffre** tant que ce n'est pas calé.

---

## 4. Vérification des chiffres cités

| Affirmation (04) | Verdict |
|---|---|
| LoLDraftAI contre DraftGap : log loss 0,6829 contre 0,6869, accuracy 55,9 % contre 54,7 %, ECE 0,0088 contre 0,0199, 32 750 parties | **[V]** (19/04/2026). Chiffres publiés par LoLDraftAI, partie au test. EUW1 17 977 parties et KR 14 773 ; parties jouées après la date d'arrêt des données des deux outils. DraftGap est bien trop confiant (« overshoots the confident end ») |
| 56,7 % (draft seule), 57,7 % avec les runes | **[V]** page d'accueil (modèle mis à jour le 24/10, 16.21). Le billet « explained » (04/09/2025) dit 56 % |
| Gain de +3,0 à +7,3 points par pick | **[V]** (28/04/2026), mais c'est un gain **prédit par le modèle**, pas mesuré sur des résultats réels (l'auteur le dit). Patchs 15.10 à 16.08, Argent à Master+ |
| DraftRec 53,2 / 54,3 / 56,2 % | **[V]** tableau 9 (prédiction après la draft complète). Le tableau principal, moyenné sur les tours de draft, donne 52,6 / 52,8 / 55,4 %. Données du top 0,1 % en 2021 : rien ne garantit que ça se transpose à l'Or en 2026 |
| Do et al. 75,1 % et fuite probable | **[V]** pour le chiffre. Fuite : **plausible**, non démontrée. Ils prennent « le dernier match ranked » de joueurs tirés au hasard et le winrate de saison sur ce champion, et rien n'indique qu'ils aient retiré ce match |
| iTero 2023 : environ 44 % sous 10k, 51,5 % au-dessus ; seuil vers 12k, soit environ 20 parties | **[V]** (24/04/2023, patch 13.7, autour de l'Or, environ 1 M de parties). Les 20 parties reposent sur une estimation de 600 points par partie |
| iTero 2022 : 41,5 % sous 5k contre 54,5 % au-delà de 500k | **[V]**. Mais ce sont deux extrêmes, et les plus de 500k sont surtout des OTP |
| « Un champion découvert coûte 6 à 13 points » | **[Corrigé]**. La bonne comparaison oppose le premier essai au joueur moyen sur ce champion : environ **4 à 8 points** (iTero 2023 : 7,5 ; Riot 2020 : +4 points sur les ~15 premières parties d'un champion facile). Les 13 points comparent aux OTP |
| iTero : « les équipes à moins de 20 % AD sous-performent » | **[V], mais sans aucun chiffre** : la phrase existe, sans effet ni échantillon. Ça ne justifie pas un terme chiffré |
| Exemple full AP : 64,9 % chez DraftGap contre 40,2 % | **[V]**, mais c'est **une seule draft partielle** choisie par le concurrent. C'est une anecdote, pas une taille d'effet |
| Riot 2017 : environ 40 % pour un premier Riven ou Yasuo | Non vérifié (la page redirige ailleurs). À ne pas citer |
| DraftGap : 1 000 pseudo-parties (niveau de risque moyen) pour la force, les matchups et les duos | **[V code]** |
| Patch 16.21 : nerfs de Qiyana, Viktor, Lee Sin, Nidalee… | [V, source secondaire] previews (Altchar, Gamewave). La page officielle des notes de patch répond 404 à mon outil |

---

## 5. Modèle MVP corrigé

Pour un candidat c, joué par le joueur i dans le rôle ρ, à l'état de draft D :

```
Λ(c) = γ_s · s_b(c,ρ)
     + γ_m · E_e[ m(c,ρ ; e) ]               e = vis-à-vis de lane (connu, sinon loi q par pick rate, λ = 0)
     + γ_y · 1[ρ ∈ {BOT,SUP}] · E_a[ y(c ; a) ]   a = partenaire bot/sup (locké, hover, sinon popularité)
     + x_i(c)                                   expérience, pas de winrate perso
P(c) = σ( β0 + Λ(c) + termes des autres joueurs, calculés de la même façon )
```

| Terme | Source | Granularité | Shrinkage | Affichage |
|---|---|---|---|---|
| s_b : force de base | u.gg `champion_ranking/world/{patch}/ranked_solo_5x5/{tier}` : 1 fichier par tranche, quotidien [V, réponse 200, 60 Ko] | monde, tranche **d'après le rang affiché** (règle Riot), patch courant, centré par rôle | prior = patch précédent, n0 = 15 000 (inchangé) ou 1 300 (cité dans les notes de patch) | « Méta » seulement si ≥ 1 pt |
| Parts de rôle, pick rate, bans | même fichier | idem | — | aucun (sert à inférer les rôles ennemis et les bans) |
| m : vis-à-vis de lane | u.gg `matchups` (**inverser les victoires**) | monde, bande d'elo regroupée (par ex. Or à Émeraude+), 3 derniers patchs pondérés 1 / 0,7 / 0,5, refresh hebdomadaire | Beta-binomial, n0 : top 480, mid 600, support 1 000, jungle 1 100, bot 1 300 | « Lane » si sûr du signe à 80 % ; montrer N |
| y : synergie bot + support | u.gg `champion_duos` (adc ↔ supp) | idem | n0 = 1 760 | « Duo » avec la même règle |
| x : expérience | LCU (historique, bilan de saison, scouting) ; points de maîtrise en borne basse | parties sur c, toutes files SR | **fixé** : 0 partie −0,25 logit (≈ −6 pts), 1 à 9 parties −0,12 (≈ −3), ≥ 10 → 0 [H : ordre de grandeur iTero 2023 et Riot 2020] | badge « Nouveau » plutôt qu'un chiffre |
| Compo | CommunityDragon `damageType` + tags Data Dragon | équipe | — | alerte « 4 AP » sans chiffre |
| γ, β0 | régression logistique sur ≥ 50 000 parties match-v5 (§7) | par bande d'elo | — | — |

Règles :

- **Candidats par défaut** : champions possédés, pickables, avec au moins 10 parties. Les meilleurs choix hors pool apparaissent à part, avec le malus d'expérience.
- **Bans** : P_adv(b) × [s_b(b) + matchup moyen contre nos picks probables], avec le pick rate de la tranche. On propose 3 bans.
- **Affichage** : le gain en points par rapport au champion le plus joué du joueur dans ce rôle (« +2 »), la règle « ≈ » de 04, et des raisons filtrées par la règle du §3.2.6.

Attendus réalistes [H, calcul] :

- La variance expliquée sur une draft complète vaut environ 10 × 0,0025 (méta) + 0,022 (lanes) + 0,0036 (duo bot) ≈ 0,05 logit².
- On en déduit une log loss d'environ 0,6931 − 0,05/8 ≈ **0,687** et une accuracy d'environ **54,5 %**. C'est le niveau de DraftGap sur le seul signal fiable, en dessous de LoLDraftAI.
- Notre avantage ne viendra pas de la précision, mais du filtre sur le pool, du malus d'expérience et de l'honnêteté de l'affichage.

---

## 6. Ce qu'on reporte (et sous quelle condition)

| Composant | Pourquoi pas en v1 | Condition pour l'ajouter |
|---|---|---|
| ADC contre support adverse (τ 0,061) | absent de u.gg | crawl match-v5 maison : environ 900 000 parties par patch en 24/7, soit N médian ≈ 2 000 et w ≈ 0,65 par patch (w ≈ 0,8 sur 30 jours). Gain prouvé en backtest |
| 16 autres croisements hors lane | source Lolalytics uniquement, effets marginaux qui se recouvrent entre eux et avec la compo | accord Lolalytics ou DraftGap, ou crawl maison, **et** gain en backtest (détectable vers 8 000 à 10 000 parties si l'effet est réel) |
| Synergie jungle + mid | v = 2 × 0,033² × 0,5 ≈ 0,0011, donc il faut environ 130 000 parties pour la valider | backtest à 150 000 parties |
| 8 autres synergies | τ ≤ 0,027, w ≤ 0,44 même sur 30 jours monde | probablement jamais |
| u_ic (performance perso), o_i (hors rôle), oubli H | σ_u inconnu ; 20 à 60 parties par champion chez un pote donnent w ≈ 0,17 à 0,37 | échantillon d'environ 500 joueurs via match-v5, avec un historique complet pour reconstituer k_g (environ 500 000 requêtes, 7 jours en 24/7) |
| Courbe d'apprentissage par champion (A_c, T_c) | 100 000 parties contiennent peut-être 2 000 à 4 000 « premières parties », soit environ 20 par champion [H] | par classe de difficulté seulement (3 classes, environ 1 000 cas chacune, ±1,6 pt) |
| λ contre-pick, κ fiabilité des hovers | aucun log réel (le PoC n'a pas encore tourné sur le vrai client) | environ 300 drafts loggées (5 à 10 potes, environ 1 mois) |
| Compo chiffrée | 1,5 % des équipes, erreur type de 2 pts à 20 000 parties | environ 200 000 parties |
| ARAM | seule la force de base existe (u.gg, tous rangs, environ 25 000 parties par patch pour un champion populaire) | v1.5 : force de base + valeur attendue du reroll |
| Clash, flex en optimisation conjointe | dépend de π, qui est faible en v1 | v2 |

---

## 7. Validation minimale avant de montrer des chiffres aux potes

1. **Intégrité, automatique à chaque build** :
   - les tests du §3.1 (sens des victoires, symétrie, rôles) ;
   - les 173 identifiants Data Dragon 16.21.1 ;
   - la version de patch identique à celle de `/lol-patch` ;
   - en cas d'échec, on garde le fichier de la veille et on envoie une alerte ntfy.
2. **Backtest hors échantillon** :
   - ≥ 50 000 ranked EUW dans la bande d'elo des potes, jouées après la date du snapshot. Source : match-v5, clé perso, environ 3 jours en GitHub Actions ou 1 jour en 24/7 (débits du rapport 03). Rôles tirés de `teamPosition`.
   - Découpage temporel : 50 % pour caler les γ, 50 % pour l'évaluation.
   - Modèles comparés : (0) 50 % + côté, (1) méta par tranche, (2) + lanes regroupées, (3) + duo bot.
   - Un terme reste seulement si sa log loss, comparée à celle du modèle d'avant partie par partie, gagne avec un IC à 95 % qui exclut 0.
   - Puissance [V calcul] : un terme qui explique une variance v baisse la log loss d'environ v/8, et il faut environ 144/v parties pour 3 erreurs types. Lanes : v ≈ 0,018, soit environ 8 000 parties. Duo bot : v ≈ 0,0036, soit environ 40 000 parties.
   - Seuils : ECE ≤ 0,015 sur 10 classes, et log loss ≤ 0,689.
3. **Drafts réelles** :
   - le PoC LCU doit d'abord tourner sur le vrai client ;
   - ensuite, sur 30 drafts loggées : zéro suggestion illégale (banni, déjà pris, non possédé), rôles corrects, recalcul en moins d'1 seconde après chaque événement ;
   - Thomas relit 10 drafts à la main.
4. **Mode fantôme de 2 à 4 semaines.**
   - L'appli calcule et logge sans rien montrer, ou ne montre qu'à Thomas.
   - On mesure la part de décisions marquées « ≈ ». Si elle dépasse environ 70 %, on montre moins de choses.
   - On ne présente **jamais** le suivi de calibration sur nos propres parties comme une preuve. Avec 500 parties, une case de 100 parties a ±5 points d'erreur type. Prouver +3 points demanderait environ 8 700 parties.

---

## 8. Hypothèses restantes

- La stabilité des matchups (§2.1) repose sur 8 champions et un seul changement de patch. Il faut la vérifier sur tous les champions au prochain patch (26.22, le 04/11) avec le même script.
- Les parts de tranche varient d'un champion à l'autre (la part EUW va de 13,5 % à 31 %). Mes mises à l'échelle utilisent des moyennes.
- Les τ hors lane sont des effets marginaux. Leur part réelle, une fois les autres termes pris en compte, est inconnue.
- Je suppose que le profil des joueurs Or en EUW ressemble à celui du monde. C'est confirmé pour la force (écart de 0,2 à 0,7 pt), pas testé pour les matchups en Or.
- u.gg n'a donné aucune autorisation et n'a pas de documentation. Je n'ai pu lire ni ses CGU ni la page officielle des notes de patch 16.21.

---

## Sources

- u.gg (fichiers publics téléchargés le 30/10/2026) :
  - https://stats2.u.gg/lol/1.5/champion_ranking/world/16_21/ranked_solo_5x5/emerald_plus/1.5.0.json, plus les variantes gold, platinum, silver, master_plus, euw1 et 16_20 ;
  - https://stats2.u.gg/lol/1.5/matchups/{16_20,16_21}/ranked_solo_5x5/{103,86,122,64,222,412,517,145}/1.5.0.json ;
  - https://stats2.u.gg/lol/1.5/champion_duos/16_21/ranked_solo_5x5/222/1.5.0.json et rankings/16_21/…/{86,64,222,412}.
- DraftGap :
  - dataset https://bucket.draftgap.com/datasets/v5/30-days.json et current-patch.json (29/10/2026) ;
  - code https://github.com/vigovlugt/draftgap (risk-level.ts, analysis.ts).
- LoLDraftAI :
  - https://loldraftai.com/blog/draftgap-vs-loldraftai-comparison (19/04/2026) ;
  - https://loldraftai.com/blog/suggestion-lift-study (28/04/2026) ;
  - https://loldraftai.com/blog/loldraftai-explained (04/09/2025) ;
  - https://loldraftai.com
- DraftRec, arXiv 2204.12750v1, tableaux 3 et 9 : https://arxiv.org/pdf/2204.12750
- Do et al., FDG 2021 : https://arxiv.org/abs/2108.02799
- iTero :
  - https://www.itero.gg/articles/mastery-a-statistical-summary (24/04/2023) ;
  - https://www.itero.gg/articles/draft-sq (08/09/2022).
- Riot :
  - https://www.leagueoflegends.com/en-au/news/dev/dev-balancing-new-champions (06/07/2020) ;
  - https://support.riotgames.com/en-us/league-of-legends/rewards/champion-mastery-guide (31/07/2025).
- Previews du patch 26.21 (source secondaire) :
  - https://www.altchar.com/game-news/lol-patch-26.21-nerfs-target-caitlyn-lee-sin-viktor-and-more-aET1N3w2F5yY ;
  - https://gamewave.fr/lol/lol-ce-que-nous-savons-sur-le-patch-26-21/
- Scripts de ce rapport : `C:\Users\vialo\AppData\Local\Temp\claude\c--Users-vialo-Desktop-Code-Worlds-2026\cca1783e-dd4b-465d-8074-0ce9111653e9\scratchpad\lol-draft-research\scripts-07\` :
  - cells07.py : tailles de cases et poids des données ;
  - stability07.py : stabilité des matchups ;
  - base07.py : force de base, dérive, elo, région ;
  - compo07.py : fréquence des compos extrêmes ;
  - shares.py : parts de tranche.
- Les données téléchargées sont dans `...\lol-draft-research\dl-07\`.
