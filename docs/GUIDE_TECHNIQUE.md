# Guide Technique Complet — Eolis Connect
> Pour développeur débutant — explique tout le système, comment le modifier et le maintenir.

---

## TABLE DES MATIÈRES
1. [Comprendre le système](#1-comprendre-le-système)
2. [Les outils utilisés](#2-les-outils-utilisés)
3. [Workflow Git — Comment faire des modifications](#3-workflow-git--comment-faire-des-modifications)
4. [Structure des fichiers](#4-structure-des-fichiers)
5. [La base de données — Modèles](#5-la-base-de-données--modèles)
6. [Le Backend FastAPI — Routes API](#6-le-backend-fastapi--routes-api)
7. [Le Frontend Next.js — Pages et composants](#7-le-frontend-nextjs--pages-et-composants)
8. [Comment modifier les catégories et sous-catégories](#8-comment-modifier-les-catégories-et-sous-catégories)
9. [Comment modifier les degrés d'urgence](#9-comment-modifier-les-degrés-durgence)
10. [Comment rendre un champ obligatoire](#10-comment-rendre-un-champ-obligatoire)
11. [Comment ajouter un nouveau champ](#11-comment-ajouter-un-nouveau-champ)
11. [Comment déployer après une modification](#11-comment-déployer-après-une-modification)
12. [Variables d'environnement — Référence complète](#12-variables-denvironnement--référence-complète)
13. [Erreurs fréquentes et solutions](#13-erreurs-fréquentes-et-solutions)
14. [Comment accéder aux logs](#14-comment-accéder-aux-logs)
15. [Base de données — Requêtes utiles](#15-base-de-données--requêtes-utiles)

---

## 1. Comprendre le système

### Architecture globale
```
Utilisateur
    ↓
https://eolisconnect.online
    ↓
Cloudflare (CDN — accélération + protection)
    ↓
Vercel (Frontend Next.js — ce que l'utilisateur voit)
    ↓
Railway (Backend FastAPI — la logique métier)
    ↓
Neon (Base de données PostgreSQL — les données)
```

### Flux d'une requête typique
```
1. Le client clique "Soumettre une demande"
2. Next.js (Vercel) appelle l'API FastAPI (Railway) via apiFetch()
3. FastAPI vérifie le token JWT, valide les données
4. FastAPI enregistre dans la base Neon
5. FastAPI envoie un email/SMS de confirmation (Zoho/Twilio)
6. FastAPI retourne la réponse JSON
7. Next.js affiche la confirmation au client
```

### Les rôles utilisateurs
| Rôle | Valeur en BDD | Ce qu'il peut faire |
|------|---------------|---------------------|
| Client | `CLIENT` | Créer des tickets, chatter, noter |
| Agent | `AGENT` | Traiter des tickets, envoyer des messages |
| OPS Admin | `OPS_ADMIN` | Comme agent + dashboard stats équipe |
| Admin système | `SYSTEM_ADMIN` | Tout + gestion des utilisateurs |

---

## 2. Les outils utilisés

### Frontend
| Outil | Version | Rôle |
|-------|---------|------|
| **Next.js** | 16.2.5 | Framework React — pages, routing, SSR |
| **React** | 19 | Bibliothèque UI |
| **Tailwind CSS** | 4 | Classes CSS utilitaires pour le design |
| **Recharts** | — | Graphiques (barres, courbes, camemberts) |
| **Lucide React** | — | Icônes (Bell, Star, Check, etc.) |
| **next-intl** | — | Internationalisation FR/EN |
| **TypeScript** | — | JavaScript avec types |

### Backend
| Outil | Version | Rôle |
|-------|---------|------|
| **FastAPI** | — | Framework API Python |
| **SQLAlchemy** | 2.x | ORM — interface Python ↔ base de données |
| **Pydantic** | 2.x | Validation des données entrantes |
| **python-jose** | — | Génération/vérification des tokens JWT |
| **passlib + bcrypt** | — | Hashage des mots de passe |
| **Twilio** | — | Envoi de SMS |
| **boto3** | — | Client AWS S3 pour les fichiers |

### Infrastructure
| Service | Usage |
|---------|-------|
| **GitHub** | Stockage du code source |
| **Railway** | Hébergement du backend (Docker) |
| **Vercel** | Hébergement du frontend (serverless) |
| **Neon** | Base de données PostgreSQL cloud |
| **Cloudflare** | CDN, DNS, protection DDoS |
| **Namecheap** | Registrar du domaine eolisconnect.online |
| **Zoho Mail** | Serveur SMTP pour les emails |

---

## 3. Workflow Git — Comment faire des modifications

### Prérequis
Avoir Git installé et le repo cloné localement :
```bash
git clone https://github.com/christian12-cell/Eolis_Connect.git
cd Eolis_Connect
```

### Workflow standard (à suivre à chaque modification)

```bash
# 1. Vérifier l'état actuel
git status
# Montre les fichiers modifiés (rouge = non suivi, vert = prêt à commit)

# 2. Voir ce qui a changé dans un fichier
git diff eolis-connect/src/app/[locale]/(client)/nouvelle-demande/page.tsx

# 3. Ajouter les fichiers modifiés
git add eolis-connect/src/app/[locale]/\(client\)/nouvelle-demande/page.tsx
# OU ajouter tous les fichiers modifiés :
git add -A

# 4. Créer un commit (snapshot de la modification)
git commit -m "feat: ajouter la catégorie Réclamation"
# Le message doit être court et descriptif

# 5. Envoyer sur GitHub
git push

# 6. Déployer (Railway se redéploie seul, Vercel aussi si connecté)
```

### Conventions pour les messages de commit
```
feat: nouvelle fonctionnalité
fix: correction de bug
docs: modification de documentation
style: changement de design/CSS
refactor: réécriture de code sans changer le comportement
```

### En cas d'erreur git
```bash
# Annuler les modifications non commitées d'un fichier
git checkout -- nom-du-fichier.tsx

# Voir l'historique des commits
git log --oneline -10

# Revenir à un commit précédent (ATTENTION : destructif)
git reset --hard abc1234
```

---

## 4. Structure des fichiers

```
EolisProject/
├── Dockerfile                    ← Build du container Railway
├── railway.toml                  ← Config Railway
├── .gitignore                    ← Fichiers exclus de git
├── docs/                         ← Cette documentation
│
├── eolis-api/                    ← BACKEND PYTHON
│   ├── requirements.txt          ← Dépendances Python
│   ├── Procfile                  ← Commande de démarrage
│   └── app/
│       ├── main.py               ← Point d'entrée FastAPI
│       ├── config.py             ← Lecture des variables d'env
│       ├── database.py           ← Connexion PostgreSQL
│       ├── models.py             ← Tables de la base de données
│       ├── schemas.py            ← Validation entrée/sortie API
│       ├── security.py           ← JWT + hashage mots de passe
│       ├── mail.py               ← Envoi d'emails (Zoho)
│       ├── sms.py                ← Envoi de SMS (Twilio)
│       └── routers/              ← Routes API (endpoints)
│           ├── auth.py           → POST /api/auth/login
│           ├── tickets.py        → CRUD /api/tickets
│           ├── messages.py       → CRUD /api/tickets/{id}/messages
│           ├── notifications.py  → GET/POST /api/notifications
│           ├── users.py          → CRUD /api/users
│           ├── ratings.py        → POST /api/tickets/{id}/ratings
│           ├── attachments.py    → POST/GET /api/attachments
│           ├── faq.py            → CRUD /api/faq
│           ├── admin_logs.py     → GET /api/logs
│           └── otp.py            → POST /api/otp/send
│
└── eolis-connect/                ← FRONTEND NEXT.JS
    ├── next.config.ts            ← Config Next.js
    ├── package.json              ← Dépendances Node.js
    ├── tsconfig.json             ← Config TypeScript
    ├── public/                   ← Fichiers statiques
    │   ├── logo.png              ← Logo de l'app
    │   ├── manifest.json         ← Config PWA
    │   └── sw.js                 ← Service Worker (offline)
    └── src/
        ├── app/                  ← Pages (App Router Next.js)
        │   ├── layout.tsx        ← Layout racine (splash screen)
        │   ├── globals.css       ← CSS global
        │   └── [locale]/         ← Pages par langue
        │       ├── layout.tsx    ← Layout locale (next-intl)
        │       ├── page.tsx      ← Page racine → redirect
        │       ├── login/        ← Page connexion
        │       ├── register/     ← Page inscription
        │       ├── (client)/     ← Pages réservées aux clients
        │       │   ├── accueil/      ← Dashboard client
        │       │   ├── mes-demandes/ ← Liste des tickets
        │       │   │   └── [id]/     ← Détail d'un ticket
        │       │   ├── nouvelle-demande/ ← Créer un ticket
        │       │   └── parametres/   ← Profil client
        │       ├── (agent)/      ← Pages agents
        │       │   ├── agent/dashboard/   ← Dashboard agent
        │       │   ├── agent/dossiers/[id]/ ← Traitement ticket
        │       │   ├── agent/historique/    ← Historique clôturés
        │       │   ├── agent/notifications/ ← Notifications
        │       │   └── agent/parametres/    ← Profil agent
        │       ├── (ops)/        ← Pages OPS Admin
        │       │   ├── ops/dashboard/      ← Dashboard stats
        │       │   ├── ops/performances/   ← Perfs par agent
        │       │   └── ops/classement/     ← Classement équipe
        │       └── (auth)/       ← Pages auth partagées
        │           ├── forgot-password/
        │           └── reset-password/
        ├── components/           ← Composants réutilisables
        │   ├── layout/
        │   │   ├── DashboardLayout.tsx  ← Layout des dashboards
        │   │   ├── MobileLayout.tsx     ← Layout mobile client
        │   │   ├── Navbar.tsx           ← Barre de navigation
        │   │   └── Sidebar.tsx          ← Menu latéral
        │   ├── ui/
        │   │   ├── LoadingScreen.tsx    ← Écran de chargement
        │   │   ├── NavigationSplash.tsx ← Animation navigation
        │   │   ├── SplashHider.tsx      ← Cache le splash initial
        │   │   └── OfflineBanner.tsx    ← Bannière hors ligne
        │   └── scanner/
        │       └── ScannerModal.tsx     ← Scanner QR/code
        └── lib/
            ├── api-client.ts     ← apiFetch(), getUser(), getToken()
            ├── offline-db.ts     ← IndexedDB pour le mode offline
            ├── offline-sync.ts   ← Synchronisation offline
            └── utils.ts          ← Fonctions utilitaires
```

---

## 5. La base de données — Modèles

Tous les modèles sont dans `eolis-api/app/models.py`.

### Table `users` — Utilisateurs
```python
id           : UUID unique (clé primaire)
first_name   : Prénom
last_name    : Nom
username     : Identifiant unique de connexion
email        : Email unique
phone        : Téléphone (optionnel)
phone_verified: Téléphone vérifié ? (boolean)
password_hash: Mot de passe hashé (jamais en clair)
role         : "CLIENT" | "AGENT" | "OPS_ADMIN" | "SYSTEM_ADMIN"
status       : "ACTIVE" | "PENDING" | "SUSPENDED"
language     : "fr" | "en"
created_at   : Date de création
```

### Table `tickets` — Dossiers
```python
id           : UUID unique
ref          : Référence lisible (ex: ELS-2026-001)
client_id    : ID de l'utilisateur client (clé étrangère → users)
agent_id     : ID de l'agent assigné (nullable)
category     : Catégorie principale (ex: "Livraison")
subcategory  : Sous-catégorie (ex: "Retard de livraison")
equipment_type: Type d'équipement (ex: "20 pieds")
ship_line    : Compagnie maritime
ship_name    : Nom du navire
voyage_number: Numéro de voyage
ship_date    : Date d'embarquement
code         : Code conteneur
vessel_data  : Données navire (JSON sérialisé)
description  : Description du problème
urgency      : "HIGH" | "MEDIUM" | "LOW"
status       : "PENDING" | "IN_PROGRESS" | "CLOSED"
created_at   : Date de création
taken_at     : Date de prise en charge par l'agent
closed_at    : Date de clôture
```

### Table `messages` — Messages
```python
id               : UUID unique
ticket_id        : Ticket concerné
sender_id        : Expéditeur
sender_type      : "CLIENT" | "AGENT" | "INTERNAL_NOTE" |
                   "DOCUMENT_REQUEST" | "FINAL_RESPONSE" | "SYSTEM"
content          : Contenu du message
document_description: Description si demande de docs
is_read          : Lu ? (boolean)
read_at          : Date de lecture
created_at       : Date d'envoi
```

### Table `notifications` — Notifications
```python
id        : UUID unique
user_id   : Destinataire
ticket_id : Ticket concerné (nullable)
type      : "MENTION" | "FINAL_UNREAD" | "CLIENT_MSG_UNREAD" |
            "INTERNAL_NOTE" | "DOCS_SUBMITTED" | "NEW_MESSAGE"
title     : Titre de la notification
message   : Corps de la notification
is_read   : Lue ? (boolean)
created_at: Date de création
```

### Table `satisfaction_ratings` — Évaluations
```python
id        : UUID unique
ticket_id : Ticket évalué (unique — 1 note par ticket)
client_id : Client qui note
agent_id  : Agent noté
score     : Note de 1 à 5
comment   : Commentaire optionnel
created_at: Date de la note
```

### Table `attachments` — Pièces jointes
```python
id        : UUID unique
ticket_id : Ticket concerné
message_id: Message associé (nullable)
filename  : Nom du fichier
url       : URL de téléchargement
size      : Taille en octets
mime_type : Type MIME (ex: "image/jpeg")
source    : Contexte (ex: "ticket_creation")
```

---

## 6. Le Backend FastAPI — Routes API

La documentation interactive est disponible sur :
**https://eolisconnect-production.up.railway.app/docs**

### Authentification (`routers/auth.py`)
```
POST /api/auth/login          ← Connexion → retourne token JWT
POST /api/auth/register       ← Inscription client
POST /api/auth/forgot-password← Demande reset mot de passe
POST /api/auth/reset-password ← Reset avec token email
```

### Tickets (`routers/tickets.py`)
```
GET  /api/tickets             ← Liste des tickets (filtrés par rôle)
POST /api/tickets             ← Créer un ticket
GET  /api/tickets/{id}        ← Détail d'un ticket
PATCH /api/tickets/{id}       ← Modifier (statut, agent, urgence)
```

### Messages (`routers/messages.py`)
```
GET  /api/tickets/{id}/messages       ← Lister les messages
POST /api/tickets/{id}/messages       ← Envoyer un message
POST /api/tickets/{id}/messages/mark-read ← Marquer comme lu
```

### Notifications (`routers/notifications.py`)
```
GET  /api/notifications              ← Mes notifications
PATCH /api/notifications/{id}/read  ← Marquer une comme lue
POST /api/notifications/mark-all-read ← Tout marquer comme lu
GET  /api/notifications/unread-count ← Nombre non lues
POST /api/notifications/check-final-unread ← Vérifier réponses non lues
```

### Utilisateurs (`routers/users.py`)
```
GET  /api/users               ← Liste des utilisateurs (admin)
POST /api/users               ← Créer un utilisateur (admin)
PATCH /api/users/{id}         ← Modifier un utilisateur
DELETE /api/users/{id}        ← Supprimer un utilisateur
```

### Évaluations (`routers/ratings.py`)
```
POST /api/tickets/{id}/ratings ← Noter un ticket clôturé
GET  /api/ratings             ← Liste des notes (admin/ops)
```

### Pièces jointes (`routers/attachments.py`)
```
POST /api/attachments         ← Uploader un fichier
GET  /api/attachments/{id}    ← Télécharger un fichier
```

---

## 7. Le Frontend Next.js — Pages et composants

### `src/lib/api-client.ts` — Le fichier le plus important
C'est ici que se fait toute la communication avec le backend.

```typescript
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
// → URL du backend Railway

export async function apiFetch(path: string, options = {}) {
  // Récupère le token JWT du localStorage
  // Ajoute Authorization: Bearer <token> dans les headers
  // Appelle l'API FastAPI
  // Cache en IndexedDB pour le mode offline
}

export function getUser() {
  // Retourne l'utilisateur connecté depuis localStorage
  // { id, firstName, lastName, role, email, ... }
}

export function getToken() {
  // Retourne le token JWT depuis localStorage
}
```

**Usage dans une page :**
```typescript
const res = await apiFetch('/api/tickets')
const data = await res.json()
```

### `src/app/[locale]/(client)/nouvelle-demande/page.tsx`
Formulaire de création de ticket en plusieurs étapes (wizard) :
- **Étape 1** : Catégorie + sous-catégorie
- **Étape 2** : Type d'équipement
- **Étape 3** : Informations logistiques (navire, voyage...)
- **Étape 4** : Description + pièces jointes
- **Étape 5** : Récapitulatif + soumission

### `src/components/layout/Navbar.tsx`
- Affiche le compteur de notifications non lues (🔔)
- Rafraîchit le compteur toutes les 15 secondes
- Gère le dropdown de notifications

### `src/components/layout/Sidebar.tsx`
- Menu latéral des dashboards
- Affiche des liens différents selon le rôle (`AGENT`, `OPS_ADMIN`, `SYSTEM_ADMIN`)

### `src/components/layout/DashboardLayout.tsx`
- Wraps toutes les pages de dashboard
- Vérifie l'authentification au chargement
- Compose Sidebar + Navbar + contenu

### `src/components/ui/NavigationSplash.tsx`
- Affiche l'animation "Eolis Connect" à chaque changement de page
- Détecte les changements de route via `usePathname()`
- Durée : 800ms + fondu 400ms

---

## 8. Comment modifier les catégories et sous-catégories

Les catégories sont définies dans le fichier :
**`eolis-connect/src/app/[locale]/(client)/nouvelle-demande/page.tsx`**

### Ligne 17-33 — Les catégories et sous-catégories

```typescript
// ── Catégories en français ──────────────────────────────────────────
const CATEGORIES_FR = ['Livraison', 'Facturation', 'Dossier', 'Information', 'Autre']

// ── Catégories en anglais ───────────────────────────────────────────
const CATEGORIES_EN = ['Delivery', 'Billing', 'File', 'Information', 'Other']

// ── Sous-catégories en français ─────────────────────────────────────
const SUBCATEGORIES_FR: Record<string, string[]> = {
  Livraison:   ['Conteneur bloqué', 'Retard de livraison', 'Problème à la réception', 'Autre'],
  Facturation: ['Retard de paiement', 'Paiement incomplet', 'Remboursement', 'Autre'],
  Dossier:     ['Dossier incomplet', 'Document manquant', 'Validation de dossier', 'Autre'],
  Information: ["Demande d'information", 'Procédure', 'Autre'],
  Autre:       [],
}

// ── Sous-catégories en anglais ──────────────────────────────────────
const SUBCATEGORIES_EN: Record<string, string[]> = {
  Delivery:    ['Blocked container', 'Delivery delay', 'Reception issue', 'Other'],
  Billing:     ['Late payment', 'Incomplete payment', 'Refund', 'Other'],
  File:        ['Incomplete file', 'Missing document', 'File validation', 'Other'],
  Information: ['Information request', 'Procedure', 'Other'],
  Other:       [],
}
```

### Exemple : Ajouter la catégorie "Réclamation"

**Étape 1** — Ajouter dans `CATEGORIES_FR` et `CATEGORIES_EN` :
```typescript
const CATEGORIES_FR = ['Livraison', 'Facturation', 'Dossier', 'Information', 'Réclamation', 'Autre']
const CATEGORIES_EN = ['Delivery', 'Billing', 'File', 'Information', 'Complaint', 'Other']
```

**Étape 2** — Ajouter dans `SUBCATEGORIES_FR` et `SUBCATEGORIES_EN` :
```typescript
const SUBCATEGORIES_FR: Record<string, string[]> = {
  // ... existant ...
  Réclamation: ['Prestation non conforme', 'Délai non respecté', 'Erreur de facturation', 'Autre'],
}

const SUBCATEGORIES_EN: Record<string, string[]> = {
  // ... existant ...
  Complaint: ['Non-compliant service', 'Deadline not met', 'Billing error', 'Other'],
}
```

> ⚠️ La clé dans `SUBCATEGORIES_FR` doit correspondre exactement à la valeur dans `CATEGORIES_FR`.

**Étape 3** — Commit et push :
```bash
git add eolis-connect/src/app/\[locale\]/\(client\)/nouvelle-demande/page.tsx
git commit -m "feat: ajouter la catégorie Réclamation"
git push
```

### Exemple : Ajouter une sous-catégorie dans "Livraison"

```typescript
const SUBCATEGORIES_FR: Record<string, string[]> = {
  Livraison: [
    'Conteneur bloqué',
    'Retard de livraison',
    'Problème à la réception',
    'Livraison au mauvais endroit',  // ← Nouvelle sous-catégorie
    'Autre'
  ],
  // ...
}
```

---

## 9. Comment modifier les degrés d'urgence

### Comment ça fonctionne
Le degré d'urgence est attribué **automatiquement** par le système selon la catégorie et la sous-catégorie choisies par le client. Le client ne choisit pas lui-même son urgence.

**Fichier concerné :** `eolis-connect/src/lib/utils.ts` — fonction `getUrgency()` (lignes 14-56)

### La table de correspondance actuelle
```
Livraison → Conteneur bloqué         = 🔴 HIGH
Livraison → Retard de livraison       = 🔴 HIGH
Livraison → Problème à la réception   = 🔴 HIGH

Facturation → Retard de paiement      = 🟡 MEDIUM
Facturation → Paiement incomplet      = 🟡 MEDIUM
Facturation → Remboursement           = 🟢 LOW

Dossier → Dossier incomplet           = 🟡 MEDIUM
Dossier → Document manquant           = 🟡 MEDIUM
Dossier → Validation de dossier       = 🟢 LOW

Information → Demande d'information   = 🟢 LOW
Information → Procédure               = 🟢 LOW

Tout le reste (Autre, non défini...)  = 🟢 LOW  ← valeur par défaut
```

### Modifier l'urgence d'une sous-catégorie existante
Dans `eolis-connect/src/lib/utils.ts`, modifiez la valeur `'HIGH'`, `'MEDIUM'` ou `'LOW'` :
```typescript
Facturation: {
  'Retard de paiement': 'HIGH',    // ← était MEDIUM, on le passe en HIGH
  'Paiement incomplet': 'MEDIUM',
  Remboursement:        'LOW',
},
```

### Ajouter une nouvelle catégorie avec ses urgences
Quand vous ajoutez une catégorie (voir section 8), ajoutez aussi son bloc dans `getUrgency()` :
```typescript
// Dans utils.ts → getUrgency()
Réclamation: {
  'Prestation non conforme': 'HIGH',
  'Délai non respecté':      'MEDIUM',
  'Erreur de facturation':   'LOW',
},
// Et en anglais aussi :
Complaint: {
  'Non-compliant service': 'HIGH',
  'Deadline not met':      'MEDIUM',
  'Billing error':         'LOW',
},
```

> ⚠️ Le nom de clé (`Réclamation`) doit être **exactement identique** à la valeur dans `CATEGORIES_FR`.
> ⚠️ Si une sous-catégorie n'est pas listée ici, elle recevra automatiquement `LOW`.

### Modifier manuellement l'urgence d'un ticket existant
Un agent ou OPS Admin peut modifier l'urgence d'un ticket via l'interface. Côté API :
```
PATCH /api/tickets/{id}
Body: { "urgency": "HIGH" }
```

### Commit après modification
```bash
git add eolis-connect/src/lib/utils.ts
git commit -m "fix: modifier urgences selon nouvelles règles"
git push
```

---

## 10. Comment rendre un champ obligatoire

### Le composant `<Req />`
Dans le fichier `nouvelle-demande/page.tsx`, il y a un petit composant :
```typescript
const Req = () => <span className="text-red-400 ml-0.5">*</span>
```
Cela affiche une étoile rouge `*` après le label d'un champ.

### Utilisation dans un label
```tsx
<label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
  Nom du navire <Req />   {/* ← l'étoile rouge apparaît ici */}
</label>
```

### Rendre un champ vraiment obligatoire (validation)
L'étoile rouge est visuelle. Pour bloquer la soumission si le champ est vide, il faut aussi ajouter une validation.

Cherchez la fonction de validation dans la page (généralement `canProceed()` ou `validate()`) :
```typescript
// Exemple — bloquer si shipName est vide
const canProceed = () => {
  if (!form.shipName.trim()) return false  // ← ajouter cette condition
  // ... autres conditions
  return true
}
```

### Rendre un champ obligatoire côté backend aussi
Dans `eolis-api/app/schemas.py`, changez un champ de `Optional[str]` à `str` :

```python
# AVANT (optionnel)
ship_name: Optional[str] = None

# APRÈS (obligatoire)
ship_name: str
```

> ⚠️ Si vous rendez un champ obligatoire en backend, assurez-vous que le frontend l'envoie toujours.

---

## 11. Comment ajouter un nouveau champ

Exemple complet : ajouter un champ "Port de destination" au formulaire de ticket.

### Étape 1 — Ajouter dans la base de données (`models.py`)
```python
# Dans la classe Ticket
destination_port: Mapped[str | None] = mapped_column(String(100), nullable=True)
```

### Étape 2 — Ajouter dans les schémas (`schemas.py`)
```python
# Dans TicketCreateRequest
destination_port: Optional[str] = None

# Dans TicketResponse
destination_port: Optional[str]
```

### Étape 3 — Gérer dans le routeur (`routers/tickets.py`)
```python
# Dans la création de ticket
new_ticket = Ticket(
    # ...existant...
    destination_port=body.destination_port,
)
```

### Étape 4 — Ajouter dans le formulaire frontend
Dans `nouvelle-demande/page.tsx`, ajouter dans `FormState` :
```typescript
interface FormState {
  // ...existant...
  destinationPort: string
}
```

Initialisation :
```typescript
const [form, setForm] = useState<FormState>({
  // ...existant...
  destinationPort: '',
})
```

Afficher le champ dans le JSX :
```tsx
<div>
  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
    Port de destination
  </label>
  <input
    type="text"
    value={form.destinationPort}
    onChange={e => setForm(prev => ({ ...prev, destinationPort: e.target.value }))}
    className="w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-sm focus:outline-none focus:border-[#1B3A5C]"
    placeholder="Ex: Douala"
  />
</div>
```

Inclure dans la soumission :
```typescript
const payload = {
  // ...existant...
  destinationPort: form.destinationPort || undefined,
}
```

---

## 12. Comment déployer après une modification

### Backend (eolis-api/)
```bash
# 1. Modifier les fichiers
# 2. Pousser sur GitHub
git add eolis-api/
git commit -m "feat: ..."
git push

# 3. Railway → ton service → Deploy (bouton bleu)
# OU Railway redéploie automatiquement si connecté à GitHub
```

### Frontend (eolis-connect/)
```bash
# 1. Modifier les fichiers
# 2. Pousser sur GitHub
git add eolis-connect/
git commit -m "feat: ..."
git push

# 3. Vercel redéploie automatiquement
# Si non : Vercel → projet → Deployments → Redeploy
```

### Vérifier que le déploiement a réussi
- **Railway** : Deploy Logs doit finir par `Application startup complete`
- **Vercel** : Status doit être `Ready` (point vert)

---

## 12. Variables d'environnement — Référence complète

### Backend — Railway Variables

| Variable | Valeur exemple | Obligatoire | Rôle |
|----------|---------------|-------------|------|
| `DATABASE_URL` | `postgresql://user:pass@host/db` | ✅ | Connexion Neon |
| `SECRET_KEY` | `une-longue-chaine-aleatoire` | ✅ | Signature JWT |
| `ALLOWED_ORIGINS` | `https://eolisconnect.online` | ✅ | CORS |
| `PORT` | `8080` | ✅ | Port uvicorn |
| `MAIL_ENABLED` | `true` | ❌ | Activer emails |
| `MAIL_SERVER` | `smtp.zoho.eu` | ❌ | Serveur SMTP |
| `MAIL_PORT` | `587` | ❌ | Port SMTP |
| `MAIL_NOREPLY_FROM` | `noreply@eolisconnect.online` | ❌ | Email expéditeur |
| `MAIL_NOREPLY_PASSWORD` | `votre-mot-de-passe` | ❌ | Mot de passe SMTP |
| `MAIL_SUPPORT_FROM` | `support@eolisconnect.online` | ❌ | Email support |
| `ADMIN_EMAIL` | `admin@eolisconnect.online` | ❌ | Email admin |
| `TWILIO_ENABLED` | `true` | ❌ | Activer SMS |
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxx` | ❌ | Compte Twilio |
| `TWILIO_AUTH_TOKEN` | `votre-token` | ❌ | Token Twilio |
| `TWILIO_FROM_NUMBER` | `+1234567890` | ❌ | Numéro Twilio |
| `USE_S3` | `false` | ❌ | Activer S3 |
| `AWS_ACCESS_KEY_ID` | `AKIAxxxxxxxx` | ❌ | Clé AWS |
| `AWS_SECRET_ACCESS_KEY` | `votre-secret` | ❌ | Secret AWS |
| `AWS_REGION` | `eu-west-3` | ❌ | Région S3 |
| `AWS_S3_BUCKET` | `eolis-uploads` | ❌ | Nom du bucket |

### Frontend — Vercel Environment Variables

| Variable | Valeur | Rôle |
|----------|--------|------|
| `NEXT_PUBLIC_API_URL` | `https://eolisconnect-production.up.railway.app` | URL backend |
| `NEXTAUTH_SECRET` | `une-longue-chaine` | Sécurité session |
| `NEXTAUTH_URL` | `https://eolisconnect.online` | URL frontend |

---

## 13. Erreurs fréquentes et solutions

### ❌ Railway — `DATABASE_URL Field required`
**Cause :** Variable manquante.
**Solution :** Railway → Variables → ajouter `DATABASE_URL`.

### ❌ Railway — `Invalid value for '--port': '$PORT'`
**Cause :** Variable `PORT` non définie.
**Solution :** Railway → Variables → ajouter `PORT=8080`.

### ❌ Railway — `ModuleNotFoundError`
**Cause :** Package Python manquant dans requirements.txt.
**Solution :** Ajouter le package dans `eolis-api/requirements.txt` et redéployer.

### ❌ Vercel — Build failed (TypeScript error)
**Cause :** Erreur de type TypeScript.
**Solution :** Vérifier `eolis-connect/next.config.ts` contient :
```typescript
typescript: { ignoreBuildErrors: true }
```

### ❌ Frontend — "An error occurred"
**Cause 1** : Le backend Railway est down.
**Vérification** : Aller sur `https://eolisconnect-production.up.railway.app/docs` — si ça ne charge pas, le backend est down.
**Solution** : Railway → Deployments → Deploy.

**Cause 2** : CORS — l'URL du frontend n'est pas autorisée.
**Vérification** : F12 → Console → chercher "CORS" en rouge.
**Solution** : Railway → Variables → `ALLOWED_ORIGINS` → ajouter l'URL.

### ❌ Frontend — Page blanche sans erreur visible
**Solution** :
1. F12 → Console → lire les erreurs rouges
2. F12 → Network → chercher les requêtes en rouge (erreur 401, 500...)
3. Vérifier que le token est présent : F12 → Application → Local Storage → `eolis_token`

### ❌ Login échoue — "An error occurred"
**Cause 1** : Backend down → voir ci-dessus.
**Cause 2** : Mauvais identifiants.
**Cause 3** : Compte en statut "PENDING" → admin doit l'activer.

### ❌ Notifications ne s'affichent pas
**Cause** : L'URL Vercel n'est pas dans `ALLOWED_ORIGINS`.
**Solution** : Railway → Variables → `ALLOWED_ORIGINS` → ajouter `https://eolisconnect.online`.

---

## 14. Comment accéder aux logs

### Logs Railway (backend)
1. Aller sur **railway.app**
2. Cliquer sur votre projet → service `supportive-beauty`
3. Onglet **Deploy Logs** : logs de démarrage et erreurs
4. Onglet **HTTP Logs** : toutes les requêtes reçues avec code de statut

**Codes de statut HTTP importants :**
- `200` : Succès
- `201` : Créé avec succès
- `400` : Données invalides envoyées
- `401` : Non authentifié (token manquant ou expiré)
- `403` : Accès refusé (pas les permissions)
- `404` : Ressource non trouvée
- `500` : Erreur serveur (bug dans le code)

### Logs Vercel (frontend)
1. Aller sur **vercel.com** → projet `eolis-connect`
2. Onglet **Deployments** → cliquer le dernier déploiement
3. **Build Logs** : erreurs pendant la compilation
4. **Functions** : erreurs des fonctions serveur

### Logs via la console navigateur (F12)
1. Ouvrir l'app dans Chrome
2. Appuyer sur **F12**
3. Onglet **Console** : erreurs JavaScript
4. Onglet **Network** : toutes les requêtes vers l'API (chercher celles en rouge)

---

## 15. Base de données — Requêtes utiles

Accès via **console.neon.tech** → votre projet → **SQL Editor**.

### Voir tous les utilisateurs
```sql
SELECT id, username, email, role, status, created_at
FROM users
ORDER BY created_at DESC;
```

### Activer un compte en attente
```sql
UPDATE users
SET status = 'ACTIVE'
WHERE username = 'nom_utilisateur';
```

### Réinitialiser le mot de passe admin
Le backend recrée automatiquement le SYSTEM_ADMIN au démarrage si aucun n'existe.
Pour forcer une recréation, supprimez le compte admin :
```sql
DELETE FROM users WHERE role = 'SYSTEM_ADMIN';
-- Puis redémarrez Railway → le compte est recréé avec Christian.DENMEKO / Admin@2026!
```

### Voir tous les tickets
```sql
SELECT t.ref, t.status, t.urgency, t.category,
       u.email as client, t.created_at
FROM tickets t
JOIN users u ON t.client_id = u.id
ORDER BY t.created_at DESC
LIMIT 50;
```

### Compter les tickets par statut
```sql
SELECT status, COUNT(*) as nombre
FROM tickets
GROUP BY status;
```

### Voir les notes de satisfaction
```sql
SELECT t.ref, u.email as client, r.score, r.comment, r.created_at
FROM satisfaction_ratings r
JOIN tickets t ON r.ticket_id = t.id
JOIN users u ON r.client_id = u.id
ORDER BY r.created_at DESC;
```

### Voir les notifications non lues d'un utilisateur
```sql
SELECT n.type, n.title, n.message, n.created_at
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE u.username = 'nom_utilisateur' AND n.is_read = false
ORDER BY n.created_at DESC;
```

---

## Contacts importants

| Service | URL de connexion |
|---------|-----------------|
| Code source | github.com/christian12-cell/Eolis_Connect |
| Backend | railway.app |
| Frontend | vercel.com |
| Base de données | console.neon.tech |
| CDN/DNS | cloudflare.com |
| Domaine | namecheap.com |
| API docs | eolisconnect-production.up.railway.app/docs |
| App live | eolisconnect.online |
