# Manuel Administrateur — OPS Admin
## Eolis Connect

---

## Page Overview (Vue d'ensemble)

La page Overview est le tableau de bord principal de l'OPS Admin. Elle se rafraîchit automatiquement toutes les **60 secondes** et affiche l'état en temps réel de toute l'activité des dossiers.

---

### Les 6 cartes KPI (ligne du haut)

#### 1. Total tickets
**Ce que c'est :** Le nombre total de dossiers dans le système, tous statuts confondus (en attente, en cours, traités).

**Calcul :** `nombre de tous les tickets dans la base`

**Indicateur de tendance (texte en dessous) :**
- `↑ +X new vs last week` (rouge) → plus de dossiers cette semaine que la semaine dernière
- `↓ -X new vs last week` (vert) → moins de nouveaux dossiers qu'avant
- `→ stable vs last week` (gris) → même volume

**Comment c'est calculé :** Comparaison entre les 7 derniers jours et les 7 jours précédents.

---

#### 2. Pending (En attente)
**Ce que c'est :** Dossiers soumis par les clients mais pas encore pris en charge par un agent.

**Calcul :** `tickets avec statut === 'PENDING'`

**Sous-texte (si applicable) :** "X non assigné(s)" — dossiers PENDING sans agent assigné. Ces dossiers sont prioritaires car personne ne les traite.

---

#### 3. In progress (En cours)
**Ce que c'est :** Dossiers en cours de traitement — un agent les a pris en charge et travaille dessus.

**Calcul :** `tickets avec statut === 'IN_PROGRESS'`

---

#### 4. Treated today (Traités aujourd'hui)
**Ce que c'est :** Dossiers clôturés aujourd'hui (à partir de minuit, heure de Douala WAT).

**Calcul :** Tickets avec statut `TREATED` ou `CLOSED` dont la date de clôture (`closedAt`) est après minuit WAT (West Africa Time = UTC+1) du jour en cours.

**Note :** Ce compteur repart à 0 chaque nuit à minuit.

---

#### 5. Avg satisfaction (Satisfaction moyenne)
**Ce que c'est :** La note moyenne laissée par les clients après la clôture de leurs dossiers.

**Calcul :**
1. Récupère tous les tickets ayant reçu une note de satisfaction
2. Additionne toutes les notes (sur 5)
3. Divise par le nombre d'avis
4. Arrondi à 1 décimale

**Exemple :** 4.8/5 avec "4 reviews" = 4 clients ont noté, la moyenne est 4.8/5.

**Affiché "—"** si aucun dossier n'a encore été noté.

---

#### 6. Avg resolution (Délai résolution moyen)
**Ce que c'est :** Le temps moyen entre la création d'un dossier et sa clôture.

**Calcul :**
1. Pour chaque dossier clôturé : `(date clôture - date création)` en heures
2. Moyenne de tous ces temps
3. Affiché en heures (ex: 0.5h = 30 minutes, 2h 30min, etc.)

**Affiché "—"** si aucun dossier n'est encore traité.

---

### Les 3 cartes SLA (ligne du bas)

**SLA = Service Level Agreement** — les engagements de délai de résolution selon l'urgence du dossier.

Chaque carte mesure : *"quel pourcentage de dossiers de cette urgence ont été résolus dans le délai cible ?"*

| Urgence | Délai cible | Couleur |
|---|---|---|
| 🔴 High | < 3 heures | Rouge |
| 🟡 Medium | < 5 heures | Orange |
| 🟢 Low | < 10 heures | Vert |

**Calcul du pourcentage :**
```
% SLA = (dossiers résolus dans le délai / total dossiers résolus) × 100
```

**Code couleur du score :**
- **Vert** : ≥ 80% — objectif atteint
- **Orange** : 60–79% — attention
- **Rouge** : < 60% — objectif non atteint

