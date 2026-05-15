# FINANCE_AGENT — Guide complet Eolis Connect

> **Rôle** : Le FINANCE_AGENT est le gestionnaire financier d'Eolis Connect.  
> Il est le seul à pouvoir approuver les recharges clients, saisir les charges d'infrastructure et définir les objectifs financiers.  
> Le SYSTEM_ADMIN dispose d'un accès lecture seule sur les finances, mais doit obligatoirement confirmer les grosses opérations (≥ 30 000 FCFA) — principe des 4 yeux.

---

## Modèle économique d'Eolis Connect

Eolis Connect facture ses clients en **crédits prépayés**. La règle est simple :

> **1 crédit = 1 FCFA**

Les clients achètent des crédits via Orange Money ou MTN Mobile Money, puis les consomment pour utiliser les fonctionnalités IA (extraction de BL, dictée vocale). Le coût réel payé à OpenAI est infime comparé au prix facturé au client — c'est là que se trouve la marge.

### Marges par opération

| Opération | Ce que paie le client | Ce que paie Eolis (OpenAI) | Marge Eolis |
|---|---|---|---|
| Extraction BL | 50 crédits (50 FCFA) | ~0,60 FCFA | **~98,8%** |
| Dictée vocale | 10 crédits/min (10 FCFA/min) | ~3,60 FCFA/min | **~64%** |

### Taux de change utilisés dans l'application

| Devise | Taux | Nature |
|---|---|---|
| 1 USD | = 600 FCFA | Taux opérationnel Eolis (modifiable dans Paramètres système) |
| 1 EUR | = 655,957 FCFA | Taux fixe officiel XAF/EUR — fixé par traité depuis 1999 (modifiable si parité change) |

Toutes les conversions affichées dans l'interface ($, €) utilisent ces taux.

---

## Pages accessibles au FINANCE_AGENT

| Page | URL | Ce qu'on peut faire |
|---|---|---|
| **Tableau de bord** | `/finance/dashboard` | Vue d'ensemble KPIs, alertes, graphes tendance |
| **Validation crédits** | `/finance/credits` | Approuver ou refuser les recharges clients |
| **Revenus & IA** | `/finance/revenus` | Analyse détaillée des coûts IA par usage/dossier |
| **Charges infra** | `/finance/depenses` | Saisir/supprimer les factures (Vercel, Railway, etc.) |
| **Rapport P&L** | `/finance/rapport` | Rapport mensuel profits & pertes + export Excel |
| **Projections** | `/finance/projections` | Définir des objectifs et comparer avec la réalité |
| **Notifications** | `/agent/notifications` | Alertes de nouvelles recharges et confirmations |
| **Paramètres** | `/agent/parametres` | Profil, langue, mot de passe |
| **Aide** | `/finance/aide` | Guide interactif en accordéons |

> Le SYSTEM_ADMIN a accès à toutes ces pages en **lecture seule**, sauf Validation crédits où il peut confirmer/annuler les grosses demandes.

---

## 1. Tableau de bord financier

C'est la page d'accueil du FINANCE_AGENT. Elle donne une photo instantanée de la santé financière d'Eolis sur la période sélectionnée.

### Filtre de période

En haut à droite, le filtre permet de sélectionner une période précise :
- **Jour** : une journée
- **Semaine** : une semaine d'un mois donné
- **Mois** : un mois complet (défaut : mois en cours)
- **Année** : une année complète
- **Toute la période** : depuis le début

Tous les KPIs et graphes se mettent à jour selon le filtre sélectionné.

---

### Les 4 KPIs de revenus et coûts

**Revenus recharges**
```
= Somme des montants validés sur toutes les recharges approuvées de la période
```
C'est l'argent réellement encaissé par Eolis. C'est le **chiffre d'affaires**. Affiché en FCFA, $ et €.

