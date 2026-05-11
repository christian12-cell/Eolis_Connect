# Manuel Utilisateur — OPS Admins
## Eolis Connect — Eolis Cameroun

---

## 1. Rôle de l'OPS Admin

En tant qu'OPS Admin, vous avez accès à des fonctionnalités supplémentaires par rapport aux agents :

| Fonctionnalité | Client | Agent | OPS Admin |
|----------------|--------|-------|-----------|
| Soumettre des tickets | ✅ | ❌ | ❌ |
| Traiter des tickets | ❌ | ✅ | ✅ |
| Voir ses propres stats | ❌ | ❌ | ✅ |
| Voir les stats de toute l'équipe | ❌ | ❌ | ✅ |
| Accéder au classement agents | ❌ | ❌ | ✅ |
| Voir le dashboard opérationnel | ❌ | ❌ | ✅ |

---

## 2. Le Dashboard Opérationnel

Accessible via **"Dashboard"** dans le menu gauche.

### Les 6 cartes KPI (indicateurs clés)

| Indicateur | Signification |
|------------|---------------|
| **Nouveaux** | Tickets créés sur la période sélectionnée |
| **Traités** | Tickets clôturés sur la période |
| **En cours** | Tickets actuellement pris en charge |
| **En attente** | Tickets sans agent assigné |
| **Satisfaction** | Note moyenne des évaluations clients (sur 5) |
| **Temps moyen** | Durée moyenne de résolution en heures |

