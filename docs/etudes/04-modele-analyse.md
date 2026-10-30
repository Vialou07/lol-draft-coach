# 04 — Modèle d'analyse : noter chaque champion pendant la draft

Date : 30/10/2026. Patch live 16.21 (Data Dragon 16.21.1). Périmètre : la formule qui note chaque champion pour le joueur à l'instant t de la draft, plus les bans. L'accès aux données et l'interface sont traités par d'autres agents.

Légende : **[V]** = vérifié (source lue ou calcul fait sur des données publiques, URL en fin de document). **[H]** = hypothèse, à caler ou à confirmer.

---

## 0. En bref

- La draft seule bouge peu le résultat. Les meilleurs modèles publics « draft seule » prédisent le gagnant dans environ **55 à 56 %** des cas [V]. Mon calcul sur les données Emerald+ du 16.21 retombe sur le même ordre de grandeur (56 %) [V calcul].
- **Ton propre pick**, quand tout est visible (dernier pick), fait varier la winrate d'environ **±3,3 points** (écart-type entre les choix viables) [V calcul]. Le meilleur choix rapporte environ **+4 points** face à un pick réaliste (+7 face à un pick au hasard) d'après l'étude de LoLDraftAI [V, chiffres de l'éditeur].
- **La maîtrise pèse plus que la meta.** Jouer un champion découvert coûte environ **6 à 13 points** de winrate [V]. Entre deux champions de la meta, l'écart typique n'est que de **1,1 à 1,5 point** [V calcul]. En revanche, passer de 30 à 300 games sur un champion ne change presque rien (< 1 point) [V].
- Les vrais gros counters sont rares. Seules **1,8 %** des lanes top ont un écart de plus de 5 points, 0,4 % des mids et quasiment aucune bot [V calcul].
- Le modèle proposé est une **somme en log-odds** (comme DraftGap), avec trois ajouts :
  - un shrinkage dont la force est calculée à partir des données, et non fixée à la main ;
  - un terme de maîtrise personnelle mesuré *par rapport au joueur moyen sur ce champion* ;
  - une simulation des picks restants avec la réponse adverse (pour la sécurité en blind), puis un recalage global sur des matchs réels. Ce recalage retire le double comptage et donne des probabilités fiables.
- À l'écran : une **chance de victoire** par champion, une barre d'incertitude, un badge « ≈ » quand deux choix ne se départagent pas, et **3 raisons au maximum**. Tout le reste sur demande.

---

## 1. Ce que la draft peut réellement changer

### 1.1 Mesures publiques

| Source | Données | Résultat |
|---|---|---|
| LoLDraftAI vs DraftGap, avril 2026 [V] (test publié par LoLDraftAI) | 32 750 ranked solo Emerald+ EUW1/KR, jouées après l'arrêt des données des deux outils | Log loss : DraftGap 0,6869, LoLDraftAI 0,6829 (50/50 = 0,6931). Accuracy : 54,7 % et 55,9 %. ECE (erreur de calibration) : 0,0199 et 0,0088 |
| Page LoLDraftAI [V] | Entrées : champions, patch et elo, **aucune donnée joueur** | 56,7 % d'accuracy sur la draft seule (57,7 % avec les runes). Les drafts au-delà de 60 % sont rares |
| Étude « lift » LoLDraftAI, 28/04/2026 [V] | 10 000 games, patchs 15.10 à 16.08, Silver à Master+, effet *prédit par le modèle* | Remplacer un pick par la 1re suggestion : +3,0 points au 1er pick, puis +3,8 (ordre réaliste) à +7,3 (ordre naïf) au dernier pick |
| DraftRec, WWW 2022 [V] | 279 893 games du top 0,1 % (juin à septembre 2021) | Après la draft : régression logistique sur les champions 53,2 %, réseau sans historique joueur 54,3 %, **avec historique joueur 56,2 %** |
| Do et al., FDG 2021 [V] | 5 000 ranked NA | 75,1 % avec la winrate et la maîtrise de chaque joueur sur son champion. **Fuite probable** : la winrate de saison inclut le match prédit (mon analyse). Ils citent aussi Chen et al. à 60,2 % |
| Thèse CTU Prague [V] | Embeddings de champions | Jusqu'à 54 %, contre 50,43 % en prédisant toujours le côté bleu |

### 1.2 Mon calcul sur le patch actuel [V calcul]