**Prix client (crédits)**
```
= Somme des crédits consommés par les clients sur la période (valeur en FCFA)
```
Ce que les clients ont réellement utilisé en IA. Ce chiffre peut être **différent des revenus** car :
- Un client peut avoir rechargé mais pas encore utilisé ses crédits
- Les 100 crédits offerts à l'inscription sont consommés sans avoir généré de revenu

**Coûts IA (OpenAI)**
```
= Calculé automatiquement à chaque appel API (extraction BL, dictée vocale)
```
Ce qu'Eolis paie réellement à OpenAI. Très faible grâce au modèle pay-per-use. Affiché en FCFA avec 4 décimales car les montants sont infimes (ex : 0,0006 FCFA par token).

**Charges infra**
```
= Somme des charges saisies manuellement dans la page "Charges infra"
```
Vercel, Railway, Neon, AWS S3, Twilio, Cloudflare, etc. Ces charges ne s'enregistrent pas automatiquement — il faut les saisir chaque mois.

---

### Les 3 KPIs de profit

**Bénéfice sur usages IA**
```
= Crédits consommés − Coûts OpenAI
```
La marge pure générée par l'IA. C'est le cœur du business : le client paie 50 FCFA pour une extraction BL, OpenAI coûte 0,60 FCFA, Eolis garde 49,40 FCFA.

**Bénéfice brut**
```
= Revenus recharges − Coûts IA (OpenAI)
```
Ce que tu gagnes après avoir payé OpenAI, **avant** les charges d'hébergement et infrastructure. Utile pour évaluer la rentabilité du modèle IA seul.

**Bénéfice net ⭐ — L'indicateur le plus important**
```
= Revenus recharges − Coûts IA − Charges infra
```
Ce qui reste **réellement** dans la poche d'Eolis après avoir tout payé. C'est le vrai baromètre de santé.
- 🟢 **Vert** = Eolis est rentable sur la période
- 🔴 **Rouge** = Eolis dépense plus qu'elle ne gagne — à corriger

La **marge %** associée indique : sur 100 FCFA encaissés, combien restent après tout.

---

### Note sur les crédits offerts à l'inscription

Chaque nouveau client reçoit **100 crédits gratuits** à l'inscription. Ces crédits ne coûtent rien à Eolis tant qu'ils ne sont pas utilisés. Si un client les utilise pour extraire un BL, Eolis paie ~0,60 FCFA à OpenAI sans avoir reçu de revenu en échange. Ce coût minime est automatiquement capturé dans les **Coûts IA** — il n'y a pas de ligne séparée car le montant est négligeable.

Le dashboard affiche une note informative indiquant combien de nouveaux clients se sont inscrits sur la période.

---

### Alertes automatiques

| Icône | Alerte | Condition | Action recommandée |
|---|---|---|---|
| 💬 | Demandes en attente | Des recharges non traitées existent | Aller dans Validation crédits |
| 🚨 | Bénéfice net négatif | `netProfit < 0` | Vérifier les charges infra ou augmenter les recharges |
| ⚠️ | Charges infra élevées | Infra > 30% des revenus | Revoir les abonnements infrastructure |
| ✅ | Excellente marge | Marge nette > 50% | Bonne santé — continuer |

---

### Graphes du tableau de bord

**Évolution revenus & coûts**
Montre la tendance sur la période. Trois courbes :
- **Verte** : revenus (recharges encaissées)
- **Rouge** : coûts totaux (IA + infra)
- **Bleue pointillée** : prix client en crédits consommés

