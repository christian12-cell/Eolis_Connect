# FINANCE_AGENT — Guide complet Eolis Connect

> Rôle créé pour séparer la gestion financière de l'administration opérationnelle.  
> Le FINANCE_AGENT est le seul à pouvoir approuver les recharges et gérer les charges.  
> Le SYSTEM_ADMIN a un accès lecture seule + confirmation obligatoire pour les grandes opérations.

---

## Modèle économique

Eolis Connect facture ses clients en **crédits prépayés** : 1 crédit = 1 FCFA.  
Les clients achètent des crédits par mobile money (Orange / MTN), puis les consomment pour utiliser l'IA.

| Opération | Prix client | Coût OpenAI | Marge |
|---|---|---|---|
| Extraction BL | 50 crédits | ~0,60 FCFA | ~98,8% |
| Dictée vocale | 10 cr./min | ~3,60 FCFA/min | ~64% |

**Taux de change**
- 1 USD = 600 FCFA (taux opérationnel Eolis)
- 1 EUR = 655,957 FCFA (taux fixe officiel XAF/EUR)

---

## Pages accessibles

| Page | URL | Action possible |
|---|---|---|
| Tableau de bord | `/finance/dashboard` | Lecture KPIs + alertes |
| Validation crédits | `/finance/credits` | Approuver / Refuser les recharges |
| Revenus & IA | `/finance/revenus` | Analyse coûts IA par usage |
| Charges infra | `/finance/depenses` | Ajouter / Supprimer des charges |
| Rapport P&L | `/finance/rapport` | P&L mensuel + export Excel |
| Journal d'audit | `/finance/audit` | Lecture seule — immuable |
| Notifications | `/agent/notifications` | Alertes de nouvelles recharges |
| Paramètres | `/agent/parametres` | Profil, langue, mot de passe |
| Aide | `/finance/aide` | Ce guide |

---

## Tableau de bord — KPIs

### Ligne 1 — Revenus et coûts

**Revenus recharges**
```
Somme des recharges approuvées sur la période
```
L'argent réellement encaissé. C'est le chiffre d'affaires d'Eolis.

**Prix client (crédits)**
```
Somme des crédits consommés par les clients (en FCFA)
```
Ce que les clients ont utilisé en IA. Peut différer des revenus si des crédits achetés ne sont pas encore utilisés.

**Coûts IA (OpenAI)**
```
Calculé automatiquement à chaque appel API
```
Ce qu'Eolis paie réellement à OpenAI. Automatique, très faible grâce au modèle par usage.

**Charges infra**
```
Somme des charges saisies manuellement sur la période
```
Vercel, Railway, Neon, AWS S3, Twilio, Cloudflare, etc.

### Ligne 2 — Profits

**Bénéfice sur usages IA**
```
Crédits consommés − Coûts OpenAI
```
La marge pure sur l'IA. Ex : client paie 50 cr. (50 FCFA), OpenAI coûte 0,60 FCFA → bénéfice = 49,40 FCFA.

**Bénéfice brut**
```
Revenus recharges − Coûts IA
```
Ce que tu gagnes après OpenAI, avant les frais d'infrastructure.

**Bénéfice net ⭐ (indicateur principal)**
```
Revenus − Coûts IA − Charges infra
```
Ce qui reste réellement dans la poche d'Eolis après TOUT.  
- 🟢 Vert = rentable  
- 🔴 Rouge = dépenses > recettes, à surveiller

### Alertes automatiques

| Alerte | Condition de déclenchement |
|---|---|
| 💬 Demandes en attente | Recharges clients non encore traitées |
| 🚨 Bénéfice net négatif | netProfit < 0 |
| ⚠️ Charges infra élevées | infraCost > 30% des revenus |
| ✅ Excellente marge | marge nette > 50% |

### Graphes