J'ai utilisé le jeu de données public de DraftGap, qui vient de Lolalytics : Emerald+, toutes régions. Le fichier « 30 jours » contient 11,3 M de lignes champion-rôle par rôle, soit environ 5,6 M de games. Le fichier « patch 16.21 » en compte environ 3,3 M par rôle. Les deux datent du 29/10/2026.

Pour chaque effet, j'ai séparé la variance « vraie » du bruit d'échantillonnage : variance vraie = variance observée − bruit binomial moyen. J'ai gardé les champions qui font au moins 0,5 % des games de leur rôle. 0,1 logit ≈ 2,5 points de winrate.

| Effet | Écart-type vrai | En points |
|---|---|---|
| Force du champion dans son rôle (meta) | 0,045 à 0,059 logit | **1,1 à 1,5 pt** (bot = le plus dispersé) |
| Matchup de lane | top 0,087 · mid 0,074 · sup 0,061 · jungle 0,058 · bot 0,052 | top **2,2** · mid 1,9 · sup et jungle 1,5 · bot 1,3 |
| Bot contre support adverse | 0,054 à 0,059 | 1,4 |
| Autres croisements (ex. ton top contre leur jungle) | 0,032 à 0,050 | 0,8 à 1,2 |
| Synergie bot + support | 0,046 | 1,1 |
| Synergie jungle + mid, jungle + sup, jungle + bot, top + jungle | 0,024 à 0,033 | 0,6 à 0,8 |
| Synergie top + bot, top + sup, top + mid | 0,017 à 0,021 | ≤ 0,5 (négligeable) |

- **Draft complète** : la variance totale vaut 0,100 logit², soit un écart-type de 0,32. Elle se répartit en 26 % force des champions, 60 % matchups et 14 % synergies. Ce chiffre implique une accuracy de 56,2 % et une log loss de 0,681. C'est cohérent avec les 55,9 à 56,7 % de LoLDraftAI, mais c'est une borne haute : les effets par paires se recouvrent en partie.
- **Ton pick quand tout est visible** : environ 3,3 points d'écart-type entre les champions viables, quel que soit le rôle. La part due au vis-à-vis de lane est de 45 % au top, 31 % au mid, 21 % au support, 20 % à la jungle et 15 % au bot. Conséquence pratique : **le dernier pick doit aller en priorité au top, puis au mid.**
- **Counters forts (> 5 pts après shrinkage)** : 1,8 % des lanes top, 0,4 % des mids, ≤ 0,2 % ailleurs. Au-delà de 2,5 points : 22 % des tops, 15 % des mids, 8 % des supports, 4 % des bots.

### 1.3 Maîtrise contre meta

- iTero, 2023 (environ 1 M de games, autour de Gold) [V] : moins de 10k points de maîtrise ≈ 44 % de victoires, plus de 10k ≈ 51,5 %. Le seuil se situe vers 12k points, soit environ 20 games. Entre 50k-1M et plus de 1M points : 51,77 % contre 51,73 %, aucune différence.
- iTero, 2022 [V] : moins de 5k ≈ 41,5 % contre 54,5 % pour plus de 500k. Passer de 2,5k à 7,5k rapporte environ 8 points ; passer de 75k à 175k, moins d'1 point.
- Riot, 2020 [V] : même un champion facile gagne environ 4 points de winrate sur les ~15 premières games, et certains progressent encore après 100 games.
- Riot, 2017 [V, résumé de recherche, page redirigée] : environ 40 % de victoires pour un premier essai sur Riven ou Yasuo.
- Limites : l'échelle des points de maîtrise a changé au patch 14.10 (2024) [V], donc ces seuils en points ne sont plus directement valables. Il faut **compter les games**. Il y a aussi un biais de sélection : on garde les champions avec lesquels on gagne. Pour prédire, ce biais ne gêne pas.

**Conclusion.** Entre ton pool et un champion hors pool, la maîtrise domine (5 à 10 points). À l'intérieur de ton pool, ce sont la meta, les matchups et la compo qui départagent (1 à 4 points). Le modèle ne propose donc par défaut que des champions déjà joués.

---

## 2. Ce qu'on reprend des travaux existants