**Exemple (screenshot) :**
- High 100% — 1/1 ticket(s) : le seul dossier HIGH a été résolu en moins de 3h ✓
- Medium 100% — 2/2 ticket(s) : les 2 dossiers MEDIUM ont été résolus en moins de 5h ✓
- Low 100% — 1/1 ticket(s) : le seul dossier LOW a été résolu en moins de 10h ✓

**"No data"** apparaît si aucun dossier de cette urgence n'a encore été clôturé.

---

---

### Les filtres Year / Month / Day

Trois menus multi-sélection qui filtrent les données affichées dans les 4 graphes ci-dessous (ils n'affectent PAS les 6 cartes KPI ni les 3 cartes SLA — celles-ci sont toujours en temps réel).

| Filtre actif | Granularité des graphes |
|---|---|
| Aucun filtre | 30 derniers jours, un point par jour |
| Mois sélectionné | Chaque jour du mois sélectionné |
| Année sélectionnée | Chaque mois de l'année sélectionnée |
| Combinaison | Intersection des filtres appliqués |

Le bouton **"Effacer les filtres"** réinitialise tout d'un coup.

---

### Graphe 1 — Ticket Volume (grand graphe gauche)

**C'est quoi :** Un graphe combiné barres + courbes montrant l'activité des dossiers dans le temps.

- **Barres bleues** = nouveaux dossiers créés ce jour/semaine/mois
- **Courbe rouge** = dossiers HIGH clôturés ce jour
- **Courbe verte** = dossiers LOW clôturés ce jour
- **Courbe orange** = dossiers MEDIUM clôturés ce jour

**Utilité :** Visualiser les pics d'activité, voir si les dossiers sont traités aussi vite qu'ils arrivent (barres bleues vs courbes colorées).

---

### Graphe 2 — Status Breakdown (donut haut droit)

**C'est quoi :** Répartition des dossiers par statut.

| Couleur | Statut |
|---|---|
| 🟡 Jaune | Pending — en attente de prise en charge |
| 🔵 Bleu | In progress — en cours de traitement |
| 🟢 Vert | Treated / Closed — clôturés |

**Note :** Soumis aux filtres. Si tous les dossiers sont traités → 100% vert.

---

### Graphe 3 — Global Performance by Urgency (graphe bas gauche)

**C'est quoi :** Le graphe le plus important. Il affiche un **score composite 0–100** par niveau d'urgence, calculé à partir de deux critères : satisfaction client et vitesse de résolution.

**Formule :**
```
Score satisfaction = (note moyenne / 5) × 100
Score vitesse      = max(0, 100 − (temps résolution moyen / 24h) × 100)
Score final        = (satisfaction × 50%) + (vitesse × 50%)
```

**Plafond vitesse :** Au-delà de 24h de résolution, le score vitesse tombe à 0.

**Exemple :**
- Note moyenne 4.8/5 → satisfaction = 96/100
- Résolu en 0.5h → vitesse = 100 − (0.5/24 × 100) = 98/100
- Score composite = (96 × 50% + 98 × 50%) = **97/100**

| Ligne | Urgence |
|---|---|
| 🔴 Rouge | HIGH |
| 🟡 Jaune | MEDIUM |
| 🟢 Vert | LOW |

**Utilité :** Suivre la qualité du service dans le temps par niveau d'urgence. Un score qui baisse indique soit des clients moins satisfaits, soit des délais de résolution qui s'allongent.

---

### Graphe 4 — By Category (donut bas droit)

**C'est quoi :** Répartition des dossiers selon la catégorie choisie par le client lors de la soumission.

Les catégories possibles : Livraison, Facturation, Dossier, Information, Autre (et sous-catégories).

**Utilité :** Identifier les types de demandes les plus fréquents pour adapter les ressources ou la formation des agents.

---

---

### Les 3 cartes "Best time" — Records par urgence

**C'est quoi :** Le record absolu de résolution le plus rapide pour chaque niveau d'urgence, tous agents et toutes périodes confondus.

**Calcul :** Pour chaque urgence, le système prend tous les dossiers clôturés, calcule `date clôture − date création` pour chacun, et affiche celui avec le temps le plus court.

Chaque carte affiche :
- Le temps record (en minutes ou heures)
- La référence du dossier
- Le nom de l'agent qui l'a traité
- La catégorie et sous-catégorie
- La date de réception
- Un lien direct vers le dossier ("View ticket")

**Note :** Ces records **ne sont pas affectés par les filtres Year/Month/Day** — ils reflètent toujours le meilleur temps de toute l'histoire du système.

**Utilité :** Référence de performance et reconnaissance des agents. Un record peut servir d'objectif pour l'équipe.

---

### Urgent queue — HIGH pending

**C'est quoi :** Un tableau d'alerte montrant les 5 dossiers HIGH urgency les plus anciens encore ouverts (PENDING ou IN_PROGRESS), triés du plus ancien au plus récent.

**"No urgent tickets pending ✓"** = aucun dossier HIGH en attente, situation normale.

Si des dossiers apparaissent ici, chaque ligne affiche : référence, client, catégorie, agent assigné (ou "Non assigné"), temps de soumission. Le lien "View full queue" renvoie vers la file complète de l'agent dashboard.

**À surveiller :** Si un dossier HIGH reste dans cette liste plus de 2 heures, une alerte rouge apparaît aussi en haut de la page Overview.

---

---

## Page Ticket Queue (File de dossiers)

Cette page est l'Agent Dashboard — la vue opérationnelle du travail quotidien.

### Les 3 cartes

| Carte | Calcul |
|---|---|
| **New** | Tickets `status === 'PENDING'` — pas encore pris en charge |
| **In progress** | Tickets `status === 'IN_PROGRESS'` — en cours de traitement |
| **Treated today** | Tickets clôturés depuis minuit (heure Douala, WAT) |

### La file de dossiers

Affiche uniquement les dossiers **actifs** (PENDING + IN_PROGRESS). Les dossiers clôturés ne sont pas ici — ils sont dans la page "Treated tickets".

**Tri :** toujours par urgence, dans cet ordre : HIGH → MEDIUM → LOW. À urgence égale, les plus anciens apparaissent en premier.

**Chaque ligne affiche :**
- Point coloré d'urgence (rouge/orange/vert)
- Référence du dossier (REF-2026-XXXX)
- Nom du client + badge langue (🇫🇷 FR / 🇬🇧 EN)
- Catégorie et sous-catégorie
- Statut (badge)
- Temps depuis la soumission ("il y a 2h", "il y a 3j")
- Bouton "Voir" pour accéder au dossier

### Filtres et recherche

- **Filtres urgence :** All / High / Medium / Low — filtrent l'affichage de la file
- **Recherche :** sur la référence (ex: REF-2026-0001) OU le nom du client

### Différence OPS Admin vs Agent simple

L'OPS Admin peut accéder à **n'importe quel dossier**, même ceux déjà assignés à un autre agent. Un simple AGENT voit le bouton "Voir" grisé si le dossier appartient à quelqu'un d'autre.

### Auto-refresh

La page se rafraîchit automatiquement toutes les **60 secondes**. Le compteur SVG en haut à droite indique le temps restant avant le prochain refresh. Le bouton "Refresh" force un rafraîchissement immédiat.

---

---

## Page Treated Tickets (Dossiers traités)

Archive consultable de tous les dossiers clôturés dans le système.

### Différence OPS Admin vs Agent simple

| | OPS Admin | Agent simple |
|---|---|---|
| Titre | "Treated tickets" | "Mon historique" |
| Dossiers visibles | **Tous** les dossiers clôturés du système | Uniquement **ses propres** dossiers |
| Colonne "Agent" | ✅ Visible | ❌ Cachée |

### Compteur

`X result(s) / Y treated ticket(s)` — X = résultats après filtres appliqués, Y = total des dossiers clôturés.

### Colonnes du tableau

| Colonne | Description |
|---|---|
| **Reference** | Référence unique du dossier (REF-2026-XXXX) |
| **Client** | Nom du client ayant soumis le dossier |
| **Category** | Catégorie + sous-catégorie |
| **Urgency** | Badge coloré (High / Medium / Low) |
| **Agent** | Agent qui a traité le dossier *(OPS Admin uniquement)* |
| **Closed on** | Date et heure de clôture |
| **View** | Lien vers le dossier complet |

### Filtres

Tous les filtres sont **combinables** entre eux :
- **Recherche textuelle** : par référence (ex: REF-2026-0001) ou nom du client
- **Urgency** : multi-sélect — High, Medium, Low
- **Year / Month / Day** : multi-sélect pour filtrer par période de clôture

Le bouton **"Effacer les filtres"** réinitialise tout d'un coup (apparaît dès qu'un filtre est actif).