Si la courbe bleue dépasse la verte → les clients utilisent plus de crédits qu'ils n'en ont achetés récemment (possible grâce aux crédits gratuits d'inscription).

**Bénéfice net par mois**
Barres par mois : violet si positif, rouge si négatif. Ligne jaune = taux de marge %. Permet de voir rapidement quels mois ont été rentables.

---

## 2. Validation crédits

C'est la page la plus critique opérationnellement. Elle gère tout le cycle de vie des recharges clients.

### Comment fonctionne une recharge

```
Client fait un virement Orange Money ou MTN → prend un screenshot SMS → soumet dans l'app
     ↓
FINANCE_AGENT reçoit une notification
     ↓
FINANCE_AGENT ouvre le justificatif (OBLIGATOIRE avant de valider)
     ↓
FINANCE_AGENT entre le montant reçu
     ↓
Si montant < 30 000 FCFA → crédités immédiatement
Si montant ≥ 30 000 FCFA → en attente confirmation SYSTEM_ADMIN (principe 4 yeux)
     ↓ (pour les grosses demandes)
SYSTEM_ADMIN confirme ou annule
     ↓
Crédits ajoutés au compte client + notification client
```

### Codes USSD utiles pour vérifier un paiement

| Opérateur | Code | Usage |
|---|---|---|
| Orange Money | `#150#` | Consulter historique et solde |
| MTN Mobile Money | `*126#` | Consulter historique et solde |

### Statuts des demandes

| Statut | Couleur | Signification |
|---|---|---|
| `pending` | 🟡 Horloge amber | En attente — personne n'a encore traité |
| `pending_admin` | 🟠 Bouclier orange | FINANCE_AGENT a approuvé, SYSTEM_ADMIN doit confirmer |
| `approved` | 🟢 Coche verte | Crédits ajoutés au client |
| `rejected` | 🔴 Croix rouge | Demande refusée |

### Filtres disponibles

- **En attente** : demandes non traitées (action FINANCE_AGENT requise)
- **⚠️ À confirmer** : pour le SYSTEM_ADMIN — affiche les `pending_admin` ET les grosses demandes `pending` ≥ 30 000 FCFA
- **Approuvées** : historique des recharges validées
- **Refusées** : historique des refus
- **Toutes** : vue complète

### Règles de sécurité (non contournables)

| Règle | Détail |
|---|---|
| **Cap strict 1×** | Le montant approuvé ne peut jamais dépasser le montant déclaré par le client |
| **Principe 4 yeux** | Toute demande ≥ 30 000 FCFA nécessite 2 personnes : FINANCE_AGENT + SYSTEM_ADMIN |
| **Justificatif obligatoire** | Le bouton Valider est désactivé tant que le justificatif n'a pas été ouvert |
| **Rate limit** | Maximum 10 approbations par minute |
| **Audit immuable** | Chaque action est enregistrée avec IP, heure exacte, montant, identité |
| **Anti-double** | Si l'OTP 2FA a été envoyé dans les 30 dernières secondes, aucun nouveau SMS n'est envoyé |

### Pour le SYSTEM_ADMIN : confirmation des grosses demandes

Quand une demande ≥ 30 000 FCFA arrive :
- **Chemin A** : FINANCE_AGENT l'approuve → passe en `pending_admin` → SYSTEM_ADMIN confirme
- **Chemin B** : SYSTEM_ADMIN la voit directement dans "⚠️ À confirmer" → peut approuver/refuser sans attendre FINANCE_AGENT

Dans les deux cas, il faut ouvrir le justificatif avant de pouvoir agir.

---

## 3. Charges infrastructure

Page pour enregistrer toutes les factures mensuelles des services utilisés par Eolis Connect.

### Pourquoi saisir ces charges ?

Ces charges ne se comptabilisent pas automatiquement. Sans elles, le bénéfice net affiché dans le dashboard serait surestimé. Chaque mois, dès réception de la facture, la saisir ici pour avoir un P&L réaliste.

### Saisir une charge

**Devise d'entrée** : choisir EUR, USD ou FCFA selon comment la facture est libellée. Les deux autres conversions s'affichent automatiquement en temps réel. Par défaut EUR (la plupart des services tech facturent en euros).

**Période** : format `YYYY-MM` (ex: `2026-05`). Correspond au mois de la facture, pas au jour de paiement.

### Catégories disponibles

| Catégorie | Service concerné | Fréquence typique |
|---|---|---|
| `vercel` | Vercel — hébergement frontend Next.js | Mensuel |
| `railway` | Railway — hébergement API FastAPI | Mensuel |
| `neon` | Neon — base de données PostgreSQL | Mensuel |
| `aws_s3` | AWS S3 — stockage fichiers et justificatifs | Mensuel (usage) |
| `twilio` | Twilio — envoi SMS (OTP 2FA, notifications) | Mensuel (usage) |
| `cloudflare` | Cloudflare — DNS, protection DDoS | Mensuel/annuel |
| `domain` | Registrar — nom de domaine | Annuel |
| `openai` | OpenAI — abonnement forfait si applicable | Si abonnement |
| `maintenance` | Interventions manuelles, développements | Ponctuel |
| `other` | Toute autre charge non listée | Variable |

---

## 4. Rapport P&L (Profits & Pertes)

Le Rapport P&L montre l'évolution financière **mois par mois** sur toute une période. C'est l'outil de reporting principal.

### Différence avec le Tableau de bord

| Tableau de bord | Rapport P&L |
|---|---|
| Photo instantanée de la période | Historique mois par mois |
| KPIs synthétiques | Détail complet par mois |
| Alertes en temps réel | Tendances et prévisions |
| Graphes de tendance | Graphes + tableau exportable |

### Filtres disponibles

**Filtre de période** (en haut à droite) : Jour / Semaine / Mois / Année / Toute la période. S'aligne à droite pour ne pas déborder de l'écran.

**Filtre urgence** : filtrer les coûts IA selon l'urgence des dossiers (HIGH / MEDIUM / LOW). Permet d'analyser la rentabilité par segment de clientèle.

### Contenu de la page

**4 KPIs récapitulatifs** (revenus totaux, coûts IA, charges infra, bénéfice net sur la période filtrée)

**Table "Détail mensuel"** (accordion — cliquer pour ouvrir) :
Chaque ligne = un mois. Colonnes :
- `Revenus` : encaissements de la période
- `Coûts IA` : ce payé à OpenAI
- `Infra` : charges infrastructure
- `Bénéfice brut` = Revenus − Coûts IA
- `Bénéfice net` = Revenus − Coûts IA − Infra
- `Marge %` : badge coloré (vert ≥70%, orange ≥30%, violet ≥0%, rouge négatif)
- Ligne TOTAL en bas récapitule toute la période

**Prévision mois suivant** (accordion) :
Calculée par **régression linéaire** sur tous les mois disponibles. Donne une estimation du prochain mois basée sur la tendance actuelle. Indicatif — ne tient pas compte des charges non encore saisies.

**Graphes** :
- Tendance revenus & coûts (aire + ligne)
- Bénéfice net par mois (barres + ligne marge)

### Export Excel (.xlsx)

Clique sur **"Excel"** pour télécharger un fichier formaté :
- Titre fusionné bleu marine avec la période et la date d'export
- En-têtes colorés blanc sur fond bleu
- Lignes colorées : fond vert clair si bénéfice ≥ 0, rouge clair si négatif
- Bénéfice net en **gras vert** ou **gras rouge**
- Marge % colorée selon performance
- Ligne TOTAL en fond bleu foncé
- Chiffres avec séparateurs de milliers (`50 000,00`)
- Colonnes de largeur fixe — pas besoin d'agrandir

L'export respecte les filtres actifs (période + urgence).

---

## 5. Projections économiques

Page dédiée à la **planification financière** : tu définis des objectifs à l'avance et le système les compare automatiquement avec la réalité.

### Pourquoi utiliser les projections ?

Sans objectifs, il est difficile de savoir si les résultats sont bons ou mauvais. Avec les projections :
- Tu fixes des cibles réalistes basées sur tes ambitions
- Le système te dit chaque mois si tu es en avance, dans les clous ou en retard
- Tu identifies rapidement les mois sous-performants
- Tu peux présenter un rapport structuré à des associés ou investisseurs

### Filtre de période

Deux champs `De [mois] → À [mois]` permettent de sélectionner n'importe quel intervalle :
- Trimestre (ex: 2026-01 → 2026-03)
- Semestre (ex: 2026-01 → 2026-06)
- Année complète (ex: 2026-01 → 2026-12)
- Période personnalisée

### Définir des objectifs

**Mois précis** : définir un objectif pour un seul mois.

**Intervalle de mois** : définir le même objectif sur plusieurs mois d'un coup. Ex: fixer 50 000 FCFA/mois de revenus pour les 8 mois de mai à décembre 2026 en une seule action. Les mois concernés s'affichent en temps réel avant validation.

Pour chaque période, 4 objectifs possibles :

| Objectif | Ce que ça représente |
|---|---|
| **Objectif revenus (FCFA)** | Montant de recharges à encaisser ce mois |
| **Objectif bénéfice net (FCFA)** | Ce qui doit rester après avoir tout payé |
| **Objectif nouveaux clients** | Nombre de nouveaux inscrits visés |
| **Objectif marge %** | Pourcentage de marge nette cible |

### Les 4 graphes de comparaison

**Graphe 1 — Revenus** : Aire verte (réel) + ligne violet pointillée (objectif). Voir d'un coup d'œil si les revenus suivent la trajectoire prévue.

**Graphe 2 — Bénéfice net** : Barres (vertes si positif, rouges si négatif) + ligne violet pointillée (objectif). Montre si le bénéfice réel atteint la cible fixée.

**Graphe 3 — Nouveaux clients** : Barres violettes claires (objectif) côte à côte avec barres bleues/orange (réel). Voir l'acquisition client vs la cible.

**Graphe 4 — Marge %** : Deux lignes (verte = réelle, violette pointillée = objectif). Suivre l'évolution du taux de marge dans le temps.

### Table de détail mensuel

Affichée en accordion. Pour chaque mois, les colonnes montrent :
- Objectif revenus vs Réel + Écart (FCFA + %)
- Objectif bénéfice net vs Réel + Écart %
- Objectif clients vs Réel
- **Badge statut** :

| Badge | Condition | Signification |
|---|---|---|
| ⭐ Dépassé | +5% ou plus | Objectif largement atteint |
| ✓ Dans les clous | Entre -5% et +5% | Objectif atteint |
| ⚠️ En retard | Entre -20% et -5% | Léger retard |
| 🔴 Loin de l'objectif | -20% ou moins | Retard important |
| — Sans objectif | Aucun objectif défini | Données réelles seulement |

### SYSTEM_ADMIN en lecture seule

Le SYSTEM_ADMIN peut consulter toutes les projections et graphes mais ne peut ni créer, ni modifier, ni supprimer d'objectifs.

---

## 6. Journal d'audit financier

**Accessible uniquement au SYSTEM_ADMIN.** Le FINANCE_AGENT ne peut pas y accéder.

Registre immuable des 200 dernières actions financières. Aucune entrée ne peut être modifiée ou supprimée — c'est une trace permanente.

### Types d'actions enregistrées

| Code | Signification |
|---|---|
| `CREDIT_APPROVE` | Recharge approuvée directement (< 30 000 FCFA) |
| `CREDIT_REJECT` | Recharge refusée par FINANCE_AGENT |
| `CREDIT_PENDING_ADMIN` | Recharge soumise à confirmation admin (≥ 30 000 FCFA) |
| `CREDIT_ADMIN_CONFIRM` | SYSTEM_ADMIN a confirmé une grosse recharge |
| `CREDIT_ADMIN_REJECT` | SYSTEM_ADMIN a annulé une grosse recharge |
| `CREDIT_DIRECT_ADMIN_APPROVE` | SYSTEM_ADMIN a approuvé directement sans passer par FINANCE_AGENT |
| `CREDIT_DIRECT_ADMIN_REJECT` | SYSTEM_ADMIN a refusé directement |
| `INFRA_COST_ADD` | Charge infrastructure ajoutée |
| `INFRA_COST_DELETE` | Charge infrastructure supprimée |

### Informations affichées par entrée

- **Qui a agi** : nom complet + `@username` + rôle
- **Client concerné** : nom + `@username` du client (pour les actions CREDIT_*)
- **Adresse IP** : IP depuis laquelle l'action a été effectuée
- **Montant** : en FCFA avec conversion $ et €
- **Date et heure** : horodatage exact UTC

---

## 7. Authentification 2FA

Le FINANCE_AGENT et le SYSTEM_ADMIN ont une **authentification à deux facteurs obligatoire** à chaque connexion.

### Flux de connexion

```
1. Saisir identifiant + mot de passe
2. Recevoir un code à 6 chiffres par SMS sur le numéro enregistré (valable 10 min)
3. Saisir le code dans l'application pour accéder au compte
```

### Règles de sécurité

| Règle | Valeur |
|---|---|
| Durée de validité du code | 10 minutes |
| Tentatives maximum | 5 avant blocage |
| Rate limit | 5 tentatives/minute |
| Anti-double envoi | Si un code a été envoyé dans les 30 dernières secondes, aucun nouveau SMS |
| En cas de problème | Contacter SYSTEM_ADMIN pour réinitialiser |

---

## 8. Notifications reçues

### FINANCE_AGENT reçoit

| Notification | Déclencheur |
|---|---|
| 💬 Nouvelle demande de recharge | Un client soumet une preuve de paiement |
| ✓ Approbation confirmée | Le SYSTEM_ADMIN a validé une grosse recharge que FINANCE_AGENT avait approuvée |
| ❌ Approbation annulée | Le SYSTEM_ADMIN a refusé une grosse recharge avec le motif |

### SYSTEM_ADMIN reçoit

| Notification | Déclencheur |
|---|---|
| ⚠️ Confirmation requise | FINANCE_AGENT a approuvé une demande ≥ 30 000 FCFA |
| 💬 Nouvelle demande de recharge | Un client soumet une preuve (pour information) |

---

## 9. Paramètres système (SYSTEM_ADMIN)

Page `/admin/systeme` — accessible uniquement au SYSTEM_ADMIN.

### Taux de change

Deux taux configurables :
- **1 USD = X FCFA** (défaut : 600) — taux opérationnel Eolis, utilisé pour les coûts OpenAI
- **1 EUR = X FCFA** (défaut : 655,957) — taux officiel XAF/EUR, modifiable si la parité change

Ces taux sont sauvegardés en base de données et utilisés partout dans l'application pour les conversions affichées.

### Autres paramètres système

- **Fuseau horaire** : configure l'heure affichée dans toute l'application
- **Test SMS Twilio** : envoyer un SMS de test pour vérifier que la configuration est opérationnelle
- **Réinitialisation BDD** : supprime toutes les données opérationnelles (tickets, messages) sans supprimer les comptes — action irréversible, nécessite de taper "RESET"

---

## Récapitulatif — Qui peut faire quoi

| Action | FINANCE_AGENT | SYSTEM_ADMIN |
|---|---|---|
| Voir le dashboard financier | ✅ | ✅ (lecture) |
| Approuver une recharge < 30 000 FCFA | ✅ | ❌ |
| Approuver une recharge ≥ 30 000 FCFA | ✅ (→ pending_admin) | ✅ (direct) |
| Confirmer une pending_admin | ❌ | ✅ |
| Saisir des charges infra | ✅ | ❌ |
| Supprimer des charges infra | ✅ | ❌ |
| Voir le rapport P&L | ✅ | ✅ (lecture) |
| Exporter Excel P&L | ✅ | ✅ |
| Définir des objectifs (projections) | ✅ | ❌ |
| Voir les projections | ✅ | ✅ (lecture) |
| Voir le journal d'audit | ❌ | ✅ |
| Modifier les taux de change | ❌ | ✅ |
| Recevoir les notifs de recharge | ✅ | ✅ (info) |

---

*Document mis à jour le 2026-05-15 — Eolis Connect v2*