- **DraftGap** (open source, dernier commit le 10/10/2026, données Lolalytics Emerald+ sur 30 jours, rafraîchies toutes les 12 h) [V code] :
  - Calcul en « rating » Elo, c'est-à-dire 400·log10 des cotes : ce sont des log-odds × 173,7.
  - Force d'un champion : winrate du patch, lissée vers la winrate 30 jours avec des pseudo-games (3000/2000/1000/500/250 selon le « niveau de risque »).
  - Matchups et duos : écart à l'attendu additif, lissé vers 0. Les 25 paires allié-ennemi et les 10 paires de chaque équipe sont additionnées.
  - Rôles ennemis : énumération des affectations possibles, pondérées par la part de chaque rôle dans les games du champion.
  - Limites reconnues par DraftGap : rien sur l'identité de la compo ni sur le mix de dégâts, et aucune donnée sur le joueur.
  - On reprend la structure et l'inférence de rôles. On corrige le prior arbitraire, le double comptage (DraftGap est trop confiant : ECE ×2) et l'absence de compo et de joueur.
- **LoLDraftAI** (fermé) : un réseau qui lit les 10 picks d'un coup. Il est meilleur sur la draft seule, mais sans données joueur [V]. On ne peut pas le reproduire sans des millions de matchs bruts. On peut en revanche le battre sur **notre** cas, grâce à la maîtrise personnelle et aux potes connus.
- **DraftRec** : l'historique du joueur ajoute environ 2 points d'accuracy au-dessus de la draft seule. Son évaluation des recommandations par un modèle séparé, sans réutiliser le même modèle, est une bonne pratique à reprendre.

---

## 3. Le modèle (formules)

### 3.1 Notations

```
σ(x) = 1/(1+e^-x)     logit(p) = ln(p/(1-p))     près de 50 % : 1 point ≈ 0,04 logit
Rôles ρ ∈ {TOP, JGL, MID, BOT, SUP}. Alliés j=1..5 : rôle ρ_j (connu en draft SR), champion a_j.
Ennemis k=1..5 : champion e_k (connu une fois locké), rôle ρ'_k inconnu.
Contexte θ = (tranche d'elo b, patch t, file q, côté).
```

### 3.2 Force de base (meta) avec shrinkage

```
s(c,ρ) = logit[(W_cρ + n0_s·p_prior) / (N_cρ + n0_s)] − logit(p̄_ρ)
  W, N    = victoires et games du champion c dans le rôle ρ, patch courant, tranche b, file q
  p_prior = winrate du même champion sur le patch précédent ou les 30 derniers jours, même tranche
  p̄_ρ    = winrate moyenne du rôle dans la tranche (retire le biais de rang, comme DraftGap)
  n0_s    = 4/τ_s²  avec τ_s ≈ 0,05  →  n0_s ≈ 1 600 games
            n0_s ÷ 4 si le champion est modifié dans les notes de patch [H]
Tranche d'elo : s_b = s_large + δ_b, où δ_b passe par la même formule avec un prior centré sur 0.
```

Ce que donne n0 : avec N = 1 600, les données et le prior pèsent chacun 50 %. Avec N = 17 000 (le minimum observé en Emerald+ au patch actuel), les données pèsent 91 %.

### 3.3 Matchups et synergies (bayésien empirique Beta-binomial)

```
p_att = σ( s̃(c,ρ) − s̃(e,ρ') )            (s̃ = logit brut, même jeu de données que les paires)
m(c,ρ ; e,ρ') = logit[(W + n0·p_att)/(N + n0)] − logit(p_att)
  W, N : moyenne des deux points de vue (victoires de c contre e, défaites de e contre c)
y(c,ρ ; a,ρ_a) : même formule avec p_att = σ(s̃_c + s̃_a)
n0 = 4/τ²  où τ est l'écart-type vrai du type de paire (§1.2)
Variance a posteriori (logit) : Var ≈ 4/(N + n0)
```

| Paire | n0 | Usage |
|---|---|---|
| Top contre top | 530 | toujours |
| Mid contre mid | 730 | toujours |
| Support contre support, jungle contre jungle | 1 070 à 1 190 | toujours |
| Bot contre bot, bot contre support adverse | 1 150 à 1 480 | toujours |
| Croisements hors lane | 1 600 à 3 900 | oui (petit poids) |
| Synergie bot + support | 1 890 | oui |
| Synergies jungle + (mid, top, sup, bot), mid + (bot, sup) | 3 700 à 7 600 | oui (petit poids) |
| Synergies top + bot, top + sup, top + mid | ≥ 9 000 | **supprimées (= 0)**, c'est du bruit |

