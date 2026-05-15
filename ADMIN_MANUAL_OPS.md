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

*(Suite du manuel à venir — pages suivantes)*
