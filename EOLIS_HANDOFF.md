# EOLIS CONNECT — Handoff ultra-complet (tout le projet)

> **Fichier à lire en premier dans chaque nouvelle conversation.**
> Couvre 100% du projet : client PWA, interface agent, ops, admin, backend, bugs, tâches restantes.
> Dernière mise à jour : 2026-05-09

---

## 1. CONTEXTE GÉNÉRAL

**Eolis Connect** est une plateforme web/PWA de gestion des demandes clients pour **Eolis Cameroun**, société de logistique spécialisée dans le shipping de containers maritimes.

- **Maître d'ouvrage** : Christian Denmeko (l'utilisateur avec qui tu travailles)
- **Utilisatrice principale** : Debora (sœur de Christian), en stage chez Eolis Cameroun — utilise le côté ops/admin/agent
- **Développement** : 100% guidé par Claude Code avec Christian
- **Statut** : En développement actif, pas encore en production

### Problème résolu
Eolis Cameroun gère ses demandes clients manuellement (WhatsApp, appels). Eolis Connect remplace ça avec un système de tickets structuré, avec suivi, messagerie, pièces jointes, et analytics.

---

## 2. STACK TECHNIQUE

| Couche | Tech |
|--------|------|
| Frontend | Next.js 16.2.5 (App Router, Turbopack, `'use client'` partout) |
| Backend | FastAPI (Python) + PostgreSQL (Neon, région EU-West-2) |
| Auth | JWT dans localStorage (`eolis_token`, `eolis_user`) |
| i18n | next-intl 4.11.0 — FR / EN sur toutes les pages |
| UI | Tailwind CSS 4, Lucide icons, Recharts (graphiques) |
| PDF scan | jsPDF 4.2.1 (scanner documents → PDF) |
| Email | Zoho SMTP (`smtp.zoho.eu:587`, STARTTLS) |
| SMS | Twilio (⚠️ non fonctionnel actuellement) |

### Répertoires
```
EolisProject/
├── eolis-connect/     ← Frontend Next.js
└── eolis-api/         ← Backend FastAPI
```

### Commandes de lancement
```bash
# Frontend (port 3000)
cd "C:\Users\Denmeko Dieu-Veille\Downloads\EolisProject\eolis-connect"
npm run dev

# Backend (port 8000)
cd "C:\Users\Denmeko Dieu-Veille\Downloads\EolisProject\eolis-api"
uvicorn app.main:app --reload --port 8000
```

### Check TypeScript (après chaque modif importante)
```bash
cd "C:\Users\Denmeko Dieu-Veille\Downloads\EolisProject\eolis-connect"
npx tsc --noEmit
# → aucune sortie = aucune erreur
```

---

## 3. RÔLES UTILISATEURS

| Rôle | Description | Interface |
|------|-------------|-----------|
| `CLIENT` | Clients Eolis qui soumettent des demandes | PWA mobile (`/(client)/`) |
| `AGENT` | Agents support qui traitent les dossiers | Web desktop (`/(agent)/`) |
| `OPS_ADMIN` | Responsables opérationnels, analytics | Web desktop (`/(ops)/`) |
| `SYSTEM_ADMIN` | Admin système, gestion utilisateurs | Web desktop (`/(admin)/`) |

### Workflow ticket
```
PENDING → (agent prend en charge) → IN_PROGRESS → (agent clôt) → CLOSED
```
- Urgence : **URGENT** / **HIGH** / **MEDIUM** — calculée automatiquement, jamais montrée au client
- Satisfaction : le client peut noter après clôture (facultatif)

---

## 4. BACKEND — `eolis-api/`

### Fichiers clés
```
app/
├── main.py           → Point d'entrée, CORS, migrations startup auto
├── models.py         → SQLAlchemy ORM (Ticket, User, Message, Attachment, etc.)
├── schemas.py        → Pydantic (camelCase via alias_generator=to_camel)
├── config.py         → Settings (DB_URL, JWT_SECRET, MAIL_*, TWILIO_*)
├── database.py       → Engine SQLAlchemy + get_db()
├── deps.py           → get_current_user(), require_roles()
├── security.py       → Hachage password, création/vérification JWT
├── email_service.py  → Emails automatiques (smtplib Zoho)
├── sms_service.py    → Twilio SMS (⚠️ non fonctionnel)
└── routers/
    ├── auth.py          → Login, register, check-username, me
    ├── otp.py           → Envoi/vérification OTP téléphone
    ├── tickets.py       → CRUD tickets + changement statut
    ├── messages.py      → Messagerie par ticket
    ├── notifications.py → Notifications utilisateur
    ├── ratings.py       → Notes de satisfaction
    ├── users.py         → Gestion profils + admin users
    ├── faq.py           → Contenu FAQ localisé
    ├── admin_logs.py    → Logs audit (SYSTEM_ADMIN seulement)
    └── attachments.py   → Upload / download pièces jointes
```