Ce choix découle des données, contrairement aux 1 000 pseudo-games fixes de DraftGap. Il resserre fortement les synergies et laisse parler les matchups top et mid.

### 3.4 Rôles ennemis

```
P(ρ'_1..ρ'_K) ∝ Π_k r(e_k, ρ'_k)    sur les affectations sans doublon
r(e,ρ) = part du rôle ρ dans les games de e (patch courant, tranche b)
```

Un champion ennemi pas encore locké n'a pas de rôle propre : il prend l'un des rôles restants (§3.7).

### 3.5 Maîtrise du joueur (le terme clé)

```
π(i,c,ρ) = [ f_c(k_eff) − f̄_c ] + u_ic + o_i(ρ)

k_eff = Σ_g w_q(g) · exp(−âge_g / H)        H ≈ 90 jours, w_ranked = 1, w_normale = 0,7   [H]
f_c(k) = −A_c · exp(−k / T_c)                courbe d'apprentissage
  A_c : 0,16 logit (≈ 4 pts, champion facile) à 0,40 (≈ 10 pts, Riven ou Yasuo)
        prior au départ : difficulté Data Dragon (info.difficulty), recalé ensuite   [H, ordres de grandeur V §1.3]
  T_c ≈ 5 à 15 games, davantage pour les champions à courbe longue   [H]
f̄_c = moyenne de f_c chez ceux qui jouent c ≈ −A_c × (part de games « débutant » sur c, ~0,1 à 0,2)
      ⇒ π est mesuré PAR RAPPORT AU JOUEUR MOYEN SUR c : pas de double comptage avec s(c),
         qui contient déjà le niveau moyen des joueurs de c (cas des champions à OTP)
u_ic = Σ_g (y_g − p̂_g) / ( Σ_g p̂_g(1−p̂_g) + 1/σ_u² )     σ_u ≈ 0,2 [H]  ⇒  équivaut à n0 ≈ 100 games
  y_g = 1 si victoire, p̂_g = prédiction du modèle pour cette game passée (sans π), sinon 0,5
  Var(u_ic) = 1 / ( Σ p̂(1−p̂) + 1/σ_u² )
o_i(ρ) = même estimateur sur les games du joueur par rôle (hors rôle principal, autofill)
Alliés inconnus et ennemis : π = 0 (joueur moyen), sauf en Clash (§5)
```

Conséquence chiffrée : 20 games à 60 % de victoires sur un champion ne donnent que u ≈ +0,07 logit (≈ +1,7 pt). La winrate perso sur petit échantillon pèse donc peu. Le nombre de games (f_c) pèse beaucoup plus. La « forme récente » toutes champions confondus n'entre pas dans le calcul [H : peu de signal, le MMR compense déjà] ; on la teste en backtest.

### 3.6 Composition d'équipe

```
h(T) = Σ_f γ_f · φ_f(T)
  φ_AD = max(0 ; 0,20 − part_physique)   φ_AP = max(0 ; part_physique − 0,80)
       (part des dégâts physiques de l'équipe, calculée à partir du profil de dégâts de chaque champion)
  φ_front = 1[aucun champion résistant]      (Data Dragon info.defense ≥ 7, ou tag Tank)
  φ_cc, φ_engage, φ_waveclear : candidats seulement
```

Chaque γ_f est estimé sur les résidus du modèle par paires (régression logistique L2 sur des matchs réels). **Une caractéristique n'entre que si elle améliore la log loss hors échantillon.** iTero montre que les équipes à moins de 20 % de dégâts physiques sous-performent [V]. LoLDraftAI montre qu'une équipe full AP notée 64,9 % par DraftGap tombe à 40,2 % chez eux [V] : le terme est nécessaire.

### 3.7 Draft complète, puis draft en cours

```
Λ(D) = β_côté
     + Σ_j γ_s·s(a_j,ρ_j) − Σ_k γ_s·s(e_k,ρ'_k)
     + Σ_j π(i_j,a_j,ρ_j)
     + Σ_j Σ_k γ_m[ρ_j,ρ'_k] · m(a_j,ρ_j ; e_k,ρ'_k)
     + Σ_{j<j'} γ_y · y(a_j,a_j') − Σ_{k<k'} γ_y · y(e_k,e_k')
     + h(Alliés) − h(Ennemis)
P(victoire | D) = σ(Λ(D))
```