### Tri

Du plus récent au plus ancien (date de clôture).

---

---

## Page Performance (Performances des agents)

Page d'analyse approfondie des performances individuelles et collectives.

### Filtres

- **Sélecteur d'agent** : bascule entre la vue globale ("All agents") et la fiche d'un agent spécifique
- **Year / Month** : filtrent la période analysée. Sans filtre = toutes les données disponibles

### Vue "All agents" — 3 graphes globaux

#### Treated tickets (courbe)
Nombre de dossiers clôturés par période. L'axe X s'adapte automatiquement selon l'étendue des données :
- ≤ 14 jours → granularité journalière
- ≤ 60 jours → granularité hebdomadaire
- > 60 jours → granularité mensuelle

#### Avg satisfaction (/5) (courbe)
Note moyenne de satisfaction des clients sur la période. Basé sur les évaluations post-clôture. Affiché "—" si aucune note.

#### Urgency breakdown (barres)
Répartition des dossiers traités par urgence : 🔴 High, 🟡 Medium, 🟢 Low.

### Vue "All agents" — Tableau comparatif

Tous les agents classés par nombre de dossiers traités (décroissant), avec médailles 🥇🥈🥉 pour les 3 premiers.

| Colonne | Description |
|---|---|
| **Rank** | Classement par volume traité |
| **Agent** | Nom de l'agent |
| **Traités** | Nombre de dossiers clôturés sur la période |
| **Satisfaction** | Note /5 — **vert** si ≥ moyenne équipe, **rouge** si < moyenne équipe |
| **Délai moy.** | Temps moyen entre création et clôture |
| **1ère réponse** | Temps moyen entre création du dossier et premier message de l'agent |
| **SLA %** | % global de dossiers résolus dans les délais cibles |
| **Msgs/dossier** | Nombre moyen de messages par dossier |
| **En cours** | Dossiers actifs actuellement |
| **Détail →** | Ouvre la fiche individuelle de l'agent |