### Modèle Ticket — champs complets
```python
class Ticket(Base):
    id: str (UUID)
    ref: str              # "REF-2026-0001" — unique, généré auto
    client_id: str
    agent_id: str | None
    category: str         # "Livraison", "Facturation", "Dossier", "Information", "Autre"
    subcategory: str | None
    equipment_type: Text  # TEXT (pas VARCHAR!) — peut être long pour multi-conteneurs
    ship_line: str | None
    ship_name: str | None
    voyage_number: str | None
    ship_date: str | None
    code: str | None      # N° BL / Code dossier (ajouté récemment)
    description: Text
    urgency: str          # "URGENT" | "HIGH" | "MEDIUM" — auto, jamais saisi par client
    status: str           # "PENDING" | "IN_PROGRESS" | "CLOSED"
    created_at, updated_at, taken_at, closed_at
```

### Migrations startup automatiques (main.py)
À chaque démarrage du serveur, ces ALTER TABLE s'exécutent :
```python
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE
ALTER TABLE tickets ALTER COLUMN equipment_type TYPE TEXT
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS code VARCHAR(100)
```

### Emails automatiques (email_service.py + Zoho)
```
SMTP       : smtp.zoho.eu:587 (STARTTLS)
Expéditeur : noreply@containeriq.app  /  mot de passe : E3y196QHk9HE
Support    : support@containeriq.app
Admin      : admin@containeriq.app
```
Déclenchés sur : création ticket, assignation agent, clôture, approbation/rejet compte

### API endpoints importants
```
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me
POST /api/auth/otp/send      → envoie SMS OTP (Twilio)
POST /api/auth/otp/verify    → vérifie OTP
POST /api/auth/forgot-password
POST /api/auth/reset-password

GET  /api/tickets            → liste (filtrée par rôle)
POST /api/tickets            → créer ticket (CLIENT only)
GET  /api/tickets/{id}
PATCH /api/tickets/{id}      → assigner agent, changer statut

GET  /api/tickets/{id}/messages
POST /api/tickets/{id}/messages

GET  /api/notifications
POST /api/notifications/read-all

POST /api/tickets/{id}/attachments   → upload fichiers
GET  /api/attachments/{id}/download

GET  /api/users              → liste (OPS_ADMIN / SYSTEM_ADMIN)
GET  /api/users/me
PATCH /api/users/me          → modifier profil (first_name, last_name, email, phone, language)
PATCH /api/users/me/password
PATCH /api/users/{id}        → admin : approuver / rejeter / suspendre

GET  /api/admin/logs?page=1&page_size=20
GET  /api/faq?locale=fr
POST /api/ratings
```

---

## 5. FRONTEND — Structure complète `eolis-connect/src/`

### Layout general
```
src/
├── app/
│   └── [locale]/
│       ├── (auth)/        → Pages publiques (login, register, forgot-password, reset-password)
│       ├── (client)/      → PWA mobile clients
│       ├── (agent)/       → Interface web agents
│       ├── (ops)/         → Interface web OPS_ADMIN
│       └── (admin)/       → Interface web SYSTEM_ADMIN
├── components/
│   ├── layout/
│   │   ├── MobileLayout.tsx      → Layout PWA mobile (clients)
│   │   ├── BottomNav.tsx         → Navigation bottom 5 tabs (clients)
│   │   ├── DashboardLayout.tsx   → Layout web desktop (agent/ops/admin)
│   │   └── Sidebar.tsx           → Sidebar rôle-adaptatif (agent/ops/admin)
│   ├── scanner/
│   │   └── ScannerModal.tsx      → Scanner document → PDF
│   └── ui/
│       ├── badge.tsx             → StatusBadge, UrgencyBadge
│       └── card.tsx              → StatCard, etc.
├── lib/
│   ├── api-client.ts    → getUser(), apiFetch(), apiUpload(), saveSession()
│   └── utils.ts         → formatDate(), getUrgency(), timeAgo()
└── i18n/
    └── routing.ts       → Locales FR / EN
```