Pour un candidat c pendant la draft, on tire M ≈ 300 fins de draft possibles et on fait la moyenne :

```
P(c) = (1/M) Σ σ(Λ(D_m))      avec a_i = c dans chaque D_m, où :
  - rôles ennemis    ~ P(ρ') (§3.4)
  - picks ennemis à venir : q_k(e) ∝ [pr(e,ρ'_k) / (1 − br(e))] · exp(λ · g_k(e)) · 1[e disponible]
      pr, br = pick rate et ban rate (tranche, patch). Diviser par (1 − br) donne la proba de pick quand e est disponible
      g_k(e) = gain de l'ennemi s'il prend e = −[ termes de Λ qui contiennent e ]
      λ = intensité du contre-pick : 0 = l'ennemi joue sa popularité, sans répondre ; calé sur nos logs LCU   [H]
  - picks alliés à venir : hover visible (championPickIntent) retenu avec une proba κ ≈ 0,8 [H],
      sinon popularité dans le rôle (ou le pool du pote si c'est un ami inscrit)
Disponibilité : nos candidats = champions possédés et pickables, moins les bans et les picks déjà faits.
```

- **Sécurité en blind** : elle est déjà incluse, car si ton vis-à-vis n'a pas encore pické, q_k le fait contre-picker avec l'intensité λ. On affiche à part :
  - **Risque de contre** : R(c) = P(c | λ=0) − P(c | λ calé), autrement dit ce que la réponse adverse te coûte en moyenne ;
  - **Pire cas plausible** : le 10e centile des simulations où ton vis-à-vis répond, par exemple « Contrable : Malphite −4 ».
- **Flex** : l'ennemi ne connaît pas nos rôles non plus. Il répond donc avec une intensité λ·max_ρ r(c,ρ). Plus un champion se joue sur plusieurs rôles, moins il est facile à contrer. L'effet est modeste en solo, plus net en Clash (où les échanges de champions sont possibles).

### 3.8 Recalage et incertitude

- **Recalage (il retire le double comptage)** : les γ (γ_s, γ_m par famille lane / bot 2v2 / croisé, γ_y, γ_f, et un γ_π sur les games des potes) sont estimés par régression logistique de l'issue sur les sommes de chaque famille de termes. On utilise des matchs réels joués après la date des statistiques. Les effets par paires sont marginaux et se recouvrent : on attend γ < 1 pour eux. DraftGap, qui n'a pas ce recalage, est trop confiant [V].
- **Incertitude d'estimation** :
  ```
  v_est(c) = Σ_termes γ² · Var_post(terme) + Var(u_ic) + Var(A_c)·(∂f/∂A)²
  ```
- **Intervalle à 80 % affiché** : σ(logit P(c) ± 1,28·√v_est).
- **Égalité** : P(c₁ > c₂) = Φ((μ₁ − μ₂)/√v_est(c₁ − c₂)). Les termes communs aux deux candidats s'annulent dans la différence. Si cette probabilité est < 0,75, on affiche « ≈ ».
- **Classement** : par P(c), la moyenne a posteriori. Il n'y a pas de pénalité de risque arbitraire : le shrinkage évite déjà la « malédiction du gagnant ».

### 3.9 Bans

```
V_ban(b) = E[σ(Λ) | b banni] − E[σ(Λ) | b ouvert]       (même simulation que §3.7)
        ≈ P_adv(b) · [ H(b) − H̄_remplaçant ]  −  P_nous(b) · [ perte d'option si nous voulions b ]
P_adv(b) = 1 − Π_k (1 − q_k(b))
H(b)     = baisse attendue de Λ si l'ennemi a b : sa force + ses matchups contre NOS picks probables
Nos picks probables : softmax(μ(c)/T) sur le pool de chaque joueur connu (intent déclaré = proba forte),
                      popularité du rôle pour un allié inconnu
```

- En solo : on propose 3 bans, triés par V_ban, en évitant les hovers de bans alliés visibles (à confirmer côté LCU).
- Entre potes (flex, Clash) : choix glouton de bans tous différents, qui maximisent la somme des V_ban.

### 3.10 Ordre de pick et échanges

```
VLP(ρ) = E[ max_c P(c) | vis-à-vis connu ] − E[ max_c P(c) | vis-à-vis inconnu ]
```