### Les filtres de période
En haut à droite, vous pouvez filtrer par :
- **Année** : vue annuelle
- **Mois** : vue mensuelle (sélectionnez l'année et le mois)
- **Jour** : vue journalière précise

### Le taux de conformité SLA
Le SLA (Service Level Agreement) mesure si les dossiers sont traités dans les délais cibles :
- 🔴 **Élevée** : objectif < 3 heures
- 🟡 **Moyenne** : objectif < 5 heures
- 🟢 **Faible** : objectif < 10 heures

Les barres de progression montrent le % de dossiers traités dans les délais pour chaque niveau d'urgence.

> ✅ Un taux > 80% est excellent. ⚠️ En dessous de 60%, il faut agir.

### Les alertes
Le bloc Alertes signale :
- Dossiers urgents en attente depuis trop longtemps
- Agents avec une charge de travail déséquilibrée

### Les graphiques

**1. Volume de tickets (barres + courbes)**
- Les barres montrent le nombre total de nouveaux tickets par jour/mois
- Les courbes colorées montrent la répartition par urgence (🔴🟡🟢)
- Utile pour : identifier les pics d'activité et ajuster les effectifs

**2. Répartition par statut (camembert)**
- Montre la proportion de tickets En attente / En cours / Clôturés
- Si "En attente" est trop grand → les agents sont débordés

**3. Tendance des performances (courbes)**
- Montre l'évolution du score de performance sur la période
- 3 courbes : une par niveau d'urgence (🔴🟡🟢)
- Un score proche de 100 = très bonne performance
- Un score qui baisse = problème à investiguer

**Comment lire le score de performance :**
```
Score = (Score Satisfaction × 50%) + (Score Rapidité × 50%)

Score Satisfaction = (note moyenne / 5) × 100
Score Rapidité = max(0, 100 - (temps moyen / 24h) × 100)
```

**4. Répartition par catégorie (camembert)**
- Montre quels types de demandes arrivent le plus
- Utile pour : identifier les problèmes récurrents et créer une FAQ

### Records de performance
Affiche le dossier traité le plus rapidement pour chaque niveau d'urgence avec le nom de l'agent. Utile pour reconnaître les meilleures performances.

### File urgente
Liste les 5 dossiers urgents (🔴) en attente depuis le plus longtemps. Intervenez rapidement si cette liste est longue.

---

## 3. La Page Performances

Accessible via **"Performances"** dans le menu gauche.

### Vue individuelle (un agent)
1. Sélectionnez un agent dans le menu déroulant
2. Sélectionnez la période (année/mois)

**Les 6 KPI de l'agent :**
| KPI | Signification |
|-----|---------------|
| **Dossiers traités** | Nombre total de clôtures |
| **Satisfaction** | Note moyenne reçue (sur 5) |
| **Temps de résolution** | Durée moyenne de A à Z |
| **1ère réponse** | Délai avant le premier message de l'agent |
| **Messages/dossier** | Nombre moyen d'échanges par ticket |
| **Actifs** | Dossiers encore en cours |

**Le benchmark :** à côté de chaque KPI de l'agent, vous voyez la moyenne de l'équipe. Cela permet d'identifier si l'agent est au-dessus ou en dessous de la moyenne.

**Les barres SLA individuelles :** conformité aux délais de l'agent par urgence.

**Les graphiques individuels :**
- Évolution de la satisfaction dans le temps
- Évolution du volume traité
- Répartition des urgences traitées
- Tendance des performances

**Les derniers commentaires clients :** les évaluations textuelles laissées par les clients pour cet agent.

### Vue équipe (tous les agents)
Sélectionnez **"Tous les agents"** dans le menu.

Un tableau comparatif s'affiche avec une ligne par agent + une ligne **Moyenne équipe** en bas.

**Colonnes du tableau :**
| Colonne | Signification |
|---------|---------------|
| **Agent** | Nom de l'agent |
| **Dossiers** | Nombre de tickets traités |
| **Satisfaction** | Note moyenne /5 |
| **Résolution** | Temps moyen de résolution |
| **1ère rép.** | Délai avant première réponse |
| **Msgs** | Messages moyens par dossier |
| **SLA** | % de dossiers dans les délais |
| **Score** | Score composite 0-100 |

> 💡 Cliquez sur un en-tête de colonne pour trier le tableau.

---

## 4. La Page Classement

Accessible via **"Classement"** dans le menu gauche.

### Les filtres
Filtrez par année, mois ou jour pour voir le classement sur la période souhaitée.

### Les badges (distinctions)
Chaque agent peut recevoir jusqu'à 4 badges :

| Badge | Critère |
|-------|---------|
| 🏆 **Volume** | A traité le plus grand nombre de dossiers |
| ⭐ **Satisfaction** | A la meilleure note de satisfaction clients |
| ⚡ **Rapidité** | A le meilleur temps de résolution |
| 🎯 **SLA** | A le meilleur taux de conformité aux délais |

**Le podium des distinctions :**
- 🥇 Or (1er) — médaille dorée
- 🥈 Argent (2ème) — médaille grise
- 🥉 Bronze (3ème) — médaille bronze

Cliquez sur un badge pour voir qui est 1er, 2ème et 3ème pour cette distinction.

### Le tableau de classement
Chaque ligne d'un agent affiche :
- Sa **position** (rang)
- Ses **badges** obtenus (cliquez pour voir le détail)
- Ses **métriques** (dossiers, satisfaction, temps, SLA, score)
- L'**évolution** de son rang vs la période précédente (📈 ou 📉)

---

## 5. Fonctionnalités exclusives OPS Admin

En plus du tableau de bord, performances et classement, vous pouvez aussi :

### Traiter des tickets (comme un agent)
Vous pouvez prendre en charge des tickets si l'équipe est débordée. Suivez les mêmes étapes que dans le Manuel Agent.

### Voir les notifications d'équipe
Votre cloche 🔔 reçoit des alertes spéciales :
- Réponses finales non lues depuis +12h (le client n'a pas consulté)
- Messages clients sans réponse depuis +1h

---

## 6. Comment agir face aux alertes

### 🔴 "File urgente longue" (>3 dossiers urgents en attente)
1. Vérifiez si des agents sont disponibles
2. Assignez manuellement les dossiers ou demandez à un agent de les prendre
3. Si personne n'est disponible, informez le management

### 📉 "Score de performance en baisse"
1. Allez dans Performances → voir quel agent a le score le plus bas
2. Identifiez si c'est un problème de satisfaction ou de rapidité
3. Discutez avec l'agent pour comprendre la cause

### ⭐ "Satisfaction < 3.5/5"
1. Allez dans Performances → vue individuelle → lisez les commentaires clients
2. Identifiez les types de problèmes signalés
3. Organisez une formation ou revoyez le processus de traitement

### 📊 "Pic de volume inhabituel"
1. Vérifiez le graphique par catégorie → identifiez quel type de demande explose
2. Si c'est récurrent → créez une FAQ ou une procédure dédiée
3. Prévenez l'équipe pour ajuster les priorités

---

## 7. Bonnes pratiques de supervision

**Quotidiennement :**
- Vérifier la file urgente (aucun dossier 🔴 ne doit attendre +2h)
- Vérifier la satisfaction du jour
- S'assurer que tous les agents ont des dossiers en cours

**Hebdomadairement :**
- Consulter la page Performances → vue équipe
- Identifier les agents en difficulté et les accompagner
- Regarder le Classement pour féliciter les meilleurs

**Mensuellement :**
- Analyser les tendances du dashboard
- Identifier les catégories de problèmes les plus fréquentes
- Faire un bilan de l'équipe

---

## 8. Questions fréquentes

**Un agent a clôturé un ticket par erreur, comment faire ?**
Contactez l'administrateur système (SYSTEM_ADMIN) qui peut modifier les statuts directement en base de données.

**Comment ajouter un nouvel agent ?**
Seul le SYSTEM_ADMIN peut créer des comptes. Contactez l'administrateur.

**Les statistiques ne correspondent pas à ce que j'attendais ?**
Vérifiez les filtres de période sélectionnés. Assurez-vous que la période couvre bien les dossiers concernés.

**Le score d'un agent est 0 ou très bas ?**
Vérifiez s'il a traité des dossiers sur la période sélectionnée. Un agent sans dossier clôturé n'a pas de score calculable.

**Comment interpréter un temps de résolution de "2h30" ?**
C'est la durée moyenne entre la création du ticket et sa clôture. Idéalement < 3h pour les urgences élevées, < 5h pour les urgences moyennes.