### Règles critiques Next.js 16
1. **Toutes les pages = `'use client'`** (auth via localStorage, pas de server components)
2. **`params` = Promise** → `params.then(p => setLocale(p.locale))`
3. Toujours `'use client'` en tout premier dans le fichier
4. Auth = `getUser()` depuis `api-client.ts`, jamais de cookies/session serveur

### Couleurs Eolis
```css
--navy   : #1B3A5C   /* primaire */
--blue   : #4A8FC4   /* accent */
--brown  : #8B5A2B   /* secondaire */
--bg     : #EDF1F7   /* fond pages */
--chat-agent : #D6E7F5  /* bulles messages agent */
```

---

## 6. PWA CLIENT — Détail complet `/(client)/`

### Pages
| Page | Fichier | État |
|------|---------|------|
| Accueil | `accueil/page.tsx` | ✅ Stats + CTA + activité récente |
| Mes demandes | `mes-demandes/page.tsx` | ✅ Liste + filtre statut |
| Détail dossier | `mes-demandes/[id]/page.tsx` | ✅ Chat + ship details + satisfaction |
| Nouvelle demande | `nouvelle-demande/page.tsx` | ✅ Flow 5 étapes (voir §7) |
| Notifications | `notifications/page.tsx` | ✅ Liste + mark-all-read |
| Paramètres | `parametres/page.tsx` | ✅ Profil + OTP + langue + page démarrage |

### Notes importantes
- Urgence **jamais affichée** côté client comme tu peux deja le voir 
- Login redirige vers `eolis_fav_page` (localStorage) pour les CLIENTs
- Chat : navy = client, `#D6E7F5` = agent
- `satisfactionRating` : facultatif, proposé après clôture, une seule fois

---

## 7. FLOW "NOUVELLE DEMANDE" — Détail ultra-complet

**Fichier** : `src/app/[locale]/(client)/nouvelle-demande/page.tsx`

### 5 étapes
```
Catégorie → Équipement → Logistique → Description → Récapitulatif
```

### Interfaces TypeScript
```typescript
interface FormState {
  category, categoryOther, subcategory, subcategoryOther,
  equipmentType, equipmentOther,
  shipLine, shipName, voyageNumber, shipDate,
  code,        // N° BL / Code dossier
  description
}

interface ContainerEntry { id, type, typeOther, qty, number }

interface VesselBlock {
  id, shipLine, shipName, voyageNumber, shipDate,
  description, files: File[], previews: string[]
}
```

### États clés
```typescript
mode: 'simple' | 'multi'         // mode conteneur unique ou multi
containers: ContainerEntry[]      // liste des conteneurs (mode multi)
sameVessel: boolean | null        // tous sur le même navire ?
vessels: VesselBlock[]            // blocs navires si navires distincts
sameSituation: boolean | null     // même situation pour tous ?
openRecap: Record<string, bool>   // accordéon du récap (cat/equip/log/desc)
```

### Logique centrale
```typescript
const isMultiSeparate = mode === 'multi' && sameVessel === false
// → active les blocs de navires séparés en logistique ET description
```

### Format equipment_type stocké en DB
```
Simple    : "20 pieds"
Multi     : "MULTI — même navire : 2× 20 pieds [ABCU1234] | 1× 40 pieds"
Distincts : "MULTI — navires distincts : 2× 20 pieds | 1× 40 pieds"
```
⚠️ Colonne `TEXT` (pas VARCHAR) car peut dépasser 100 caractères → bug 500 corrigé