On suggère d'échanger le dernier pick vers le rôle où VLP est le plus grand : top, puis mid (§1.2). C'est une suggestion affichée : le joueur fait l'échange lui-même dans le client, l'appli reste en lecture seule.

---

## 4. En clair, pour Thomas

On part de 50 %. Pour chaque champion que tu peux prendre, on ajoute des petits bonus ou malus :

1. **Est-il fort ce patch, à ton elo ?** Rarement plus d'1 ou 2 points.
2. **Contre qui tu tombes en lane ?** Au top et au mid, ça peut faire 2 à 5 points. Au bot, c'est rarement plus d'1 point.
3. **Avec qui tu joues ?** Ça compte surtout pour le duo bot + support et pour la jungle.
4. **La compo tient-elle debout ?** Par exemple, une équipe 100 % AP est sanctionnée.
5. **Est-ce que tu sais le jouer ?** C'est le plus gros terme : un champion découvert coûte 5 à 10 points. En revanche, 30 ou 300 games sur un champion, c'est presque pareil.

Tous ces termes s'additionnent sur une échelle où ils ne se gonflent pas entre eux (les log-odds). Ensuite, on vérifie sur des milliers de vrais matchs que « 55 % » veut bien dire 55 %, et on réduit les termes qui exagèrent.

Quand une stat repose sur peu de games, on la tire vers « neutre » : plus l'échantillon est petit, plus on la rapproche de zéro. Si ton adversaire de lane n'a pas encore pické, on simule ce qu'il risque de prendre pour te contrer, et on te le dit.

À l'écran, chaque champion a un pourcentage, une petite barre qui montre la marge d'erreur, et deux ou trois raisons courtes. Si deux choix sont trop proches pour être départagés, on l'écrit (« ≈ ») au lieu de faire semblant.

---

## 5. Modes de jeu

| Mode (queueId [V]) | Ce qui change dans le modèle | Priorité |
|---|---|---|
| **Ranked solo/duo (420)** | Modèle complet. Les alliés inconnus ont π = 0 (pas de désanonymisation). Un duo pote est reconnu parce que son propre compagnon envoie la même session | **v1** |
| **Ranked flex (440)** | Même moteur. Les potes ont leur π. **Optimisation conjointe** : on cherche la combinaison champions × potes qui maximise P, au lieu d'optimiser chacun à son tour, plus des bans coordonnés. Duo perso lissé (n0 ≈ 100 à 200 games [H]). Stats flex si une source les fournit, sinon solo [H] | **v1** |
| **Normale draft (400)** | Même moteur, stats de ranked [H : comportement proche]. Bon terrain pour un mode « apprendre un champion » | v1 (gratuit) |
| **ARAM (450) / ARAM: Mayhem (2400)** | Pas de rôles ni de matchups visibles (l'équipe ennemie n'apparaît qu'au chargement [H, à vérifier dans la session LCU]). Score = force ARAM de la file + synergies + compo ARAM + π (effet à mesurer). Décisions : prendre un champion du banc, **reroll ou non** (EV(reroll) = moyenne du score sur les champions tirables, comparée au champion actuel), échanges conseillés entre potes. Stats séparées par file | v1.5 |
| **Clash (700 / 720)** | Le capitaine fait tous les bans, en 2 phases de bans et 2 de picks [V, source secondaire]. Le scouting donne les joueurs adverses : rôles inférés à partir de leur rôle habituel, q_k tiré du **pool de chaque adversaire**, et π adverse connu. **Bans ciblés sur leurs OTP**. Les 5 potes sont optimisés ensemble, avec l'ordre de pick (les champions sûrs ou flex d'abord, top et mid en dernier). Calendrier 2026 incertain | v2 |
| Swiftplay (480) / Quickplay (490) | Pas de draft : conseil avant la file sur quels champions emporter par rôle (s + π, sans matchups) | Plus tard (peu coûteux) |
| Arena (1700), Brawl (2300), modes rotatifs | Un autre jeu (duos, augments) : demande un modèle à part | Non |

Le fichier de queues de Riot liste ces modes, mais il ne prouve pas qu'ils sont encore ouverts fin 2026.

---

## 6. Affichage