**Évolution revenus & coûts** — Courbe verte (revenus), rouge (coûts totaux), bleue pointillée (crédits consommés).  
Si la bleue dépasse la verte : les clients consomment plus qu'ils n'ont rechargé récemment (possible via crédits offerts à l'inscription).

**Bénéfice net par mois** — Barres violet (positif) / rouge (négatif) + ligne jaune (marge %).

---

## Validation crédits

### Flux complet

```
1. Client soumet preuve de paiement (screenshot SMS Mobile Money)
2. FINANCE_AGENT reçoit notification
3. FINANCE_AGENT ouvre le justificatif (obligatoire avant de valider)
4. FINANCE_AGENT entre le montant reçu
5a. Montant < 100 000 FCFA → crédités immédiatement au client
5b. Montant ≥ 100 000 FCFA → statut "pending_admin" → SYSTEM_ADMIN doit confirmer
```

### Règles de sécurité (non modifiables)

- **Cap strict 1×** : montant approuvé ≤ montant déclaré par le client
- **Principe 4 yeux** : ≥ 100 000 FCFA nécessite confirmation SYSTEM_ADMIN
- **Rate limit** : max 10 approbations/minute
- **Audit immuable** : toute action est logguée avec IP, heure, montant
- **2FA obligatoire** : connexion protégée par code SMS à chaque login

### Codes USSD de référence (pour vérifier)
- Orange Money : `#150#`
- MTN Mobile Money : `*126#`

---

## Charges infrastructure

À saisir chaque mois dans **Charges infra** dès réception des factures.

| Catégorie | Service | Usage |
|---|---|---|
| `vercel` | Vercel | Hébergement frontend Next.js |
| `railway` | Railway | Hébergement API FastAPI |
| `neon` | Neon | Base de données PostgreSQL |
| `aws_s3` | AWS S3 | Stockage fichiers / justificatifs |
| `twilio` | Twilio | OTP 2FA + notifications SMS |
| `cloudflare` | Cloudflare | DNS / protection DDoS |
| `domain` | Registrar | Nom de domaine |
| `openai` | OpenAI | Abonnement forfait si applicable |
| `maintenance` | — | Interventions manuelles |
| `other` | — | Autres charges |

**Format période** : `YYYY-MM` (ex: `2026-05`)

---

## Rapport P&L

Tableau mensuel : Mois | Revenus | Coûts IA | Charges infra | Coûts totaux | Bénéfice brut | Bénéfice net | Marge %

**Filtres disponibles**
- Période (jour / semaine / mois / année / tout)
- Urgence des dossiers (HIGH / MEDIUM / LOW)

**Prévision mois suivant**
Calculée par régression linéaire sur les données historiques. Indicatif uniquement.

**Export Excel (.xlsx)**
Génère un fichier formaté : titre fusionné bleu marine, en-têtes colorés, lignes vertes/rouges selon bénéfice, ligne TOTAL, chiffres avec séparateurs de milliers. Respecte les filtres actifs.

---

## Journal d'audit financier

Enregistrement immuable des 200 dernières actions financières.

| Type | Description |
|---|---|
| `CREDIT_APPROVE` | Recharge approuvée (< 100 000 FCFA) |
| `CREDIT_REJECT` | Recharge refusée |
| `CREDIT_PENDING_ADMIN` | Recharge soumise à confirmation admin (≥ 100 000 FCFA) |
| `CREDIT_ADMIN_CONFIRM` | SYSTEM_ADMIN a confirmé la grosse recharge |
| `CREDIT_ADMIN_REJECT` | SYSTEM_ADMIN a annulé la grosse recharge |
| `INFRA_COST_ADD` | Charge infra ajoutée |
| `INFRA_COST_DELETE` | Charge infra supprimée |

Chaque entrée contient : qui a agi, son rôle, l'IP, le montant, la date/heure.

---

## 2FA — Authentification à deux facteurs

Le FINANCE_AGENT (et SYSTEM_ADMIN) doit valider un code SMS à chaque connexion.

```
1. Saisir identifiant + mot de passe
2. Recevoir code à 6 chiffres par SMS (valable 10 min)
3. Saisir le code pour accéder au compte
```

- Max 5 tentatives avant blocage
- Rate limit : 5 tentatives/minute
- En cas de problème : contacter SYSTEM_ADMIN pour réinitialiser

---

## Notifications reçues par FINANCE_AGENT

| Type | Déclencheur |
|---|---|
| Nouvelle demande de recharge | Client soumet une preuve |
| Approbation confirmée ✓ | SYSTEM_ADMIN a validé une grosse recharge |
| Approbation annulée | SYSTEM_ADMIN a rejeté une grosse recharge |

---

*Document généré le 2026-05-15 — Eolis Connect*