Dernière ligne = **moyenne équipe** (fond bleu foncé) — référence de comparaison.

---

### Vue individuelle (agent sélectionné)

#### 6 cartes KPI

| KPI | Calcul | Comparaison affichée |
|---|---|---|
| **Dossiers traités** | Nombre de dossiers clôturés | ± vs période précédente |
| **Satisfaction moy.** | Moyenne des notes /5 | ± vs moyenne équipe |
| **Délai résolution moy.** | `(closedAt − createdAt)` en h/min | vs moyenne équipe |
| **1ère réponse moy.** | Temps entre création et premier message de l'agent | vs moyenne équipe |
| **Messages / dossier** | Moyenne des échanges par dossier | vs moyenne équipe |
| **Charge actuelle** | Dossiers PENDING + IN_PROGRESS assignés en ce moment | — |

**Note "1ère réponse" :** mesure la réactivité de l'agent — combien de temps le client a attendu avant d'avoir une réponse du staff (hors notes internes).

#### SLA Compliance individuelle
Même logique que l'Overview : % de dossiers résolus dans le délai cible par urgence (HIGH <3h, MEDIUM <5h, LOW <10h).

#### Commentaires clients
Les 8 derniers commentaires écrits par des clients sur les dossiers de cet agent, avec la note étoile associée.

---

*(Suite du manuel à venir — pages suivantes)*