- **Par candidat**, au plus 3 ou 4 visibles : portrait, **chance de victoire en gros** (par ex. « 54 »), une fine barre d'intervalle à 80 %, et le badge « ≈ » si le choix n'est pas départagé.
- **3 raisons maximum** sous forme de pastilles en points : Lane +2,1 · Maîtrise +1,5 · Compo −0,6. Pour qu'elles s'additionnent, on linéarise chaque terme en points (100·γ·terme·p(1−p)), puis on les met à l'échelle pour que leur somme égale l'écart total.
- **Masquer le bruit** : une pastille n'apparaît que si |valeur| ≥ 0,5 point **et** que les données pèsent au moins 30 % (N/(N+n0) ≥ 0,3). Sinon, sur demande uniquement : « échantillon faible (n=…) ».
- En haut, une seule fois : « Notre draft : 51 % ».
- Bans : 3 propositions avec leur gain en points.
- En blind : une ligne « Contrable : X −4 », seulement si c'est significatif.

---

## 7. Données nécessaires (pour l'agent données)

| Composant | Granularité | Taille d'échantillon utile | Note |
|---|---|---|---|
| s : force du champion | champion × rôle × tranche d'elo × patch × file | N ≥ n0_s ≈ 1 600 pour que les données pèsent la moitié ; idéalement ≥ 10 000 | Emerald+ au patch actuel : ≥ 17k par champion viable [V]. Une seule tranche sur EUW : environ ×5 à ×20 de moins [H] |
| Rôles | part de chaque rôle par champion, patch, tranche | ≥ 200 games par champion | inférence des rôles ennemis |
| Pick rate et ban rate | champion × rôle × tranche, patch | idem | modèle q et bans |
| m : matchups | paire champion-rôle, sur 30 jours ou 2 patchs | n0 de 530 à 3 900 ; médiane observée ≈ 3 000 à 5 600 (Emerald+ 30 jours) [V] | une tranche plus étroite donne moins de poids aux données (N=300, n0=530 → 36 %) |
| y : synergies | bot + support, jungle avec chaque rôle, mid + bot, mid + sup | n0 de 1 900 à 7 600 | top + bot, top + sup et top + mid supprimées |
| Profil de dégâts | champion × rôle : part physique, magique, brute | — | déjà présent dans les données Lolalytics de DraftGap [V] |
| Tags de compo | Data Dragon tags + info (officiel, 173 champions en 16.21.1) [V] | — | Meraki est figé depuis environ 25.15 et n'a que 171 champions [V] |
| Courbes d'apprentissage | winrate par nombre de games sur le champion (1 / 2-5 / 6-15 / 16-50 / 50+), par champion ou par classe de difficulté | ≥ 2 000 games par case pour estimer A à ±2 pts | aucune source publique vérifiée. Plan : des historiques Match-V5 d'environ 500 joueurs échantillonnés (≈ 100k games) [H, débit à confirmer] |
| Données perso | par pote et par game : date, file, rôle, champion, victoire, les 9 autres champions, durée ; ≥ 100 à 200 dernières games SR + points de maîtrise + rang | — | via le compagnon local (LCU) ou Match-V5 par PUUID |
| Session live | myTeam (rôles, intents), theirTeam, actions (ordre), bans, timer, banc et rerolls en ARAM | — | LCU |
| Backtest | ≥ 20 000 ranked postérieures à la date des stats, tranches ciblées, EUW + nos logs de draft (ordre des picks) | — | Match-V5 ne donne pas l'ordre des picks [V, d'après LoLDraftAI] |

Le fichier 30 jours de DraftGap pèse 54 Mo. Il faut calculer sur le PC (compagnon) ou générer une table compacte pour le téléphone, en ne gardant que les cases où les données pèsent au moins 0,1.

---

## 8. Plan de validation