### Format description multi-navires
```
Navire 1 — MSC MAYA :
Description de la situation pour ce navire...

Navire 2 — CMA SAIGON :
Description de la situation pour ce navire...
```
(Pas de `=== ===`, format propre et lisible par l'agent)

### ⚠️ Règle critique : sous-composants au niveau MODULE
```typescript
// TOUJOURS définis AVANT le export default function NouvelleDemandePage(...)
// Si définis INSIDE le composant → React les recrée à chaque render
// → unmount/remount → perte de focus à chaque frappe dans les inputs

function LogisticsFields({ sl, sn, vn, sd, onChange, lbl: LogisticsLabels }) {}
function FilePreviews({ prevs, fls, onRemove, dark?: boolean }) {}
function RecapPreviews({ prevs, fls, noDoc, filesAdded }) {}
function RecapSection({ title, isOpen, onToggle, children }) {}
```

### Récap : accordéon collapsible
- Sections : Catégorie / Équipement / Logistique / Description+Documents
- Toutes ouvertes par défaut
- Equipment multi : badges navy `qty×` + numéro ISO en monospace
- Logistique : si code BL présent → affiché en highlighted card
- Description multi-navires : blocs par navire avec header coloré

---

## 8. SCANNER MODAL — `src/components/scanner/ScannerModal.tsx`

### Phases
```
'camera' → capture → 'preview' → confirm → PDF → onScan(file)
```

### Fonctionnement
1. **Phase `camera`** : `getUserMedia()`, overlay guide document (box-shadow cutout trick), animation scan line CSS keyframe, bouton capture
2. **Phase `preview`** : image grayscale + contraste, nom de fichier éditable (click → input, Enter/blur → confirm), boutons Reprendre / Utiliser

### Traitement image (Canvas)
```typescript
// Grayscale + boost contraste 1.8×
const gray = 0.299 * R + 0.587 * G + 0.114 * B
const c = Math.max(0, Math.min(255, (gray - 128) * 1.8 + 128))
```

### Fix critique : retake (caméra noire)
```typescript
// Sans ce useEffect, le nouveau video element monté n'a pas le stream
useEffect(() => {
  if (phase !== 'camera') return
  const video = videoRef.current
  const stream = streamRef.current
  if (video && stream) {
    video.srcObject = stream
    video.play().catch(() => {})
  }
}, [phase])
```

### Output
- jsPDF avec `hotfixes: ['px_scaling']`
- Retourne `File` (.pdf) via `onScan(file)`

---

## 9. INTERFACE AGENT — `/(agent)/`

### Pages
| Page | Fichier | État |
|------|---------|------|
| Dashboard | `agent/dashboard/page.tsx` | ✅ Fonctionnel |
| Détail dossier | `agent/dossiers/[id]/page.tsx` | ✅ Fonctionnel (à redesigner) |
| Historique | `agent/historique/page.tsx` | ✅ Fonctionnel |

### Agent Dashboard — ce qui est fait
- Queue de tickets (filtre urgence + recherche)
- Stats : en attente / en cours / traités aujourd'hui
- Bannière d'alerte si message non lu depuis > 1h et envoie d'un sms a l agent pour lui dire que tel client dont vous etiez responsable du dossier n as vu la reponse finale ....
- Tri par priorité d'urgence

### Agent Dossier Detail — ce qui est fait
- Infos ticket (urgence, statut, catégorie, équipement)
- Infos logistiques (ship line, ship name, voyage, date)
- Infos client + bouton appel (lien `tel://`)
- Thread de messages
- Délègue les actions à `AgentTicketActions` (composant à vérifier)

### Agent Historique — ce qui est fait
- Dossiers traités par cet agent
- Score de satisfaction moyen
- Étoiles par ticket

### ⚠️ CE QUI RESTE À FAIRE pour l'agent (priorité haute)
L'interface agent actuelle est basique. Le redesign complet voulu :
- **Chat coloré** : navy = agent, `#D6E7F5` = client (comme côté client)
- **Notes internes** : section séparée des messages client, visible agents/ops seulement, badge différent
- **Demande de documents** : agent peut envoyer une demande formelle (bouton dédié → message spécial type "document_request" → client reçoit notification et peut uploader dans son dossier)
- **Affichage multi-conteneurs** : parser et afficher proprement `equipment_type` qui commence par `"MULTI"` (voir §7 pour le format)
- **Affichage code BL** : montrer le champ `code` dans les ship details
- **Bouton prise en charge** et **clôture** bien visibles et distincts
- **Redesign général** : plus moderne, hiérarchie visuelle claire

---

## 10. INTERFACE OPS ADMIN — `/(ops)/`

### Pages
| Page | Fichier | État |
|------|---------|------|
| Dashboard | `ops/dashboard/page.tsx` | ✅ Fonctionnel |
| Performances | `ops/performances/page.tsx` | ✅ Fonctionnel |
| Classement | `ops/classement/page.tsx` | ✅ Fonctionnel |

### OPS Dashboard — ce qui est fait
- Stats globales : total tickets, temps moyen résolution (heures), score satisfaction moyen, tickets ce mois
- Tableau agents : nom, tickets traités, temps moyen, score moyen
- Données 7 derniers jours (courbe quotidienne)
- Distribution catégories + urgences
- Délègue les graphiques à `OpsDashboardCharts`

### OPS Performances — ce qui est fait
- Sélecteur période (semaine / mois / 3 mois)
- Tableau comparatif agents : traités, temps moyen, score, décomposition par urgence
- Commentaires satisfaction (10 plus récents)
- Délègue à `AgentPerformanceCharts`

### OPS Classement — ce qui est fait
- Score composite : 70% volume traité + 30% satisfaction moyenne
- Podium top 3 avec médailles
- Sélecteur période
- Tableau complet avec badges

### ⚠️ CE QUI RESTE À FAIRE pour OPS
- **Filtres avancés** sur le dashboard : par catégorie, par agent, par période personnalisée
- **Graphiques plus riches** : tendances, comparaison périodes N vs N-1
- **Export données** (CSV ou PDF du rapport)
- **Alertes** : tickets bloqués depuis X jours, agents en surcharge

---

## 11. INTERFACE ADMIN — `/(admin)/`

### Pages
| Page | Fichier | État |
|------|---------|------|
| Dashboard | `admin/dashboard/page.tsx` | ✅ Fonctionnel |
| Utilisateurs | `admin/utilisateurs/page.tsx` | ✅ Fonctionnel |
| Logs | `admin/logs/page.tsx` | ✅ Fonctionnel |
| Système | `admin/systeme/page.tsx` | ✅ Fonctionnel |

### Admin Dashboard — ce qui est fait
- Stats : total users, comptes en attente, répartition par rôle
- Section comptes en attente (délègue à `AdminPendingAccounts`)
- Logs récents (10 derniers)

### Admin Utilisateurs — ce qui est fait
- Liste tous les utilisateurs
- Recherche par nom / email
- Pagination (15 par page)
- Actions via `UsersTable` composant (approuver / rejeter / suspendre / modifier rôle)

### Admin Logs — ce qui est fait
- Logs paginés (20 par page)
- Filtrable par type d'action
- Badges colorés par action
- Affiche action, entité, utilisateur, date/heure

### Admin Système — ce qui est fait
- Horloge système en temps réel (mise à jour 1 seconde)
- Sélecteur fuseau horaire (15 fuseaux, défaut : Africa/Douala)
- Sauvegarde timezone en localStorage
- Feature SMS test (stub → endpoint `/api/users/admin/test-sms`)

### ⚠️ CE QUI RESTE À FAIRE pour Admin
- **Création manuelle d'agent/ops** : formulaire admin pour créer des comptes staff directement (sans passer par register)
- **Modification rôle** : changer le rôle d'un utilisateur existant
- **Suspension / réactivation** compte plus explicite
- **Stats email** : combien d'emails envoyés, taux de livraison

---

## 12. LAYOUT WEB (Agent/Ops/Admin)

### DashboardLayout (`components/layout/DashboardLayout.tsx`)
- Layout deux colonnes : sidebar fixe gauche + contenu principal
- Navbar en haut avec profil utilisateur + déconnexion
- Responsive : sidebar drawer en mobile, fixe en desktop
- Support image de fond

### Sidebar (`components/layout/Sidebar.tsx`)
Menu dynamique selon le rôle :

**AGENT** :
- Dashboard (queue tickets)
- Mes dossiers (en cours)
- Historique (traités)
- Paramètres

**OPS_ADMIN** :
- Vue d'ensemble (dashboard)
- Tickets (toute la queue)
- Performances agents
- Classement
- Paramètres

**SYSTEM_ADMIN** :
- Dashboard
- Tickets
- Utilisateurs
- Logs
- Performances
- Classement
- Système
- Paramètres

---

## 13. COMPTES DE TEST

| Username | Password | Rôle |
|----------|----------|------|
| Christian.DENMEKO | Admin@2026! | SYSTEM_ADMIN |
| Debora.DENMEKO | Ops@2026! | OPS_ADMIN |
| Jean.MBARGA | Agent@2026! | AGENT |
| Marie.NGUEMA | Agent@2026! | AGENT |
| Thomas.KAMGA | Client@2026! | CLIENT (FR) |
| Alice.FONO | Client@2026! | CLIENT (EN) |

⚠️ Vérifier en DB si Admin@2026! a été modifié.

---

## 14. BUGS CONNUS

### 🔴 Bug 1 : SMS Twilio non reçus
- OTP par SMS non reçus côté client
- Twilio configuré dans `sms_service.py` et `config.py`
- Possible : numéro non vérifié pour région Cameroun, ou crédits Twilio insuffisants
- **Workaround actuel** : vérification téléphone inopérante en prod

### 🟡 Bug 2 : Affichage multi-conteneurs dans le détail dossier (côté client)
- `mes-demandes/[id]/page.tsx` affiche `equipment_type` brut au lieu d'un beau rendu
- Ex affiché : `"MULTI — navires distincts : 2× 20 pieds [ABCU1234] | 1× 40 pieds"`
- **À faire** : même rendu visuel que le récap de nouvelle-demande (badges, cartes)
- Idem pour la description multi-navires (détecter les headers et les afficher en blocs)
- Idem pour le champ `code` (N° BL) → à afficher dans les ship details

### 🟡 Bug 3 : Affichage multi-conteneurs côté agent
- Même problème : `agent/dossiers/[id]/page.tsx` affiche les champs bruts

---

## 15. TOUTES LES TÂCHES RESTANTES

### 🔴 Priorité 1 — Affichage multi-conteneurs (client + agent)

**Fichiers** :
- `src/app/[locale]/(client)/mes-demandes/[id]/page.tsx`
- `src/app/[locale]/(agent)/agent/dossiers/[id]/page.tsx`

**Ce qu'il faut faire** :
1. Détecter si `ticket.equipmentType` commence par `"MULTI"`
2. Parser la chaîne : `"MULTI — même navire : 2× 20 pieds [ABCU1234] | 1× 40 pieds"`
   - Extraire la partie navire (même / distincts)
   - Extraire chaque conteneur : qty, type, numéro ISO
3. Afficher comme dans le récap de nouvelle-demande :
   - Chaque conteneur = ligne avec badge navy `qty×` + type + numéro ISO monospace
   - Badge coloré "même navire" (vert) ou "navires distincts" (bleu)
4. Parser la description multi-navires (détecter les `"Navire 1 — NOM :\n"`) et afficher en blocs séparés avec header coloré
5. Afficher le champ `ticket.code` (N° BL) dans les ship details si présent

---

### 🔴 Priorité 2 — Redesign interface agent

**Fichier** : `src/app/[locale]/(agent)/agent/dossiers/[id]/page.tsx`

**Ce qu'il faut faire** :
1. **Chat** : bulles colorées (navy pour l'agent, `#D6E7F5` pour le client, idem PWA client)
2. **Notes internes** :
   - Nouveau type de message : `sender_type = "INTERNAL_NOTE"`
   - Non visible côté client
   - Badge "Note interne" distinctif (couleur dorée/orange)
   - Bouton séparé "Ajouter une note" dans l'interface agent
   - Backend : le router messages doit filtrer les INTERNAL_NOTE pour les clients
3. **Demande de documents** :
   - Bouton "Demander un document" dans l'interface agent
   - Envoie un message spécial type "DOCUMENT_REQUEST" avec description du document requis
   - Le client voit une notification + dans son dossier une section "Documents demandés"
   - Le client peut uploader directement en réponse
4. **Boutons d'action** : prise en charge (si PENDING) et clôture (si IN_PROGRESS) visibles et distincts
5. **Affichage beau de l'équipement** et du code BL (voir priorité 1)

---

### 🔴 Priorité 3 — Notes internes (backend)

**Fichier** : `eolis-api/app/routers/messages.py`

**Ce qu'il faut faire** :
- Ajouter `sender_type = "INTERNAL_NOTE"` comme valeur valide
- Lors de la récupération des messages pour un CLIENT : filtrer les `INTERNAL_NOTE`
- Lors de la récupération pour AGENT/OPS/ADMIN : tout afficher

---

### 🟡 Priorité 4 — Demande de documents (backend)

Si on implémente les demandes de documents formelles :
- Soit un nouveau type de message (`"DOCUMENT_REQUEST"`) avec champ `document_description`
- Soit une nouvelle table `DocumentRequest` (ticket_id, description, status, fulfilled_at)
- Le client voit une UI dédiée dans son dossier pour répondre à la demande

---

### 🟡 Priorité 5 — OPS Dashboard : filtres avancés

**Fichier** : `src/app/[locale]/(ops)/ops/dashboard/page.tsx`

- Filtre par agent (dropdown)
- Filtre par catégorie
- Filtre par période personnalisée (date range)
- Comparaison N vs N-1

---

### 🟡 Priorité 6 — Admin : création manuelle de comptes staff

**Fichiers** : `admin/utilisateurs/page.tsx` + backend `routers/users.py`

- SYSTEM_ADMIN peut créer un compte AGENT ou OPS_ADMIN directement
- Formulaire : prénom, nom, email, rôle, mot de passe temporaire
- Email envoyé automatiquement avec les credentials

---

### 🟡 Priorité 7 — Username pour noms composés africains

**Fichier** : `eolis-api/app/routers/auth.py` (ou là où le username est généré)

- Problème : "Jean-Marie MBARGA" génère un username bizarre
- Fix : prendre seulement le premier prénom (avant tiret ou espace), ex : `Jean.MBARGA`

---

### 🟢 Priorité 8 — OTP SMS (investiguer Twilio)

**Fichiers** : `eolis-api/app/sms_service.py`, `eolis-api/app/config.py`

- Vérifier si le numéro Twilio est approuvé pour la région Cameroun (+237)
- Vérifier les crédits Twilio
- Possible besoin d'un Messaging Service SID au lieu d'un numéro direct
- Alternative : passer à un autre fournisseur SMS (ex: Africa's Talking, spécialisé Afrique)

---

### 🟢 Priorité 9 — Nettoyer la DB en production

- Supprimer les comptes de test
- Retirer le numéro de téléphone de la sœur Debora des OTP de test
- Vérifier qu'aucun mot de passe de test ne reste en prod

---

### 🟢 Priorité 10 — Migration S3 pour fichiers (sur déploiement)

**Fichier** : `eolis-api/app/routers/attachments.py`

- Actuellement : stockage local `eolis-api/uploads/`
- Sur AWS : remplacer par S3 (boto3)
- Variables à ajouter : `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`, `AWS_BUCKET`

---

### 🟢 Priorité 11 — PWA installable (iOS / Android)

- Manifest et service worker déjà en place dans eolis-connect
- Tester l'installation sur device réel
- Vérifier les icônes PWA

---

### 🟢 Priorité 12 — Scan perspective correction

- Actuellement : grayscale + contraste seulement (sans deskewing)
- Pour corriger la perspective/torsion d'un document → nécessiterait OpenCV.js
- Complexe, non prioritaire pour l'instant

---

### 🔵 Futur — Champ "code" par navire (multi-navires distincts)

- Actuellement : un seul champ `code` (N° BL) au niveau du ticket global
- En mode "navires distincts" : chaque navire peut avoir son propre N° BL
- Décision à prendre avec Debora (comment ça marche chez Eolis)
- Si confirmé : ajouter `code` à `VesselBlock`, adapter le backend

---

## 16. DÉCISIONS TECHNIQUES IMPORTANTES (à ne pas oublier)

### Pourquoi `'use client'` partout
Next.js 16 App Router permet les server components mais l'auth est dans localStorage. Impossible d'accéder à localStorage côté serveur. Toutes les pages sont donc client-side.

### Pourquoi les sous-composants doivent être au niveau MODULE
```
Si définis INSIDE le composant parent → React = nouveau type à chaque render
→ unmount/remount à chaque keystroke → perte de focus dans les inputs
TOUJOURS définir les sous-composants React AVANT le export default du composant parent.
```

### Pourquoi equipment_type est TEXT
Multi-conteneurs génère des chaînes longues (ex: 3 conteneurs avec N° ISO). Bug 500 (`value too long for type character varying(100)`) corrigé en passant à TEXT + migration startup.

### Calcul de l'urgence (automatique)
```typescript
// src/lib/utils.ts — getUrgency(category, subcategory)
// URGENT  : "Conteneur bloqué" / "Blocked container"
// HIGH    : "Livraison" / "Delivery"
// MEDIUM  : tout le reste
// → CLIENT ne voit JAMAIS l'urgence dans son interface
```

### Pattern upload fichier par navire (sans collision)
```typescript
const activeVesselRef = useRef<number | null>(null)
function openVesselUpload(vesselId: number) {
  activeVesselRef.current = vesselId  // mémoriser le navire cible
  vesselUploadRef.current?.click()    // ouvrir le file picker
}
// handleVesselUpload lit activeVesselRef.current pour savoir quel navire
```

### Format API (camelCase côté frontend, snake_case côté backend)
Le backend Pydantic utilise `alias_generator=to_camel` → la réponse JSON est en camelCase.
`equipment_type` (Python) → `equipmentType` (JSON/TypeScript).

---

## 17. STRUCTURE DES DONNÉES API

### POST /api/tickets — body envoyé
```json
{
  "category": "Livraison",
  "subcategory": "Conteneur bloqué",
  "equipmentType": "MULTI — même navire : 2× 20 pieds [ABCU1234] | 1× 40 pieds",
  "shipLine": "MSC",
  "shipName": "MSC MAYA",
  "voyageNumber": "VY-2026-001",
  "shipDate": "2026-05-15",
  "code": "BL-2026-XXXX",
  "description": "Le conteneur est bloqué au port depuis...",
  "urgency": "URGENT"
}
```

### GET /api/tickets/:id — réponse
```json
{
  "id": "uuid",
  "ref": "REF-2026-0001",
  "clientId": "uuid",
  "agentId": null,
  "category": "Livraison",
  "subcategory": "Conteneur bloqué",
  "equipmentType": "MULTI — même navire : 2× 20 pieds [ABCU1234]",
  "shipLine": "MSC",
  "shipName": "MSC MAYA",
  "voyageNumber": "VY-2026-001",
  "shipDate": "2026-05-15",
  "code": "BL-2026-XXXX",
  "description": "...",
  "urgency": "URGENT",
  "status": "PENDING",
  "createdAt": "2026-05-09T10:00:00",
  "updatedAt": "...",
  "takenAt": null,
  "closedAt": null,
  "client": { "firstName": "Thomas", "lastName": "KAMGA", "email": "...", "phone": "..." },
  "agent": null,
  "attachments": [{ "id": "...", "filename": "scan.pdf", "mimeType": "application/pdf", "size": 12345 }],
  "satisfactionRating": null
}
```

---

## 18. GUIDE DE DÉMARRAGE RAPIDE — Pour une nouvelle session Claude

### 1. Lire ce fichier en entier
### 2. Identifier la tâche sur laquelle travailler (voir §15)
### 3. Lire les fichiers concernés avant de modifier quoi que ce soit
### 4. Après toute modification frontend → vérifier TypeScript :
```bash
cd "C:\Users\Denmeko Dieu-Veille\Downloads\EolisProject\eolis-connect"
npx tsc --noEmit
```

### Fichiers les plus importants à lire selon la tâche

| Tâche | Fichiers à lire en priorité |
|-------|---------------------------|
| Interface agent | `(agent)/agent/dossiers/[id]/page.tsx` + `(client)/mes-demandes/[id]/page.tsx` |
| Multi-conteneurs display | `(client)/mes-demandes/[id]/page.tsx` + `(client)/nouvelle-demande/page.tsx` |
| Notes internes | `(agent)/agent/dossiers/[id]/page.tsx` + `eolis-api/app/routers/messages.py` |
| OPS filtres | `(ops)/ops/dashboard/page.tsx` |
| Admin utilisateurs | `(admin)/admin/utilisateurs/page.tsx` + `eolis-api/app/routers/users.py` |
| SMS OTP | `eolis-api/app/sms_service.py` + `eolis-api/app/config.py` |

---

## 19. PRÉFÉRENCES DE TRAVAIL (Christian)

- Réponses courtes et directes, pas de blabla
- Il teste lui-même sur smartphone (PWA mobile)
- Sa sœur Debora teste le côté ops/admin
- Il fait confiance au jugement technique de Claude sur les détails d'implémentation
- Il écrit parfois en franglais ou en majuscules quand c'est urgent — c'est normal
- Toujours vérifier TypeScript après une grosse modification
- Ne jamais définir de sous-composants React à l'intérieur d'autres composants (bug focus)
- Pas de commentaires inutiles dans le code, code propre et auto-documenté