1. **Sans fuite** : toutes les stats (meta, paires, maîtrise) sont calculées avec des données *antérieures* au match testé. C'est l'erreur probable de Do et al.
2. **Jeu de test** : ≥ 20 000 ranked postérieures à la date d'arrêt des données. Métriques : log loss, Brier, ECE, accuracy, avec IC bootstrap à 95 %.
3. **Modèles de référence**, du plus simple au plus complet :
   - (0) 50 % + côté ;
   - (1) meta seule ;
   - (2) DraftGap tel quel ;
   - (3) notre modèle avec recalage γ ;
   - (4) le même + compo ;
   - (5) le même + π (sur les games où l'historique des joueurs est connu).
   Repère à atteindre sans données joueur : log loss ≤ 0,684 et ECE ≤ 0,01 (niveau de LoLDraftAI). Chaque terme ne reste que s'il fait baisser la log loss au-delà de l'IC.
4. **Maîtrise** : on ajuste A_c, T_c, H et σ_u sur les historiques échantillonnés. On vérifie le gain du terme π sur nos propres games (attendu ≈ +1 à 2 points d'accuracy, comme DraftRec).
5. **Ordre de pick** : on cale λ et κ sur nos logs LCU (draft-log.jsonl) et on mesure la calibration de P à chaque tour.
6. **Recommandations** : on mesure le gain avec un modèle séparé (pratique de DraftRec), pas avec le même modèle. Sur nos games, on suit la calibration (« nos 55 % gagnent-ils 55 % ? ») avec un IC affiché. Honnêtement, quelques centaines de games ne suffisent pas à *prouver* un gain de +3 points : il en faudrait plusieurs milliers.
7. **Suivi** : recalcul hebdomadaire de la log loss, alerte si elle dérive après un patch.

---

## 9. Hypothèses à confirmer

- Les écarts-types τ (§1.2) viennent de Lolalytics Emerald+ toutes régions. Il faut les recalculer pour la tranche d'elo des potes et pour EUW.
- Les paramètres de maîtrise (A_c, T_c, H, σ_u, w_normale) ne sont que des ordres de grandeur, à caler.
- λ (contre-pick adverse) et κ (fiabilité des hovers alliés) sont inconnus.
- Côté LCU, à confirmer par l'agent dédié : les hovers de bans alliés sont-ils visibles ? Les sorts des ennemis sont-ils masqués ? Les champs ARAM (banc, rerolls) existent-ils ? L'équipe ennemie est-elle invisible en ARAM ?
- Les stats flex, normale et ARAM: Mayhem sont-elles disponibles séparément chez une source ?
- Numérotation : le client indique 16.21 ; Riot et certains sites affichent peut-être « 26.21 » (non confirmé).

---

## Sources

- DraftGap, code et FAQ : https://github.com/vigovlugt/draftgap (fichiers packages/core/src/draft/analysis.ts, rating/ratings.ts, risk/risk-level.ts, role/role-predictor.ts, apps/frontend/src/components/dialogs/FAQDialog.tsx)
- Données DraftGap (Lolalytics Emerald+), 29/10/2026 : https://bucket.draftgap.com/datasets/v5/30-days.json et https://bucket.draftgap.com/datasets/v5/current-patch.json
- LoLDraftAI, fonctionnement : https://loldraftai.com/blog/loldraftai-explained · étude du gain par pick (28/04/2026) : https://loldraftai.com/blog/suggestion-lift-study · comparaison avec DraftGap (19/04/2026) : https://loldraftai.com/blog/draftgap-vs-loldraftai-comparison · page d'accueil : https://loldraftai.com
- DraftRec (WWW 2022) : https://arxiv.org/pdf/2204.12750
- Do et al. (FDG 2021) : https://arxiv.org/abs/2108.02799
- Thèse CTU, Drafting in MOBA Games using Machine Learning : https://dspace.cvut.cz/entities/publication/4d02f46b-ec5c-4aa2-af19-ba1d510670e0
- iTero, statistiques de maîtrise (2023) : https://www.itero.gg/articles/mastery-a-statistical-summary · draft en solo queue (2022) : https://www.itero.gg/articles/draft-sq
- Riot, équilibrage des nouveaux champions (2020) : https://leagueoflegends.com/en-au/news/dev/dev-balancing-new-champions
- Riot Nexus, Riven vs Yasuo (2017, redirigé, lu via un résumé de recherche) : https://nexus.leagueoflegends.com/en-us/2017/06/riven-vs-yasuo-1v1-data-only/
- Riot, guide de la maîtrise (refonte 14.10) : https://support.riotgames.com/en-us/league-of-legends/rewards/champion-mastery-guide
- Riot, queues : https://static.developer.riotgames.com/docs/lol/queues.json · Data Dragon 16.21.1 : https://ddragon.leagueoflegends.com/cdn/16.21.1/data/fr_FR/champion.json
- Meraki (champions, figé) : https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json
- Format Clash (source secondaire) : https://upcomer.com/league-of-legends-clash-everything-to-know/
